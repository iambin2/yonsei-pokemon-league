# Battle streak design

Starting 2026-11-09, the UI name is 도전의 탑 (user: "이름은 도전의 탑으로 가자"). This document, the code, and the database (`kind` `streak`, `streak_runs`) keep the original streak naming.

Drafted 2026-11-07 after committee feedback asking for mainline PWT-style content and live rankings. Phase 0 benchmarks passed (Chapter 4); phases 1 onward were still pending at draft time.

## 1. Summary

A signed-in trainer plays consecutive random battles against the computer, and their record is the number of wins before losing. Each month ranks accounts by their highest streak. Both the battle engine and the computer run on the server.

## 2. Streaks instead of points

- Elo ratings do not work against a computer of fixed strength. Simple "+n per win" points scale linearly with games played, ranking playtime rather than skill.
- Streaks shrink the effect of volume logarithmically. Across N attempts at win rate p, the expected best streak is roughly `log N / log(1/p)`. At 80% win rate, 10 runs yield about a 10-win streak and 100 runs yield about 21; at 90%, 10 runs already yield about 22. Playing 10x more games equals a 10 percentage point gain in win rate.
- At club scale, too few members are online at once for a PvP points ladder to match reliably. Solo play against the computer is always available.
- A streak fits the site's visual language: one figure for the streak count and one amber mark for an active run (`DESIGN.md` "Figures", "Marks"; until 2026-11-24 these were a 7-segment display and a lamp). Mainline BP is a spendable currency rather than a ranking metric, and we have nothing to spend it on.

## 3. Fairness safeguards

Regular computer battles run on the client and upload only the input log on completion (`record`, `readCpuRecord`). The server replays the log to check team legality and completion. Adding a leaderboard exposes all of the gaps below.

| Gap | Regular computer battle | Streak mode |
|---|---|---|
| Rerolling teams or seeds until satisfied | Client generates them (`cpu.worker.js` `start`) | Server generates them per match |
| Seed peeking to pre-simulate crits and misses | Client knows the seed | Seed stays in `battle_secrets` only |
| Forging computer moves to make it throw | Server cannot verify computer choices | Computer picks moves on the server |
| Closing the tab on a losing match and retrying | Client simply skips uploading the log | Match lives on the server; 90-second timer (`battle_timer.sql`) counts as a loss |
| Hardware variance (in 1.4 s an idle desktop averages 14 samples vs ~1 on phones; strength gap is small per Chapter 4, but rankings need an identical opponent) | Varies by device | Server uses the same time budget for everyone |
| One person submitting under multiple names | Free-text name | Only approved trainer names tied to Google accounts appear on the leaderboard (`player_accounts.sql`) |

Streak matches therefore follow the same path as room battles (casual and official): rows in `battles` and `battle_secrets`, seat-token submissions, and engine execution solely inside the battle edge function. The only difference is that the server-side computer fills seat p2. Earlier I said running the computer server-side was impractical, yet reusing the room-battle path turned out to be the smallest possible change. CPU time was the sole open question, and Phase 0 passed it.

## 4. Phase 0 benchmarks (2026-11-07, passed)

| Metric | Result |
|---|---|
| CPU limit | Supabase Edge Functions allow 2 seconds of CPU per request on every plan (per docs). Pass threshold was slowest move under 1 second |
| Fixed sample count (`samples`, tested and reverted) | 3 samples matched the 1.4 s computer at 52.3% ± 4.8 over 300 games, and Edge matched this PC across all 576 moves on identical seeds. Across 30 games on Edge, the slowest move hit 1906 ms because heavy turns make individual samples expensive |
| Existing time-budget mode | Narrowing the first sample's width to the budget caps worst-case time around 2.2x budget. Edge over 30 games: max 1028 ms at 450 ms budget, 1541 ms at 700 ms, and mean 407 ms, p95 598 ms, max 815 ms at 400 ms budget |
| Strength at 400 ms | Edge runs roughly 1.8x slower than this PC, so we benchmarked 220 ms locally against the 1.4 s computer: 50.0% ± 4.9 over 300 games, Elo 0, no difference |
| Server overhead | Restoring battle state takes 1 ms, creating a computer instance takes 2 ms, and max request body is 37 KB |

Decision: the server computer uses the existing time-budget mode at `budgetMs: 400` for 폴리곤Z with no new search code. We drop seed-level move reproducibility since the server adjudicates everything. 폴리곤 stays at 300 ms, and 폴리곤2 drops from 500 ms (which would hit ~1.1 s max on Edge) to 400 ms on the server only (phone settings in `cpuLevels.js` stay unchanged).

Carrying deduction across server requests (Phase 1, complete): because deduction state (opponent candidate sets and prior turn) lived only in memory, a stateless server computer recreated each request could not deduce. `createCpu` now exports state as JSON via `memory()` and restores it via the `memory` option. The server saves it alongside battle state in `battle_secrets` and clears both when the match ends. Max size is 39 KB (around 5 KB compressed), similar to battle state. `tests/battleCpu.test.mjs` verifies that a computer recreated from JSON every turn produces the exact same input log character-for-character as a continuous instance, and that pruned candidates stay pruned. Since move choices are identical, strength matches the benchmark above.

Difficulty ladder strength at server budgets (tested locally at 1/1.8 of Edge time):

| Matchup | Lower tier win rate | Verdict |
|---|---|---|
| 폴리곤2 (Edge 400 ms) vs 폴리곤Z (Edge 400 ms) | 37.3% ± 4.6 over 300 games, Elo -90 | One tier below |
| 폴리곤 (Edge 300 ms) vs 폴리곤2 (Edge 400 ms) | 39.3% ± 5.1 over 300 games, Elo -75 | One tier below |

Spacing matches the phone ladder (폴리곤2 34% vs 폴리곤Z, 폴리곤 32% vs 폴리곤2). Each benchmark had one engine rejection (2 in 600 games; benchmark falls back to strongest attack), caused by hidden 그림자밟기 (메가팬텀) where the request marks `maybeTrapped` instead of `trapped` and still lists switches that the engine rejects. Commit `c11f1a6` fixing `decide` sits on branch `claude/vigilant-mendeleev-18581c` and is not yet merged. Because a player could still bring an off-sample trapping ability unknown to the computer, rejections remain possible. After a rejection, the engine updates the request to `trapped: true`, so the server runs `decide`, retries `decide` once on rejection, falls back to `quickChoice` if still rejected, and logs it (all 4 fuzzing rejections succeeded on retry).

The probe edge function (`cpu-probe`) was deployed to production for testing and deleted immediately afterward. Logs also appear in `BATTLE_COMPUTER.md` Section 5.

## 5. Rules

- Only approved Google accounts (approved trainer names in `player_accounts`) can enter, and that name appears on the leaderboard. Unauthenticated visitors see a Google sign-in button at the entry point (`DESIGN.md` "Composing a screen" 17).
- Format is singles random battle only. Doubles will get its own leaderboard after separate benchmarking.
- Each match generates fresh teams for both sides (`randomTeam`, with `meta: true` on the computer side) and a fresh seed. From 2026-11-09, all random teams are power-balanced (Chapter 11).
- Floors and gatekeepers (changed 2026-11-08; originally difficulty stepped up every 7 wins with no boss match, until user feedback: "그냥 단순한 배틀의 반복으로 느껴져. 한 층 한 층 긴장감 있는 도전을 쌓아간다는 느낌"): five matches form one floor, and match 5 is the floor gatekeeper (`층의 수문장`, renamed from `층의 주인` on 2026-11-09 after user feedback: "주인이라는 표현 대신 쓸 말이 있을까"). Match labels use native Korean ordinals: `1층 첫 번째 판`, `두 번째`, `세 번째`, `네 번째`, `1층 수문장` (user: "1번째 라는 표현은 엄밀히 말하면 적절한 표현은 아닌 걸로 알아"). Floor length dropped from 7 to 5 on 2026-11-09 (user: "연승 도전의 템포도 좀 쳐지는 것 같아. 좀 더 매판마다 도파민이 돌았으면 하는데. 주인이 등장하는 주기를 짧게"), which also aligns with the five step heights in `DESIGN.md` (32, 44, 52, 64, 84). In initial production testing, zero losses occurred across seven 폴리곤 matches, making Floor 1 feel like a warmup (7-win streak ending on the first 폴리곤2 match). Active runs map their existing win count directly onto the new floor length (6 wins equals Floor 2, match 2).
  - One difficulty tier covers an entire floor: Floor 1 is 폴리곤, Floor 2 is 폴리곤2, Floor 3 onward is 폴리곤Z, including each floor's gatekeeper. Changed on 2026-11-09 from having the back three matches and boss step up one tier (user: "통일성을 위해 폴리곤 폴리곤2 폴리곤z로", accepting that Floor 1 became easier again). Gatekeepers are stronger through their teams instead. Only tested tiers are used; interpolating `slack` and `mistake` per match showed no gap against 폴리곤 over 300 games (50.3% ± 5.0, `BATTLE_COMPUTER.md` Section 5) and was dropped.
  - Until 2026-11-08, boss teams drew exclusively from the top-24 usage species (56.3% ± 5.6 over 300 mirror-CPU games against normal teams). From 2026-11-09, they used `MASTER_PLAN`, replacing the weakest tier slot with an extra mid-tier slot (benchmarked in Chapter 11).
  - Fixed floor gatekeepers (2026-11-09, user: "층마다 강력한 포켓몬을 설정하는 거야. 해당 층에 도달하면 고정으로 나오는 포켓몬. 메가진화로 설정하면 아마 좋겠지. 층을 올라갈 때마다 강력해지고. 특정 층 이상으로 가면 그냥 랜덤으로"): Floors 1 through 8 each have a fixed Mega Evolution ace (`streak.js` `GATEKEEPERS`) in ascending power order (Chapter 11): 루카리오, 한카리아스 (Mega Z), 팬텀, 가디안, 마기라스, 망나뇽, 보만다, 리자몽 (Mega X). That Mega occupies the top slot of `MASTER_PLAN`, with the other five balanced around it (`randomTeam` `ace`). From Floor 9 onward, a top-tier Mega is drawn randomly each match. The UI shows the current floor's gatekeeper in silhouette, higher/random gatekeepers as `?`, and cleared gatekeepers fully revealed.
  - Difficulty labels are hidden in the UI (2026-11-09, user: "난이도 표기 자체를 연승 도전에서는 없애자"), while the computer still plays at the floor's tier.
  - Team persistence (changed 2026-11-10): players climb with their starting team all the way through without rerolling on floor changes or gatekeeper clears (user: "그냥 처음 시작한 포켓몬으로 쭉 밀고 가는게 더 의미 있는 경험"). After each win, players can swap one defeated opponent Pokémon with one of their own in the same tier, limited to one swap per match (user: "한 라운드에 한 포켓몬만"). Beating a gatekeeper rewards a swap from the gatekeeper's team (user: "수문장의 보상으로서 파티 한 마리 교체로 가자"). Reroll was removed. Previously, teams refreshed every floor, players could swap multiple same-tier pairs at once (Battle Factory style, 2026-11-09, user: "포켓몬 교체를 좀 더 자주 하면 재밌을 것 같네") without allowing duplicate species (and transferring the outgoing item on duplicate items except Mega Stones before re-validating), or choose `새로 뽑기` for a fresh hand of equal power (2026-11-09, user: "포켓몬 리스트를 좀 더 자주 바꿀 수 있다든가").
  - Revisit floor length and tiers after one month of live streak data.
