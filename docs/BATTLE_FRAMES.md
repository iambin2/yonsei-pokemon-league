# Battle frames

This log tracks dropped frames at mobile speed in battle and 도전의 탑. It started in phase 2 of `docs/superpowers/plans/2026-11-18-battle-game-feel.md`. The target is zero frames over 50 ms during motion at mobile speed (4x CPU throttle).

## 1. Measurement methods

| What | Command | Output |
|---|---|---|
| Frames | `node scripts/measure-frames.cjs <scene> [--base <url>] [--desktop] [--reduced] [--profile]` | Every frame interval from the page's first script and what was moving when that frame began. `inMotion` counts long frames while anything was moving; `stopped` counts long frames where main-thread animations (stage, tower, non-opacity/non-transform animations) froze, with their names in parentheses. `--profile` lists the top three main-thread functions per long frame |
| Recording | `node scripts/record-transition.cjs <dir> <url> [--ms] [--act] [--wait-for]` | All frames emitted by the compositor plus a contact sheet, showing actual visual freezes (gaps over 50 ms with no new frame) |

- Always measure against a production build (`npm run build`, preview server on port 4173). The dev server serves modules one by one and ends up measuring its own loading.
- To read readable function names, create a separate unminified build and point the script at it: `npx vite build --minify false --outDir <dir>`, then `npx vite preview --outDir <dir> --port 4174`.
- Even on the same build, worst-case frame times fluctuate by hundreds of milliseconds between runs. Measure three times and record the range.
- Playwright windows start with prior user activation (`navigator.userActivation.hasBeenActive` is true), matching a user navigating in from inside the site.
- What counts as a freeze (2026-11-18): animations touching only opacity and transform run on the compositor and do not freeze when the main thread blocks. Recordings confirmed this: during load, the busy bar (`y-busy`) updated every 16 ms throughout a 233 ms frame, and SVG `<g>` opacity progressed just as smoothly as `<span>` during a 600 ms main-thread block. Those frames are tagged `+` (compositor-only motion) and do not count as failures. Motion is checked at the start of a long frame; a transition that starts at the end of a long frame (from a class added during that frame's work) started late rather than freezing mid-flight. We still log `inMotion` (long frames with any motion), counted at frame start, which differs slightly from earlier logs.
- When the CPU profile shows blank gaps, use Chrome Tracing (`Tracing`, `devtools.timeline` and `fonts` categories). CPU profiles only capture JS, so font loading during layout, image decoding, and GPU waits look like empty frames.

## 2. Records

Scene `replay-open`: open a finished 도전의 탑 match (`2firh2l7xbhn`) at mobile viewport for 12 seconds. Numbers are: frames over 50 ms / worst frame / total long-frame time (ms).

| Date | Change | Result (3 runs) | Decision |
|---|---|---|---|
| 2026-11-18 | Baseline (HEAD `d64f070`) | 16 / 734 / 2602, 24 / 650 / 3386, 20 / 817 / 3370 | Culprits: atlas surface step 260 ms, audio context 270 ms, ink measurement 184 ms, Poké Ball paint 15 to 60 ms/step, tower shader 148 ms, texture upload 15 to 30 ms/step |
| 2026-11-18 | Split atlas surface and ball painting into row steps (`gl.js surfaceSteps`, `stageFx.js paintBalls`). The stage still painted the full atlas synchronously on engine creation (one 984 ms frame) | Unminified build: 20 / 1067, 18 / 984 | Stepping alone is not enough. See next row |
| 2026-11-18 | Boot engine without atlas, paint 6 ms per frame and swap in when ready (`gl.js setup takeAtlas`). Move noise into first atlas step. Compile tower shaders in parallel and link once finished (`towerGL.js begin, finish`). Decode cries in an offline audio context, create live audio context only after user gesture, compute stadium reverb every 256 samples | 21 / 450 / 2702, 18 / 467 / 2468, 18 / 417 / 2385 | Kept. Worst frame dropped from 650-817 ms to 417-467 ms. Long frame count unchanged |

Scene `tower-tab`: open the 도전의 탑 tab for the first time and record 10 seconds (including tower entrance). Same number format.

| Date | Change | Result | Decision |
|---|---|---|---|
| 2026-11-18 | Baseline (HEAD `bd42508`, built separately on same machine) | Mobile: 6 / 684 / 1518, 7 / 501 / 1418, 7 / 601 / 1485 | Long frames cluster in the first 2 seconds of load. Largest culprit is battle bundle module evaluation (314 ms) |
| 2026-11-18 | Changed tab viewpoint to looking up from the door, scaled streetlamps to 0.55x, cleaned up toggles and panels (Task 8) | Mobile: 8 / 684 / 1601, 8 / 484 / 1368, 8 / 534 / 1484. Desktop: 3 / 100 / 217 | Kept. Within baseline variance. Reaching zero remains a loading problem (Section 3) |

Scene between-matches (harness): production build pointed at the harness (`VITE_SUPABASE_URL=http://localhost:54321`), mobile viewport, 4x CPU throttle, starting a new run from draft through one win and all three between-match beats. Numbers are in-motion frames over 50 ms / worst frame.

| Date | Change | Result | Decision |
|---|---|---|---|
| 2026-11-18 | First implementation of three beats, tower doors, and draft card flip (Task 9) | Draft 8 / 150, result to trade 0, trade to doors 4 / 117 | Door hitch culprit: ink measurement on 12 door sprites (`inkCentre.js centreInk`, 293 ms) |
| 2026-11-18 | Preload door sprites during idle time on the result beat (`readAhead`), load draft sprites while card backs are up before flipping, and preload the next slot's three sprites | Draft 5 to 6 / 150, result to trade 0, trade to doors 1 / 83 to 100 | Kept. Draft long frames cluster in the first 0.4 s when the screen mounts (dialog closes and tower switches to draft), leaving 1 (50 ms) during flip and selection. The lone door-beat hitch is the tower canvas's first paint frame |

Task 10 (2026-11-18, build on `c0ab287`): mobile speed `replay-open` 18 / 450 / 2335, `tower-tab` 7 / 550 / 1468, `lobby` 8 / 317 / 1051, `tab-switch` 13 / 984 / 2586. Desktop `replay-open` 5 / 100, `tower-tab` 3 / 117. Reduced motion `replay-open` in-motion 2 / 117, `tower-tab` 2 / 100. Alternating `tab-switch` twice against HEAD `bd42508` (pre-Task 8) gave 14 / 951 and 10 / 684 vs 15 / 500 and 12 / 717 (same range). No scene hit zero yet.

Cleanup pass (2026-11-18): replaced runtime sprite ink measurement with a precomputed table (`src/data/sprite-ink.json`, generated by running the page's exact function on 1324 sprites in Chrome via `scripts/build-sprite-ink.cjs`). `centreInk` (previously 184 ms) vanished from `replay-open` profiles. Same-day numbers on the same machine: `replay-open` 23 / 534 and 24 / 517, `tower-tab` 7 / 767 and 6 / 751, `lobby` 13 / 350 and 7 / 350, `tab-switch` 15 / 851 and 14 / 817. Alternating `replay-open` against a build reverting the mobile stage max-height (`112vw`) also gave 23, 24, 23, confirming the higher counts were machine variance. Remaining culprits: texture upload (`upload`, 225 ms), battle bundle module evaluation (~200 ms), and stage measurement (`measure`, 77 ms).

Task 5 (2026-11-18): after removing hit-stop and impact shake and delaying HP bar updates by one beat, `replay-open` measured 16 / 334 / 1651 and 14 / 334 / 1368; reduced motion 18 / 284 (in-motion 4 / 117).

Splitting stage prep (2026-11-18): fixed culprits found in unminified profiles one by one.
- Sprite ink boxes (`gl.js inkBox`, 15 ms per sprite): added box bounds to the precomputed ink table.
- Poké Ball paint step (20 rows, 35 to 48 ms): reduced to 5 rows per step.
- Atlas surface step (16 rows, 40 to 53 ms): reduced to 4 rows per step.
- Atlas cell painting (94 ms per step): reduced to 4 cells per step.
- Texture upload (23 to 53 ms): decode and premultiply off-thread with `createImageBitmap` before uploading. Verified matching interior sprite colors across both builds.

Alternating against the prior build (`14840a2`); numbers are in-motion >50 ms / all >50 ms / worst / total:

| Scene | Before | After |
|---|---|---|
| `replay-open` (`6ge7rn3hsxms`) | 11 / 27 / 534 / 3553, 11 / 19 / 484 / 2436, 11 / 27 / 450 / 3036, 11 / 15 / 284 / 1468 | 10 / 20 / 534 / 2985, 10 / 15 / 434 / 2068, 9 / 16 / 367 / 2269, 7 / 9 / 267 / 1201 |
| `lobby` | 6 / 6 / 234 / 584, 7 / 7 / 267 / 668, 6 / 6 / 217 / 634, 8 / 8 / 217 / 734 | 6 / 6 / 233 / 617, 6 / 6 / 250 / 634, 4 / 4 / 200 / 434, 4 / 4 / 200 / 467 |
| `tower-tab` | 6 / 6 / 367 / 884, 5 / 5 / 334 / 784 | 5 / 5 / 300 / 701, 5 / 5 / 301 / 684 |
| `tab-switch` | 11 / 11 / 717 / 1701, 10 / 10 / 500 / 1518 | 9 / 9 / 384 / 1334, 11 / 11 / 350 / 1635 |

The last two runs for `lobby` and `replay-open` include cell-paint splitting. Still not zero. Remaining culprits: audio context creation (`audio`, 126 to 190 ms, only on user-activated pages), stage shader linking (`compileEnd`, 44 ms), render target creation (`measure`, 54 ms), calculator bundle evaluation (static screen), and first frame of tower tab entry (mesh chunks and tab underline `slideLine`).

Single-pass tower mesh reuse (2026-11-18): opening the tab immediately needed the tower before idle chunked mesh building finished, forcing a full synchronous rebuild on frame 1 (467 ms frame). Sharing the in-progress build (`towerGL.js prebuildModel`) and painting only once finished (`tower.js` `paint`, `entrance`, `arrive`) improved `tower-tab` across three alternating runs vs `14840a2`: before 5 / 6 / 384 / 901, 5 / 6 / 317 / 801, 6 / 6 / 384 / 884; after 3 / 4 / 217 / 451, 4 / 5 / 250 / 517, 3 / 4 / 234 / 501.

Second culprit pass (2026-11-18, on `b3ef3d1`): fixed items found via unminified profiles and Chrome Tracing.
- Audio context (`cries.js audio`, 126 to 340 ms): initial mute-button state (`BattlePage.jsx`) and first sound effect (`sfx.js ready`) created the context before warming up audio devices. Now reads only existing contexts (`madeAudio`) and delegates creation to `primeAudio`, which queries device list first. Standalone creation time dropped from 348 ms to 23 ms after querying devices. Replays still see 100 to 300 ms, but it lands on the static screen before the stage appears.
- Atlas and Poké Balls (`paintAtlas`, `surfaceSteps`, noise, `paintBalls`, 30 to 150 ms/frame): moved painting to a worker (`paint.worker.js`, code relocated to `atlas.js` and `balls.js` without logic changes). Worker and main-thread output match byte for byte (shapes, surface, noise, 24 ball frames). When workers are unavailable, main-thread stepping runs as before and produces identical textures.
- Render targets (`gl.js measure`, 40 to 70 ms synchronous GPU stall): the stage mounted before the full-width battle layout (`page--battle`), creating render targets at 350 px and recreating them at 390 px. Now creates them once on the first frame at the active size. Canvas, render targets, and camera match between builds.
- Image decoding (`Decode Image`, 147 to 160 ms): `createImageBitmap` from `<img>` decoded on the main thread; calling it on a `Blob` decodes off-thread. GPU readback across six sprites showed 0-byte difference.
- Font subset (118 ms layout inside timer): the `600-rest` subset used by names and moves loaded when names first mounted, forcing fallback layout. Now preloaded when opening the battle screen ahead of data.
- Missing webfont glyphs (`▲▼♀♂←→`, 59 to 122 ms layout): first render opened the system font (10 MB Noto Sans KR on this machine) at that weight. Now triggers a hidden pre-layout at weights 600 and 700 on battle screen open. Page dimensions unchanged.
- Reverted attempts: pre-laying out hidden glyphs with `font: 600 11px Freesentation` failed because a different font stack opened a different fallback font; inheriting `body` font-family is required. Wrapping tab switches in `startTransition` gave 0, 3, 3 freezes vs 2, 2, 3 before, so it was reverted.

Three alternating runs against `b3ef3d1` (all >50 ms / old `inMotion` / `stopped` / worst `stopped` / worst / total):

| Scene | Before | After |
|---|---|---|
| `replay-open` (`6ge7rn3hsxms`) | 6 / 6 / 2 / 184 / 317 / 1118, 8 / 8 / 2 / 200 / 333 / 1368, 10 / 9 / 3 / 167 / 334 / 1369 | 4 / 3 / 0 / 0 / 284 / 717, 6 / 5 / 0 / 0 / 267 / 784, 7 / 6 / 1 / 50 / 283 / 934 |
| `lobby` | 6 / 6 / 0 / 0 / 250 / 634, 4 / 4 / 0 / 0 / 200 / 534, 4 / 4 / 0 / 0 / 233 / 567 | 5 / 5 / 0 / 0 / 200 / 551, 4 / 4 / 0 / 0 / 200 / 483, 4 / 4 / 0 / 0 / 217 / 500 |
| `tower-tab` | 6 / 5 / 0 / 0 / 267 / 601, 6 / 5 / 1 / 67 / 183 / 600, 4 / 4 / 0 / 0 / 234 / 434 | 5 / 4 / 0 / 0 / 184 / 534, 4 / 4 / 1 / 83 / 217 / 500, 4 / 4 / 0 / 0 / 234 / 484 |
| `tab-switch` | 8 / 7 / 2 / 100 / 234 / 983, 13 / 12 / 3 / 83 / 250 / 1335, 10 / 9 / 2 / 100 / 284 / 1217 | 11 / 11 / 2 / 100 / 234 / 1302, 8 / 7 / 2 / 100 / 250 / 1017, 8 / 8 / 3 / 100 / 250 / 984 |

Replay freezes dropped from 2-3 (worst 167-200 ms) to 0-1 (50 ms). Lobby stayed at 0. Tower tab and tab switch did not change. Almost all remaining >50 ms frames are `+`: module evaluation during load (200 to 300 ms, only the busy bar moving) and initial stage mount.

Third culprit pass (2026-11-18, on `79a1381`): profiled individual tab clicks by inclusive function time.
- First tower draw (`tower.js drawTower`, 33 to 85 ms): ran inside React commit on tab entry while `.tw-body` was at the start of its 0-to-1 opacity fade and invisible anyway. Now prepares the mesh during commit and starts the fade and first draw on the next frame; the canvas stays blank in between just as before. Recorded entrance frames on both builds to confirm identical sequence. Reduced motion still draws immediately.
- Color ramp textures (`gl.js buildRamps`, 26 ms): recomputed static values every time a stage mounted. Now computed once and shared across stages.
- Standings number formatting (`StandTable`, podium, 43 ms): `toLocaleString("ko-KR")` constructed a fresh formatter per number. Replaced with shared `Board.jsx koNumber` with identical output.
- Skipped: async parallel shader linking for the stage. After the three fixes above, the 4-second stage freeze during tab switches stopped occurring.

Three alternating runs against `79a1381` (same column order):

| Scene | Before | After |
|---|---|---|
| `replay-open` | 7 / 6 / 1 / 50 / 300 / 951, 6 / 5 / 1 / 67 / 317 / 900, 5 / 4 / 0 / 0 / 267 / 817 | 5 / 4 / 0 / 0 / 283 / 734, 5 / 4 / 0 / 0 / 250 / 734, 5 / 4 / 1 / 50 / 300 / 767 |
| `lobby` | 6 / 6 / 0 / 0 / 234 / 634, 6 / 6 / 0 / 0 / 284 / 717, 5 / 5 / 0 / 0 / 250 / 700 | 6 / 6 / 0 / 0 / 217 / 684, 5 / 5 / 0 / 0 / 167 / 484, 5 / 5 / 0 / 0 / 234 / 601 |
| `tower-tab` | 5 / 5 / 0 / 0 / 267 / 567, 4 / 4 / 0 / 0 / 234 / 534, 5 / 5 / 1 / 67 / 250 / 550 | 3 / 3 / 0 / 0 / 217 / 400, 3 / 3 / 0 / 0 / 267 / 434, 3 / 3 / 0 / 0 / 217 / 417 |
| `tab-switch` | 9 / 9 / 1 / 67 / 434 / 1335, 7 / 7 / 1 / 50 / 200 / 784, 5 / 5 / 1 / 83 / 234 / 651 | 6 / 6 / 0 / 0 / 167 / 651, 9 / 9 / 0 / 0 / 217 / 867, 8 / 8 / 1 / 67 / 200 / 834 |

Three follow-up `tab-switch` runs recorded 0, 0, 0 freezes.

## 3. Remaining issues

Remaining `stopped` frames after the third pass on 2026-11-18 (2 across 12 runs):
- Replay at 2.3 to 2.5 s: 50 to 83 ms during the replay button color transition (`.bt-rkey`, 160 ms). Main-thread JS is only 8 ms for `upload`; Chrome Trace shows 40 ms of WebGL work in the GPU process for the stage's first frame and texture upload. Occurs 0 to 1 time in 3 runs.
- Tab switch at 1.6 to 1.9 s: 67 ms during button color transition (`.btn`) when tower tab data arrives and React renders the tab view. Occurs 1 time in 6 runs.
- All other >50 ms frames are `+` (only the busy bar moving during load). Module evaluation (200 to 300 ms) does not visually freeze the screen and was left alone.
- First-gesture audio context: tapping before the audio device warms up creates the context inside the click handler (310 ms on this machine). Kept as-is because iOS only unlocks audio inside a direct gesture handler.
- System font loading cost (Noto Sans KR) and audio device wakeup cost are specific to this Windows machine and have not been measured on a real phone.

Earlier remaining items from the first pass (2026-11-18):
- Audio context still gets created on user-activated pages (100 to 250 ms to wake Windows audio; unmeasured on real phones).
- Stage measurement (`gl.js measure`, `getBoundingClientRect`, `checkVisibility`) and shader linking (`compileEnd`) take 20 to 50 ms per frame.
- Texture upload (`upload`) takes 20 to 30 ms per sprite, already throttled to one per frame.
- Table counts include loading frames. Actual compositor freezes in recordings over 9 seconds of the same scene were 4 gaps of 150 to 250 ms.
