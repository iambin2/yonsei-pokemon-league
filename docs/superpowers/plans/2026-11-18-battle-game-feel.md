# Battle and 도전의 탑 game feel plan

> For agentic workers: use the required sub-skill `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task by task. Steps use checkbox (`- [ ]`) syntax for tracking.

Goal: make battle and 도전의 탑 read as a game rather than a spreadsheet, with one layout where the stage leads, a game-grammar HUD, punchy hit timing, match rituals, in-scene tower picks, and stutter-free transitions.

Architecture: only the UI changes. The engine (`@pkmn/sim`), battle functions, database, and AI (`battleCpu.js`) stay untouched. First establish the design rules (`DESIGN.md`) and measurement tooling, then layer the frame, HUD, hit feel, rituals, and tower in order. Show mockups to the user at each phase and implement only after a written selection.

Tech stack: React 18, plain CSS, WebGL2 (`gl.js`, `arena.js`, `towerGL.js`), Web Animations (`motion.js`), and Web Audio (`sfx.js`). No new dependencies.

Spec: the 2026-11-18 conversation diagnosis (mapped in the diagnosis table below), `DESIGN.md` "Battle", `docs/BATTLE_STREAK.md`, and `CLAUDE.md` "Working with the owner".

## Global constraints

- Change only the user interface. Data behavior, engine rulings, and battle function response shapes stay unchanged.
- Start every new visual shape with mockups (screenshots, labeled options in text, and one recommendation). Do not implement until the user picks an option in writing.
- Update `DESIGN.md` before changing code. Never introduce new values or patterns in code first.
- Check every screen at 390 and 1440 in both themes. Judge motion from recorded frames and layout from ink metrics.
- Performance budget: zero frames over 50 ms at mobile speed (4x CPU throttle). Baseline is 20 frames over 50 ms in the first 12 seconds of a replay, with the longest at 817 ms.
- Animate only with CSS and Web Animations using `transform` and `opacity`. Under `prefers-reduced-motion`, every new effect holds as a still image.
- Apply changes across regular battles and 도전의 탑, singles and doubles, players, spectators, and replays (everywhere the shared components run).
- Korean UI copy uses polite formal style (합니다체) and noun labels, with no exclamation marks or middle dots. Showdown-specific terms must not appear on screen.
- Compare elements that must match the source game (cut-ins, hits, audio) against real footage. Ask before downloading anything, stating name, source, and size.
- Write commit messages in four sections (`문제 인식`, `사고 과정`, `기획 방향성`, `프롬프트`). Both `npm test` and `npm run build` must pass with no warnings.
- Deploy only when the user says `"배포"`.

## Review focus

- With reduced motion enabled, results (damage, critical hits, selected cards) must remain readable at the exact same moment even when hit stop, screen shake, cut-ins, and card flips are turned off. Include one reduced-motion run in the Task 2 measurement tool.
- The new HUD and cut-ins must not overlap or drift in doubles (four plates), pre-chapter-14 challenge runs, or matches past 100 turns. Include one doubles replay and one long match in the Task 4 and Task 5 checks.
- Spectators and reconnecting players who join mid-match must skip cut-ins and land on the current state without replaying animations during catch-up. Include a mid-turn spectator join in the Task 5 and Task 6 checks.
- On slow devices, tapping the stage during an animation must still skip it, and keys pressed before an animation finishes must not submit accidental actions. Verify mid-animation stage taps with CDP touch in Task 5.
- Cut-in and result card text must stay legible over the stage in light theme. Include light theme in Task 5 and Task 6 screenshots.

## Diagnosis map

| Diagnosis | Phase |
|---|---|
| Scoreboard rules cover game scenes | 1 |
| Transition stutter (20 frames over 50 ms, 817 ms worst) | 2 (frames), 3, 4, and 6 (flow, `docs/BATTLE_TRANSITIONS.md`) |
| Stage takes 40% of screen, eight horizontal strips, 400-width log column, layout shifts per state | 3 |
| Unlabeled header numbers, multiplier chips, X-crossing between HP plates and Pokemon, cramped move keys, hit-count stickers, table-like log, broken-digit wait indicator | 4 |
| No hit stop, screen shake, or trailing HP bar; critical and super-effective pass as one line; no message cadence | 5 |
| No start or end ritual, video-player style playback bar, end state is a single leave button | 6 |
| Lobby looks like an application form, team-pick cards look like spec sheets | 7 |
| Tower top clipped, overlapping nameplates, off scale, duplicate 1st place, login as primary button, web toggle, clipped active run on mobile | 8 |
| Draft, doors, and between-games are all tables; three decisions in one beat | 9 |

---

### Task 0 (closing prior work)

Start this plan from a clean tree.

- [ ] Review and merge the sample-cleanup agent's output. Re-run the skew check in `tests/towerBuild.test.mjs` (3.5x upper limit) until it passes, or record the new numbers in section 15.7.
- [ ] Get the user's pick on the damage helper mockups (A gauge only, C opponent HP plate). Implement the choice in Task 4.
- [ ] Confirm the untracked edits in four board files and the remaining stash with the user.
- [ ] After `npm test` and `npm run build` pass, commit per the user's direction (full item sets, multiple megas, one-slot-at-a-time draft, swap table A, touch, notifications, relay layout).

### Task 1 (updating DESIGN.md)

Files:
- Modify `DESIGN.md`: first paragraph of "Battle" (scope of the game exception), "The tower", "The draft", "The doors, the trades".
- Modify `tests/designLaw.test.mjs`: exclusion list.
- Create `src/styles/tower-play.css`: move draft, door, between-games, and swap rules out of `streak.css`, and import it right after `streak.css` in `src/main.jsx`.
- Modify `CLAUDE.md`: exception sentence in "Product and design constraints" and CSS file count (21 to 22).

Decisions:
- The game exception covers everything after entering a run and between games: team pick, battle, end screen, draft, doors, between-games, swap, and entry scenes. The tab's landing view (tower side panel, rankings, records), sheets, dialogs, and toasts stay under scoreboard rules.
- What stays inside the exception: site colors (tokens, type colors, amber for live state), fonts, Korean copy rules, square corners, and no gradients or circles (except the Mega emblem).
- What becomes allowed inside the exception: stage overlays (cut-ins, result cards), screen shake, card flips, light, and particles. "Turns on rather than flies in" stays the rule outside the exception.

- [ ] Step 1. Draft the `DESIGN.md` revision quoting the user's reasons for widening the scope (`"실제 게임처럼 느껴지지 않고 엑셀처럼 느껴져"`, `"기존 틀에서 완전히 벗어나 구조를 새로 쌓아도 돼"`).
- [ ] Step 2. Show the revision to the user for approval. Do not proceed before approval.
- [ ] Step 3. Move the play-flow rules from `streak.css` to `tower-play.css` with identical values and add the file to the `designLaw.test.mjs` exclusion list.
- [ ] Step 4. Verify `node tests/designLaw.test.mjs` passes and compare before/after screenshots of lab `swap.html` and `draft.html` (zero pixel diff since rules only moved).
- [ ] Step 5. Commit.

### Task 2 (frame measurement tool, baselines, and stutter removal)

Files:
- Create `scripts/measure-frames.cjs` (promote scratch `audit.cjs` into the repo: Playwright from npx cache, `--use-angle=d3d11`, 4x CPU throttle, rAF interval logging).
- Create `docs/BATTLE_FRAMES.md` (per-scene baselines and a log table updated after each change, matching the experiment table format in `BATTLE_COMPUTER.md`).
- Modify only verified causes (`BattlePage.jsx`, `Stage.jsx`, `tower.js`, `towerGL.js`, `gl.js`).

Interfaces:
- Produces `node scripts/measure-frames.cjs <scene> [--reduced] [--desktop]`. Valid scenes are `replay-open`, `battle-open` (lab `?view=lab`), `tower-tab`, `tower-enter`, `between-games`, and `end`. Outputs one line: `frames N over34 N over50 N worst N sumLong N`. Exits with code 1 if `over50` is non-zero.

- [ ] Step 1. Write the tool and record baselines for all six scenes in `BATTLE_FRAMES.md` (replay-open currently sits at over50 20, worst 817).
- [ ] Step 2. Capture Chrome performance traces (CDP `Tracing`) for each scene to identify the owners of long tasks. Candidates to inspect: full match re-render on each log line, initial image decoding, GL model creation (`buildModel`, `arena.js`), layout shifts from changing box heights, and font subsets.
- [ ] Step 3. Fix only confirmed causes one at a time, re-measuring after each fix and adding a row to the table (including failed attempts). Do not guess.
- [ ] Step 4. Reach `over50` of 0 across all six scenes with no visual change (verify via per-scene screenshot comparison).
- [ ] Step 5. Commit. Every subsequent phase ends by measuring its affected scenes with this tool.

### Task 3 (one frame and one transition grammar)

Files:
- Modify `src/pages/BattlePage.jsx` (`Arena` layout: `bt-main`, `bt-side`, `bt-deck`, end screen `bt-end`, `EndSets`).
- Modify `src/styles/battle.css` and `src/styles/battle-stage.css`.
- Modify `DESIGN.md` "Battle": "From 860", mobile layout, "After the battle".

Mockup choices for the user: for desktop log and party, choose between (a) folding into a drawer beside the stage, (b) a single strip below the stage, or (c) keeping the 400-width column while enlarging the stage. On mobile, decide how many horizontal strips to collapse (including moving opponent and player rows into stage HUD).

Requirements:
- Follow the five transition grammar rules in section 3 of `docs/BATTLE_TRANSITIONS.md`, and close T1, T2, T3, T4, and T8 from section 2 in this phase.
- Team pick, active battle, end screen, spectating, and replay share one frame. The stage position and size must not shift by even 1px across state changes.
- The end screen and between-games screens overlay the stage without changing the height of the lower panel.
- On mobile, the stage takes more than half the viewport height (currently about 340 out of 844).

- [ ] Step 1. Screenshot the current frame across all five states (team pick, active, end, spectate, replay) at 390 and 1440, and measure the stage bounding box (x, y, w, h).
- [ ] Step 2. Build three lab mockup variants, send them together as one sheet, and let the user pick.
- [ ] Step 3. Update `DESIGN.md`, then implement.
- [ ] Step 4. Verify with a Playwright assertion that the stage `getBoundingClientRect` stays identical across all five states (keep this check in `scripts/verify-battle-frame.cjs` rather than `tests/` since it needs a browser). Pass `measure-frames` on `battle-open` and `end`.
- [ ] Step 5. Commit.

### Task 4 (game-grammar HUD)

Files:
- Modify `src/pages/battle/Stage.jsx` (HP plates, stat stages, status), `src/pages/BattlePage.jsx` (header, move keys `moveKeys`, long-press card `tipFor`, wait indicator, `Log`).
- Modify `src/styles/battle.css` and `src/styles/battle-stage.css`.
- Modify `DESIGN.md` "Battle": "The head", "HP plates", "The move keys", "Information at hand".
- Transitions: close T5 (ability and item plates), T6 (repeated prompt every turn), and T7 (lit keys during turn playback) from `docs/BATTLE_TRANSITIONS.md`.

Decisions to confirm via mockups:
- Each HP plate sits directly above or below its own Pokemon so sightlines never cross, in both singles and doubles.
- Stat changes display as stat name and arrow stages (`▲1` through `▲6`, `▼`) instead of multipliers (`×1.5`). Tapping the plate shows the multiplier.
- Every header number carries a label (floor, turn). Remove any number that cannot stand with a label.
- Move keys lead with name, type color, and PP, with one effectiveness chip and hit-count display per the Task 0 selection (option A places a gauge along the key bottom and moves the long-press progress bar to the top edge; option C shows the targeted move's damage range on the opponent's HP plate). Power, accuracy, and priority move to the long-press card.
- The battle log groups lines under turn headers rather than table rows, placed in the slot chosen in Task 3.
- The wait indicator uses a spinning segment (`Busy`) instead of empty segment cells.

- [ ] Step 1. Build lab mockups for each piece (two HP plate positions, stat stage display, move keys) in singles and doubles, at 390 and 1440, in both themes.
- [ ] Step 2. Update `DESIGN.md` after the user's pick, then implement.
- [ ] Step 3. Verify with screenshots of a doubles replay and a 100+ turn match that plates never overlap and six stat stages fit on one line. Pass existing battle tests in `tests/`.
- [ ] Step 4. Commit.

### Task 5 (three beats of a hit)

Files:
- Modify `src/pages/battle/stageFx.js`, `moveFx.js`, `gl.js` (hit stop, shake), `Stage.jsx` (trailing HP, cut-in), `sfx.js` (cut-in audio slots), `stageCamera.js`.
- Modify `src/styles/battle-stage.css`.
- Modify `DESIGN.md` "Battle": "The moves", "The big moments", "Judging a game".

Initial targets (to refine from recordings):
- Hit stop: 60 ms on normal hit, 90 ms on super-effective, 120 ms on critical hit, scaled by playback speed.
- Screen shake: proportional to damage share, capped at 1% of stage width, settling within 180 ms.
- Trailing HP: lost portion remains as a white band and shrinks after 400 ms.
- Critical hits, super-effective hits, and OHKOs show a large stage text cut-in (under 700 ms) without repeating the line in the message box.
- Message cadence: longer beat on move names, shorter on outcomes, without lengthening total turn time.

- [x] Step 1. Find hit footage from the source game (`포켓몬 챔피언스`) and count hit-stop and shake frames (ask before downloading).
- [x] Step 2. Implement in the lab `?view=lab` moves tab and show side-by-side before/after CDP recordings to the user.
- [x] Step 3. Verify total turn duration did not grow. Check `--reduced` removes hit stop and shake while holding cut-ins static. Verify mid-animation stage tap skips via CDP touch. Verify mid-turn spectator join lands on current state with no cut-in. Pass `tests/battleSfx.test.mjs` and `measure-frames battle-open`.
- [x] Step 4. Record values in `DESIGN.md` and commit.

Measurements and changes (2026-11-18). Source video: "Pokémon Champions Switch 2 Gameplay: 17 Minutes of Ranked Battles in 4K" (YouTube, 720p60 video-only, 194.55 MiB, downloaded with owner permission). Phase correlation and frame-to-frame deltas were logged across all 17 minutes.
- No pause longer than 67 ms appeared between moving frames. There is no hit stop.
- Hits produce no screen shake. Screen motion comes only from slow camera pushes.
- No large text cut-ins appeared over the stage.
- Three hits (Surf, Dragon Tail, Hurricane) were inspected frame by frame:
  - Impact triggers a bright flash (about 280 ms) and the target recoils.
  - The HP plate slides in about 50 to 80 ms later. Numbers count down starting around 300 ms for 700 to 1100 ms.
  - The bar has no trailing ghost segment.
- Because the initial targets (60 to 120 ms hit stop, shake, 400 ms trail, cut-ins) diverged from the source game, they were not added. Instead, matching the source, we removed:
  - Stage hit stop (62, 100, 160) and engine `hold`.
  - Critical and super-effective screen shake.
  - Pink trailing HP bar.
- Target recoil starts immediately, and HP begins draining after 300 ms (`Stage.jsx HP_BEAT`).
- Verification: side-by-side recordings of the same replay turn showed HP previously dropping to 80% with a trail while flames were still mid-flight, whereas after the change HP drops after impact. Removing hit stop shortened each hit by about 150 ms.
- `replay-open` logged 16 / 334 and 14 / 334; reduced-motion mid-turn logged 4 / 117. `tests/battleSfx.test.mjs` passed. Because no cut-ins were added, spectator and skip behavior stayed unchanged.

### Task 6 (match rituals)

Files:
- Modify `src/pages/BattlePage.jsx` (`opening`, end `bt-end`, `ReplayBar`), `src/pages/battle/Stage.jsx`, `stageFx.js`, `changeover.js`, `Replay.jsx`.
- Modify `src/styles/battle.css` and `src/styles/battle-stage.css`.
- Modify `DESIGN.md` "Battle": "The big moments", "After the battle", "Replay".

Decisions (via mockups):
- Opening: a VS scene pairing both names and parties (under 2 seconds, skippable on tap). Read the battle notes on why the `"배틀 시작"` popup removed on 2026-11-07 stuttered, and avoid repeating it by animating only opacity and position of already-rendered elements.
- Ending: camera moves toward the winning Pokemon (1 second) and a result card appears over the stage (win/loss, match stats, plus streak and lamps in 도전의 탑). Action buttons sit below the card, and leaving is not the primary button.
- Replay: replace the video-style scrubber with a turn-tick timeline marking KOs and Mega Evolutions on the ticks. Keep first, previous, play, next, and last controls.

- [x] Step 1. Create mockups (two VS options, two result cards, timeline), get selection, and update `DESIGN.md`.
- [x] Step 2. Implement using shared components across regular battles, 도전의 탑, official matches, spectating, and replays.
- [x] Step 3. Verify the stage box does not shift at match end (Task 3 check). Check result cards for loss, draw, forfeit, and timeout, plus light theme. Pass `measure-frames` on `replay-open` and `end`.
- [x] Step 4. Commit.

Selection (2026-11-18): opening stays as-is (no VS scene). Ending uses option A, where the stage stays in place and the message box becomes the result strip (no camera zoom). Replay uses the turn-tick timeline. Verification: stage box stayed fixed across end and rewind at both 390 and 1440, with `replay-open` worst at 317 ms. Loss, draw, forfeit, and timeout strips were verified in code only (a live loss screen with slot data will be checked in the next pass).

### Task 7 (lobby and team pick)

Files:
- Modify `src/pages/BattlePage.jsx` (lobby: `LobbyArena`, opponent, difficulty, and format selection), `src/pages/battle/Sets.jsx` (`TeamPick`, `MonCard`, `PickDock`).
- Modify `src/styles/battle.css`.
- Modify `DESIGN.md` "Battle": "The opponent and the rooms", "The party".

Decisions (via mockups):
- The stage leads the lobby. Condense selections (opponent, difficulty, format, party) into a single bar above or below the stage, and place the active selections on the court instead of twelve empty question marks (the AI's polygons on its side, and the player's six once a party is chosen).
- Team-pick cards show sprite, name, type, and item on the front, moving the stat grid behind an info button. Display pick order prominently.

- [x] Step 1. Mockups, user selection, `DESIGN.md`, and implementation.
- [x] Step 2. Verify room creation, code rooms, official match waiting, and 도전의 탑 team pick all share the same components. Manually click through picking slots past the fourth of six in the lab (the 2026-11-06 bug site).
- [x] Step 3. Commit.

Selection (2026-11-18): lobby uses B (stage as menu), with growing lists like regulations placed inside a sheet. Team pick uses A (pick on stage), turning the court area into an info plate for the focused Pokemon. Verification: 390 and 1440 in both themes, picking 4th, 5th, and 1st in order, two saved-team regulations, and lobby frame timing (unchanged from prior commit). 도전의 탑 team pick and joiner screens require a live server so they were not captured here (same components).

### Task 8 (tower landing screen)

Files:
- Modify `src/pages/battle/Streak.jsx` (tab: `StreakOpen`, active run panel, buttons), `tower.js` (`climbersHTML`, `viewOf` camera), `towerGL.js` (`viewOf("hall")`, streetlamps, scale reference).
- Modify `src/styles/streak.css` and `src/styles/battle-stage.css` (`.tw-hall`).
- Modify `DESIGN.md`: `도전의 탑`, "The tower".

Fixes (most direct without mockups; mockups only for camera angle and scale reference):
- Show the tower top (lantern) in the idle camera. Mark the player's position with an amber lamp and lead the path upward.
- Prevent nameplate overlaps by offsetting players at the same height by one row (first find why the 28px gap in `climbersHTML` failed at 1440).
- Scale streetlamps smaller than the door and add one human-scale reference by the entrance (mockup).
- Remove the duplicate 1st-place display between the side panel (`이번 달 1위`) and the podium: when the user has no active run, show only a `도전의 탑` line and start-button guidance.
- Make `도전` always the primary button. If login is required, open the Google sign-in sheet after clicking. Keep `컴퓨터와 연습` as the secondary button.
- Move `이번 달 / 오늘의 탑` out of the scene corner toggle into a selector row under the tab.
- Keep the active run panel above the fixed action buttons on mobile.

- [x] Step 1. Reproduce and fix nameplate overlap (`tower.js`), verified with four climbers at 1440 and 390.
- [x] Step 2. Camera and scale reference mockups, selection, implementation. Record tab entry and floor transition to verify they connect cleanly from the new viewpoint.
- [x] Step 3. Fix buttons, panels, and toggle. Capture five states (logged out, name check, no run, active run, daily tower finished) using the harness (PGlite + dev server).
- [x] Step 4. Pass `measure-frames` on `tower-tab` and `tower-enter`, then commit. (`tower-tab` did not pass; details below.)

Selection (2026-11-18): camera uses C, looking up the path from the base of the door (owner: `"올려다보는 구도가 너무 좋은데"`). The summit appears only during the entry sequence descending from the full tower. Scale uses B, shrinking streetlamps to 0.55x (two-thirds of the door) with no human-scale figure. Buttons and panels use B with `"의미 없이 낭비되는 공간을 최소화"`: the primary button always starts a run and prompts for an account in a sheet if needed. The active run panel renders only when the player has a record; the toggle sits at the top of the side column (above the scene), and without a record, rankings appear 20px below the toggle. Mobile keeps a 16:10 tower aspect so the panel clears the fixed button. Fixed bottom-up perspective sorting that put a 10-win streak above a 12-win streak by sorting strictly by streak count, and brightened cloud undersides to clear dark blotches. Verification: captured all five states via harness at 1440 and 390 in both themes, and checked entry and door-walk frames. `tower-tab` failed on mobile with 8 frames over 50 ms, though HEAD already had 6 to 7 in the first 2 seconds of page load (`docs/BATTLE_FRAMES.md`). `tower-enter` is not in the tool, so it was checked via frame sheet. Floor transitions between games do not use the tab camera and stayed unchanged.

### Task 9 (tower play flow)

Files:
- Modify `src/pages/battle/Streak.jsx` (`DraftBoard`, `DoorPick`, `StreakEnd`, `SwapTable`), `tower.js` and `towerGL.js` (door hit-testing, six Pokemon behind doors).
- Modify `src/styles/tower-play.css`.
- Modify `DESIGN.md`: "The draft", "The doors, the trades", and `docs/BATTLE_STREAK.md` section 17 (UI-only note and verification).

Decisions (via mockups):
- Draft: when a slot's turn arrives, three cards flip open. The chosen card moves into the party slot and the other two dim out. Card fronts reuse the Task 7 team-pick card component.
- Between-games splits into three beats, asking one thing at a time: (1) result, where the streak increments and lamps toggle; (2) reward, offering swap (using the Nov 18 option A table as the entire scene) or skip; (3) next door.
- Doors are actual doors on the 3D tower: the camera stops before the next floor's two doors, clicking a door reveals its six Pokemon above it, and clicking again enters. The gatekeeper has one large closed door. Accessibility and reduced-motion modes show the existing two panels instead.
- Loss review appears in beat (1).

- [x] Step 1. Build lab mockups (stills and recordings) for the three-beat flow, showing the 3D door picker beside the current panel picker.
- [x] Step 2. After selection, update `DESIGN.md` and implement without altering battle function requests (`swap` and `door` in `streakNext`).
- [x] Step 3. Verify `scripts/verify-streak-function.mjs` (function invariance) and run a full challenge in the harness through a win, swap, strong door, loss, gatekeeper, and completion. Confirm draft, doors, and swap work by keyboard alone. Pass `measure-frames between-games`. (Frames did not pass; details below.)
- [x] Step 4. Commit.

Selection (2026-11-18): option B across the board (owner: `"전부 B로 진행해줘"`). Draft flips blank card backs in sequence and flies the picked sprite into its slot. Between-games runs the three beats (result, swap, next door), with doors under the same upward-looking tower as the tab and walking into the chosen door (3D branching doors option C was skipped). Door previews show sprites only (owner noted type squares were `"상당히 무의미"`; the silhouette variant was shown as a capture only). Verification: captured win, swap, strong door, battle loss (review), forfeit loss, gatekeeper, and the next floor at 1440 and 390 in both themes via harness. Completed six runs keyboard-only under reduced motion. `verify-streak-function.mjs` passed. Because `measure-frames` lacks a between-games scene, it was timed the same way on the harness build at mobile speed: result to swap had 0 long frames, swap to door had 1 (83 to 100 ms, first draw of the tower canvas), and draft had 5 to 6 (clustered in the first 0.4s on mount, 1 during flips), so not yet 0.

### Task 10 (full review)

- [x] Play through one regular battle (singles and doubles), one full 도전의 탑 run (draft to finish), one spectate session, and one replay at 390 and 1440 in both themes.
- [x] Re-score all nine rows of the 2026-11-18 diagnosis table and record any remaining gaps openly.
- [x] Run `measure-frames` on all six scenes, `npm test`, and `npm run build`.
- [x] Report separately what was verified on a real phone and what was not.

Observations (2026-11-18). Everything ran in Playwright (chrome channel, GPU). Nothing was tested on a real phone.
- Played one AI singles match (1440 dark) and one doubles match (390 light) from lobby through the end strip.
- Ran 도전의 탑 multiple times on the harness (PGlite, real SQL and battle functions) from draft through win, swap, strong door, losses (forfeit and battle), gatekeeper door, gatekeeper team pick (inverted strip and gatekeeper slot), and floor 2 past the gatekeeper, at 1440 and 390 in both themes.
- Checked spectating the same match, the joiner lobby via link (390 light, 1440 dark), and replays of finished matches (all four combinations).
- `npm test` passed 628 tests. `npm run build` produced only the pre-existing large-chunk warning.

Nine-item diagnosis review:
1. Scoreboard rules covering game scenes: closed (Task 1).
2. Transition stutter: open. `replay-open` improved from 20 / 817 to 18 / 450, but no scene reached 0 (`docs/BATTLE_FRAMES.md`). `tab-switch` worst of 951 ms predates these phases.
3. One frame: mostly closed. A blank strip (about 120px) remained between the header and party strip on 390 replay.
4. HUD: mostly closed. Four Pokemon overlapped in 390 doubles.
5. Three beats of a hit: not done yet; waiting to ask the owner before downloading source footage.
6. Match rituals: closed. Mobile replay timeline got squeezed to around 60px beside the five buttons.
7. Lobby and team pick: closed (link joiner lobby and tower team pick verified here). Two items left: spectator team pick showed two party tables without a stage, and the room host's waiting stage had an empty top strip.
8. Tower landing screen: closed (Task 8), frames still open.
9. Tower play flow: closed (Task 9), with 1 long frame on the door beat and 5 to 6 on draft mount.

Remaining items resolved (2026-11-18, owner: `"남은 수정사항도 전부 진행해줘"`):
- Sprite ink now reads from a precomputed table (`scripts/build-sprite-ink.cjs`, `tests/spriteInk.test.mjs`).
- Mobile stage now absorbs remaining viewport height (removing the 137px empty strip in replay). The replay bar folds first and last buttons on mobile, widening the timeline from 66px to 158px.
- Mobile doubles caps each pair's sprite width at the slot gap (near pair 31, far pair 28 with the far pair lifted slightly).
- Spectator team pick now uses the same stage frame as players (top strip, arena, bottom strip).
- Host waiting label (`참가 대기`) now appears once on the opponent strip above the stage (removed from the side panel). Leaving the waiting stage's top strip otherwise empty was kept because it holds the incoming opponent's spot.
- Still open: zero long frames (owners listed above), Task 5 (source footage), and real phone testing.

## Order and grouping

- Tasks 0, 1, and 2 run sequentially because the design rules and measurements underpin everything else.
- Tasks 3, 4, 5, and 6 cover battle, while Tasks 8 and 9 cover the tower. Task 7 fits anywhere after Task 4.
- Battle work from Task 3 onward and tower work from Task 8 onward barely overlap in files (meeting only at the `StreakEnd` call site in `BattlePage.jsx`), so they can progress independently.
- Deliverable at each phase: one mockup sheet, a before/after comparison after selection, and recorded numbers.
