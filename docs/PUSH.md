# 알림 (Web Push)

공지 하나뿐이던 알림을 종류로 나눈다(2026-11-18). 기기(구독)마다 종류를 켜고 끄고, 개인 알림은 구글 계정에 이어진 기기에만 간다.
DB 원본은 `docs/db/announcement_push.sql`, `docs/db/application_close.sql`(구독 수 한도), `docs/db/push_kinds.sql`이고,
PGlite 검사는 `node scripts/verify-push-db.mjs <pglite dist/index.js>`다.

## 종류

| 종류 | 이름(알림 화면) | 누구에게 | 언제 | 여는 주소 |
| --- | --- | --- | --- | --- |
| `notice` | 공지 | 켠 모두 | 운영진이 새 공지를 올린 직후 | `?view=news&notice=…` |
| `schedule` | 대회 일정 | 켠 모두 | 신청 마감 하루 전 안쪽(한 번), 대회의 대진표가 처음 생긴 뒤, 대회 결과를 기록에 반영한 뒤 | 공지, 그 대회의 대진표 |
| `match` | 내 경기 | 그 경기 상대 출전(팀이면 팀원 모두)의 계정 | 공식 경기의 배틀 방을 먼저 연 선수가 기다리기 시작한 직후 | `?view=battle&event=…&match=…` (제출 비밀번호로 앉는 화면) |
| `match` | 내 경기 | 그 라운드의 경기에 선 출전의 계정 | 라운드 시작 30분 전(bracket_runtimes.round_schedule, 10분마다 pg_cron `push-bracket-steps`, handover_features.sql) | `?view=bracket&eventId=…` |
| `match` | 내 경기 | 아직 파티를 내지 않은 신청자의 계정 | 파티 제출 마감(대회 시작) 하루 전부터(같은 작업) | `?view=builder&eventId=…` |
| `reply` | 내 글의 댓글 | 계정으로 쓴 글과 댓글의 계정 | 계정으로 쓴 글에 댓글이나 대댓글이 달렸을 때(글쓴이에게), 계정으로 쓴 댓글에 대댓글이 달렸을 때(그 댓글쓴이에게). 자기가 쓴 것으로는 보내지 않고, 비밀글의 알림에는 내용을 담지 않는다(`docs/db/community_accounts.sql`) | 그 글 |
| `board` | 게시판 새 글 | 켠 모두 | 지난 게시판 알림 뒤에 공개 글(자유, 샘플, 파티. 비밀글, 댓글, 사설 대진표 제외)이 올라왔을 때 | 글이 하나면 그 글, 여럿이면 `?view=board` |
| `tower` | 도전의 탑 순위 | 앞질린 계정 | 이번 달 도전(오늘의 탑 제외)이 한 판 이겨, 같은 연승에 먼저 닿아 위에 있던 계정을 넘었을 때(2연승부터) | `?view=battle&tab=streak` |
| `record` | 도전의 탑 신기록 | 켠 모두 | 이번 달 도전 하나가 다른 모든 도전의 최고 연승을 넘어선 판(이번 달 1위가 되는 순간, 2연승부터). 1위가 계속 이겨 기록을 늘리는 판은 알리지 않는다 | `?view=battle&tab=streak` |
| `daily` | 오늘의 탑 (2026-11-19 내림, `docs/db/drop_daily_tower.sql`) | 없음 | 화면에서 켤 수 없고, 쌓인 줄은 받을 기기가 없다 | |

- 이미 있던 구독은 `notice`만 받는다(예전과 같다). 새 구독은 `notice`, `match`, `reply`를 받는다. 나머지는 알림 화면에서 켠다.
- `경기 결과 등록`은 대회 결과의 기록 반영(`events.record_applied_at`)으로 읽었다. 경기 하나하나의 승자는 모두에게 보내기에 너무 잦다.
- 게시판의 "내 글의 댓글"은 계정으로 쓴 글과 댓글만이다(2026-11-18, `docs/superpowers/specs/2026-11-18-board-account-replies-design.md`). 비밀번호로 쓴 것은 누가 썼는지 몰라 알리지 않는다.

## 받은 알림 (2026-11-19)

알림 화면(`?view=alerts`)이 지난 7일의 알림을 다시 보여 준다. `docs/db/push_inbox.sql`의 `push_inbox(p_kinds)`가 읽는다.

- 원본은 따로 두지 않는다: `push_outbox`의 줄(7일 뒤 지워진다)과 게시판의 공개 글(글마다 게시판 새 글 한 줄, 비밀글과 댓글 제외).
- 모두에게 가는 줄은 누구나, 개인 줄은 그 계정의 로그인으로만 읽는다. 화면은 이 기기가 받는 종류를, 꺼진 기기는 모든 종류를 묻는다.
- 마지막으로 본 때는 이 기기의 `localStorage`(`ypl-alerts-seen`)에만 둔다. 그 뒤에 온 줄이 새 알림이고, 더보기의 알림 줄에 램프가 켜진다.
- SQL이 실행되기 전의 화면은 받은 알림을 감추고 설정만 보인다(`push_inbox`가 없다는 답).
- 배포: SQL 편집기에서 `docs/db/push_inbox.sql`을 실행한 뒤(여러 번 실행해도 된다) 사이트를 배포한다. 확인: `select proname from pg_proc where proname = 'push_inbox';`

## 계정 잇기

