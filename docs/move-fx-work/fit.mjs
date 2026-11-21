// match.tsv의 한 타입을 읽어, 각본(scripts/move-anims.mjs)에 그 기술의 시간을 적는다. 그 뒤 build-move-fx.mjs를 돌린다.
// node fit.mjs <type> [--dry]
//   c:  모으는 시간(ms): 원작의 (모으기 + 날아가기)에서 우리 날아가는 시간을 뺀 것. 120ms가 안 되면 지운다.
//   ts: 날아가는 시간을 몇 배로 늘릴지(지금 값 x 원작/우리, .6~2). t:를 직접 읽는 각본은 건드리지 않는다.
//   rs: 맞은 뒤 남는 것을 몇 배로 늘릴지(지금 값 x 원작/우리). r:을 직접 읽는 각본은 건드리지 않는다.
//   f:0 원작에 흰 섬광이 없으면.
// ts와 rs는 한 번에 다 가지 않는다(지수 .75, .6): 길이가 값에 곧게 비례하지 않아 한 번에 맞추면 넘쳤다.
// 같은 각본을 쓰는 모든 기술이 함께 바뀐다(각본은 대표 기술에 맞춘다). 두세 번 돌리면 수렴한다: match → fit → match.
import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { ANIMS } from "../../scripts/move-anims.mjs";

const [type, flag] = process.argv.slice(2);
const SRC = fileURLToPath(new URL("../../scripts/move-anims.mjs", import.meta.url));
const rows = readFileSync(new URL("match.tsv", import.meta.url), "utf8").trim().split(/\r?\n/).slice(1).map(l => l.split("\t")).filter(r => r[2] === type && r[5]);
const clamp = (x, a, b) => Math.min(b, Math.max(a, x)), dur = p => (p ? p.end - p.start : 0);
let src = readFileSync(SRC, "utf8"), changed = 0;
for (const r of rows) {
  const move = r[1], ref = JSON.parse(r[5]), ours = JSON.parse(r[6]), old = ANIMS[move];
  if (!old || old.includes(" then ")) { console.log(`skip ${move}: ${old ? "several phases" : "no script"}`); continue; }
  const words = old.split(/\s+/), opts = {}, base = [];
  for (const w of words) { if (/^(c|ts|rs|f):/.test(w)) { const [k, v] = w.split(":"); opts[k] = Number(v); } else base.push(w); }
  const native = k => base.some(w => w.startsWith(`${k}:`));
  const ph = (o, n) => o.phases.find(p => p.name === n);
  const rc = dur(ph(ref, "charge")), rt = dur(ph(ref, "travel")), ot = dur(ph(ours, "travel"));
  // 3초가 넘는 모으기는 두 턴짜리 기술의 앞 턴이나 컷신이다: 모으기로 치지 않는다
  // 몸으로 치는 기술(hit)의 맞기 전은 달려드는 몸이다: 시계를 늦추면 몸이 느려지므로 늘리지 않는다
  // 날아가는 시간은 두 배까지만 늘린다(.6~2): 시계를 다섯 배 늦추면 번개와 물줄기가 느린 화면이 된다. 원작이 그보다 길면
  // 남는 시간은 모으기(c)에 넣어, 기술이 시작해 맞기까지의 시간(모으기 + 날아가기)을 원작과 같게 한다
  const ts0 = opts.ts || 1;
  let travel = ot;
  if (base[0] !== "hit" && !native("t") && rt > 0 && ot > 50) { opts.ts = +clamp(ts0 * (rt / ot) ** .75, .6, 2).toFixed(2); travel = ot * opts.ts / ts0; if (Math.abs(opts.ts - 1) < .05) { delete opts.ts; travel = ot / ts0; } }
  const lead = (rc <= 3000 ? rc : 0) + rt, c = Math.round((lead - travel) / 10) * 10;
  if (!native("t")) { if (c >= 120) opts.c = Math.min(c, 3000); else delete opts.c; }
  else if (rc > 0 && rc <= 3000) opts.c = Math.round(rc / 10) * 10;
  // 대상을 치지 않는 기술(show)은 연출 전체를 늘린다
  const rsw = dur(ph(ref, "show")), osw = dur(ph(ours, "show"));
  if (rsw > 0 && osw > 50) { opts.ts = +clamp((opts.ts || 1) * (rsw / osw) ** .75, .6, 2.5).toFixed(2); if (Math.abs(opts.ts - 1) < .05) delete opts.ts; }
  else if (!native("r") && ref.residueEnd > 0 && ours.residueEnd > 0) { opts.rs = +clamp((opts.rs || 1) * (ref.residueEnd / ours.residueEnd) ** .6, .5, 2).toFixed(2); if (Math.abs(opts.rs - 1) < .08) delete opts.rs; }
  if (!ref.flash) opts.f = 0; else if (opts.f === 0) delete opts.f;
  const next = [...base, ...["c", "ts", "rs", "f"].filter(k => opts[k] !== undefined).map(k => `${k}:${opts[k]}`)].join(" ");
  if (next === old) continue;
  const n = src.split(`: "${old}"`).length - 1;
  console.log(`${move}: "${old}" → "${next}" (${n} moves)`);
  if (n) { src = src.split(`: "${old}"`).join(`: "${next}"`); changed++; }
  for (const k of Object.keys(ANIMS)) if (ANIMS[k] === old) ANIMS[k] = next; // a later row of the same recipe sees the new script
}
if (flag !== "--dry" && changed) {
  writeFileSync(SRC, src);
  console.log(spawnSync("node", [fileURLToPath(new URL("../../scripts/build-move-fx.mjs", import.meta.url))], { encoding: "utf8" }).stdout.trim());
}
