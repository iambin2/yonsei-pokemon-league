# Battle computer

This document records how the single-player battle computer chooses moves, how we measure whether it got stronger, what we tried, and what worked. Anyone changing the computer (human or AI) should read this first and add a row to the experiment log in Section 5 after making changes.

## 1. File locations

| File | Role |
|---|---|
| `src/services/battleCpu.js` | Full computer logic: team preview selection, move choice, opponent set sampling, and deduction |
| `src/pages/battle/cpu.worker.js` | Runs the battle engine and computer inside a browser worker. Nothing is sent to the server during a match |
| `supabase/functions/battle/engine.mjs` | Showdown engine wrapper: random teams, validation, replays, and reading computer battle logs (`readCpuRecord`) |
| `src/data/random-sets.json` | Per-species sample sets used to build random teams and as the computer's prior for guessing opponent sets. M-C redistributes ladder EVs (`docs/SAMPLE_SETS.md`) and trims builds to one item per build so most species have one set (`scripts/curate-sets.mjs`, Section 5 of the same doc) |
| `src/data/random-sets.ladder.json` | Raw sets built from ladder usage. `scripts/build-random-sets.mjs` regenerates this from Smogon usage stats, and `scripts/tune-sets.mjs` builds `random-sets.json` from it |
| `scripts/sets-benchmark.mjs` | Set benchmark that pits the same Pokémon with new sets against raw sets |
| `scripts/cpu-benchmark.mjs` | Main benchmark that pits two computer versions against each other to measure strength (Section 3) |
| `scripts/cpu-readability.mjs` | Predictability benchmark that pits the computer against an opponent that predicts its move (Section 3) |
| `scripts/learn-cpu-sets.mjs` | Blends real YPL player teams into sample set weights (Section 6) |
| `docs/db/cpu_battles.sql` | Private table storing input logs of finished computer battles |
| `tests/battleCpu.test.mjs`, `tests/cpuLearn.test.mjs` | Tests for the computer and set learning |

Because the computer runs in the browser, edits to `battleCpu.js` go live with a normal site deploy. Edits to `engine.mjs` or `random-sets.json` also affect server-side random teams, so run `npm run build:battle` and redeploy the battle edge function as well.

## 2. Move selection

This is not reinforcement learning. It uses standard imperfect-information search paired with a hand-tuned position evaluator.

1. For determinization, the computer fills each unrevealed opponent Pokémon by sampling one candidate set. Candidates come from sample sets plus 1%-weight variants that give all-attacking sets 구애스카프, 구애머리띠, 구애안경, or 돌격조끼.
2. For deduction, after each turn ends, the computer replays each candidate against the pre-turn state and drops any candidate inconsistent with actual turn order (at equal priority) or observed damage (within the damage roll range). Turns involving switches, Mega Evolution, stat changes, weather, critical hits, or protection are skipped, and any turn that would eliminate all candidates is ignored.
3. For candidate pruning, choices for both sides are narrowed using heuristics (expected damage, KOs, priority, status move utility), dropping moves that do nothing against the active opponent.
4. For matrix evaluation, every pair of choices is simulated for one turn in the real engine, followed by one extra turn where both sides pick their strongest attack, and then scored with `evaluate` (remaining Pokémon and HP, status conditions, stat stages, hazards, screens, and matchup outcomes). Simulation RNG is fixed to the median (`steady`: events with >=50% chance always happen, events below 50% never happen, and damage uses the average roll). Phones only fit 1 to 3 samples per move, so random RNG rolls used to let a single miss dictate the move.
5. For the opponent model, the computer blends the matrix Nash equilibrium 50/50 with human-likely moves. Expected opponent switch rate starts at half the model's value (humans switch half as often as the model, per 2026-11-19 data) and shifts toward how often this opponent has actually switched. The computer then picks the move with the highest expected value against that mix. Switching carries a penalty (0.12, plus an extra 0.2 if withdrawing a Pokémon that has not moved since entering). On turns where a switch is within 0.1 of the best option, the computer draws among options within that margin according to equilibrium weights so it does not repeat the same switch in identical positions.
6. Steps 1 through 5 repeat and average while time remains. Budgets are fixed at 1.4 seconds for singles and 2.2 seconds for doubles, so slower phones simply take fewer samples.
7. For team preview selection, the computer builds a 6-by-6 1v1 matchup table. Pokémon holding a Mega Stone are evaluated in Mega form. Every opponent Mega holder is assumed to Mega Evolve, while each of our own team combinations is scored by assuming the best single Mega Evolution choice.

