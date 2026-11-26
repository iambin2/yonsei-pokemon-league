# Matching move effects to source timing and intensity plan

> For agentic workers: use the required sub-skill `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task by task. Steps use checkbox (`- [ ]`) syntax for tracking.

Goal: match all 223 move effect recipes to the phase timings, white flash, and type-color area sampled from source footage, while keeping our own rendering verbs.

Architecture: place measurement tools (frames to metrics to phases) in `docs/move-fx-work/`, isolating pure math in `fxphases.mjs` under `tests/`. Slice source videos by type at 30fps and capture our lab via Reanimate `capture.ts`. Compare both sets of phases in `match.tsv`, iterating on `moveFx.js` and `stageFx.js` until every check passes.

Tech stack: Node 22 (`node:test`), Bun 1.4 with Reanimate skill scripts (`~/.claude/skills/reanimate/scripts`, including pngjs), yt-dlp, and the WebGL2 stage (`gl.js`).

Spec: `docs/superpowers/specs/2026-11-21-move-fx-match-design.md`.

## Global constraints

- Never import or trace source textures, frames, models, or shaders. Use source footage strictly for measurement and keep it in the scratchpad only.
- Ask the operator before downloading each source video, stating its name, source, and size.
- Keep the camera fixed (`DESIGN.md` "The camera").
- Pass thresholds: phase start and duration within ±80ms, white flash duration within ±50ms with peak area at or below the source, peak type-color area (divided by target size) within ±25%, and residue fade time within ±120ms. Never relax thresholds to force a pass.
- Confine white flash to the impact point without turning target body parameters (`flash`, `rim`, `tint`) white. Normalize area comparisons by target size (ink height).
- For Flying, Steel, Ice, and Rock, count flash only when pixels are near-white and outside the type color range. Keep impact light on the `${t}.d` ramp.
- Leave weather, terrain, rooms, hazards, screens, and Mega Evolution untouched in this pass.
- Commit one type per commit using the four-section message format (`문제 인식:`, `사고 과정:`, `기획 방향성:`, `프롬프트 (사용자 지시):`). Deploy only when the operator asks.
- Write all reports and docs in Korean; polite formal style (합니다체, `DESIGN.md` "Voice and tone") applies only to site copy.

## Review focus

- Moves with no impact moment (`protect`, `harden`, `focus`, `speed`) must anchor time 0 at the first frame the effect alters the screen (Task 1 test `self moves anchor at first change`).
- Near-white types (Flying, Steel, Ice, Rock) must not miscount type light as a white flash (Task 1 test `near-white type light is not flash`).
- Blocked or missed moves must not stall measurement and must produce zero flash area. In Task 3, capture `flamethrower` after `protect` and confirm flash area is 0.
- Verify in Task 3 that the new impact flash follows slow/fast playback speed multipliers and remains visible under reduced motion (`DESIGN.md` "Reduced motion").
- `flashStage` scales intensity to 0.6x in light theme; confirm in Task 3 that the new impact flash uses the same multiplier.

---

### Task 1 (measurement tooling)

Files:
- Create `docs/move-fx-work/fxphases.mjs` (pure math, zero dependencies).
- Create `docs/move-fx-work/fxmeasure.mjs` (CLI reading a frame directory to emit rows, moved from scratchpad `fxmeasure.ts`).
- Test `tests/fxPhases.test.mjs`.

Interfaces:
- `typeWindow(type: string) -> { hue: [number, number], minSat: number, nearWhite: boolean }` covers all 18 types using `--type-*` values from `src/styles/tokens.css` at ±20°, with `nearWhite` set for `flying`, `steel`, `ice`, and `rock`.
- `classify([r,g,b], win) -> "white" | "type" | null` returns `"white"` only when `r>235`, `g>225`, `b>200` and (if `nearWhite`) outside the type range.
- `phasesOf(rows: Row[], { fps: number, baseline: Row, inkPx: number, hit: boolean }) -> { zero: number, phases: { name, start, end }[], flash: { start, end, peak } | null, typePeak: number, residueEnd: number }`, where `Row = { white: number, type: number, cx: number }` (screen share), all times are in ms relative to `zero`, areas are divided by `inkPx`, and when `hit: false`, `zero` is the first frame differing from baseline.
- `compareRow(ref, ours) -> { pass: boolean, fails: string[] }` enforces the four global thresholds.
- CLI: `bun docs/move-fx-work/fxmeasure.mjs <frames> --type fire --fps 30 [--top 0.12] [--from N --to N] > rows.json`.

- [ ] Step 1. Write failing tests in `tests/fxPhases.test.mjs` using synthetic rows:
  - `flash is found and timed`: at 30fps, 10 baseline frames (`white` .02) followed by frames 20 to 24 at `white` .15 should yield `flash.end - flash.start` of 133±34 and `zero` at frame 20.
  - `self moves anchor at first change`: with `hit: false` and type area rising from frame 7, `zero` equals 233.
  - `near-white type light is not flash`: `classify([240,240,245], typeWindow("ice"))` returns `"type"`, while `classify([250,248,240], typeWindow("fire"))` returns `"white"`.
  - `compareRow fails on long travel`: reference travel 500ms vs ours 1100ms returns `pass: false` with `"travel"` in `fails`.
- [ ] Step 2. Run `node --test tests/fxPhases.test.mjs` and confirm failure (module missing).
- [ ] Step 3. Implement `fxphases.mjs`. Detect phase boundaries where type and white areas cross baseline plus noise (3x standard deviation of the first 10 baseline frames), naming phases `charge` (first rise before impact to travel start), `travel` (type-area centroid `cx` moving toward target), `land`, `flash`, and `residue`.
- [ ] Step 4. Confirm `node --test tests/fxPhases.test.mjs` and full `npm test` pass.
- [ ] Step 5. Implement the `fxmeasure.mjs` CLI, loading pngjs via `createRequire(~/.claude/skills/reanimate/scripts/)` (matching how `shoot.mjs` loads Playwright from the npx cache). Run it on source Flamethrower frames (`scratchpad/ref-fire/ref/frames`) and verify peak white flash sits near 13% of screen around 4.23s.
- [ ] Step 6. Commit `docs/move-fx-work/fxphases.mjs`, `fxmeasure.mjs`, and `tests/fxPhases.test.mjs`, adding both tools to the README.

### Task 2 (source segment table and capture harness)

Files:
- Create `docs/move-fx-work/refs.json`: `{ "fire": "qj7qVH6dyz0", "water": "C4XkrMghgwk", "grass": "YngFWS7k-W0", "electric": "lx9hm1AdzWU", "ice": "fin0QjV1QGw", "fighting": "fGR4WtguYoM", "poison": "cjxMnQDYkig", "ground": "3yDp1NIU9nQ", "flying": "h1TsHzbyrAI", "psychic": "8KjASk9x3Ws", "bug": "UCa1vD9c66w", "rock": "7lxCxN3YwZo", "ghost": "mOIvZSdRQPA", "dragon": "Kjx_2CAwwNY", "dark": "b0ramkcJw5k", "steel": "D1yjGRa2v9U", "fairy": "MlWWR0Xbi54", "normal": null }`.
- Create `docs/move-fx-work/segments.tsv`: `recipe\tmove\ttype\tvideo\tstart\tend\tnote` (filled manually, times in seconds).
- Create `docs/move-fx-work/refindex.sh <video.mp4> <out>`: 2-second interval timecode index sheet (using the ffmpeg tile command from the Flamethrower trial).
- Create `docs/move-fx-work/capture-ours.mjs <ids,comma> <outDir>`: invokes Reanimate `capture.ts` for each id with `--url http://localhost:5182/?view=lab --viewport 1280x720 --selector canvas --trigger none --wait-before 1500 --duration <recipe duration+1500> --pre-roll 0 --fps 30 --gpu hardware` and async-wrapped pre-js (`setFormat("singles")`, calling `__bench.play(id)` 300ms after recording starts at 2.5s), outputting to `<outDir>/<id>/frames`.
- Create `docs/move-fx-work/match.mjs`: reads one type from `segments.tsv`, runs `phasesOf` and `compareRow` on source and captured rows, and rewrites `match.tsv` (`recipe\tmove\tpass\tfails\tref\tours`).

