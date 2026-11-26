# Sample sets

Per-species sample sets in `src/data/random-sets.json` supply random parties, inform the battle computer's opponent set inference, and feed `도전의 탑` opponent builders. This document explains how the current Regulation M-C sets are built and what measurements shaped them.

## 1. Build pipeline

| Step | Command | Output |
|---|---|---|
| Ladder sets | `STATS_CACHE=<dir> node scripts/build-random-sets.mjs` | `src/data/random-sets.ladder.json`. Ranker sets built from Smogon usage stats (prioritizing 1760+ rating), preserved as the raw baseline |
| Stat point tuning | `STATS_CACHE=<dir> node scripts/tune-sets.mjs` | Regulation M-C singles and doubles in `src/data/random-sets.json`. Prior Regulation M-B stays unchanged from ladder |
| Curation | `node scripts/curate-sets.mjs` | Reduces M-C in the same file to one build and one item per set (section 5). Idempotent on re-runs |
| Docs render | `node scripts/render-sample-sets.mjs` | `docs/sample-sets/m-c-singles.md` and `m-c-doubles.md` |
| Benchmark | `node scripts/sets-benchmark.mjs --kind singles --games 400` | Win rate of tuned sets against raw ladder sets on identical species |

`STATS_CACHE` must contain the four 2026-10 chaos stat files: `-1760` and `-0` for both `gen9championsbssregmc` and `gen9championsvgc2026regmc`. Weekly learning (`scripts/learn-cpu-sets.mjs`) blends weights on top of this output.

## 2. Tuning rules

Moves, items, abilities, natures, and Speed investment remain exactly as chosen by ladder rankers. Only the remaining stat points (up to 32 per stat, 66 total, where 1 point equals 1 stat point at level 50) are redistributed against target benchmarks. Targets are the top 20 most-used species at 1760+ rating, each using its most common ladder set. Damage is calculated with `@smogon/calc` using the `포켓몬 챔피언스` formula.

- Offense: never increased above ladder investment. Reduced only to the minimum that preserves every guaranteed KO threshold achievable with the ladder spread against all 20 targets, checked at both min and max rolls and at full HP and 75% HP.
- Bulk: leftover points go one point at a time into HP or whichever defensive stat the ladder spread already invests in (or both if neither has investment), choosing the stat that adds the highest usage-weighted survival thresholds against the top 20's strongest attacks.
- Sets that attack with Defense, such as 바디프레스, keep Defense locked alongside Speed.
- If a new spread loses more usage-weighted KO/survival thresholds than it gains, it is discarded in favor of the ladder spread.

## 3. Benchmarks

Two CPU instances (300 ms per turn) play identical six-species teams, one with tuned sets and one with raw ladder sets, then swap sides and play again. Because the CPU uses `random-sets.json` for opponent inference, whichever side holds those sets gets read accurately by the opponent. That information penalty measured roughly 12 percentage points (first two rows below), so benchmarks are evaluated from the disadvantaged side (when the tuned set is the one being read).

| Date | Change | Result | Decision |
|---|---|---|---|
| 2026-11-12 | Full redesign: picked moves, items, abilities, natures, and stat points from a 1v1 matchup model (top 40 species at full HP, half HP, and switch-in), locking status moves used by 50%+ of rankers | Singles 400 games: 34.5% ± 4.6 when new sets are read, 46.3% ± 4.7 when ladder sets are read | Rejected. The model undervalued Speed (average investment dropped from 18.2 to 12.7) and status moves (0.57 to 0.37 per set). A 1v1 model cannot capture switching, team preview, or turn order |
| 2026-11-12 | Stat point redistribution only, no offensive cap | Singles 400 games: 50.0% ± 4.4 (tuned sets read) | Revised. Defensive sets like 하마돈 and 아머까오 shifted to 32 Attack, erasing their ladder roles |
| 2026-11-12 | Stat point redistribution only, offense reduced only, bulk restricted to ladder defensive stats, revert on net loss | Singles 400 games: 54.3% ± 4.4 (tuned sets read) | Kept. Final version locking Defense on 바디프레스 sets is below |
| 2026-11-12 | Same as above plus Defense lock on 바디프레스 sets (final) | Tuned sets read: Singles 400 games 50.7% ± 4.5, Doubles 400 games 47.0% ± 4.4 | Kept. Neither format shows a meaningful gap against raw sets (Doubles sits at 47% under the information penalty). Strength stays equal, while every stat point now has a documented reason |