## 3. Strength benchmarks

```bash
npm run bench:cpu -- --games 300
```

This pits the working tree's computer (B) against the last commit (A). Both versions play mirrored pairs with identical teams and seeds, so wins come from decisions rather than team luck. Output includes B's win rate, 95% confidence interval, Elo difference, and a verdict ("B is stronger", "B is weaker", or "No difference shown").

- `--base` sets A's version (default `HEAD`). Compare against `origin/main` to match production since local `main` can lag behind. `quick` selects a simple bot that always picks the strongest attack.
- `--parties` selects team generation: `random` (random sample-set teams), `spiced` (one-third of offensive sets given Choice items), `tuned` (one tweak per Pokémon from its sample set: swapping an invested stat with an uninvested stat, flipping nature between offense and Speed, or replacing one move with another move from a different sample set of the same species; the computer still assumes original sample sets, measuring performance when beliefs are wrong), `ranker` (full top-433 ranker builds from `ranker-teams.json` paired with matching item sample sets, singles only), and `players` (real player teams; requires `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`, kept in memory only).
- `--a` and `--b` pass JSON options to `createCpu`, such as `--b '{"reads":false}'`.
- `--kind doubles` benchmarks doubles.
- The runner uses half the CPU cores and completes about 5 games per minute. Raising concurrency above the core count slows down unbudgeted work and reduces throughput.

Predictability is measured separately because self-play opponents do not try to read the computer, so a repetitive bot does not look weaker in self-play.

```bash
node scripts/cpu-readability.mjs --games 200            # working tree computer
node scripts/cpu-readability.mjs --games 200 --ref HEAD  # last commit computer
```

This pits the computer against a reading opponent that sees the computer's full team, asks a separate copy of the same computer (with independent RNG and deduction) what it would play each turn, and chooses the best counter. It reports prediction accuracy (overall move, switch and switch target) and the computer's win rate. At 400 ms per move, 200 games take about 10 minutes. Run it before and after changes to compare.

At 300 games, the margin of error is roughly ±5%. Smaller effects will not show up, so increase game count or bundle small changes before measuring.

## 4. Improvement rules

1. Any change to move selection must be benchmarked using Section 3. Default to 300 singles games, and run doubles too if doubles behavior is affected.
2. Keep changes that score "B is stronger". On "No difference shown", keep only verified correctness features (such as tested deduction logic) or bug fixes; revert changes intended solely to add strength. Always revert "B is weaker".
3. Log every result as a row in Section 5, including failures, so we do not repeat dead ends.
4. Do not increase thinking time. Mean decision time in the benchmark must stay within 1.4 seconds (singles).
5. The computer must rely only on public information, just like a human player. Never break the `the computer never reads the other side's hidden set` test.

## 5. Experiment log

All benchmarks below are singles, 1.4 s budget, mirrored pairs with identical teams unless noted otherwise.