- Run end (changed 2026-11-10, Chapter 12): runs start with three lamps, losing one on each loss, forfeit, 90-second timeout, or draw, and ending when all three go out. Record is total wins. Previously one loss ended the run. Changed to two lamps on 2026-11-11 (Chapter 14).
- One active run per account. Starting a new run immediately ends the active one at its current win count.
- Monthly leaderboard periods (KST). A run counts toward the month it started. One best record per account per month; ties break by who reached that streak first.
- Isolated from official records: streak runs never create a `Result` or `RankingAward` and never touch normalized league tables. Like `community_items`, they live in visitor space (`ARCHITECTURE.md`).
- Excluded from CPU set learning: both sides use random teams, which `learn-cpu-sets.mjs` skips anyway, so streak games are not sent to `cpu_battles`.

## 6. Database schema (`docs/db/streak_runs.sql`, operator-run)

SQL is written and verified against `node scripts/verify-streak-db.mjs <pglite>`, which checks 11 invariants and idempotency on top of the production `battles` table definition (columns, constraints, and two triggers copied from production).

- `public.streak_runs` holds `id`, `auth_user_id`, `trainer_name` (approved name snapshot at run start), `format_id`, `month` (first day of start month, KST), `wins`, `status` (`active`, `ended`), `battle_id` (current or final match), `started_at`, `last_win_at`, and `ended_at`. A unique index enforces one active run per account. Visitors cannot read this table directly.
- `battles` adds `streak` to its kind enum and a `run_id` column. A check constraint ties `kind = 'streak'` strictly to `run_id IS NOT NULL`. Streak matches remain public rows so anyone can spectate active runs. `battle_create` is recreated so casual rate limits (20/min, 5000 total) ignore streak rows.
- `battle_secrets.cpu_memory` stores computer deduction state via `battle_set_cpu_memory` for active streak matches only (up to 256 KB).
- Writes go exclusively through `service_role` RPCs called by the battle function:
  - `streak_start` verifies account approval, closes any active run at its current wins (forfeiting its match), and opens a new run and first match with the computer's team-preview pick already submitted so the 90-second clock starts immediately.
  - `streak_after_battle` reads the winner from the public match row, increments `wins` and opens the next match on victory or ends the run on defeat, and is idempotent if called twice for the same match.
  - Public reads use `streak_board(p_month)`, returning rank, name, wins, active flag, spectate match ID (active runs only), timestamp reached, and self flag without exposing user IDs. Lists up to 100 entries with at least 1 win or an active run.
- No background cleanup cron is needed. Whenever anyone starts a new run, the RPC expires up to 20 matches past deadline by more than 1 minute as timeout losses and deletes up to 200 streak match rows older than last month (keeping `streak_runs` records intact and leaving official battles untouched). The leaderboard also excludes expired matches from active status in between.
- Fits inside Supabase free tier limits (500 MB DB, 500k edge invocations/month, 5 GB egress/month): finished matches clear engine state, deduction memory, and pending choices, only two months of streak match rows persist, and new runs are capped site-wide at 300/day (~25 invocations per match). Egress is checked after building the function by inspecting per-match response sizes.
- Invalid states (settling an unfinished match, unapproved accounts) fail closed without guessing.

## 7. Battle function (built, not yet deployed)

Engine logic lives in `supabase/functions/battle/streakEngine.mjs` (match creation and computer turns); request routing lives in `index.ts`.

