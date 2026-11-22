# docs/db

운영 데이터베이스(Supabase, 프로젝트 `rqffrogcverfjqzjasax`)를 만드는 SQL입니다. 마이그레이션 도구를 쓰지 않고, 소유자가 Supabase SQL 편집기에서 한 파일씩 실행해 왔습니다. 그래서 "이 파일이 운영에 들어갔는가"는 이 문서의 장부와 `scripts/db-ledger.mjs`로 확인합니다.

## 규칙

- 새 SQL은 이 폴더에 파일로 먼저 쓰고, 로컬에서 `npm run verify:db`(PGlite, Supabase에 접속하지 않음)로 확인한 뒤 운영에서 실행합니다.
- 실행 순서는 CLAUDE.md "Deployment"대로 SQL, 함수, 사이트입니다. SQL이 실행되기 전까지 사이트는 그 기능을 숨깁니다.
- 실행한 날짜를 아래 장부에 적습니다.
- 운영에서 함수를 직접 고쳤다면, `pg_get_functiondef`로 받은 정의를 이 폴더에 파일로 남깁니다(`live_drift_2026_11_22.sql`이 그 예).
- 읽기 전용 확인은 Supabase MCP(읽기 전용)나 SQL 편집기의 select로 합니다.

## 적용 장부 확인

```powershell
node scripts/db-ledger.mjs > ledger.sql
```

`ledger.sql`을 SQL 편집기에 붙여 실행하면 파일마다 함수가 몇 개 운영과 같은지 나옵니다. "→ 다른파일.sql"은 뒤의 파일이 그 함수를 바꾼 것(정상), "≠"는 운영 본문이 어느 파일에도 없는 것(누가 운영에서 직접 고침)입니다.

## 장부 (2026-11-22 대조)

함수 본문을 공백을 빼고 비교했습니다. 표가 없는 파일은 표와 열의 존재로 확인했습니다. "≠"였던 함수 7개는 `live_drift_2026_11_22.sql`로 저장소에 들어와, 지금은 모든 함수가 어느 한 파일과 같습니다.

| 파일 | 처음 커밋 | 상태 |
|---|---|---|
| normalized_schema_v1.sql | 2026-10-16 | 적용됨 (표 존재). 머리의 "DRAFT" 문구는 옛 표시 |
| normalized_bracket_runtime.sql | 2026-10-16 | 적용됨 (표 존재) |
| normalized_bracket_runtime_grants.sql | 2026-10-16 | 적용됨 (권한) |
| normalized_bracket_runtime_rpc.sql | 2026-10-16 | 적용됨 |
| normalized_bracket_runtime_elimination_rpc.sql | 2026-10-16 | 적용됨, `delete_normalized_bracket_runtime`은 운영에서 고쳐짐 (drift 파일) |
| normalized_bracket_winner_rpc.sql | 2026-10-16 | 뒤에 match_outcome.sql이 같은 본문으로 다시 씀 |
| ypl_season_rollover.sql | 2026-10-16 | 적용됨, `ensure_current_ypl_season`은 player_accounts.sql이 바꿈 |
| event_name_constraint.sql | 2026-10-16 | 적용됨 (제약) |
| champions_* 4개 | 2026-10-16 | 적용됨, 일부 함수는 운영에서 고쳐짐 (drift 파일) |
| access_lockdown.sql | 2026-10-16 | 적용됨 |
| team_submission_rpc.sql | 2026-10-16 | 적용됨 |
| legacy_normalized_migration.sql | 2026-10-16 | **한 번만**. 옛 site_data 기록을 정규화 표로 옮긴 이관. 다시 실행하지 않음 |
| announcement_push.sql | 2026-11-01 | 적용됨, 뒤 파일들이 함수 교체 |
| visitor_gates.sql, visitor_gates_close.sql | 2026-11-02 | 적용됨. close는 **한 번만** |
| record_apply_rpc.sql, competition_editions.sql, league_intake.sql, private_bracket_conflict_guard.sql, backend_hardening.sql | 2026-11-02 | 적용됨 |
| match_outcome.sql | 2026-11-02 | 적용됨 (점수, 불참) |
| application_close.sql, player_name_unique.sql, private_answers.sql, champions_direct_recommendation.sql | 2026-11-03 | 적용됨 |
| move_seminar_brackets_to_private.sql | 2026-11-03 | **한 번만**. 데이터 이동 |
| application_edit.sql, battles.sql | 2026-11-04 | 적용됨 |
| battle_links.sql, battle_random_seat.sql, battle_integration.sql, battle_timer.sql | 2026-11-05 | 적용됨, `battle_official_seat`은 운영에서 고쳐짐 (drift 파일) |
| player_accounts.sql, battle_rematch.sql, battle_column_grants.sql, cpu_battles.sql | 2026-11-06 | 적용됨 |
| notice_copy_cleanup.sql | 2026-11-06 | **한 번만**. 공지 문구 정리 |
| battle_rooms.sql, streak_runs.sql | 2026-11-07 | 적용됨 |
| championship_single_qualifier_battle_guard.sql, battle_team_bouts.sql, bracket_format_at_creation.sql, bracket_manual_registration.sql | 2026-11-08 | 적용됨 |
| streak_reset_2026_11.sql | 2026-11-11 | **한 번만, 파괴적**. 도전의 탑 기록을 전부 지움 |
| group_brackets_and_rookie_candidates.sql | 2026-11-13 | 적용됨 |
| account_teams.sql, match_schedule.sql | 2026-11-16 | 적용됨 |
| push_kinds.sql, community_accounts.sql, tower_cups.sql, push_inbox.sql | 2026-11-18~19 | 적용됨 |
| drop_daily_tower.sql | 2026-11-19 | **한 번만**. 오늘의 탑 알림 종류 정리 |
| live_drift_2026_11_22.sql | 2026-11-22 | 운영에서 받은 정의. 운영에 다시 실행해도 바뀌는 것 없음 |