| Date | Change | Result | Decision |
|---|---|---|---|
| 2026-11-06 | 4x thinking time (300 ms vs 1200 ms) | 14 wins in 36 games | Time is not the bottleneck |
| 2026-11-06 | Endgame search: 3x3 next-turn matrix played out to completion when <=4 Pokémon remain | 31 wins in 64 games. At 4 s/move, 28 wins in 48 games. 1-turn lookahead scored 26 wins in 64 games | Reverted. Evaluation quality is the limit, not search depth |
| 2026-11-06 | Deduction (Speed order and damage rolls) | 51.3% ± 4.7 over 300 games vs prior code on Choice-spiced teams; 47.5% ± 6.1 over 200 random games | Kept (`9fa1eec`). Tests verify catching hidden 구애스카프 and 구애머리띠 on turn 1. Effect against pure sample teams is under 5% |
| 2026-11-06 | Evaluate Mega Stone holders in Mega form during team preview | 55.3% ± 4.9 over 300 games vs previous commit, Elo +37 | Kept (`709a4d7`). First confirmed strength gain |
| 2026-11-06 | First 폴리곤2 difficulty settings (no reads, 0.7 s, slack .2, mistake .1) | 41.7% ± 11.6 over 60 games vs 폴리곤Z | Dropped. Not clearly separated from 폴리곤Z |
| 2026-11-06 | 폴리곤2 difficulty (no reads, 0.5 s, slack .35, mistake .18) | 34.0% ± 6.5 over 100 games vs 폴리곤Z, Elo -115 | Kept. Clear one-tier step down |
| 2026-11-06 | 폴리곤 difficulty (no reads or lookahead, 0.3 s, slack .6, mistake .3) | 26.7% ± 9.1 over 60 games vs first 폴리곤2, 31.7% ± 12.9 over 60 games vs new 폴리곤2, 35.0% ± 12.5 over 40 games vs strongest-attack bot | Kept. Beginner tier |
| 2026-11-07 | Bug fix: in doubles, when the ally fainted and only an ally-targeted move like 도우미 remained, emitting untargeted `move 1` caused engine rejection and stalled the computer (found by battle-fuzz). Now targets the empty ally slot (fails cleanly). No change when other moves exist | Doubles 2.2 s, 300 games: 50.3% ± 5.3, Elo +2, 0 rejections | Kept. Bug fix allowed on "No difference shown" (Section 4.2) |
| 2026-11-07 | Two fixes from three human-loss replays: lower alive bonus in `evaluate` from 1 to 0.6 (a 1% HP Pokémon counted as half a healthy one), add 0.3 for 탈 and full-HP 기합의띠 or 옹골참, and lock simulation RNG to median (`steady`) | Eval change alone at 1.4 s, 300 games: 51.7% ± 4.9. Both at 1.4 s, 300 games: 50.0% ± 4.6. Both at 0.4 s (phone sample count): 53.7% ± 4.6 over 300 games, 53.3% ± 3.3 over 600 games (Elo +23 [0, 47]), 53.0% at 687 games (stopped early from 1200 target) | Kept by operator decision. Rule says "No difference shown", but no measurement regressed and the exact replay blunders (Game 1 turn 2 wasting 탈, Game 3 turn 1 switch) are fixed on replay |
| 2026-11-07 | Server computer for streak runs (`docs/BATTLE_STREAK.md` Section 4). Tested a fixed sample count option `samples` instead of time budget (Edge and this PC picked identical moves across all 576 moves on matching seeds) | 3 samples vs 1.4 s computer: 52.3% ± 4.8 over 300 games (Elo +16); 2 samples: 47.3% ± 4.5 (Elo -19). On Edge, 3 samples hit 1906 ms worst move across 30 games because heavy turns make each sample expensive. 220 ms time budget (matching 400 ms on Edge) vs 1.4 s computer: 50.0% ± 4.9 over 300 games (Elo 0). Edge 400 ms across 30 games (324 moves): mean 407 ms, p95 598 ms, max 815 ms | Reverted `samples`. Server keeps time-budget mode at `budgetMs: 400`: narrowing the first sample's width caps worst-case time around 2.2x budget (1028 ms at 450 ms, 1541 ms at 700 ms). An idle desktop at 1.4 s averages 13.9 samples per move yet ties 220 ms, confirming thinking time is not the limit |
| 2026-11-07 | `memory()` and `memory` option to serialize and restore deduction state (opponent candidates and previous turn) as JSON for stateless server requests | Move choices unchanged: a computer recreated from JSON every turn produces the exact same input log as a single continuous instance (tested; fails if state is not passed) | Kept. Identical play requires no benchmark |
| 2026-11-07 | Server difficulty budgets for streak runs: 폴리곤 Edge 300 ms (165 ms local), 폴리곤2 and 폴리곤Z Edge 400 ms (220 ms local) | 폴리곤2 vs 폴리곤Z: 37.3% ± 4.6 over 300 games (Elo -90). 폴리곤 vs 폴리곤2: 39.3% ± 5.1 over 300 games (Elo -75). Each run had 1 engine rejection (singles) | Kept. Matches phone tier spacing. Rejections came from hidden 그림자밟기 (next row) |
| 2026-11-07 | Bug fix: in singles under hidden trapping like 메가팬텀's 그림자밟기 (`maybeTrapped`), the engine rejected switches listed in the request (1 rejection in weak-tier 220 ms benchmark, 4 rejections in 320 seeded 100%-mistake fuzz games). Search already counted them as rejected on its belief copy, but weak-tier mistakes and the forced-switch shortcut when all moves are immune bypassed search. Now filters candidates through the belief copy whenever `maybeTrapped` or `maybeDisabled` is set | 1.4 s, 300 games: 48.3% ± 4.8, Elo -12 [-45, 22], 0 rejections. Fuzzing: 0 rejections across 320 singles and 120 doubles games | Kept. Bug fix allowed on "No difference shown" (Section 4.2) |
| 2026-11-08 | Gradual per-match difficulty scaling in streak runs: floor-1 midpoint between 폴리곤 and 폴리곤2 (193 ms local, slack .475, mistake .24) vs 폴리곤 (165 ms) | 300 games: 50.3% ± 5.0, Elo +2 | Dropped. Single-match increments are indistinguishable. Keep measured difficulty tiers for front and back halves of floors (`BATTLE_STREAK.md` Section 5) |
| 2026-11-11 | Added `tuned` and `ranker` team modes to benchmark (prep for Section 7.4). Move selection unchanged. Baseline on `tuned`: reads off (B) vs reads on (A) | 200 games: 49.0% ± 6.1, Elo -7, 0 rejections, mean 1181 ms | Kept. Deduction gains nothing when each set differs by one tweak because candidates lack those variants and only get pruned without hitting the truth. Section 7.4 must score "B is stronger" in this mode |
| 2026-11-11 | Accuracy branching (`chanceToHit`): for our moves under 100% accuracy, evaluate each matrix cell twice (hit and miss) and weight by accuracy. Previously `steady` treated 70% moves as guaranteed hits. Trimmed opponent candidate width to offset extra cells | 300 games: 51.3% ± 4.9, Elo +9 [-25, 44], 0 rejections, mean 1191 ms, max 1975 ms | Kept as a verified correctness feature (Section 4.2): tests confirm picking a guaranteed KO over a 70% KO (disabling branching fails 1 of 5 seeds). Does not yet read accuracy stages, 넓은렌즈, 복안, or weather accuracy |
| 2026-11-11 | Broader belief set: added 3%-weight EV variants (swapping Speed investment with least-invested bulk, or most-invested bulk with Speed) and nature variants (고집 and 명랑, 조심 and 겁쟁이, etc.) per sample set. Tested that Speed-invested 괴력몬 moving before 킹갬빗 narrows candidates to Speed variants | `tuned`, 300 games: 48.7% ± 5.0, Elo -9 [-44, 25], 0 rejections, mean 1214 ms, max 2370 ms | Reverted. Required "B is stronger" in `tuned` mode. Even accurate reads rarely change subsequent moves in ~11-turn games, and most `tuned` tweaks (Attack/Defense swap or move swap) fall outside these variants. Before retrying, count how many turns per game are actually lost to wrong beliefs to bound upside |
| 2026-11-11 | Coverage term in evaluation (`cover`, `TUNE.answer` 0.3): average our best matchup score against each remaining opponent Pokémon and subtract the opponent's equivalent score. Previously `evaluate` only looked at the two active Pokémon, scoring an unstoppable late-game sweeper the same as a swept position | 300 games: 54.3% ± 4.9, Elo +30 [-4, 65], 0 rejections, mean 1263 ms, max 2586 ms. Operator skipped 600-game confirmation | Kept by operator decision. Rule says "No difference shown", but this is the strongest signal in the plan with no sign of regression. Weight 0.3 is uncalibrated; fitting weights from self-play positions and outcomes is the next candidate |
| 2026-11-12 | Sample set update (computer's opponent prior). Dropped full redesign after scoring 34.5% ± 4.6 and 46.3% ± 4.7 in singles, keeping only EV redistribution (`docs/SAMPLE_SETS.md` Section 3) | Knowing the opponent's exact sets swung win rate by about 12 points on identical teams (34.5% when the computer knew the redesigned sets vs 46.3% when it assumed raw sets) | Move logic unchanged. That 12-point gap shows belief accuracy has meaningful upside for Section 7.4 |
| 2026-11-08 | Floor boss teams: drawn only from top-24 usage species vs normal computer teams, same computer on both sides (220 ms), fresh teams mirrored per pair | 300 games: 56.3% ± 5.6 | Kept. Team pool change only; computer logic unchanged |
| 2026-11-18 | Sample set curation (`docs/SAMPLE_SETS.md` Section 5): reduced M-C singles from 1329 sets to 280 sets, one item per build, mostly one set per species. Changes the computer's belief prior; code unchanged | Same code (`HEAD`) vs working tree on curated random teams, 300 games: 50.3% ± 4.5, Elo +2 [-29, 34], 0 rejections, mean 1305 ms, max 3444 ms. Set benchmark (curated vs pre-curated when curated is read): 400 games, 50.2% ± 4.3 | Kept by operator direction. Because this is a data change, both sides share the same prior here; this confirms zero rejections and healthy decision times. Initial misread impact against off-sample player sets must be measured with `--parties tuned` or `players` |
| 2026-11-19 | Halving tower server computer thinking time (backend optimization phase 2). Production timing logs in the battle function showed tower `choose` averaging 571 ms: 383 ms CPU thinking and 188 ms DB. Tested 폴리곤Z at 220 ms local (400 ms Edge) vs 110 ms local (~200 ms Edge) | 300 random games: B (110 ms) won 141/300 = 47.0% ± 5.0, Elo -21 [-56, 14], 0 rejections | Reverted by operator decision ("유지해줘"). Verdict was "No difference shown", but point estimate leaned weaker and thinking time is part of the tower difficulty ladder (`STREAK_STEPS`). To cut tower latency further, target DB round trips (~90 ms each) first |
| 2026-11-18 | Removed 돌격조끼 from deduction variants (`VARIANTS`): item does not exist in 포켓몬 챔피언스 (marked "Past" in engine data). Re-curated samples the same day to one build per role (310 singles, 296 doubles, `SAMPLE_SETS.md` Section 5) | 300 random games, 1400 ms: B (working tree) won 158/300 = 52.7% ± 4.9, Elo +19 [-15, 53], 0 rejections, mean 1279 ms, max 2936 ms | Kept. No strength change shown; corrects an impossible hypothesis |
| 2026-11-19 | Switch audit on 525 human singles games (`cpu_battles`). Findings: computer switched on 19.3% of turns vs 7.7% for humans, repeated the exact same switch 85.4% of the time when queried twice, immediately switched back to a just-withdrawn Pokémon 96 times, and assumed humans switch 38% in losing matchups when actual rate was 19%. Three fixes: halve opponent-model switch prior (`HUMAN_SWITCH`), add 0.2 penalty for withdrawing a Pokémon that has not acted (`CHAIN_COST`), and sample from equilibrium weights when a switch is within 0.1 of best (`READ`, `drawChoice`; 폴리곤 and 폴리곤2 sampling unchanged) | Readability benchmark (Section 3), 200 games, 400 ms: switch+target prediction dropped from 99.1% to 90.6%, move prediction from 94.6% to 84.7%, mean game length from 35 turns (endless switch loops) to 11 turns, computer win rate rose from 33.5% ± 6.3 to 37.0% ± 6.5. Re-querying 1762 live positions: repeat switch rate 85.4% to 79.7%, switch rate 19.3% to 19.1%. Self-play 300 games: 52.0% ± 5.1, Elo +14 [-21, 49], 0 rejections. Mean time on idle PC (40 games): 1178 ms, max 2038 ms (1511 ms during 300-game run had background load) | Kept. Operator-requested anti-predictability feature, verified by unit tests and readability benchmark. Self-play showed no difference. The reading opponent still predicts 9 in 10 switches and switch rate remains 2.5x human rate |
| 2026-11-19 | On top of the above: raised switch cost from 0.12 to 0.2 and mixing margin from 0.1 to 0.2 | Self-play vs above state, 300 games: 49.0% ± 5.0, Elo -7 [-42, 28], 0 rejections. Readability unchanged at 90.2% switch prediction (win rate 38.5% ± 6.4). Live positions: switch rate 19.1% to 17.1%, repeat switch 79.7% to 76.0% | Reverted. Switched less without becoming less predictable or stronger. Widening the margin left predictability flat because most switches score more than 0.2 above alternatives. Reducing predictability further requires changing how switches are valued (accounting for being read), not just sampling |
| 2026-11-19 | Raised `TUNE.answer` coverage weight from 0.3 to 1.0. Logistic regression on 4404 positions from 408 completed human games (HP weight fixed at 1.4, 100 game-level bootstraps) estimated answer 1.77 (90% CI [0.93, 4.77]), alive 0.97 [0.33, 2.95] (current 0.6), status/ranks 1.07 [0.24, 2.51] (current 1), matchup 0.42 [-0.04, 0.97] (current 0.35), intercept -0.93 favoring humans | Self-play vs first row above, 300 games: 50.7% ± 4.9, Elo +5 [-30, 39], 0 rejections (PC slept mid-run so timing unreadable) | Reverted. Game logs suggest a higher answer weight, but self-play showed no gain. Logs mix difficulties and versions (difficulty is not logged) and human skill sits in the intercept, so raising one weight alone is unreliable. Revisit after logging difficulty and fitting on 폴리곤Z games only |

Difficulty levels (`src/services/cpuLevels.js`) are option presets for `createCpu`. 폴리곤Z is the default computer with no extra options, so the rules and experiments above target 폴리곤Z; changing the base computer affects 폴리곤 and 폴리곤2 as well. Whenever you adjust a difficulty preset, benchmark it against its neighbor (pass the weaker tier's options to `--b`, and use a commit from `git stash create` as `--base` to compare working changes) to confirm the lower tier scores "B is weaker".

Human match records in `cpu_battles`: as of 2026-11-06, the computer won 43 of 80 completed games, plus all 14 forfeits. As of 2026-11-19 (singles), it won 209 of 408 completed games (51.2%), with 117 forfeits across all difficulties combined. In those games, the computer won 68% when it never switched and 28% when it switched three or more times (confounded by losing positions triggering more switches).

## 6. Learning

To help the computer read the sets YPL players actually bring, finished battle logs adjust sample set weights. This does not train move selection.

- After each finished computer battle, the client sends the input log, and the battle function replays and verifies it before saving to `cpu_battles`. Player names are replaced with `선수` so no personal names are stored. The table is private.
- `scripts/learn-cpu-sets.mjs` reads only player teams, skipping random teams and duplicate team repeats. Teams sharing at least two-thirds of their sets are grouped as one player so one active player gets one vote. YPL weight is capped at 30% per species, and off-ladder sets need at least three distinct players to enter. Nothing is written if fewer than 30 players are present. Weights are always recomputed from ladder `baseWeight`, preventing drift over repeated runs. Because sample sets use one item per build (`docs/SAMPLE_SETS.md` Section 5), any player set sharing an ability, item category, and at least three moves with a build votes for that build; new sets cluster the same way and always keep one item.
- `.github/workflows/learn-cpu-sets.yml` runs every Monday at 10:00 KST, verifies tests pass, and opens a PR if anything changed. Merging deploys the update. If the `SUPABASE_SERVICE_ROLE_KEY` secret is missing, the workflow exits cleanly.
- Current gap: the benchmark compares code versions, not data versions. Real impact of a learning PR is tracked via human win rate after merge.

## 7. Next candidates

Listed in rough order of expected impact. Benchmark any change using Section 3 and log it in Section 5.

1. Position evaluation is the current bottleneck, not search depth (shown by the 4x time and endgame search experiments in Section 5). Fit evaluation weights against win/loss outcomes from logged positions, or add explicit win-condition checks (whether a remaining Pokémon sweeps the rest of the opponent's team).
2. Run `--parties players` to measure real-world deduction and team preview impact, which should be larger than on sample-based random teams.
3. Run doubles benchmarks, since all measurements so far are singles only.
4. Benchmark against human-built sets. Three human losses happened because the computer locked onto one sample set (assuming max-Speed Charizard Y caused Archaludon to switch repeatedly, missing HP investment led to using 스텔스록 assuming a guaranteed OHKO, and seeing 풍선 on Gholdengo led it to assume no 10만볼트). Random-team benchmarks never trigger these errors because beliefs always match. Add a team mode that alters one EV spread, nature, or move from sample sets, then add Speed and bulk variants to candidates. Most player teams in `cpu_battles` come from the random-team button, so `players` mode does not test this.
5. Improve phone sample counts. Phones manage about 1 sample in 1.4 seconds (idle desktops averaged 13.9 on 2026-11-07, though 220 ms tied 1.4 s, so upside may be small). Cutting the cost of evaluating a second move (currently recreating the battle from JSON via `revive` every time) would let Monte Carlo belief sampling actually run on phones.
6. Preserve deduction across page reloads. Reloading mid-battle currently wipes deduction state; replaying the input log turn by turn on load fixes this.

## 8. Handover notes

What you need to keep improving the computer:

- Write access to GitHub repo `iambin2/yonsei-pokemon-league`. Pushing to `main` deploys the site. Because it currently lives under a personal account, add new maintainers as collaborators or transfer it to an organization when leadership changes.
- Repository secret `SUPABASE_SERVICE_ROLE_KEY` (used by the learning workflow and `--parties players`), found in the API settings of the production Supabase project (`rqffrogcverfjqzjasax`). This grants full DB access; never expose it outside the repository.
- Supabase project access only when modifying the battle edge function (`npm run build:battle` followed by function deploy).

Workflow: read this document, pick a candidate from Section 7, implement it, run `npm test` and `npm run bench:cpu -- --games 300`, keep or revert per Section 4, and add one line to Section 5 before committing.
