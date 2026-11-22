# 문제가 생겼을 때

증상별로 확인할 순서를 적습니다. 위에서부터 차례로 봅니다. 계정과 비밀의 위치는 [HANDOVER.md](HANDOVER.md)에 있습니다.

## 먼저 볼 곳

1. 저장소 Issues의 "자동 작업 실패: …" (매시간 가동 감시가 사이트, 배틀 함수, DB를 확인합니다).
2. 저장소 Actions 탭의 최근 실행.
3. Supabase 대시보드: 프로젝트가 일시정지(Paused)인지, Database, Reports의 용량, Edge Functions, Logs.

## 사이트가 안 열린다

| 확인 | 조치 |
|---|---|
| `https://league.pokeyonsei.com/version.json`이 열리는가 | 안 열리면 GitHub Pages 또는 DNS. 저장소 Settings, Pages에 커스텀 도메인과 "DNS check successful"이 있는지, Cloudflare의 CNAME `league`가 그대로인지 봅니다 |
| 마지막 배포가 실패했는가 | Actions의 "Deploy to GitHub Pages". 테스트가 실패했으면 배포되지 않고 이전 사이트가 그대로 떠 있습니다 |
| 열리는데 하얀 화면 | 방금 배포한 것이 원인이면 아래 "되돌리기" |

## 저장이 안 된다, 기록이 안 보인다

| 확인 | 조치 |
|---|---|
| Supabase 프로젝트가 Paused | 대시보드에서 Restore. 가동 감시가 매시간 읽으므로 보통은 일어나지 않습니다 |
| 운영자 로그인이 풀림 | 탭을 닫으면 풀립니다. 다시 로그인 |
| "다른 곳에서 먼저 저장했습니다" | 다른 운영자가 같은 것을 고쳤습니다. 새로고침 뒤 다시 |
| `site_data` 저장 실패 | 한 행이 512KB를 넘거나 이미지가 직접 들어간 경우 DB가 거절합니다. 이미지는 링크로 넣습니다 |

## 알림이 안 간다

1. Actions의 "Push sweep"이 15분마다 성공하는가.
2. Supabase Edge Functions, `notify-announcement`의 Logs.
3. 그 기기가 알림을 켰는가 (알림 화면). iOS는 홈 화면에 추가한 앱 안에서만 알림이 됩니다.
4. `VAPID_KEYS`를 바꾸지 않았는가. 바꿨다면 모든 기기가 알림을 다시 켜야 합니다.

## 배틀이 멈춘다, 공식 경기 결과가 안 들어간다

- 경기 시트에 반영 실패 이유가 보이면 **다시 넣기**. 그래도 안 되면 **배틀 무효** 후 승자를 직접 넣습니다(OPERATOR.md 5절).
- 함수 자체가 안 되면 Supabase Edge Functions, `battle`의 Logs. 배포가 꼬였으면 Actions에서 "Deploy functions"를 다시 실행(Run workflow)합니다.
- "배틀 저장 공간이 가득 찼습니다"가 뜨면 끝난 친선 배틀이 한도(5000판)를 채운 것입니다. 끝난 지 오래된 친선 배틀을 지웁니다:
  ```sql
  -- 끝난 지 30일 넘은 친선 배틀만. 공식, 도전의 탑, 진행 중인 판은 건드리지 않습니다.
  delete from public.battles where kind = 'friendly' and status = 'ended' and updated_at < now() - interval '30 days';
  ```
  먼저 같은 조건으로 `select count(*)`를 돌려 몇 판인지 봅니다.

## 되돌리기 (잘못된 배포)

- **사이트**: 문제 커밋을 `git revert <커밋>`으로 되돌려 push합니다. GitHub Pages에는 이전 배포로 돌아가는 버튼이 없습니다.
- **함수**: 같은 revert가 `main`에 들어가면 "Deploy functions"가 이전 코드를 다시 배포합니다. 급하면 Actions에서 그 이전 실행을 Re-run합니다.
- **SQL**: 자동으로 되돌아가지 않습니다. 바꾸기 전 함수 정의는 `docs/db`의 이전 파일이나 `git log -p -- docs/db/<파일>`에 있으니 그 정의를 다시 실행합니다.

