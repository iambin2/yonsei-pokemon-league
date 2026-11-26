# Move FX tools (2026-11-07)

- `recipes.json` holds 223 animation recipes (representative move, recipe, included moves). Numbers reflect recipe order, not rank.
- `scores.tsv` records pre-edit scores (number, score, representative move, memo). `final.tsv` records post-edit scores (if a number appears on multiple lines, the last line is latest).
- `shoot.mjs` plays moves in the lab (`?view=lab`) and captures 8-frame contact sheets. Requires the dev server on port 5182 (`ypl-dev-offline`) and uses Playwright from the npx cache (path at the top of the file). Run `node shoot.mjs 0 223 "" <outDir>` or target specific moves with `node shoot.mjs 0 0 flamethrower,surf <outDir>`. Output paths are relative to this folder or absolute. When running in parallel, offset window position with `WX=-3000`. For protection moves, the lab also plays the post-move shield line just like live battles.
- `shootfield.mjs [ids] <outDir>` sets up weather, terrains, rooms, side hazards, screens, and Mega Evolution (`mega`) in the lab and captures 8 frames over 3 seconds.
- `sb.py "Protect" "Aqua Ring"` searches official game reference videos (AGi-M's "Move: X | Pokemon Scarlet Violet", falling back to other showcases) and saves YouTube storyboard URLs (320x180, ~1 s interval, 3x3 grid) to `sb.json`. `--js` prints a one-liner to paste into the browser. Signed URLs expire after a few hours, so keep `sb.json` out of git. Open storyboard sheets in a browser window and inspect cropped cells to match official animations instead of working from memory.
- `montage.py` and `mont4.py` combine 3 to 4 contact sheets per image. `add.py move=score ... --note "what changed"` appends updated scores to `final.tsv`.
- `report.py` with `report_tpl.html` generates the ranking page `docs/move-fx-ranking.html`. Re-run after every score update.
- `shoot.mjs` writes white-saturation metrics per move to `<outDir>/white.tsv` (increase in near-white pixels over frame 1, parts per thousand of screen area, peak frame). Capture before and after on the same move list and run `pair.py <beforeDir> <afterDir> <outDir> [4]` to inspect them side by side with numbers.
- `emitlog.mjs <move>` lists emitted particles chronologically (texture, color ramp, size, `emis`, `occ`) to trace which particles stack into a white blob. `actorlog.mjs <move>` prints the Pokémon's `flash`, `rim`, and `tint` values every 40 ms during playback to separate body shading from additive glow stacked on top.
- The lab occasionally switches into doubles mode mid-capture. Re-shoot any affected move (suspect when `white.tsv` drops near 0 or two opponents appear).

## Numeric matching against the official games (2026-11-21)

Design doc: `docs/superpowers/specs/2026-11-21-move-fx-match-design.md`. Plan: `docs/superpowers/plans/2026-11-21-move-fx-match.md`.

- `fxmeasure.mjs <frameDir> --type fire` measures white area and type-color area per frame and outputs phase timings (charge, travel, flash, residue) in ms. For official footage, crop only the cut showing the defender and run `--from --to --base tail --top 0.12` because background colors change between cuts and earlier cuts cannot act as a baseline. Our own recordings must start more than 200 ms before the animation so the first six frames form a clean baseline.
- `fxphases.mjs` implements those calculations, pass thresholds (`compareRow`: phase ±80 ms, flash duration ±50 ms with area <= official, type-color area ±25%, residue ±120 ms), and per-type color windows (`WIN`). Tested by `tests/fxPhases.test.mjs`.
- `segments.tsv` stores timestamps (in seconds) read by eye from 10 fps sheets of official videos (YouTube IDs in `refs.json`): `charge` (charge glow first visible), `emit` (projectile/material leaves), `hit` (impact), `flashEnd` (end of white flash, blank if none), `end` (residue gone), and `ink` (defender height / frame height). Body lunges do not count as emitted material, so contact moves set `emit = hit`. Build sheets with the `ffmpeg` command at the end of this file.
- `match.mjs <type> <workDir>` slices the defender cut from official footage, captures our animation in the lab, compares them, and writes `match.tsv`. `show.mjs [type]` prints a readable summary. Our own start, emit, and hit timings come directly from `stageFx.js` (`fxMark`, active only when a listener is attached during capture) rather than visual estimation. Virtual clocks cannot be used because dev server loads hang and the lab is excluded from production builds; real clocks add about ±1 frame of jitter per run.
- Frame slicing and recording use `frames.ts` and `capture.ts` from the Reanimate skill (`~/.claude/skills/reanimate/scripts`, Bun). Keep official video files out of git.

## Script timing parameters (2026-11-21)

Each recipe in `scripts/move-anims.mjs` carries official-game timings at the end, computed from `match.tsv` by `fit.mjs <type>`.

- `c:` sets charge duration in ms. The stage caps playback at `GATHER_MAX` (600 ms in `moveFx.js`) per operator decision (2026-11-21, "모으기 짧게"): official games fill 1 to 3 seconds of charging with custom cutscenes, whereas our particle gather felt like dead wait time. Keep the measured value in the recipe itself.
- `ts:` scales stage clock slowdown from emit to first hit (0.6 to 2). Exceeding 2x turns lightning and water jets into slow motion.
- `rs:` scales post-hit particle lifetimes (0.5 to 2), excluding impact flash.
- `f:` sets impact flash size (0 disables it). `t:`, `r:`, and `k:` are used only by verbs that read them directly (edited in the Fire batch).
- Helper tools: `batch.sh <type> <workDir>` (insert read timestamps, measure, write fitted values, then re-measure), `summary.mjs` (failure counts by type), and `refsheet.mjs` (official reference sheets). Do not run tests or builds while measuring, as dropped frames stretch timings. Commit before measuring so another task stashing in the same repo does not swap old code underneath a run.
- Cases not solvable by numbers alone: contact moves where material trails the body lunge, multi-stage official animations (freezing inside ice then shattering, sky cutscenes), and spaced multi-hit projectiles. These remain as `lead` and `travel` failures in `match.tsv`.
- Normal type has only five official references (videos embedded in Namuwiki articles for 신속, 칼춤, 파괴광선, 조이기, and 찍찍베기; non-downloadable, so timings were read from the page without area numbers).

## Rules

- Do not use flat circles (ground rings, charge rings) or wash out a Pokémon's body to solid white.
- Per operator decision B (2026-11-21), short white flashes at the impact point are allowed (`stageFx.js` `impactFlash`, called by `burst`). Match official duration (100 to 200 ms) and stay at or below official area, rendered strictly as airborne light. Turning the target's body white via `flash`, `rim`, or `tint` remains forbidden. Moves without an official flash (such as 열풍 or 도깨비불) disable it with `land(t, { flash: 0 })`.
- Use `rim` to tint a Pokémon's body. Since 2026-11-07, color channels (`rimR/G/B`, `tintR/G/B`) assign rather than add (`gl.js` `ASSIGN`); adding to the default 1 previously washed every color to white.
- Hit blinks must not overlap (`stageFx` `hit`), since overlapping blinks on multi-hit moves washed bodies white.
- Additive light (`emis 1`) clips to white when stacked. Physical matter like smoke, droplets, and scales should use higher `occ` and lower `emis`.
- From pass 4 (2026-11-07), shaped move props like fists, feet, claws, and fangs are solid type matter (`emis .3`, `occ .9`, darker `.m` or `fire.s`). Drawing them with white-core ramps like `fire.c` or `fighting.h` creates a white disc over the target. Fireballs (`fire()`) use `fire.s`, matching the body of 화염방사.
- Flying, Steel, Ice, and Rock type colors are nearly white on their own. Draw their impact lights (stars, streaks, projectiles) with `${t}.d` (midpoint between type color and deep shade).
- If a target already has an active impact light, `burst` emits only streaks, shards, and marks (`e.burstAt`) instead of stacking extra stars and glow on multi-hit or projectile impacts.
- Blade bodies (`mode 0`) are solid matter (`emis .55`, `occ .6`) with type-colored edges rather than white edges. The lingering large C-shaped post-hit arc was removed.

## Reference sheet generation

```bash
ffmpeg -nostdin -ss 121 -to 129 -i videos/fire.mp4 -vf "fps=10,scale=192:-1,drawtext=text='%{eif\:(t+121)*10\:d}':x=3:y=3:fontsize=13:fontcolor=yellow:box=1:boxcolor=black,tile=10x9" -frames:v 1 sheet.png
```

Cell numbers equal video timestamp multiplied by 10 (`1237` means 123.7 s). Omitting `-nostdin` lets `ffmpeg` swallow loop input.