Interfaces:
- Consumes `phasesOf`, `compareRow`, and the CLI from Task 1.
- Produces one `match.tsv` row per recipe, typed by `moves[rep].type` in `champions-data.json`.

- [ ] Step 1. Run `node docs/move-fx-work/capture-ours.mjs flamethrower <scratch>/ours` against the `ypl-dev-offline` dev server (`preview_start`) and confirm at least 130 frames with no effect on frame 0 (capture does not miss the start).
- [ ] Step 2. Test once whether `--clock virtual` clears load on `ypl-preview` (built site). If it works, make `--clock virtual` the default in `capture-ours`; otherwise note why in the README.
- [ ] Step 3. Run `match.mjs fire` with one Flamethrower row and confirm `match.tsv` reports a `travel` failure (1.1s vs 0.5s from the trial).
- [ ] Step 4. Commit.

### Task 3 (impact-point white flash under option B)

Files:
- Modify `src/pages/battle/stageFx.js` (beside `flashStage`, around line 288) to add `impactFlash(stage, at: [x, y], { ms = 150, size = 1 } = {})`: a single additive light at the impact point, scaled to 0.6x in light theme, following the playback speed multiplier (`ms()`), without touching body parameters (`flash`, `rim`, `tint`).
- Modify `src/pages/battle/moveFx.js` to call `impactFlash` on impact only for recipes that have a flash in the source (enabled per recipe from Task 4 onward).
- Modify `docs/move-fx-work/README.md` (first line of `"지킬 것"`) and `DESIGN.md` (hit row in "What the stage plays") to allow brief impact-point white flashes while keeping body whitening forbidden.
- Add `impactFlash never touches a body` to `tests/moveFx.test.mjs`, asserting that the `impactFlash` body in `stageFx.js` contains none of `flash:`, `rim`, or `tint`.

