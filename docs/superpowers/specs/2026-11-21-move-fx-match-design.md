# Matching move effects to source timing and intensity

2026-11-21. Operator direction: `"화염방사뿐만 아니라 모든 기술 이펙트를 수정해줘. 원본과 비교해서 거의 동일하도록. 그래픽 스타일은 사이트의 포켓몬 이미지와 비슷한 스타일을 유지해서."` Where the source conflicts with our rules, option B (impact flash only) was selected.

## Motivation

All 223 move effect recipes (`docs/move-fx-work/recipes.json`, which group every move) were matched by eye on 2026-11-07 against source storyboards sampled at roughly 1-second intervals. One-second steps hide phase durations: measuring Flamethrower at 30fps on 2026-11-21 showed our flame stream lasted twice as long as the source (1.1s vs 0.5s), while missing the impact flash and falling embers. What makes an effect feel like the source is phase timing and intensity rather than silhouette. This work matches those numbers across every move.

## Goals

- Locate each recipe's representative move in source footage, anchor impact at time 0, and measure the start and duration of each phase (charge, travel, land, flash, residue).
- Capture our effects at the same 30fps, compute the same metrics, and iterate until every threshold passes.
- Keep rendering with our own verbs (`moveFx.js`) and GPU stage (`gl.js`), preserving the matte material look of the site's Pokemon sprites (substance over glow, type-color ramps without white cores).

## Non-goals

- Never import source textures, frames, models, or shaders, and never trace frame by frame. Use the source strictly to measure timing, phases, color ranges, and areas.
- Keep the camera stationary (`DESIGN.md` "The camera"), excluding source camera cuts from comparison.
- Do not target pixel-by-pixel image similarity; differing framing and cameras make it meaningless.
- Leave weather, terrain, rooms, hazards, screens, and Mega Evolution (captured by `shootfield.mjs`) out of this pass. Per the operator's 2026-11-21 decision (`"기술만 먼저"`), handle them separately after the 223 move recipes finish.

## Failure conditions

- Any move running noticeably longer than the source and dragging out battles (message lines wait for the effect to end).
- Frame drops at mobile speed (checked against `docs/BATTLE_FRAMES.md`).
- Body whitening or a solid white mass covering the target (still forbidden under option B).

## Rule change (option B)

- Allow a white flash strictly at the impact point for the duration sampled in the source (about 0.15s for Flamethrower). The flash is an impact light only and must not whiten target body parameters (`flash`, `rim`, `tint`).
- Cap flash intensity so its peak white area never exceeds the source (13% of screen for Flamethrower).
- Update the `"흰 별"` line in `docs/move-fx-work/README.md` (`"지킬 것"`) and the hit row in `DESIGN.md` ("What the stage plays") to match.

## Pipeline (verified on Flamethrower)

1. Source footage. Use Jeyknite's 17 per-type videos (4K originals, 80 to 100MB each as 720p60 video-only) and locate a separate source for Normal. Ask before downloading each video with its name, source, and size, and store files in the scratchpad only.
2. Segment lookup. Locate each representative move using a 2-second interval index sheet (timecodes and on-screen move names) and slice 30fps frames (`frames.ts`). If the representative move is missing, use another move from the same recipe; if none appear, skip the recipe and log it.
3. Measurement. `fxmeasure.ts` (starting in the scratchpad, then moved into `docs/move-fx-work/`) computes per-frame luminance, white area, type-color area, and centroid. Expand the Fire-only color check to cover all 18 types, subtracting a pre-effect baseline to strip stage decor and UI.
4. Capturing our side. Record the lab (`?view=lab`) at 30fps with Reanimate `capture.ts`. Because virtual clock stalls on load in the dev server, use the real clock and real GPU, switching to virtual clock if it works on the built preview (`ypl-preview`). Delay playback until after recording starts so frame 0 never clips the opening.
5. Comparison and thresholds. Align impact at time 0 and write one row per recipe to `docs/move-fx-work/match.tsv`:
   - Phase start and duration: within ±80ms of the source (Reanimate standard).
   - White flash: present whenever the source has one, duration within ±50ms, peak area at or below the source.
   - Peak type-color area: normalized by target size, within ±25% of the source.
   - Residue fade time (embers, droplets, debris): within ±120ms.
   Record metrics and reasons for any failing row without lowering thresholds to pass.
6. Visual check. Even after numbers pass, review side-by-side filmstrips via `pair.py`. Metrics catch drift; the frames show what drifted.

## Order and batching

- Work one type per batch, starting with Fire and continuing through types with available footage. Make one four-section commit per batch, deploying only when the operator asks.
- Whenever a shared verb (`hit`, `beam`, `burst`, and similar) changes, recapture other recipes using that verb to verify no regressions.
- Update `final.tsv` scores and `docs/move-fx-ranking.html` after each batch.

## Verification

- Run `npm test` after each batch and trigger moves of that type in both regular battle and 도전의 탑.
- Check mobile-speed frame logs (`docs/BATTLE_FRAMES.md` method) to confirm new flashes and particles do not drop frames.
- For recipes whose duration changed, verify message timing and verb sound effects (`sfx.js`) stay aligned.

## Options compared

- Option A (rules first) matches timing, color, and area with no flash, leaving impacts weaker than the source.
- Option B (flash only, chosen) keeps the camera fixed and allows a brief impact-point white flash, approaching source impact while preserving the rule against body whitening.
- Option C (source first) adds camera movement, which breaks the battle screen's core layout rules.

## Designer decisions (open to operator override)

- Self-targeted moves with no impact moment (harden, focus, protect, and similar) anchor time 0 at the first frame the effect changes the screen, measuring start, peak, and end.
- Multi-type recipes are tuned during their representative move's type batch and only regression-checked in later batches.
- When source moves inside one recipe differ in duration, do not split the recipe during this pass. Match the representative move, measure other moves in the video, and log any pair differing by more than ±80ms for a separate splitting decision.
- Normalize the white flash ceiling by target size (Pokemon ink height) rather than full screen, matching the color-area denominator so framing differences do not skew passes or failures.
- Because Flying, Steel, Ice, and Rock have near-white type colors, count white flash only for near-white pixels outside each type's color window. Keep their impact light on the `${t}.d` ramp and exclude it from flash area.

## Left to the implementer

- Whether to detect phase boundaries automatically from metric inflection points (white and type-color area) or mark them manually from frames.
- How to adjust duration inside a verb (recipe parameters, verb defaults, or playback speed scaling).
- How to normalize target size between source and captured frames (such as dividing by Pokemon ink height).
