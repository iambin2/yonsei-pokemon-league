# Visual audit test environment

These scripts render the UI states listed in chapter 12 of `docs/visual-audit/report.md`. Production data is never modified: only GET requests reach production Supabase, while all other requests (RPCs, battle functions, writes) are mocked by the scripts. User and admin sessions are injected into the browser. Playwright loads from the npx cache rather than package dependencies (run `npx playwright --version` once first).

Screenshots save to `docs/visual-audit/shots/<ID>/` (untracked by git). Run commands from each subfolder here; in Git Bash, run `export MSYS_NO_PATHCONV=1` first and append `< /dev/null` to each command.

## Required dev servers

| Port | Command (from repo root) | Used by |
|---|---|---|
| 5193 | `npx vite --mode production --port 5193 --strictPort` (reads production data) | `admin/`, `states/` |
| 5194 | `VITE_SUPABASE_URL=http://localhost:54321 VITE_SUPABASE_ANON_KEY=local VITE_YPL_DATA_SCHEMA=ypl_schema_validation npx vite --port 5194 --strictPort` | `streak/` |
| 54321 | Build `standin/server.mjs` with `python scripts/visual-audit-env/streak/mkserver.py`, then run `node scripts/visual-audit-env/standin/server.mjs .` | `streak/` |

`standin/server.mjs` is a local Supabase stand-in running real `docs/db` SQL on PGlite alongside the real `supabase/functions/battle` function (transpiled with esbuild). Account `11111111-1111-4111-8111-111111111111` is pre-seeded in an approved state. If SQL or function changes break startup, update the load order at the top of `server-base.mjs`.

## Folders

- `states/`: account states, loading/error/empty states, data extremes, and headed Chrome checks.
  - `node account.cjs none pending rejected approved checking long`
  - `node states.cjs 390 844 dark` (to pass site data through and stall only records: `PART=q MODES=hold node states.cjs 1440 900 dark`)
  - `node extremes.cjs long 390 844 dark` (also supports `many` and `zero`), `node manyhome.cjs`, `node shell.cjs`, `node shell08.cjs`, `node headed.cjs`
- `admin/`: operator write flows and tournament-day views.
  - Run `node dump.cjs` first to cache real GET responses into `data/` (this copies production data; delete `data/` when finished and never commit it).
  - `node flow.cjs <fixture> <ID> <WxH> <theme> <admin|visitor> "<url>" <steps...>`. Fixtures are `live` (38회 rewritten as live today), `done`, `step1`, `step2`, and `plain`. Steps can be button text to click, `sel:<selector>`, `wait:<ms>`, `shot:<name>`, or `full:<name>`.
  - Example: `node flow.cjs live ADM-BRK-04 1440x900 dark admin "/?view=bracket&eventId=c34f3629-ad49-4d32-82fb-38d1f989fa13" wait:2500 "M5" shot:decided`
  - `node login.cjs 390x844 dark` (two login errors and session-expired toast)
- `streak/`: `도전의 탑` runs and 2-player battles (requires ports 5194 and 54321).
  - `node t2.cjs` captures a full tower run (team draft, win and loss games, every beat of the break screen).
  - `node t3.cjs` and `node t3b.cjs` cover six rooms, waiting, joining, 2-player battles, spectating, and rematches.
  - `node t4.cjs` records tower transitions at 4x CPU throttle; run `python recsheet.py <dir> <ms>` to build a frame sheet.
  - `node t6.cjs 390 844` logs per-frame card opacity, veil, bars, and scroll on entry; `node t7.cjs` checks viewport overflow causes; `node t8.cjs` checks dock overlap.
  - Starting a fresh tower run requires clicking `새로 도전` and then clicking `새로 도전` again in the confirmation sheet (handled inside `t6` and `t8`).

## Batch 18 (2026-11-23)

Scripts for re-measuring remaining audit items. Override the server URL with the `BASE` environment variable (defaults to 5193). Uses `ypl-audit-prod` (production mode, reading live data) and `ypl-dev-offline` (legacy record editor, T-51) from `.claude/launch.json`. Run `node dump.cjs` once inside `admin/` and delete `data/` afterwards.

- `states/acct2.cjs [390x844-dark ...]`: linked account (`이제빈` approved) covering T-103 account key, T-104 sheet order, T-105, and T-108. `states/t106.cjs` checks the alerts row on `더보기`.
- `states/cls95.cjs <WxH> [cpu]`: measures first-visit home layout shifts, their sources, and ranking section height changes.
- `admin/builder.cjs <WxH> <theme>`: patches `39회 루키` to open submission for T-44 (violation line x) and T-43(c) (name field to error line).
- `admin/home74.cjs <WxH> <theme>`: checks the clock and date row on tournament-day home (T-74).
- `admin/flow.cjs` adds an `eval:<js>` step. Examples: T-19 `node flow.cjs step1 T-19 390x844 dark admin "/?view=news&notice=mgcf6zf" "응답 보기" "eval:..."`, T-69 `step1 ... "/?view=admin"`, admin row `plain ... "/?view=bracket&eventId=c34f3629-ad49-4d32-82fb-38d1f989fa13"`, T-100 `plain T-100 375x667 dark anon "/?view=battle" "배틀 시작" wait:9000 "eval:..."` (CPU battles run in the worker while `lib.cjs` stubs battle functions and writes).

## Batch 20 (2026-11-23)

Scripts for measuring items 20a through 20d. Uses `ypl-audit-prod` (5193) and `ypl-audit-standin` (5194) from `.claude/launch.json`, plus the stand-in backend `node scripts/visual-audit-env/standin/server.mjs .` (54321).

- `states/s20a.cjs <W> <H> <theme> <fail|hold|zero> [home news bracket alerts builder]`: measures error panel count, button width, spacing from previous elements, empty-state copy, and primary keys (T-109 to T-115). `states/b114.cjs` samples the team builder search bar and first home ranking row every 500ms while loading.
- `states/a20b.cjs <WxH> <theme> checking pending approved rejected long linesfail`: measures `내 기록 찾기` list y-offset, account key, `더보기` row height, and top bar spacing (T-116 to T-118). `states/gate119.cjs` checks the tower door sheet (T-119). `states/t120.cjs` checks a long current-champion name (T-120).
- Bracket and admin items (T-122 to T-129) use the `eval:` step in `admin/flow.cjs` (same URLs as the measurements in commit `015cd79`).
- Battle checks: `streak/t6.cjs` checks header tag clipping (`tag`), `streak/t4.cjs` followed by `python streak/cardlum.py streak/rec/next-game` measures card slot luminance (double flash shows as up-down-up), and `streak/t8.cjs` also clicks `다시 도전` when a tower run is already active.