## 4. Limitations

- Stat tuning checks only the top 20 species and excludes critical hits, secondary effects, weather, terrain, stat stages, and 2v2 double-targeting.
- Moves, items, natures, and Speed rely directly on ladder choices. Improving those selections requires evaluating candidates in full simulated games (as shown by the failed 1v1 experiment in section 3).
- Species with under 1% ladder usage or no 1760+ sample have small sample sizes and are flagged under `"추가 검증 필요"` in their species descriptions.
- `도전의 탑` power ratings (`src/data/species-power.json`, `tower-tiers.json`) were re-measured on 2026-11-19 using the curated sets. Win shares and tiers now belong to individual sample sets rather than species (`BATTLE_STREAK.md` chapter 19) and must be re-measured whenever sets change.

## 5. Curation

On 2026-11-18, Regulation M-C sets were curated down to one build and one item per set.

### Problem

M-C singles held 1329 sets across 269 species, giving nearly every species five sets. Of those, 814 sets shared the same ability and first item as an earlier set of the same species and differed by at most one move (한카리아스 had four 메가 Z sets differing by one move plus one 기합의띠 set; 아보크 at 0.08% usage had five 기합의띠 and 먹다남은음식 sets differing by one move). Each set also carried a fallback `items` list pulled from species-wide item stats, so when item clause blocked the primary item, a set fell back to a mismatched item (such as a 기합의띠 lead getting 먹다남은음식). Owner feedback: "의미 없는 샘플이 너무 많아", "다양한 형태가 가능한 포켓몬(한카리아스 등)과 메가진화가 여러 개인 포켓몬만 복수의 샘플을 만들고, 상당히 마이너한 포켓몬은 샘플 하나에만 집중해도 좋아".

### Rules

Implemented in `scripts/curate-sets.mjs`:

1. One set represents one build with one item (`items: [item]`, preserving schema shape). The item is the set's primary item, except Choice items are disallowed if the set runs status moves other than 트릭 or 변신, and 기합의띠 is disallowed if the set runs recovery moves (돌격조끼 does not exist in `포켓몬 챔피언스` because the engine marks it `"Past"`). If invalid, the script picks the first valid item from the fallback list (affected 7 singles sets and 1 doubles set).
2. Within a species, sets sharing the same ability, item category, and at least 3 of 4 moves merge into one build, keeping the heaviest set's moves and spread while summing weights. Item categories are bulk (먹다남은음식, 검은진흙, 울퉁불퉁멧, 조개껍질방울, 풍선, 나무열매), offense (생명의구슬, 달인의띠, type-boosting items, gems, 초점렌즈, 넓은렌즈, etc.), individual Mega Stones, and every other item as its own category.
3. Species with two or more Mega Stones keep one build per Mega Stone (리자몽 X and Y, 루카리오 Z and 루카리오, doubles 한카리아스, 라이츄).
4. Major species (top 80 by usage) keep up to four builds, one per distinct role (revised the same day after owner feedback: "단순히 기술 몇개만 바뀌는 게 아니라 역할이 변하는 포켓몬들"). Roles partition by Mega Stone, Choice item, and then by moveset: setup (랭크업), hazards (스텔스록, etc.), 트릭룸, wall (recovery plus at most 2 attacks), support (2+ status moves), and attacker. Protect-type moves are excluded from status counts since nearly all doubles sets run them. Each role keeps its heaviest build with the role's combined weight, retained only when the role holds at least 10% weight. Builds differing only by a few moves or one item (기합의띠 vs 생명의구슬) share a role and collapse into one. Rule 2 merges also require matching roles; previously, 누리레느's 명상 set had merged into an 앙코르 set sharing three moves and vanished. Any secondary build beside another build has a 10% weight floor (a 1% Mega set was almost never picked).
5. All other species keep only their single heaviest build. Owner-requested builds are appended after curation (`ADDED`): 메타몽 구애스카프 (60%, absent from raw ladder stats which had only 기합의띠 and 선제공격손톱), 망나뇽 용의춤 멀티스케일 (20%), and 한카리아스 regular Mega (singles, 20%). Re-running curation does not duplicate them.
6. Weights re-normalize to 1 per species. M-B stays untouched. Re-running on curated output produces no changes (verified by tests).