`save_push_subscription`이 저장할 때의 `auth.uid()`를 구독에 적는다. 화면은 구글 로그인 세션(`visitorAuth.js`)으로 부르고, 없으면 익명으로 부른다.
로그인을 바꾼 기기는 알림 화면에 올 때 다시 저장되며 따라간다(로그아웃한 기기는 풀린다). 계정의 트레이너는 `player_accounts`의
승인된 연결이다: 선수(`player_id`)가 같거나, 아직 선수가 없는 새 트레이너면 신청 이름이 계정의 이름과 같은 사람이다.

## 보내는 길

```text
새 공지 저장 ──(운영진 토큰)──▶ notify-announcement { id } ─▶ push_queue_notice ─┐
공식 배틀 방 생성 ─▶ 트리거 push_match_waiting ─▶ push_outbox ◀─────────────────────┤
  └ battle 함수가 바로 notify-announcement { } 를 부른다                              │
도전 연승 +1 ─▶ 트리거 push_tower_passed, push_tower_record ─▶ push_outbox           │
게시판 댓글 ─▶ 트리거 push_community_reply(커밋 때) ─▶ push_outbox                     │
1분마다 pg_cron push-sweep ─▶ notify-announcement { sweep } ─▶ push_take(true) ───────┘
                                         (대회 일정, 오늘의 탑을 줄에 넣고, 게시판을 센다)
push_take 가 줄을 한 번만 꺼내 준다 ─▶ VAPID로 각 기기에 보낸다 ─▶ 404, 410 구독은 지운다
```

- 보내는 함수는 `notify-announcement` 하나다. 무엇을 누구에게 보낼지는 DB가 정한다. 꺼낸 줄은 `taken_at`으로, 게시판과 도전의 탑은 구독의
  마지막 알림 시각으로 잠그므로 누가 몇 번 불러도 같은 알림이 두 번 가지 않는다. 그래서 함수는 로그인 없이 부를 수 있다(공지만 운영진 토큰을 확인한다).
- 트리거는 배틀과 도전의 쓰기를 절대 막지 않는다. 알림을 만들다 실패하면 경고만 남긴다.
- 공식 경기 방이 열린 알림은 배틀 함수가 바로 보낸다. 그 호출이 실패해도 다음 정리(1분 안)가 보낸다.
- 정리는 DB의 pg_cron이 1분마다 부른다(`docs/db/push_cron.sql`, pg_net). GitHub의 `push-sweep.yml`은 15분 예약이었지만 실제로는 6~8시간에
  한 번 돌아(2026-11-18..24) 게시판, 댓글, 라운드 알림이 몇 시간 늦거나 버려졌다. 그 워크플로는 DB 작업이 멈췄을 때의 예비로만 남는다.

## 빈도

- 밤(한국 시각 22시부터 9시 전)에는 `notice`와 `match`만 보낸다. 나머지는 아침 첫 정리까지 기다린다.
- 하루가 지난 줄은 보내지 않고, 7일이 지나면 지운다.
- 게시판: 기기마다 한 시간에 한 번까지. 그사이의 글은 다음 알림에 "첫 글 외 2개"처럼 묶인다. 게시판을 새로 켜면 그때부터 센다.
- 도전의 탑: 기기마다 6시간에 한 번까지. 그사이에 또 앞질려도 보내지 않는다(순위는 화면에서 본다).
- 같은 사실은 한 번만: 공지 id, 신청서와 마감 시각, 대회의 첫 대진표, 대회의 결과 반영(취소 뒤 다시 반영해도 한 번), 날짜마다 오늘의 탑, 배틀과 받는 계정.

## 배포 순서 (운영진이 할 일)

1. Supabase SQL 편집기에서 `docs/db/push_kinds.sql`을 한 번 실행한다(여러 번 실행해도 된다). 실행 뒤 읽기로 확인:
   `select kinds, count(*) from public.push_subscriptions group by 1;` 가 모두 `{notice}`이고, `select proname from pg_proc where proname like 'push_%';`에
   `push_settings, push_take, push_queue_notice, push_match_waiting, push_tower_passed, push_closes_at`이 있다.
   게시판의 계정 쓰기와 답의 알림은 그다음 `docs/db/community_accounts.sql`(역시 여러 번 실행해도 된다).
2. 함수 둘을 배포한다.
   - `npx supabase functions deploy notify-announcement --use-api --no-verify-jwt --project-ref rqffrogcverfjqzjasax`
     (`--no-verify-jwt`가 새로 필요하다. `VAPID_KEYS` 비밀값은 그대로 둔다.)
   - `npm run build:battle` 다음 `npx supabase functions deploy battle --use-api --no-verify-jwt --project-ref rqffrogcverfjqzjasax`
3. 사이트를 배포한다. 같은 푸시로 `.github/workflows/push-sweep.yml`이 main에 들어가 15분마다 돈다(비밀값 필요 없음, `.env.production`의 공개 키를 쓴다).

SQL이 실행되기 전의 사이트는 종류 스위치를 감추고 예전처럼 공지 알림 하나만 보인다(`push_settings`가 없다는 답). 함수를 먼저 배포하면
SQL이 없어 공지 발송이 실패하므로 순서를 지킨다.

## 아직 모르는 것

- 실제 폰(안드로이드 Chrome, 홈 화면의 iOS)에서 종류별 알림이 닿는지는 이 저장소에서 확인할 수 없다. 배포 뒤 알림 화면에서 종류를 켜고 확인한다.
- `push_take`는 PostgREST가 한 번에 돌려주는 1000줄까지다. 구독이 수백을 넘으면 나눠 꺼내야 한다.