이 날 이후에 추가된 파일은 아래에 한 줄씩 적습니다.

| 파일 | 운영 실행일 | 확인 방법 |
|---|---|---|
| backup_grants.sql | 2026-11-22 | service_role이 두 스키마의 표 41개를 모두 읽음(확인 질의 0). 이어서 돌린 주간 백업이 41개 표를 받아 성공(암호화 1.8MB, 2027-02-20까지 보관) |
| account_self.sql | 2026-11-22 | 함수 3개, 실행 권한(authenticated만), 함수 주인 postgres의 auth.users 삭제 권한을 읽기 전용으로 확인. 방문자(anon) 호출은 거절됨 |
| tower_history.sql | 2026-11-22 | streak_my_runs, streak_month_tops(방문자도 호출, 아직 지난달 기록 없음), tower_archive 표와 보존 트리거를 확인 |
| change_log.sql | 2026-11-22 | ypl_audit 스키마, 20개 표의 log_change 트리거, admin_change_log(운영자만)를 확인. 방문자 호출은 거절됨 |
| battle_records.sql | 2026-11-22 | 열 4개, 트리거 2개, 정리 함수와 pg_cron 작업(매일 한국 04:10), 30일 한도, 난이도 열을 읽기 전용으로 확인. 지난 판 827개 중 끝난 824개에 끝 시각이 채워짐 |
| match_outcome_more.sql | 2026-11-22 | set_normalized_match_outcome 본문에 팀전 처리, match_outcome_more_ready(authenticated 실행), 트리거 battle_applied_mark_forfeit를 읽기 전용으로 확인 |
| handover_features.sql | 2026-11-22 | 함수 15개, 표 6개(entry_departures, client_errors, match_picks, event_checkins, match_reports, community_reports), 정책 5개, battles.paused_left, 새 battle_set_deadline(turnSeconds), pg_cron push-bracket-steps(10분마다), 저장소 버킷 board(공개, 512KB)를 확인. set_match_picks는 anon 실행 불가, report_community_item과 handover_features_ready는 anon 실행 가능(의도대로) |
| third_place_best_of.sql | 2026-11-22 | bracket_runtimes의 열 3개, 함수 4개(set_bracket_rules, sync_third_place_match, set_third_place_winner, bracket_rules_ready), 싱글 승자 RPC의 3위전 맞추기, 삭제 두 함수와 조별 기록 반영 검사의 3위전 키, 점수 RPC의 선승 검사, 배틀 다전제 점수 트리거를 읽기 전용으로 확인 |

## 구조 스냅숏

`schema_snapshot_2026_11_22.sql`은 운영 DB의 표, 열, 제약, 색인, RLS 정책, 트리거, 권한, 함수 서명, 확장, 예약 작업을 읽기 전용 카탈로그 조회로 받아 적은 읽는 파일입니다(실행하지 않음, 함수 본문과 데이터는 없음). match_outcome_more.sql과 handover_features.sql이 실행되기 전의 모습입니다.

## 빈 프로젝트에서 다시 만들 때

순서대로 실행한다는 보장은 시험해 본 적이 없습니다. 위 표의 날짜 순서가 실제로 실행된 순서에 가장 가깝고, "한 번만" 파일은 건너뜁니다. 가장 확실한 방법은 운영 DB의 스키마 덤프입니다.

```powershell
npx supabase db dump --db-url "<운영 DB 주소>" -f schema.sql
```

DB 주소(비밀번호 포함)는 Supabase 대시보드 Settings, Database에 있고 저장소에는 넣지 않습니다. 데이터 복구는 docs/RUNBOOK.md "복구"를 봅니다.

## 운영 DB에만 있는 것

- `ypl_backup` 스키마: SQL을 실행하기 전에 만든 일회성 사본(`site_data_20261005`, `site_data_20261103`, `site_data_20261104`, `event_registrations_20261104`, `site_data_20261106_notice_copy`). 각 파일이 만든 것이며 사이트는 읽지 않습니다. 주간 백업(`.github/workflows/backup.yml`)이 자리 잡은 뒤에는 지워도 됩니다.
- `ypl_schema_validation.title_definitions`, `title_awards`: 정규화 초안이 만든 표로, 지금 사이트는 칭호를 `site_data`에서 읽습니다.
- `public.rls_auto_enable`: Supabase가 만든 함수.