- `streak` (start) is the only action requiring Google auth. The client sends the signed-in session (`storage.js` `invokeFunction`), and because the function deploys with `--no-verify-jwt`, `index.ts` verifies the `Authorization` token directly via `db.auth.getUser`, fetches the approved name via `streak_trainer_name`, creates match 1 (server-rolled teams, seed, and computer lead pick), and calls `streak_start`. The caller takes seat p1.
- `choose` follows the room-battle flow. After resolving the player's turn, the same request runs `computerTurns` to pick the computer's next move and saves it as p2's `pending` choice, which resolves together with the player's next submission. Computer-only forced switches execute immediately in a loop. Rejected choices retry once and fall back to strongest attack (Chapter 4).
- `battle_secrets.cpu_memory` stores `{ wins, cpu }`, where `wins` determines difficulty (`streak.js`) and `cpu` stores `memory()` output across requests.
- If a player choice arrives past the 90-second server deadline, the match ends as a timeout loss. The computer never times out, so room-battle timeout claims do not apply; abandoned matches are swept by Chapter 6 cleanup.
- On any match finish (win, loss, forfeit, or timeout), the function calls `streak_after_battle`. Updated 2026-11-07: winning increments `wins` without immediately opening the next match (previously the next match's 90-second timer ticked while viewing results, causing timeouts). The run pauses until the player clicks next match, calling `streakNext` (`streak_next`, idempotent) with the winning match's seat token. Every response includes `streak: { wins, status }`. `join` rejects streak matches.
- Verification: `tests/streakEngine.test.mjs` checks that a match completes using only persisted DB fields (state, pending, memory) and replays to the same outcome. `scripts/verify-streak-function.mjs <pglite>` runs the real `index.ts` over real SQL in PGlite through a full run (2026-11-07 run: 7 wins followed by a loss on 폴리곤2 match 1, max request 615 ms including local DB, every match replayed cleanly with no leftover state).
- Replays load from `battles` rows just like finished room battles.
- Because the winning match's seat opens the next match, a dropped response recovers safely on retry (or navigates straight to the already-opened match stored on the device).
- Team persistence and swaps (2026-11-08, updated 2026-11-10): `streakNext` always carries `battle_secrets.p1_team` into the next match even across floors. `swap` accepts a single `{ give, take }` pair and rejects multiple swaps with `"한 판이 끝날 때마다 한 마리만 바꿀 수 있습니다."`. `reroll` was removed. `scripts/verify-streak-function.mjs --sure` verifies match-1 swap, multi-swap rejection, post-gatekeeper swap, and cross-floor team carryover on real SQL (2026-11-10 run: 11 wins, two gatekeepers, max request 574 ms). Earlier 2026-11-08 behavior carried `p1_team` within a floor, read opponent species from the public input log (`sideTeam`), enforced same-tier swaps (`swapParty`, rejecting mismatches with `"tier"` before `validateTeam`), identified Pokémon by species because engine requests reorder by lead, supported `reroll: true`, and rolled fresh teams on floor 1 (2026-11-08 run: 8 matches, 7 wins, max 731 ms).

## 8. Screens

Read `DESIGN.md` first and reuse existing components. Verify at 390 px and 1440 px in both themes using "Composing a screen" and "Judging the stage", then play several live matches.

- Entry point is the `연승 도전` tab on the battle page, with no explanatory blurb or popup (`DESIGN.md` "Composing a screen" 22, 2026-11-08).
- Match stakes (2026-11-08): below move buttons and forfeit sit the floor and match label, current streak (7-segment size 32, unit `연승`), and the floor's match track. No sentence explaining what is at stake (user: "4연승이 걸린 판 과 같은 설명들은 굳이 필요 없어", `DESIGN.md` "Composing a screen" 22).
- Between matches: never cut straight into the next match (rule 14). Show the streak counter at tier 0 (size 84) with the next difficulty's Pokémon standing on the stage pad (`Stage.jsx` `foeLead`).
- In match: keep the existing battle screen with the streak count (size >=32 integer) in the scoreboard slot.
- Leaderboard: current month #1 gets a hero panel with name (20) and 7-segment streak (84); rank 2 onward render as table rows. Active runs show an amber lamp next to the name and open spectating on click. The signed-in user's own record pins at the top (rule 4). Previous month is a tab.
- Copy style: formal Korean (`합니다체`), noun labels (`연승 도전`, `연승 순위`, `이번 달`, `내 최고 기록`, `도전 중`, `N연승`), no middle dots or exclamation marks.

Implemented 2026-11-07 in `src/pages/battle/Streak.jsx` and `src/styles/streak.css`:
- The `연승 도전` tab (`?view=battle&tab=streak`) mirrors the lobby layout: next-difficulty computer on the stage, trainer name and random team (or active streak) on the player side, and a primary action button adapting to account state (Google login, set trainer name, pending approval, start run, or continue plus start new with confirmation). Any disabled reason sits in one dock line.
- Side column shows a one-line rule summary, `이번 달 내 최고 기록` for approved accounts, and the leaderboard with `이번 달` and `지난달` chips using the shared `StandTable` component (podium, header row, rank 4+ rows, no ties). Active runs show an amber lamp with `도전 중` and click through to spectate.
- During a match, the header status line shows `연승 도전 N번째 판`.
- After a match, `이번 도전 N연승` appears under the result. On a win, the next opponent stands beside it at a 1:1.618 ratio with next-match and leaderboard buttons; on a loss, only the counter, retry, and leaderboard buttons appear.
- Verified at 390 px and 1440 px in both themes by mocking finished casual matches as streak matches and stubbing account/board responses in-browser without touching production DB. Live Google sign-in runs wait for deployment since OAuth does not return to localhost.

## 9. Rollout order

Confirm after each step.

1. Phase 0 benchmarks (Chapter 4): complete, also logged in `BATTLE_COMPUTER.md` Section 5.
2. Server computer prep: complete (`memory()`, server tier benchmarks in Chapter 4, rejected-move retry logic).
3. Rules module: complete (`src/services/streak.js` mapping wins to difficulty and server budget, tested in `tests/streak.test.mjs`, shared by function and UI; month and rankings stay in DB).
4. SQL: executed and read-only verified on 2026-11-07; re-run once more after adding `streak_trainer_name` and 20-character name trimming.
5. Battle function: built (Chapter 7). Deploy via `npm run build:battle` after the SQL update. Without the SQL, the UI hides streak mode (same pattern as Google sign-in).
6. Screens: built (end of Chapter 8). Play one full run in production with real Google sign-in after site deploy.

## 10. Open questions

- Floor step count: tier spacing is benchmarked (Chapter 4). Proposal is to start at 7 matches per tier and revisit after one month of live distribution.
- Ranking period: calendar month vs YPL season.
- Home page surface: whether to show the monthly #1 or active runs (fits "show what is happening now", though home space is tight).
- Unranked practice runs for signed-out visitors: skipping them keeps scope smaller.

## 11. Random team balancing (2026-11-09)

User feedback: "포켓몬 뽑기 운이 너무 강한 것 같아. 보만다나 메타그로스 같은 사기 포켓몬 뽑으면 쭉쭉 밀어. ... 내가 의도한 건 순수 실력으로 올라가는 거였거든. 일반 배틀에서 컴퓨터 상대로하는 배틀도 마찬가지야. 포켓몬 성능별로 밸런스를 맞춰줄래?"

- Rating (`scripts/rate-species.mjs --play`): pit 100 ms computers against each other with uniformly drawn random teams, mirrored per pair to cancel seat advantage. Across 8000 m-c singles matches (7922 decided, ~350 picks per species), logistic regression (`win ~ sum(own ratings) - sum(foe ratings)`, L2 = 2) writes per-species ratings to `src/data/species-power.json` (`--fit`). Top species: 리자몽 0.62, 피죤투 0.62, 대쓰여너 0.62, 보만다 0.57, 망나뇽 0.55. Bottom: 프레프티르 -0.57. 메타그로스 rated 0.26 (upper tier, not top).
- Tiering (`src/services/partyBalance.js`): splits species into six equal-sized tiers by rating. Unrated species (added later by weekly learning) get median rating. Unrated formats borrow from the closest format (m-b borrows m-c).
- Doubles (same day): 3000 m-c doubles matches (~130 picks per species) were rated separately because rankings diverge sharply (top: 입치트 0.66, 갑주무사 0.63, 미끄래곤 0.61, 갸라도스 0.58; 블로스터 is 0.34 in doubles vs -0.35 in singles). Uniform teams predicted 66.3% of outcomes with ±17.6%p swing; balanced teams dropped to 52.2% and ±2.8%p across 600 games (first team 49.8% ± 4.4).
- Drawing (`engine.mjs randomTeam`): all random teams (both sides in streak, casual random teams, and regular computer battles) pick one Pokémon per tier until the six-rating sum lands within 0.15 of the plan mean. Computer teams (`meta`) still weight picks inside each tier by ladder usage so familiar Pokémon appear. `even: true` keeps uniform draws for rating runs and CPU benchmarks (preserving historical benchmark comparability).
- Verification (`--check`): on 7922 uniform singles games, team ratings alone predicted 62.9% with ±15.0%p expected win-rate swing. On 1193 balanced games, predictability dropped to 53.7% with ±2.8%p swing and log loss 0.6903 (coin flip 0.6931), cutting draft luck to roughly one-fifth. First-team win rate between balanced teams was 51.8% ± 3.1 (no difference).
- Gatekeeper: `MASTER_PLAN` (swapping tier 6 for an extra mid-tier slot) scored 54.7% ± 3.8 over 800 games against normal teams. Fixed Mega aces sit in slot 1, so Floor 1 with 루카리오 (0.0, below top-tier average ~0.33) is slightly softer while Floor 8 with 리자몽 (0.62) hits ~61%, stacked with rising AI difficulty.
- Swaps stay within the same tier (Chapter 5) so winning does not snowball team power and every match keeps the same power gap.
- Refresh cadence: re-run a few thousand `--play` games and `--fit` roughly once a month as set learning updates the pool, confirming `--check` stays near a coin flip.

## 12. Phase 1 redesign removing unfairness (2026-11-10)

User feedback: "도전의 탑을 도파민이 빵빵 터져서 너무나도 재밌고, 플레이어 입장에서 부조리한 불쾌함을 최소화하고 템포가 빠른, 다른 말로 말하면 정말정말 재밌게 게임으로 만들고 싶어. ... 기존의 것은 컨셉만 존중하면 돼. 나머지를 완전히 재설계해도 좋아." From four proposed phases (unfairness, per-match rewards, variety and tempo, social), the user picked Phase 1 first ("1단계부터 진행").

Baseline data from production DB (277 streak matches from 2026-11-07 to 2026-11-10, two accounts, mixed with dev testing; read for structural properties only):

| Metric | Value |
|---|---|
| Match duration (224 completed, median) | 91 s, ~10 turns, 14 log chunks at 7 s each |
| Between-match gap (median) | ~10 s |
| Gatekeeper cadence | ~8.5 min |
| Zero-win runs out of 101 ended runs | 54 (median 0 wins, mean 1.7) |
| Match-1 win rate (68 non-forfeit matches) | 71% |
| Forfeited matches | 44, median 34 s |
| Best streak | 11 wins, ~17 min |

Losing 17 minutes to one critical hit or ending at 0 wins on match 1 caused the sharpest frustration, so we fix that before rewards or variety.

Rules:
- Three lamps (`streak.js` `STREAK_LIVES`, `streak_runs.lives`): runs start with 3 lamps. Each loss turns one off; if lamps remain, the run pauses just like after a win. Continuing replays the exact same slot (same floor, match, and gatekeeper if applicable) against a fresh opponent team and seed while keeping the player's team intact with no swap. Losing the third lamp ends the run. Clearing a gatekeeper relights one lamp up to 3. Streaks and rankings stay unchanged, and Chapter 2's logarithmic volume scaling still holds (lamps only lengthen each run; at 75% per-match win rate, mean streak rises from 3 to about 9, excluding gatekeeper relights, via `3 * p / (1 - p)`).
- Forfeits and timeouts cost one lamp rather than ending the run. Matches that time out after disconnect behave identically (`streak_start` cleanup, `expire`), letting returning players continue with one fewer lamp. Starting a new run still ends the active run immediately.
- Luck-swing bans (`STREAK_BAN`, both sides): items 밝은가루, 선제공격손톱, 왕의징표석, 기합의머리띠; moves 절대영도, 땅가르기, 뿔드릴, 가위자르기, 그림자분신, 작아지기. Across 1329 m-c singles sets on 2026-11-10, 11 sets were excluded by move and 155 sets stripped those items from their item list (0 sets left itemless, 0 species lost). Core engine RNG (crits, misses, sleep) remains because lamps absorb single bad rolls. Computer deduction still reads the base sample pool (holding banned items in candidates slightly longer). Tier ratings (Chapter 11) were not recomputed because few sets were touched.
- Loss review: after a loss, the player's seat receives the exact sets (species, ability, item, four moves, nature) of the three Pokémon the opponent brought (`streak.foe`). Nothing new leaks because finished match input logs are public anyway, and the retry rolls a fresh opponent.

Data and functions:
- `streak_runs.lives` (default 3, range 0 to 3). `streak_settle(match, relight)` settles match end: win adds +1 win and (on gatekeeper) +1 lamp; loss subtracts 1 lamp and ends the run at 0. The battle function passes the gatekeeper boolean so floor rules live solely in `streak.js`. Idempotent per match. `streak_run_state(match)` returns wins, lamps, status, and current match. `streak_next` opens the next match after losses too while the run stays active. Cleanup in `streak_start` and `streak_begin` only closes timed-out matches; lamps and next-match doors are settled when the returning seat reads the match in the battle function (updated 2026-11-13; previously cleanup turned off lamps and wiped engine state, leaving returning runs with no doors). Matches that crashed between saving finish and settling follow the same path (`view` `streakSeen`).
- Keep `streak_after_battle` intact so the deployed function continues running old sudden-death rules between SQL update and function deploy. Deploy order is SQL, battle function, then site. Deploying the site early is safe because lamps only render when the DB returns `lives`.
- Finished match responses attach `streak: { wins, lives, status, won, foe }`. `view` attaches the same payload on settled active runs (timeouts and reloads). `streakNext` rejects swaps after a loss.
- Client `localStorage` remembers `lives`, `won`, `ended`, and `foe`. Live spectating reads streak and lamps from run matches (`streak.js` `runTrack`), following through losses until the final lamp goes out.

Screens (`DESIGN.md` "Battle", The run's hearts; hearts since 2026-11-24, scoreboard lamps before): hearts sit on the right end of the match title row (menu stakes, preview strip, between-match next match, tab active run) with no text or numbers. Post-loss between-match sits in the same slot as post-win, replacing swaps with opponent set cards and a continue button. Verified 2026-11-10 via PGlite harness and dev server at 390 px and 1440 px in both themes across loss, retry, win, and final lamp.

Tests: `tests/streak.test.mjs` (lamps, run tracking, ban-list exclusion) and `scripts/verify-streak-function.mjs` (retry same slot after loss, end on third loss, gatekeeper relight, swap rejection after loss on real SQL).

Remaining proposed phases (not yet committed at this point):
2. Per-match rewards: starting draft (1 of 3 per tier), 1-of-3 win rewards (capture, item, alternate sample set, scouting), and gatekeeper tier promotion matched by tower scaling (preserving Nov 9 skill parity).
3. Variety and tempo: floor modifiers (weather, room, doubles, monotype), door choices, smooth per-floor power scaling, and 2-Pokémon team preview (benchmark matchup luck first, and profile where the 7 s per chunk goes across server, animations, and thinking).
4. Social: club members' monthly records pinned along tower floors, plus Daily Tower.

## 13. Redesign phases 2 through 4 (2026-11-11)

User feedback: "나머지 단계도 진행해줘. 진행하면서 도전의 탑 초기화면도 대폭 개선해줘. 지금 너무 단순한 네모의 연속이라 하나도 안 예뻐. 일반 배틀 초기화면처럼 네모를 고집하지 않아도 홈페이지 컬러 톤 앤 매너만 맞추면 돼. 틀에 박히지 말고 자유롭게 상상해. 진입 애니메이션도 새로 짜고."

Phase 2, per-match rewards:
- Starting draft (`streak.js` `STREAK_DRAFT`, `engine.mjs` `draftOffer`, `draftParty`): runs begin without a match (`streak_begin`), offering three complete sets per power tier. Picking one per tier builds the six-Pokémon team and opens match 1 (`streakDraft`, `streak_first`). All candidates are distinct species; if a row rolls all Megas, the third slot forces a non-Mega so any path can respect the one-Mega cap. Duplicate items fall back to the set's next item or a universal fallback item (0 validation rejections across 4000 random picks). Because choices stay inside each tier, team quality depends on drafting skill rather than luck.
- Doors (`doorsOf`, `streakDoors`): while paused between matches, players pick between two doors, normal and tough (two steps stronger, matching gatekeeper plan without Mega), with all six opponent species visible (preview level, sets hidden). Beating a tough door relights one lamp like a gatekeeper and raises that match's swap reach by one tier. Before a gatekeeper, only one closed door appears. Door teams are rolled on match end and saved in `streak_runs.offer` (cleared when the next match opens).
- Tier promotion (`swapParty` `reach`): winning a gatekeeper or tough door lets you swap an opponent Pokémon up to one tier higher than your outgoing slot (never two tiers higher or lower). The UI pairs +1 tier options first.

Phase 3, variety and tempo:
- Floor types (`floorType`): each floor concentrates opponent teams into one type by prioritizing that type in every tier (`randomTeam` `prefer`). Floors 1 to 8 match their gatekeeper's type (Fighting, Ground, Ghost, Fairy, Rock, Flying, Dragon, Fire); higher floors cycle the remaining ten types. Sampling 40 matches per floor on 2026-11-11 produced 5 to 6 matching-type Pokémon per team. Because everyone faces the same floor type, drafting and swapping counters rewards planning. Engine rule mods (like Inverse Battle) were skipped because bundled `@pkmn/sim` rejects them (`Unrecognized rule`).
- Per-floor opponent scaling (`foeSteps`, `foePlan`): opponent teams step up one tier-slot per floor (upgrading the weakest slot by one tier; two steps equals `MASTER_PLAN` at ~55% gatekeeper win rate from Chapter 11, keeping Floor 1 gatekeeper unchanged), capping at Floor 5. Mean rating sums (2026-11-11, 40 teams each): Floor 1 `0.00`, Floor 2 `0.19`, Floor 3 `0.16` (gatekeeper `0.28`), Floor 5 `0.32`, Floor 9 `0.47`. Revisit alongside AI difficulty after one month of live data.
- Rejected 2-Pokémon bring format: tested 2400 CPU games (300 team pairs x 4 mirrored games at 80 ms/move). Match length halved (mean turns 12.2 to 6.4, move lines 17.1 to 9.7), but matchup luck grew from roughly one-fifth to one-third of outcomes (4-0 sweeps rose from 29.3 ± 5.2% to 39.3 ± 5.5%, split-seed correlation from 0.32 to 0.51). Because that reintroduced the unfairness removed in Phase 1, we kept 3-Pokémon bring and sought tempo through doors, draft decisions, and tighter intros instead. Benchmark script lived in scratch (`pick2.mjs`).
- No doubles floors (2026-11-11, user: "더블 층은 빼줘"). Weather and room floors lacked engine support and were replaced by floor types.

Phase 4, social:
- Other climbers on the tower: up to four trainers from the monthly (or daily) leaderboard hang by name at their floor and match height on the tower canvas (amber lamp if active), letting you watch yourself pass clubmates as you climb. Reuses `streak_board` with no SQL changes.
- Daily Tower (`streak_runs.daily`, `streak_daily_board`, `seeded`): retired on 2026-11-19 (operator: "오늘의 탑도 그냥 없애줘. 도전의 탑 이번 달로만 남기자"). Removed from site UI and notification types (`docs/db/drop_daily_tower.sql`), leaving DB and battle function intact so in-flight matches could finish. While active, it allowed one run per KST day where every player at the same position (wins plus matches played, hashed with the day key) received identical draft, doors, and match seeds (AI moves remained unseeded), tracked on a separate daily leaderboard.

Data: added `offer` (draft candidates or doors and swap reach, function-only) and `daily` to `streak_runs`, split the active-run unique index by kind, and added `streak_begin`, `streak_active_run`, `streak_first`, `streak_run_public` (spectator read without user IDs), and `streak_daily_board`. `streak_settle` took doors as a third argument (replacing the unrun two-argument version), and `streak_run_state` returned doors, daily flag, and match count. Kept legacy `streak_start` and `streak_after_battle` for rolling deploy safety (SQL, battle function, site).

Screens: `DESIGN.md` "Battle" entries for The tower (night cylindrical tower, winding path, balcony party, entrance animation), The draft, The doors, and The two kinds.

Verification: `tests/streak.test.mjs`, `scripts/verify-streak-db.mjs` (15 checks), `scripts/verify-streak-function.mjs` (draft, tough door after loss, lamp relight and +1 swap on tough door win, Daily Tower seed parity), plus visual checks via PGlite and dev server at 390 px and 1440 px in both themes.

## 14. Real-match practice redesign (2026-11-11)

User feedback: "목숨이 3개로 바뀌면서 긴장감이 없어지고 게임이 늘어지는 경우가 많아졌어", "내가 도전의 탑을 설계했던 이유는 실전 배틀 연습을 재미있게 하라는 목적이었는데, 한 층에서 한 타입만 계속 나오니까 실전을 연습할 수 없어졌어", and "현재 포켓몬들의 샘플도 랭커 수준의 샘플에 부합하도록". Intended experience: "실전 연습이면서 랜덤 파티로 다양한 환경에 유연하게 대처하는 능력을 기르면서 도파민도 챙기는 것". Keep the player side (draft, swaps) intact and align opponents and loss rules with real ladder play.

### 14.1 Goals and non-goals

- Goal: every match carries real-battle weight against actual top-ranker teams, with draft candidates and opponent sets drawn from Pokémon and items rankers actually use, while keeping randomness (draft offers, opponent builds, sets, seeds).
- Non-goals: bringing your own built team (user chose to keep draft), doubles, changing regular CPU or casual random teams, changing `learn-cpu-sets`, or scraping per-Pokémon pages on Battle Database (against ToS, Section 14.4).
- Target run length (user choice): half of runs clear Floor 1 (Section 14.6).
- Deploy immediately and reset prior records (user: "그냥 바로 적용해줘. 기존 기록은 리셋하면 그만이야", `docs/db/streak_reset_2026_11.sql`) rather than waiting for next month.
- Failure modes: dragging runs, unrealistic opponents (like monotype floors), or ranker builds crushing almost everyone on Floor 1.

### 14.2 Approaches

| Area | Options considered | Chosen and reason |
|---|---|---|
| Player team | Own team, rented ranker team, keep draft | Keep draft (user): preserves adapting with random teams |
| Loss rule | A sudden death, B 1 lamp + 1 earnable reserve, C 3 lamps with no relight, D start with 2 lamps and gatekeeper relights up to 2 | Initially B (user), giving Floor 1 real stakes and making gatekeepers earn a margin of error. Benchmarks (14.6) put Floor 1 clear rate at ~19% under B, so the user switched to D the same day: up to one mistake per floor, ~46% Floor 1 clear rate. C only half-solved tension |
| Opponents | A full real ranker teams, B balanced random 6 from ranker species | A (user): real cores and synergy preserve real team-preview reads; B is not a real build |
| Moves and EVs | A Smogon 1760+ stats matched to ranker items, B Battle Database in-game stats (needs operator permission), C hand-entered blog sets | A first, swap in B at the same hook if permission arrives (user) |

### 14.3 Rules

Lamps (replacing Chapter 12's three lamps):
- Runs start with 2 lamps (`STREAK_START_LIVES`). Every loss, forfeit, timeout, or draw removes one; 0 ends the run.
- Beating a gatekeeper relights one lamp up to a max of 2 (`STREAK_LIVES`), allowing one mistake per floor. (Initially designed as 1 starting lamp + 1 reserve; updated after 14.6 benchmarks.)
- Beating a tough door no longer relights a lamp; its sole reward is +1 tier swap promotion (Chapter 13).
- When a lamp remains after a loss, players retry the same slot against a fresh opponent with no swap.
- Streak scoring and leaderboard rules stay unchanged.

Opponents (real ranker teams):
- Opponent teams use a full published top-ranker six (six species and their items), filled with moves, abilities, natures, and spreads per 14.4 and piloted by the computer.
- Higher floors draw from higher rank bands (433 M-6 and M-7 singles teams as of 2026-11-11):

| Rank band | Teams | Normal door | Tough door | Gatekeeper |
|---|---|---|---|---|
| 601-1000 | 146 | Floor 1 | | |
| 301-600 | 72 | Floor 2 | Floor 1 | |
| 101-300 | 129 | Floor 3 | Floor 2 | Floor 1 |
| 31-100 | 60 | Floor 4+ | Floor 3 | Floor 2 |
| 1-30 | 26 | | Floor 4+ | Floor 3+ |

- Normal door uses the floor's band, tough door steps up one band, and gatekeeper steps up two (capping at 1-30). Because inter-band strength differences fell inside noise (14.6), rank bands act as real-world flavor while AI tiers (`STREAK_STEPS`) control difficulty: Floor n normal uses step n, gatekeepers and tough doors step up one, capping at Floor 5.
- Duplicate ranker teams within one run are allowed (even the narrowest 1-30 band has 26 teams, so repeats are rare without extra state).
- Removed: `floorType` / `FLOOR_TYPES`, fixed Mega `GATEKEEPERS` (replacing Nov 9), `PLANS` / `foeSteps` / `foePlan`, and `randomTeam` `prefer` / `ace` options if unused elsewhere.
- Doors remain normal and tough (or one closed gatekeeper door), showing all six species without type chips.
- Season and rank (e.g., `M-7 32위`) display on doors, between-match, and loss review per `DESIGN.md` (14.7).
- Daily Tower draws the same ranker team from the same band via the daily key.

Player side (same draft and swaps, ranker pool only):
- Draft candidates draw solely from species appearing in ranker teams (134 species), three complete sets per tier. Candidate items sample from ranker item frequencies for that species and fill sets via the 14.4 item-matching path, keeping existing rules on one Mega, no duplicate items, and fallback items.
- The six power tiers re-partition the 134 ranker species into equal buckets by `species-power.json` rating so lower tiers do not starve. `swapTier` uses the same table.
- Swaps stay unchanged (same tier, or +1 after gatekeeper/tough door), now granting ranker sets.
- `STREAK_BAN` stays active on both sides; if a ranker item is banned, that Pokémon falls back to its set's next non-duplicate item.

### 14.4 Data

Top teams come from Battle Database Champions (`champs.pokedb.tokyo`) open data: `https://champs.pokedb.tokyo/opendata/s{season}_single_ranked_teams.json`, containing rank, rating, and six Pokémon (dex/form, Japanese name, types, item) with no moves, EVs, or trainer names. Regulation M-C has M-6 and M-7 (`s6`, `s7`), with M-8 (`s8`) ending 2026-12-02.
- Terms (`guide/opendata` and `terms`, read 2026-11-11) allow automated downloads but require multi-user apps to host copies server-side rather than fetching from user devices, and forbid rapid scraping. We therefore run one build script and commit the output with attribution.
- New script `scripts/build-ranker-teams.mjs` fetches current-regulation season files (with cache-dir option like `build-random-sets.mjs`) and writes `src/data/ranker-teams.json`: `{ source, built, seasons, teams: [{ season, rank, rating, team: [{ species, item }] }] }`.
  - Species map dex + form (`0479-01`) to Showdown names via a table covering the 22 forms present (Hisui, Galar, Alola, Heat/Wash Rotom, Eternal Flower Floette, gender forms, etc.).
  - Items map 101 Japanese item names to Showdown names (fetched once from PokeAPI or maintained manually).
  - Teams with unmapped species/items or failing `validateTeam` are skipped and logged with counts and reasons.
- Refresh after each season ends; keep only seasons matching the active regulation.

Sets (moves, ability, nature, EVs) come from `random-sets.json` (Smogon 1760+ stats), matched to the ranker's held item:
- Weight-sample among the species' sets that include that item (Mega Stones pick Mega sets), keeping natural match-to-match set variety.
- If no set lists that item, attach it to the species' heaviest set, fixing illegal combos (status moves on Choice items or 돌격조끼) via `setFit.mjs` or filtering at build time, always passing `validateTeam`.
- This single lookup hook is where Battle Database in-game stats can plug in later upon permission (14.8).

### 14.5 Server and database

- `streak.js` splits `STREAK_LIVES` into start lives (1, later updated to 2) and max lives (2), restricts `streakRelights` to gatekeepers, updates `runTrack`, and exports rank-band lookup helpers without bundling heavy team data (loaded only by the battle function).
- `streakEngine.mjs` and `engine.mjs` build opponent teams and `streakDoors` from rank bands using 14.4 set filling, store season and rank on `streak_runs.offer`, and switch `draftOffer` and swap tiers to the ranker pool.
- `docs/db/streak_runs.sql` updates starting lamps in `streak_begin`/`streak_start` and caps `streak_settle` relights at 2 while keeping the 0-to-3 check constraint so active old runs finish cleanly.
- Deploy order remains SQL, battle function, then site, verifying backward compatibility at every step.

### 14.6 Benchmarks

Benchmark balanced ranker-pool draft teams against each rank band (>=300 mirrored games per band). Target from user (2026-11-11, "절반이 1층 돌파로 해줘"): about half of average club runs clear Floor 1, while strong players reach Floors 3 to 4 (10 to 20 wins). With 1 starting lamp, clearing Floor 1 meant winning four normal matches plus the gatekeeper cleanly (85% per match yields only `0.85^4 * 0.65 ≈ 0.34`; hitting 50% requires ~90% on normal matches and ~75% on the gatekeeper). Set initial tables from CPU tests and tune after one week of live Floor 1 clear rates.

Benchmark results (2026-11-11, local PC, 100 ms/move, full computer playing random draft teams vs each AI tier playing ranker teams by band, mirrored pairs; script in scratch):

| Ranker-side AI | Draft-side win rate | By band (601-1000, 301-600, 101-300, 31-100, 1-30) |
|---|---|---|
| Full computer (폴리곤Z) | 37% (1000 games) | 32, 35, 38, 37, 46 |
| 폴리곤2 | 49% (500 games) | 40, 50, 46, 50, 57 |
| 폴리곤 | 60% (500 games) | 59, 62, 57, 59, 62 |
| `tower1` (slack .75, mistake .45, no reads/rollout) | 67% (500 games) | 68, 63, 68, 69, 69 |
| `tower0` (slack .9, mistake .6, no reads/rollout) | 73% (500 games) | 71, 76, 70, 73, 76 |

- Inter-band differences sit within ±7 to 10%p noise (1-30 even scored slightly weaker, likely because high-rank builds require tighter piloting than the AI manages), so rank bands do not scale difficulty.
- Human strength tracks close to the full computer: live match-1 human win rate against 폴리곤 was 71%, vs ~72% for the full computer against 폴리곤 on equal teams (Chapter 4).
- Resulting `STREAK_STEPS`: Floor 1 `tower0`, Floor 2 `tower1`, Floor 3 폴리곤, Floor 4 폴리곤2, Floor 5+ 폴리곤Z, with gatekeepers and tough doors one step up. The two tower-only presets change options only, not AI logic.
- Even at the weakest AI preset, ranker teams outperform balanced random teams enough that 90% per match is unreachable. Starting at 1 lamp gave ~19% Floor 1 clear rate (`0.73^4 * 0.67`), so the user chose 2 starting lamps: ~46% Floor 1 clear rate (allowing one loss on Floor 1).
- Re-tune after one week of live Floor 1 clear rates, verify per-match team generation stays inside the 1-second request budget (Chapter 4), and log skipped ranker builds (14.4).

### 14.7 Screens

- Doors display type ticks below each of the six opponent sprites (2026-11-16 mockup A).
- Draft candidate cards show six level-50 actual stat bars (mockup B).
- Swaps show both selected sets side by side above the table without opening a sheet, comparing base level-50 stats since opponent EVs are hidden (mockup A).
- `RunHearts` (called `RunLamps` until 2026-11-24) draws two hearts at the end of the match title row.
- Doors drop type chips and show build season and rank. Tough door drops `램프 +1` and keeps `교환 승급`. Closed gatekeeper door stays unchanged.
- Between-match and loss review display the build's season and rank.
- Update `DESIGN.md` "Battle" and "Composing a screen" first, keep zero explanatory copy (rule 22), and verify at 390 px and 1440 px in both themes.

### 14.8 Follow-ups

- User to contact Battle Database operator (X `@pokedb_tokyo`) for permission to use per-Pokémon in-game stats (moves, natures, spreads), then plug them into 14.4.
- Noonparty Naver blog (`1209sung`) blocks automated fetching; cross-check Korean sample sets in-browser later.
- Fetch `s8` once M-8 ends (2026-12-02) to expand the ranker pool.

### 14.9 Implementation discretion

- Whether to generate the item map from PokeAPI or maintain it manually, and whether to patch moves or drop builds when no item-matching set exists.
- How to track seen builds in a run (preferring `offer`).
- Exact placement and sizing of season/rank labels within `DESIGN.md`.
- Keeping benchmark scripts in scratch vs repo, following `BATTLE_COMPUTER.md` convention.

## 15. Role-built random opponent teams (2026-11-11)

User feedback: "도전의 탑에 랭커 파티가 그대로 등장하는 방식은 진부하고 다양성이 떨어짐", "랭커 파티들의 특징을 분석하여 포켓몬의 핵심 역할(스위퍼, 탱커, 서포터 등)과 시너지 조합을 역산", "진정한 '랜덤 배틀'의 재미를 살릴 것", "여러 가지 서로 다른 파티 빌딩 알고리즘", "특정 포켓몬이나 특정 파티 조합이 빈번하게 반복되어 나오는 현상을 엄격히 방지", and "최대한 다양한 포켓몬이 각자의 역할군에 맞춰 고루 기용". Replaces Chapter 14's verbatim ranker teams (14.2 A): ranker builds now serve as structural templates rather than literal opponents.

### 15.1 Goals and non-goals

- Goal: generate a fresh role-synergized opponent team every match (aces, walls, support) modeled on real ranker structures, core pairs, and archetypes, drawing from the full random pool (269 species, 1318 m-c singles sets after bans, user choice).
- Diversity: no single species or combo dominates. Species draw uniformly within roles (never skewed by set count or usage), and species already seen in a run rarely repeat.
- Non-goals: player side (134-species ranker draft pool, swaps, tiers), regular CPU/casual `randomTeam`, and `battleCpu.js` stay unchanged.
- Failure modes: incoherent teams (no ace or six walls), recurring species across matches, large power swings across builders, or Floor 1 clear rate drifting far from 14.6's ~46% target.

### 15.2 Approaches

| Option | Tradeoff | Decision |
|---|---|---|
| A Four distinct builders chosen uniformly per match | Most code | Chosen (user): matches the request for multiple randomly selected algorithms |
| B One composite score (type synergy, role need) with randomized weights | Less code, effectively one algorithm | Rejected: fails "단일 결론을 내지 말 것" |
| C Chain-sampling by ranker co-occurrence | Natural, lacks knobs, falls into loops | Reused only for core pairs inside Builder 2 |

Pool choice (user): full 269-species random pool instead of 134 ranker species for maximum variety, accepting slight distance from strict ladder meta.

### 15.3 Roles

Derived from each set (moves, ability, item, EVs, nature) via `roleOf` in `supabase/functions/battle/towerBuild.mjs` using engine Dex data. Every set gets one primary role and zero or more tags:

- Primary roles: `setup` (boosting sweepers with 칼춤, 나쁜음모, 용의춤, 명상, 나비춤, 벌크업, 껍질깨기, etc.), `physical` and `special` (3+ attacking moves split by attack types and EVs), `bulky` (recovery or heavy HP/defensive investment with <=2 attacks), and `support` (hazards, status, screens, pivoting).
- Tags: `pivot` (유턴, 볼트체인지, 퀵턴, 막말내뱉기, etc.), `hazard` (스텔스록, 압정뿌리기, 독압정, 끈적끈적네트), `removal` (고속스핀, 안개제거), `weather:sun|rain|sand|snow` (weather ability or move), `abuser:<weather>` (엽록소, 쓱쓱, 모래헤치기, 눈치우기, etc.), `room` (트릭룸), `slow` (base Speed <=50), `scarf`, `mega`, `priority`.
- Exact thresholds are left to implementation, checking role distribution across all 1318 sets to ensure no bucket is empty.

### 15.4 Patterns learned from ranker teams

On module load (no extra data file), all 433 builds in `ranker-teams.json` are mapped to roles via 14.4 `setFor` and `roleOf`:
- Templates: each build's six primary roles (e.g., `setup, physical, special, bulky, bulky, support`) plus tag counts (hazards, pivots).
- Core pairs: frequency table of `(primaryRole, type)` pairs occurring together in a team.
- Archetypes: one per build: weather (weather tag), trick room (`room`), offense (4+ of `setup`/`physical`/`special`), stall/bulk (3+ `bulky`), or balance otherwise, with counts per archetype.

### 15.5 Four builders (`towerBuild.mjs`)

Each match picks one of the four at equal odds, followed by shared post-processing (15.6):

1. Template fill: pick a ranker template uniformly and fill each slot from species matching that primary role, prioritizing required tags (hazard, pivot).
2. Core pair first: pick a `(role, type)` pair weighted by square-root frequency (preventing top pairs from dominating), fill two slots, then fill the remaining four prioritizing resists to team weaknesses (2+ weak to an attack type), missing hazards, and missing aces.
3. Ace-centered: pick one `setup`, `physical`, or `special` ace (may be Mega), add two Pokémon resisting the ace's weaknesses, one hazard or pivot user, and fill the rest with non-overlapping primary roles.
4. Archetype: pick an archetype by square-root frequency (floored at 10% each) and fill its quota: weather (1 setter + >=2 abusers), trick room (1 `room` + 3 `slow` attackers), offense (4+ attackers + 1 hazard), bulk (3 `bulky` + `removal` or `hazard`), balance (3 attackers + 2 `bulky` + 1 `support`), falling back to Builder 3 if candidates run dry.

Species sampling is uniform per matching species (preventing multi-set species from appearing more often), then weighted by set weight among that species' matching sets.

### 15.6 Post-processing and anti-bias

- Existing legality rules stay intact: unique base species, at most one Mega, no duplicate items (falling back to next item), ban list, and `validateTeam`.
- Power parity: rebuild with the same builder until the six-rating sum (`partyBalance.js` `ratingOf`) lands inside `BAND` of `PLAN` (up to 40 tries, keeping closest). Every builder outputs equal strength; AI steps (`STREAK_STEPS`) handle floor and door difficulty, including gatekeepers (no `MASTER_PLAN`, matching 14.6). Increase retry cap if weather, room, or bulk struggles to stay within 0.1 across builders (15.7).
- Within-run memory: `seen` tracks up to the last 36 species shown on doors, weighting them at 0.05x. Because `streak_open_battle` clears `offer` (`streak_runs.sql` line 135), `streakNext` copies `seen` from `offer` into `StreakMemory`, and `streakAfter` appends newly shown door species when writing `p_offer`, requiring zero SQL changes. Closed gatekeeper doors and doorless matches append the opponent's six after the match ends; match 1 after draft starts with empty `seen`.
- Daily Tower draws builders and teams from the daily seeded RNG (`drawFor`) without `seen` (user choice) to keep Chapter 13's identical-door guarantee; four builders plus uniform species weights already prevent repeats inside a single daily run.
- Swap tiers for off-ranker species (user): opponents now carry ~135 species outside the 134-species ranker pool, which `swapTier` previously defaulted to mid-tier. Map off-pool species by inserting their `ratingOf` into the 134-species tier cutoffs (lowest rating per tier), leaving draft and ranker tiers untouched and reusing `partyBalance.js`'s loaded `species-power.json`.
- Mega swap guard: `swapParty` rejects swaps creating two Megas with `"mega"`, matching draft rules.
- Implementation detail: move `setFor` and `towerPool` into `towerBuild.mjs` to avoid circular imports, lazily learn ranker patterns on first opponent build, and run `validateTeam` once per finished team to stay under 50 ms (15.7).
- Remove `season`, `rank`, `foeRank`, `RANK_BANDS`, and `bandOf` since opponents are no longer ranker teams (already hidden in UI per `bbd3f96`). Stale `foe` metadata in old `offer` rows is harmlessly ignored.

### 15.7 Benchmarks

Diversity (`tests/towerBuild.test.mjs`, fixed seed) targets across 10,000 teams (2500 per builder):
- At least 250 of 269 pool species appear.
- Most frequent species appears <=4x the species mean.
- Exact 6-species duplicate pair rate <=0.1%.
- Mean rating sums across builders stay within 0.1 of each other.
- Simulated 20-match run (2 doors each) with `seen` averages <=0.5 repeated species per match.
- 100% pass `validateTeam`.
- Tighten thresholds after initial measurement; never loosen.

Observed results (2026-11-11): test suite runs 4000 teams (1000/builder, ~23 s) for CI speed. A 2000-team sweep hit all 269 species, max frequency 3.2x mean (Houndstone, Empoleon, Tyranitar as hazard/type-resist fillers), 0 duplicate sixes, builder rating means from -0.002 to 0.009, and 6 ms mean build time (<50 ms max). Tightened test cap to 3.5x mean. `seen` cut repeat sightings over a 40-match run from 1.71 to 0.13 per match. 310 of 433 ranker builds produced valid templates (others had species lacking a matching-item set). Archetype shares landed at ~38% each for weather and offense and 10% floor each for room, bulk, and balance.
- Hazards: only request hazards at the same rate ranker builds run them, fixing initial clustering on hazard setters.
- After set curation (2026-11-18, `docs/SAMPLE_SETS.md` Section 5): trimming 1318 sets to ~280 left narrow buckets (`support` 16, `removal` 4), spiking max species frequency to 6.7x (Empoleon). Skipping any requirement matched by fewer than 12 species (`FEW`) in `addAny` when later requirements exist brought 2000-team max frequency from 6.7x (`FEW=1`) to 3.7x (`FEW=6`) and 3.2x (`FEW=12`, Hippowdon, Tyranitar, Houndstone), passing the unloosened 3.5x test cap. Lowered only the primary-role count floor from 50 to 10 to reflect fewer total sets.

Strength benchmark (2026-11-11, local PC, 100 ms/move, same setup as 14.6, 500 mirrored games per tier):

| Opponent AI | Draft-side win rate | Chapter 14 (ranker teams) |
|---|---|---|
| `tower0` | 84.0% ± 4.5 | 73% |
| `tower1` | 80.2% ± 4.9 | 67% |
| 폴리곤 | 76.6% ± 5.2 | 60% |
| 폴리곤2 | 67.8% ± 5.8 | 49% |
| 폴리곤Z | 57.0% ± 6.1 | 37% |

- New opponents play roughly 20 percentage points weaker than ranker teams at equal AI because their rating sums match normal random teams.
- Keeping the old ladder yielded ~73% Floor 1 clear rate (84% normal, 80% gatekeeper, 2 lamps), far above 46%. Dropping `tower0` and `tower1` and shifting up to Floor 1 폴리곤 (gatekeeper 폴리곤2), Floor 2 폴리곤2 (gatekeeper 폴리곤Z), Floor 3+ 폴리곤Z brings Floor 1 clear rate to ~53% and Floor 2 to ~33%, close to Chapter 14's 46% and ~33%.
- Floor 3+ now caps at 57% vs 37% in Chapter 14 because no stronger AI tier exists; if upper floors prove too easy after one week live, raising upper-floor and gatekeeper targets to `MASTER_PLAN` is the next lever.

### 15.8 Changed files

- New `supabase/functions/battle/towerBuild.mjs`: `roleOf`, ranker pattern extraction, four builders, `towerFoe(random, seen)`.
- `streakEngine.mjs`: `foeTeam`, `streakDoors(wins, random, seen)`, and doorless `streakGame` call `towerFoe`; drop season/rank from `shownDoors`.
- `index.ts`: thread `seen` per 15.6 (door pick to memory, match end to `p_offer`), drop `foeRank` and `memory.foe` season/rank, rebuild (`npm run build:battle`) and deploy before the site (no SQL changes).
- `streak.js`: delete `RANK_BANDS` and `bandOf`, add off-pool `swapTier` mapping and Mega check in `swapParty`, update header comment. `battleService.js`: delete `foeRank`.
- Tests: update `tests/streak.test.mjs` expectations and add `tests/towerBuild.test.mjs`.

### 15.9 Implementation discretion

- Exact `roleOf` boundaries and move lists (15.3).
- Type-resist scoring details in Builders 2 and 3 (using Dex type chart).
- Final tightened diversity bounds (15.7).

## 16. Intact sets, multiple Mega Stones, one-slot draft, and trade table (2026-11-18)

User feedback: "메가진화를 하나만 허용하는 게 이해가 안 돼", "도구 중복 불가 때문에 의미 없어지는 샘플이 너무 많아", "배치는 같은 줄에 있는 포켓몬끼리 교환될 것처럼 보이는데, 막상 눌러보면 다른 경우가 많아", and "뒤에 나올 슬롯은 미리 고르지 못하게 해줘. 그래야 더 긴장감 있을 것 같아". User choices: keep Item Clause while keeping sets intact, allow multiple Mega Stones, and use mockup A for the trade table.

Findings: real 포켓몬 챔피언스 rules (Showdown `Flat Rules`) enforce Item Clause (`Item Clause = 1`), whereas the one-Mega-Stone cap was a site invention; the engine allows multiple Mega Stones and enforces one Mega Evolution per battle (which `battleCpu.js` already tracks). Swapping duplicate items to fallback items from species-wide ladder stats broke set cohesion. In a 40-match post-draft sample, each player Pokémon had 0 to 5 legal swap targets (Chapter 15 opponents do not have one per tier), and 52 of 80 swaps hit an item collision.

Rules:
- Sets stay intact. Each set has only its primary item (`engine.mjs` `itemOf`) with no item substitution. On item collision, pick another set of the same species with a free item, or move to another species. Applies uniformly to `drawInto`, `towerBuild.mjs` `add`, and draft. Sets whose primary item is in `STREAK_BAN` are skipped.
- Multiple Mega Stones are allowed everywhere (draft, swaps, opponents, random teams).
- All 18 draft candidates hold 18 distinct items (`draftOffer`), so every pick enters the team exactly as displayed without mutating other slots. Removed legacy fallback `items`, `SPARE_ITEMS`, per-row non-Mega forcing, and `HELD` item frequencies. Existing open drafts keep `items` compatibility inside `draftParty`.
- Draft unlocks one slot at a time: unreached slots stay locked and hidden until their turn, while already-picked slots can be reopened. All candidates still arrive from the server at once (UI pacing rule, not anti-peek security).
- Swapped-in Pokémon keep their exact set. If any of the five remaining team members holds that item, `swapParty` rejects with `"item"`; swapping out the holder of that item is legal.
- On victory, the battle function returns both full six-Pokémon teams (`beaten` and pre-battle `own` before berries are consumed; nothing new leaks since replays are public). The UI runs the exact same `swapParty` check to mark legal and blocked trades upfront (`Streak.jsx` `tradeRows`), falling back to species-only display against older functions.

Screens (`DESIGN.md` "Battle", The draft and the trades): one row per owned Pokémon with all eligible opponent targets to its right (at least three slots, empty panels filling gaps). Owned Pokémon with no legal swap dim out; item-blocked opponent slots dim in-row and explain why on click.

Verification: `tests/streak.test.mjs` (18 distinct draft items, exact picked items, multi-Mega swaps, item-collision rejection and same-item replacement), `tests/battleEngine.test.mjs`, and `tests/towerBuild.test.mjs` (every team member uses an intact set). Opponent species max frequency briefly rose to 3.8x (파이어로) above the 3.5x cap because common items like 기합의띠 blocked sets; curating sets to 1-2 builds per species (`SAMPLE_SETS.md` Section 5) and adding `FEW = 12` (`towerBuild.mjs`, 15.7) brought it back under 3.5x. 2000 draft simulations filled all three candidates in every row (기합의띠 in nearly every draft, mean 8.2 Mega candidates). Trade table verified in the lab (`SwapTable`, `tradeRows`) at 390 px and 1440 px in both themes across normal and +1 swaps, with full-run harness verification (`scripts/verify-streak-function.mjs`) before deploy.

## 17. Game-like draft, between-match beats, and doors (2026-11-18)

User feedback: "지금 배틀과 도전의 탑은 실제 게임처럼 느껴지지 않고 엑셀처럼 느껴져", choosing "전부 B로 진행해줘" on mockups, and dropping type squares under door sprites ("상당히 무의미한 것 같아. 그냥 포켓몬 이미지만 넣어서 심플하게 해줘").

UI-only change: battle function requests/responses (`streakStart`, `streakDraft`, `streakNext` `swap` and `door`), SQL, and computer stay untouched, and `scripts/verify-streak-function.mjs` passes unchanged.

Screens (`DESIGN.md` "Battle", The draft, The doors, The break in three beats):
- Draft: each slot's three cards start face-down and flip in sequence once sprites finish loading. The chosen sprite flies to its top slot while the other two dim. Next slot's three sprites preload during idle time after the current flip.
- Between-match asks one thing per beat: result (win/loss, streak, floor track and lamps, or opponent sets on loss), trade (on win when both full teams are present), and next doors (tower viewed from the base of the next door with doors below, walking into the chosen door via `tower.js towerBreak` and `towerShow`). Server-rejected trades return to the trade beat with that slot disabled.
- Doors display sprites only without type ticks (silhouettes were mocked; plain sprites are default).
- Run end stays one combined scene (climbed floors plus monthly top three).

Verification (PGlite harness + dev server `ypl-dev-battle`): captured full runs from draft through win, trade, tough door, loss (1 lamp left), gatekeeper door, and Floor 2 match 1 at 1440 px and 390 px in both themes. Completed a six-match run using keyboard only (Enter across cards, trade cells, doors, buttons) and under reduced motion. Mobile-speed frame metrics are logged in `docs/BATTLE_FRAMES.md`. Also verified loss review inside the result beat after a real harness loss.

## 18. Climbing cups with time windows and participants (2026-11-19)

User feedback: "정모 기간 순위 산출을 따로 했다는데 관련 기능을 구현할 수 있어? ... 이건 정모용입니다! 라고 하는 것보다는 다양한 곳에 활용될 수 있는 기능을 추가하고 그것을 정모에 활용하는 방향" and "배틀의 방 만들기 기능처럼 누군가 방을 만들어서 정해진 규칙대로 도전의 탑 등반을 경쟁". Committee notes on meetups: "정모 기간 동안 서로 경쟁하는", "그냥 정모 기간동안 순위 따로 산출하기 + 실시간 전광판기능?", "누가 1위 경신하면 알림이 가도록". Approved plan ("이대로 진행").

### 18.1 Summary

Any approved account can open a climbing cup (`등반전`) with a title, start and end times, public or code access, and a counted-run cap. Normal runs started by participants inside that window count toward both the monthly leaderboard and the cup. Running a meetup event simply means opening a cup.

### 18.2 Approaches

| Option | Tradeoff | Decision |
|---|---|---|
| A Cup is a filtered window (time + participants) over normal runs | One tower, zero battle-function edits, no shared draft/seed | Chosen (A) |
| B Separate per-cup runs | Multiple active runs per account, split engine and UI, meetup runs absent from monthly board | Dropped |
| C Shared draft and seed for everyone | Same as retired Daily Tower (Chapter 13); memorizable over retries | Dropped |

### 18.3 Rules

- Any approved account can create a cup, capped at one active cup per account and 50 site-wide per day. The host is automatically enrolled.
- Start times earlier than now clamp to now; end time must fall within 31 days of start.
- Access is either public (listed for everyone) or code-gated (server-assigned 4-digit code, listed only for joined members, visible to host and members). Direct links (`?view=battle&tab=streak&cup=<id>`) also work.
- Counts normal runs (excluding Daily Tower) started by a joined participant inside the window. Runs started before joining or before cup start do not count, and wins after the deadline stop updating so final standings freeze at close.
- Run limit is unlimited or first N runs (1 or 3) to prevent grinding during short meetups. A 0-win run still uses one attempt.
- Ranks each participant by best counted streak, breaking ties by earliest reach (matching monthly rules). Participants with zero wins still appear at `0연승` so meetup rosters stay visible. Active runs show an amber lamp and open spectating.
- New-leader alert: reaching >=2 wins and beating every other participant's best sends a `record` notification to all other participants (account-linked devices only, once per streak value per cup, never after close).
- The host can close the cup early (deleting it if it has not started yet).
- Isolated from official league records, same as Chapter 5.

### 18.4 Data (`docs/db/tower_cups.sql`, operator-run)

- Three tables (`tower_cups`: id, title, host_user, host_name, starts_at, ends_at, room, code, run_limit, created_at; `tower_cup_players`: cup_id, auth_user_id, trainer_name, joined_at; `tower_cup_runs`: cup_id, run_id, auth_user_id, nth, wins, reached_at), all locked against direct visitor reads and writes.
- Two triggers on `streak_runs`: `tower_cup_enter` inserts a cup-run row on new runs for each matching active cup with attempts remaining; `tower_cup_climb` updates wins before deadline and queues leader notifications. Both catch errors and log warnings so cup issues never block a run.
- RPCs: `tower_cup_create`, `tower_cup_join`, `tower_cup_close` (authenticated), plus `tower_cups` and `tower_cup_board` (public). Battle function stays unchanged. Deploy order is SQL then site; UI hides cups until SQL is applied.
- Verified with `node scripts/verify-tower-cups-db.mjs <pglite>`.

### 18.5 Screens

Specified in `DESIGN.md` "Battle" under 도전의 탑 `등반전`.

## 19. Per-set tiers and stronger gatekeepers (2026-11-19)

User feedback: "포켓몬 샘플에 큰 변화가 있었으니, 티어를 포켓몬 단위가 아니라 샘플 단위로 새로 측정하고, 수문장의 파티도 수문장답게 아주 강력한 구성으로 나오게 고쳐줘", "수문장의 파티가 수문장답지 않은 경우가 많아. 오히려 그 전의 파티가 훨씬 강해 보여", and "리더인(배경이 흰색으로 표시되는) 포켓몬도 메가진화 포켓몬이 아니야".

Root causes:
- Ratings and tiers (`species-power.json`) were still per-species from 2026-11-09 on pre-curation sets (1318 sets), never recomputed after 2026-11-18 trimmed sets to 310 curated builds (`SAMPLE_SETS.md`). Two sets of the same species (e.g., 에이스번 생명의구슬 vs 구애스카프) always shared one tier.
- Since Chapter 15, gatekeepers used the same builders and `PLAN` rating target as normal opponents with only a one-step AI bump, often rolling weaker teams than the prior match. Fixed Mega gatekeepers (`GATEKEEPERS`) had also been removed in Chapter 15, leaving slot 1 (the inverted-background leader on team preview) as whichever Pokémon the builder picked first.

Rating run (`scripts/rate-species.mjs --play --draw sets`): draw six uniformly from all 310 m-c singles sets (unique species, no duplicate items, validated) keyed by `partyBalance.js` `setKey` (species, item, moves). Across 6018 decided games (first 422 at 100 ms/move, rest at 50 ms sharing cores with another benchmark; symmetric conditions preserve relative ratings), each set averaged 233 appearances. First-seat win rate across mirrored pairs was 49.9% ± 1.4.

Fitting method chosen via holdout (train on 2986 even pairs, score on 3032 odd pairs; coin-flip log loss 0.6931):

| Method | Log loss | Accuracy |
|---|---|---|
| Per-set, shrunk to 0 (L2 2) | 0.7421 | 54.6% |
| Per-species, same games (L2 2) | 0.7367 | 53.7% |
| Per-set, shrunk strongly to 0 (L2 50) | 0.6860 | 53.9% |
| Per-species, shrunk strongly to 0 (L2 50) | 0.6845 | 53.9% |
| Old table (Chapter 11, per-species) as-is | 0.6997 | 56.4% |
| Half of old table | 0.6822 | 56.4% |
| Per-set, shrunk toward half of old species rating (L2 100 to 200) | 0.6795 | 56.5% |

- Fitting 310 parameters from scratch on 3000 games underperforms a coin flip, and set-vs-species splits sit inside noise at that sample size. The old 8000-game species ordering remained accurate but over-scaled.
- We therefore shrink each set toward half its prior species rating (`--fit --prior --prior-scale 0.5`, `--lambda 200` for the full 6018 games). Sets that perform differently move away from their prior, while low-sample gaps inherit species strength. Future re-fits will shrink toward the current weighted species mean.
- In `species-power.json` (m-c singles), `sets` stores per-set ratings, `rating` stores appearance-weighted species means, and `fit` records shrinkage params. Doubles remains per-species (not re-run).

Tiering:
- All m-c singles random teams (`engine.mjs` `randomTeam`, including regular CPU and casual) now bucket and sum by set, letting two sets of the same species occupy different tiers.
- Tower tiers (`src/data/tower-tiers.json`, built by `rate-species.mjs --tiers`) split the 173 sets of the 134 ranker species into six equal-sized tiers keyed by `setKey`. `build-ranker-teams.mjs` now writes teams only and runs `--tiers` in a separate step so the new ratings reload cleanly.
- `draftOffer` draws from per-set tier rows, and `swapTier` reads the full set (item + moves), falling back to species-mean rating cutoffs if an older function sends only species names.
- Impact: 71 of 173 sets (41%) changed tier from species-level bucketing, 10 by two or more tiers, and 21 species split their two sets across tiers (에이스번, 마스카나, 핫삼, 맘모꾸리, 루카리오, etc.). Big risers: 불카모스 자뭉열매 (tier 5 to 2), 에써르 구애스카프 and 포푸니크 노말주얼 (4 to 2), 이상해꽃 and 아쿠스타 Mega (5 to 3). Big drops: 미끄래곤 (Hisui) and 입치트 Mega (1 to 3), 우츠보트 and 이어롭 Mega (2 to 4). Tiers 3 through 5 sit within ~0.1 rating of each other (near noise), making top and bottom tiers distinct while the middle band is closely matched.

Gatekeepers (`towerBuild.mjs` `towerFoe(..., keeper)`, `streakDoors` `gate`):
- Leader (slot 1, inverted card on team preview) is always a Mega Evolution drawn from the top two full-pool set tiers (`GATE_LEAD`).
- Remaining five draw solely from non-Mega sets in the top three tiers (`GATE_REST`, upper half), making the leader the team's sole Mega. All four builders and `seen` still apply; the builder generates 12 candidates and picks the highest rating sum (no `PLAN`/`BAND` cap).
- If the computer leaves the leader out during team preview, `withLeader` (`streakEngine.mjs`) inserts it into the third slot without modifying `battleCpu.js`.
- AI ladder stays unchanged (gatekeepers remain one step above normal).

Strength benchmarks (local PC, 100 ms/move, full computer with random draft vs match AI, 300 mirrored games per row):

| Opponent | Draft-side win rate |
|---|---|
| Floor 1 normal (폴리곤) | 78.0% ± 4.9 |
| Floor 1 gatekeeper, old (normal team, 폴리곤2) | 68.0% ± 5.6 |
| Floor 1 gatekeeper, new team (폴리곤2) | 52.7% ± 6.0 |
| Floor 3 gatekeeper, new team (폴리곤Z) | 46.0% ± 6.4 |

- Mean rating sums (40 teams each): gatekeeper `0.79` vs normal `0.04`.
- Floor 1 clear rate (four normal matches + gatekeeper with <=1 loss) drops from ~55% (`0.78^4 * 0.68` plus one-loss paths) to ~46%, hitting 14.6's ~46% target. Re-check after one week live; tightening `GATE_REST` from 3 to 2 is the next lever if needed.

Weather archetype fix (same day): switching to per-set ratings pushed max opponent species frequency to 4.0x (마기라스, already 3.37x before) above the 3.5x test cap because sand accounted for half of ranker weather weight yet only 마기라스 and 하마돈 set sand (with no sand abusers in the pool). Builder 4 now weights all ranker weather types equally, keeping the 3.5x cap intact.

Verification: all 643 `npm test` tests pass. `tests/streak.test.mjs` checks full tier coverage, equal bucket sizes, monotonic tier ratings, per-set draft rows, Mega-only gatekeeper leader with rating sum >=0.5 above normal, and `withLeader`. `tests/towerBuild.test.mjs` scores builders by set rating. Full-function SQL verification (`scripts/verify-streak-function.mjs`) was skipped locally due to missing PGlite (`index.ts` was untouched). Deploy order is battle function (`npm run build:battle` then deploy), followed by site; no SQL changes.

## 20. Almanac motion (2026-11-24)

When the site moved from YPL Scoreboard to YPL League Almanac, recorded frames showed the tower still using Scoreboard motion (card flips from backs, 1-frame bold selection snaps, hard cuts between hearts and beats, layout-animated darkness). User feedback: "짚은 거 싹 다 바꿔." The tower now uses only Almanac motion verbs (`DESIGN.md` "Motion"). `src/pages/battle/Streak.jsx` animates via `.animate` (excluded from design-law checks like the stage), timed with `DUR` and animating only `transform` and `opacity`.

- Arrivals rise 12 px while fading in over 420 ms. Grouped elements stagger in reading order by 38 ms (capped at 260 ms), followed by sprites via tone and buttons last. Sprites still downloading fade in via tone on arrival so they never pop (`arrive`).
- Draft candidates arrive directly without card backs (removing the 2026-11-18 flip). When switching slots, current cards exit in place over 260 ms and the next three rise in the same spot starting at 160 ms, leaving no blank frame. A selected card's 2 px rule draws left-to-right over 160 ms. One underline slides across the six top slots (`slideLine`).
- Selections on doors, trades, cards, and gatekeepers neither fill nor box-outline; a 2 px rule draws from the start edge via `::after` `scaleX`. Door rules draw in their own color over 420 ms and retract over 260 ms when deselected. Trade rules draw in sequence across own slot, marker, and target in 38 ms steps left-to-right. Gatekeeper banners (menu stakes, preview strip, between-match nameplate) draw their rule on entry. Existing 1 px rules stay still while only the 2 px rule moves.
- Hearts: 420 ms after the result number updates, a spent heart empties in place (fill fades out over 420 ms ease-in, outline stays dim), while a heart restored by a gatekeeper fills via tone. Pre-match heart count is derived from `lives + 1` on loss or the held count (`heldLives`) on a gatekeeper win; reloads do not replay restored hearts.
- Three between-match beats: switching beats exits the current beat and its buttons over 260 ms, then rises the next beat's elements in 38 ms steps (result lines, trade header and six rows, door nameplate and doors). Trade and door sprites preload while the result beat sits on screen.
- Win track: after the counter updates, the won match's rule draws left-to-right over its 1 px line (420 ms) and the next slot shifts to dim via tone (`climb`). On a gatekeeper win, all five lit floor rules hold for 1260 ms before the floor number shifts via tone and the new floor's track appears.
- Run end arrives as one choreographed scene in 38 ms reading-order steps: streak, rank, three loss-review sets, climbed floor rules from top down (each drawing left-to-right), the losing match's rule lighting up then settling to muted, and finally the monthly top three. The scene waits up to 1200 ms for the monthly board to load so rank never jumps in late.
- Darkness from walking through a tower door never animates layout when transitioning into the next stage; it mounts directly at the stage rect, transforms from the old rect (translate + scale), and clears over 680 ms.
- The amber mark on the tab's active-run row shows only while a match is live, never while paused between matches.
- Under reduced motion, everything mounts in place with tone transitions only.
