# 시각 검수 테스트 환경

`docs/visual-audit/report.md` 12장의 상태를 띄운 스크립트들이다. 운영 데이터는 바꾸지 않는다: 운영 Supabase로는 GET만 나가고, 그 밖의 요청(RPC, 배틀 함수, 쓰기)은 스크립트가 직접 답한다. 계정과 관리자는 브라우저에 넣은 가짜 세션이다. Playwright는 의존성이 아니라 npx 캐시에서 불러온다(`npx playwright --version` 한 번).

스크린샷은 `docs/visual-audit/shots/<ID>/` 에 쌓인다(git 밖). 명령은 이 폴더 안의 각 하위 폴더에서, Git Bash라면 `export MSYS_NO_PATHCONV=1` 뒤에, 끝에 `< /dev/null` 을 붙여 실행한다.

## 필요한 개발 서버

| 포트 | 명령 (저장소 루트에서) | 쓰는 곳 |
|---|---|---|
| 5193 | `npx vite --mode production --port 5193 --strictPort` (운영 데이터 읽기) | `admin/`, `states/` |
| 5194 | `VITE_SUPABASE_URL=http://localhost:54321 VITE_SUPABASE_ANON_KEY=local VITE_YPL_DATA_SCHEMA=ypl_schema_validation npx vite --port 5194 --strictPort` | `streak/` |
| 54321 | `python scripts/visual-audit-env/streak/mkserver.py` 로 `standin/server.mjs` 를 만든 뒤 `node scripts/visual-audit-env/standin/server.mjs .` | `streak/` |

`standin/server.mjs` 는 PGlite에 `docs/db` 의 실제 SQL과 `supabase/functions/battle` 의 실제 함수(esbuild로 변환)를 올린 가짜 Supabase다. 계정 `11111111-1111-4111-8111-111111111111` 이 승인된 상태로 들어 있다. SQL이나 함수가 바뀌어 실패하면 `server-base.mjs` 머리의 적재 순서를 고친다.

## 폴더

- `states/` 계정 상태, 로딩·오류·빈 상태, 데이터 극단, 창 있는 Chrome
  - `node account.cjs none pending rejected approved checking long`
  - `node states.cjs 390 844 dark` (사이트 데이터는 통과시키고 기록만 늦추기: `PART=q MODES=hold node states.cjs 1440 900 dark`)
  - `node extremes.cjs long 390 844 dark` (`many`, `zero` 도 있음), `node manyhome.cjs`, `node shell.cjs`, `node shell08.cjs`, `node headed.cjs`
- `admin/` 운영진 쓰기 화면과 대회 당일
  - 먼저 `node dump.cjs` 로 실제 GET 응답을 `data/` 에 받는다(운영 자료의 사본이니 끝나면 지운다. git에 올리지 않는다)
  - `node flow.cjs <자료> <ID> <WxH> <테마> <admin|visitor> "<주소>" <단계...>`. 자료는 `live`(38회를 오늘 진행 중으로 바꾼 것), `done`, `step1`, `step2`, `plain`. 단계는 누를 낱말, `sel:<선택자>`, `wait:<ms>`, `shot:<이름>`, `full:<이름>`
  - 예: `node flow.cjs live ADM-BRK-04 1440x900 dark admin "/?view=bracket&eventId=c34f3629-ad49-4d32-82fb-38d1f989fa13" wait:2500 "M5" shot:decided`
  - `node login.cjs 390x844 dark` (로그인 오류 둘과 만료 토스트)
- `streak/` 도전의 탑 진행과 2인 배틀 (5194와 54321 필요)
  - `node t2.cjs` 탑 한 도전 전체(파티 고르기, 이기고 지는 판, 쉬는 화면의 모든 박자)
  - `node t3.cjs`, `node t3b.cjs` 방 여섯 개, 대기, 참가, 2인 배틀, 관전, 다시하기
  - `node t4.cjs` 탑 전환 녹화(CPU 4배), `python recsheet.py <폴더> <ms>` 로 프레임 시트
  - `node t6.cjs 390 844` 들어갈 때 프레임마다 카드 불투명도, 베일, 막대, 스크롤 기록 / `node t7.cjs` 창보다 긴 원인 / `node t8.cjs` 독 겹침
  - 탑을 새로 시작하려면 "새로 도전"을 누른 뒤 확인 시트의 "새로 도전"을 한 번 더 누른다(t6, t8에 들어 있음)

## 묶음 18 (2026-11-23): 남은 항목을 다시 재는 스크립트

서버 주소는 `BASE` 환경 변수로 바꾼다(기본 5193). `.claude/launch.json` 의 `ypl-audit-prod`(운영 데이터 읽기, production 모드)와 `ypl-dev-offline`(옛 기록 편집기, T-51)을 쓴다. 처음 한 번 `admin/` 에서 `node dump.cjs` (끝나면 `data/` 를 지운다).

- `states/acct2.cjs [390x844-dark ...]` 연동 계정(이제빈 승인): T-103 계정 키, T-104 시트 순서, T-105, T-108. `states/t106.cjs` 더보기의 알림 행.
- `states/cls95.cjs <WxH> [cpu]` 첫 방문 홈의 layout-shift와 출처, 순위 구역의 높이 변화.
- `admin/builder.cjs <WxH> <theme>` 39회 루키를 제출 열림으로 고쳐 T-44(위반 줄 x), T-43(c)(이름 칸 → 오류 줄).
- `admin/home74.cjs <WxH> <theme>` 대회 당일 홈의 시계와 일시 행(T-74).
- `admin/flow.cjs` 에 `eval:<js>` 단계를 더했다. 예: T-19 `node flow.cjs step1 T-19 390x844 dark admin "/?view=news&notice=mgcf6zf" "응답 보기" "eval:..."`, T-69 `step1 ... "/?view=admin"`, 운영 줄 `plain ... "/?view=bracket&eventId=c34f3629-ad49-4d32-82fb-38d1f989fa13"`, T-100 `plain T-100 375x667 dark anon "/?view=battle" "배틀 시작" wait:9000 "eval:..."`(컴퓨터 배틀은 워커에서 돌고 배틀 함수와 쓰기는 lib.cjs가 답한다).