## 백업

- 매주 일요일 03시(한국 시간)에 `backup.yml`이 모든 표를 받아 `BACKUP_PASSPHRASE`로 암호화하고, 실행 결과의 Artifacts에 90일 보관합니다.
- 바로 받고 싶으면 Actions, "Weekly backup", Run workflow.
- 90일보다 오래 남길 백업(학기 말, 인수인계 직전)은 내려받아 동아리 공용 드라이브에 둡니다. 암호화된 채로 두면 됩니다.

## 복구

1. Actions, "Weekly backup"의 원하는 실행에서 `ypl-backup` artifact를 내려받아 풉니다.
2. 복호화: `gpg --decrypt ypl-backup-YYYYMMDD.tar.gz.gpg > backup.tar.gz` (암호는 `BACKUP_PASSPHRASE`), `tar -xzf backup.tar.gz`.
3. `backup/<스키마>.<표>.json`이 표 하나의 모든 행입니다. `README.txt`에 표마다 행 수가 있습니다.
4. 되살리는 것은 일부러 손으로 합니다. 지워진 행 몇 개를 살리는 경우가 대부분이므로, 그 JSON에서 필요한 행만 골라 SQL 편집기에서 넣습니다:
   ```sql
   insert into ypl_schema_validation.matches select * from jsonb_populate_recordset(null::ypl_schema_validation.matches, '<JSON 배열>'::jsonb);
   ```
   표 전체를 되돌려야 하면, 먼저 지금 상태를 한 번 더 백업한 뒤 그 표를 비우고 같은 방식으로 넣습니다. 외래 키 때문에 부모 표(seasons, players, events)부터 넣습니다.
5. 백업에는 `auth.users`(로그인 계정)가 없습니다. 계정은 Supabase가 따로 보관하며, 프로젝트를 통째로 잃은 경우가 아니면 필요 없습니다.

학기마다 한 번은 1~3단계를 실제로 해 보고 행 수가 맞는지 봅니다.

## 누가 언제 바꿨나, 지운 공지 되살리기

`docs/db/change_log.sql`을 실행한 뒤부터 대회 기록과 `site_data`(공지, 칭호, 명예의 전당)의 모든 쓰기가 `ypl_audit.change_log`에 남습니다. 운영 화면 아래의 **최근 변경**에서 최근 것을 보고, 자세히는 SQL 편집기에서 봅니다.

```sql
-- 한 경기의 모든 변경 (승자 입력, 정정, 지움)
select at, actor_email, op, old, new from ypl_audit.change_log where table_name = 'matches' and row_id = '<경기 id>' order by at;
-- 지운 공지: 공지가 바뀐 저장들의 이전 공지 목록
select id, at, actor_email, jsonb_array_length(old -> 'announcements') from ypl_audit.change_log
 where table_name = 'site_data' and old ? 'announcements' order by at desc limit 20;
```

지운 공지는 그 저장의 `old -> 'announcements'`에 있습니다. 그 공지 한 개를 찾아 지금 목록에 다시 넣습니다:

```sql
update public.site_data set value = jsonb_set(value, '{announcements}', (value -> 'announcements') || (
  select a from ypl_audit.change_log c, jsonb_array_elements(c.old -> 'announcements') a where c.id = <로그 id> and a ->> 'id' = '<공지 id>'))
 where key = 'ypl_data_v4';
```

되살린 뒤 사이트를 새로고침해 확인합니다. 칭호(`titleGroups`)와 명예의 전당(`champions`)도 같은 방법입니다.

## 랭커 팀 (포켓몬 챔피언스 시즌이 끝났을 때)

도전의 탑의 상대가 배우는 상위 팀 데이터입니다.