Threshold rationale: below the top 60 species, most builds surviving rule 2 belong to species under 0.5% usage with thin samples (section 4). At 7% there is a natural gap in the data: candidate secondary shares drop from 9% (한카리아스 기합의띠 스텔스록) and 8% (망나뇽 울퉁불퉁멧 신속) down to 5% (타부자고 구애스카프, 팬텀 기합의띠). That makes it the highest cutoff that retains the 기합의띠 한카리아스 build cited by the owner.

### Results

| Metric | Singles | Doubles |
|---|---|---|
| Species | 269 | 269 |
| Sets | 1329 to 310 | 1326 to 296 |
| Sets per species | 1: 232, 2: 34, 3: 2, 4: 1 | 1: 247, 2: 18, 3: 3, 4: 1 |
| Mega sets | 72 | 74 |
| Distinct items | 108 | 106 |
| Top items | 기합의띠 49 (15.8%), 먹다남은음식 38 (12.3%), 구애스카프 31 (10.0%), 자뭉열매 25 (8.1%), 생명의구슬 17 (5.5%), 울퉁불퉁멧 15 (4.8%) | 기합의띠 41 (13.9%), 생명의구슬 40 (13.5%), 먹다남은음식 31 (10.5%), 구애스카프 23 (7.8%), 자뭉열매 22 (7.4%), 하양허브 7 (2.4%) |

Species keeping two or more sets (Singles): 이상해꽃(이상해꽃나이트 75%, 생명의구슬 25%), 리자몽(리자몽나이트X 62%, 리자몽나이트Y 38%), 히스이 윈디(기합의띠 60%, 구애스카프 22%, 기합의띠 18%), 갸라도스(갸라도스나이트 83%, 울퉁불퉁멧 17%), 메타몽(구애스카프 60%, 기합의띠 40%), 잠만보(먹다남은음식 60%, 먹다남은음식 40%), 망나뇽(망나뇽나이트 80%, 리샘열매 20%), 가라르 야도킹(슈캐열매 80%, 슈캐열매 20%), 핫삼(울퉁불퉁멧 47%, 울퉁불퉁멧 37%, 핫삼나이트 15%), 마기라스(마기라스나이트 75%, 풍선 25%), 대짱이(대짱이나이트 77%, 자뭉열매 23%), 패리퍼(축축한바위 89%, 구애스카프 11%), 엠페르트(슈캐열매 82%, 슈캐열매 18%), 찌르호크(찌르호크나이트 70%, 구애스카프 30%), 한카리아스(한카리아스나이트Z 80%, 한카리아스나이트 20%), 루카리오(루카리오나이트Z 79%, 루카리오나이트 21%), 맘모꾸리(기합의띠 61%, 기합의띠 39%), 히트로토무(자뭉열매 57%, 자뭉열매 43%), 워시로토무(먹다남은음식 59%, 먹다남은음식 41%), 히스이 대검귀(리샘열매 62%, 리샘열매 38%), 몰드류(기합의띠 33%, 기합의띠 31%, 구애스카프 20%, 기합의띠 17%), 개굴닌자(기합의띠 64%, 개굴닌자나이트 36%), 누리레느(자뭉열매 60%, 자뭉열매 40%), 에이스번(생명의구슬 84%, 구애스카프 16%), 아머까오(울퉁불퉁멧 79%, 울퉁불퉁멧 21%), 스트린더(생명의구슬 80%, 생명의구슬 20%), 브리무음(자뭉열매 81%, 자뭉열매 19%), 에써르(그라운드코트 73%, 구애스카프 27%), 사마자르(기합의띠 62%, 구애스카프 38%), 대쓰여너(구애스카프 69%, 저주의부적 31%), 포푸니크(노말주얼 53%, 노말주얼 47%), 마스카나(구애스카프 64%, 기합의띠 36%), 올리르바(자뭉열매 62%, 빛의점토 38%), 스코빌런(먹다남은음식 78%, 스코빌런나이트 22%), 킬라플로르(킬라플로르나이트 68%, 기합의띠 32%), 드닐레이브(드닐레이브나이트 52%, 기합의띠 48%), 브리두라스(먹다남은음식 50%, 먹다남은음식 50%).