- [ ] Step 1. Write the test and confirm it fails.
- [ ] Step 2. Implement `impactFlash` and confirm the new test and `npm test` pass.
- [ ] Step 3. Enable it on Flamethrower in the lab, capture, and check `match.tsv` for flash duration of 150±50ms and target-normalized area at or below the source. Confirm Flamethrower into `protect` yields 0 flash.
- [ ] Step 4. Capture once each in light and dark themes, slow and fast speeds, and reduced motion.
- [ ] Step 5. Commit.

### Task 4 (Fire type batch, template for every type)

Files:
- Modify `src/pages/battle/moveFx.js` (durations and particles used by Fire recipe verbs: `stream`, `blast`, `vortex`, `volcano`, `hit ... fire`, `shoot fireball`, and similar).
- Modify `docs/move-fx-work/segments.tsv`, `match.tsv`, `final.tsv`, and `docs/move-fx-ranking.html`.

- [ ] Step 1. List all recipes whose representative move is Fire (`recipes.json` crossed with `champions-data.json`).
- [ ] Step 2. The source video is already downloaded (`scratchpad/ref-fire/fire.mp4`). Build the index with `refindex.sh` and enter each recipe's segment in `segments.tsv`. If a recipe's move is absent from the video, use another move from the same recipe; if none exist, put `no-ref` in `note`.
- [ ] Step 3. Measure source and captured rows and run `match.mjs fire`.
- [ ] Step 4. For each failing recipe, make the smallest change (recipe numbers first, then verb defaults) and recapture. If a recipe still fails after five passes, record the metrics and reason in `note` and move on.
- [ ] Step 5. Recapture recipes of other types that share any modified verb and verify against prior `match.tsv` rows that none regressed.
- [ ] Step 6. Inspect side-by-side source and captured filmstrips with `pair.py` to check that flashes, embers, and smoke keep the site's matte material feel (README `"지킬 것"`).
- [ ] Step 7. Run `npm test`, trigger Fire moves in both regular battle and 도전의 탑, and confirm mobile-speed frame logs (`docs/BATTLE_FRAMES.md` method) stay within budget.
- [ ] Step 8. Update `final.tsv` and the ranking page via `report.py`, then commit.

### Tasks 5 to 21 (remaining types)

Follow Task 4 steps 1 through 8 in order: Water, Grass, Electric, Ice, Fighting, Poison, Ground, Flying, Psychic, Bug, Rock, Ghost, Dragon, Dark, Steel, Fairy, and Normal. Before step 2 of each type, ask the operator to download that type's video from `refs.json`. For Normal, find a source first and ask.

### Task 22 (wrap-up)

- [ ] Summarize failing recipes, `no-ref` recipes, and within-recipe move pairs differing by more than ±80ms at the end of the README (splitting recipes is a separate decision).
- [ ] Document this workflow in memory and the README, and run `git status` to verify source videos remain in the scratchpad and stay out of the repository.