```powershell
node scripts/build-ranker-teams.mjs
```

공개된 시즌 파일을 스스로 찾아 넣고(`SEASON_RANGE`), 아직 없는 시즌은 건너뜁니다. 끝나면 `src/data/ranker-teams.json`과 `src/data/tower-tiers.json`이 바뀌니 테스트를 돌리고 커밋, 배포합니다. 출처 사이트가 사라졌으면 지금 커밋된 데이터로 계속 돌아갑니다.

## 레귤레이션 바꾸기

새 레귤레이션이 나오면 한 번에 끝나는 작업이 아닙니다. 순서:

1. `npm run data:champions`로 포켓몬 데이터 갱신(주간 PR이 해 줍니다).
2. 엔진 판올림이 필요하면 아래 "엔진 올리기".
3. 레귤레이션 목록과 샘플 세트: CLAUDE.md 맨 위 명령 목록의 `tune-sets`, `curate-sets`, `render-sample-sets`, `rate-species` 순서. 스크립트 안의 `"m-c"`를 새 이름으로 바꿉니다.
4. `scripts/build-ranker-teams.mjs`의 `SEASON_RANGE`와 `FORMAT`.
5. 테스트 이름에 `RegulationMC`가 들어간 테스트를 새 레귤레이션에 맞춥니다.

## 엔진 올리기 (`@pkmn/sim`, `@pkmn/mods`)

Dependabot은 이 둘을 올리지 않습니다. 직접 올릴 때:

1. `package.json`의 두 버전을 같이 올리고 `npm install`.
2. `npm test`, `npm run build:battle`(번들이 실제로 읽히는지 스스로 확인합니다).
3. `npm run bench:cpu -- --games 300`으로 컴퓨터가 약해지지 않았는지(docs/BATTLE_COMPUTER.md).
4. 진행 중인 배틀은 옛 엔진의 기록으로 다시 읽히므로, 대회가 없는 날 배포합니다.

## 외부 출처

| 출처 | 쓰는 곳 | 끊기면 |
|---|---|---|
| Showdown, PokeAPI | `npm run data:champions` (주간) | 주간 PR이 실패로 알립니다. 사이트는 커밋된 데이터로 계속 돕니다 |
| champs.pokedb.tokyo | 랭커 팀 | 위와 같음 |
| PokeOS 이미지와 울음소리 | `scripts/build-sprites.py`, `build-cries.py` | 결과물이 `public/`에 커밋돼 있어 사이트는 문제없습니다. 새 포켓몬의 그림만 만들 수 없게 되니, 다른 출처를 찾아 스크립트의 주소를 바꿉니다 |

## 개인정보 삭제 요청

`docs/db/account_self.sql`을 실행한 뒤에는 본인이 기록 화면의 내 기록 찾기에서 "기록 연결 해제"와 "계정 삭제"를 직접 할 수 있습니다. 잘못 승인한 연결은 운영 화면의 "연결된 계정"에서 풉니다. 본인이 할 수 없는 요청(예: 계정 없이 이름으로 남은 신청)이 오면:

1. Supabase Authentication, Users에서 그 Google 계정을 지웁니다. 계정 연결(`player_accounts`), 저장한 파티(`account_teams`), 게시판 작성자 연결(`community_authors`)은 같이 지워지고, 배틀 기록의 계정 칸은 비워집니다.
2. 이름으로 남은 신청과 게시글은 화면에서 지우거나(게시판), 신청은 운영자가 정리합니다.
3. 대회 결과(순위, 대진)는 대회 기록이므로 이름을 "탈퇴한 트레이너"처럼 바꾸는 것으로 처리할지 운영진이 정합니다.
4. 처리한 날짜를 요청자에게 알립니다.

## 프로젝트 용량

Database, Reports에서 크기를 봅니다(2026-11-22 기준 28MB, 무료 한도 500MB). 가장 빨리 크는 것은 `battles`와 `battle_secrets`이고, 그다음 `cpu_battles`입니다.