Doubles: 리자몽(리자몽나이트Y 90%, 리자몽나이트X 10%), 라이츄(라이츄나이트Y 78%, 라이츄나이트X 22%), 픽시(자뭉열매 73%, 픽시나이트 14%, 자뭉열매 13%), 나인테일(구애스카프 63%, 목탄 37%), 알로라 나인테일(녹지않는얼음 65%, 녹지않는얼음 35%), 메타몽(구애스카프 60%, 자뭉열매 40%), 잠만보(먹다남은음식 84%, 먹다남은음식 16%), 파비코리(파비코리나이트 64%, 하반열매 36%), 밀로틱(먹다남은음식 61%, 먹다남은음식 39%), 한카리아스(한카리아스나이트Z 37%, 구애스카프 36%, 생명의구슬 17%, 한카리아스나이트 10%), 루카리오(루카리오나이트Z 90%, 루카리오나이트 10%), 하마돈(먹다남은음식 71%, 먹다남은음식 17%, 먹다남은음식 12%), 엘레이드(하양허브 50%, 하양허브 50%), 불카모스(울퉁불퉁멧 59%, 울퉁불퉁멧 21%, 울퉁불퉁멧 20%), 파이어로(예리한부리 68%, 예리한부리 32%), 따라큐(생명의구슬 63%, 생명의구슬 37%), 짜랑고우거(생명의구슬 51%, 생명의구슬 49%), 에써르(울퉁불퉁멧 62%, 울퉁불퉁멧 38%), 대쓰여너(생명의구슬 74%, 구애스카프 26%), 파밀리쥐(광각렌즈 64%, 광각렌즈 36%), 킬라플로르(기합의띠 56%, 킬라플로르나이트 44%), 드닐레이브(드닐레이브나이트 78%, 생명의구슬 22%).

기합의띠 appears on roughly 1 in 6 species. Under item clause in random parties and `도전의 탑`, a species with an already-taken item now yields its slot to another species instead of falling back to a different item.

### Related changes

- `scripts/learn-cpu-sets.mjs`: a player's set matching an existing build under rule 2 votes for that build. Unmatched sets cluster together into a single new set (at least three distinct players, up to two per species), so weekly learning never recreates one-move variants and every new set keeps one item.
- `supabase/functions/battle/towerBuild.mjs`: with one build per species, narrow `도전의 탑` opponent constraints matched too few species and repeated them. Any constraint matching fewer than 12 species now skips to the next constraint (`docs/BATTLE_STREAK.md` section 15.7).
- Tests: lowered minimum sets per species from 3 to 1 for M-C (M-B unchanged), lowered minimum sets per primary role from 50 to 10, switched the 이상해꽃 구애스카프 inference test to 고릴타 (이상해꽃 now has only a Mega set with no variant candidate), changed the memory-persistence battle seed from 41 to 44 (seed 41 left no candidates to eliminate), and fixed single-player batching in the learning test that had depended on pool species count.
- `docs/sample-sets/*.md`: updated set counts and primary build items. For species whose heaviest post-curation build differed from the heaviest pre-curation set (8 in singles, 5 in doubles), that build is noted under `"추가 검증 필요"`. Damage calcs were not re-run (requires `STATS_CACHE`).

### Benchmarks

| Date | Change | Result | Decision |
|---|---|---|---|
| 2026-11-18 | Curated sets (measured on the 280-set build before role rules) vs pre-curation tuned sets, with CPU knowing curated sets | Singles 400 games: 50.2% ± 4.3 | Kept. No strength drop even under the penalty of being read accurately |
| 2026-11-18 | Same CPU code (HEAD) vs working tree, random parties drawn from curated sets | Singles 300 games: 50.3% ± 4.5, Elo +2 [-29, 34], 0 rejections, avg 1305 ms, max 3444 ms | Confirms the CPU completes games with zero rejections on curated data without changing decision logic |

### Remaining work

- Because the CPU's belief pool holds almost one set per species, off-meta player sets initially trigger wrong assumptions. That mirrors the 12-point belief accuracy effect from section 3 and cannot be measured when both sides use sample sets; benchmarking with `--parties tuned` or `players` is the next step.
- `species-power.json` and `tower-tiers.json` were re-measured per sample set on 2026-11-19 (`BATTLE_STREAK.md` chapter 19).
- The `battle` Edge Function also reads `random-sets.json`, so run `npm run build:battle` and redeploy the function to apply changes.
