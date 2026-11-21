// 프레임 폴더(PNG)를 읽어 프레임마다 흰 면적과 타입 색 면적을 재고, 단계를 잘라 JSON으로 낸다.
// node fxmeasure.mjs <frames> --type fire [--fps 30] [--top 0.12] [--from 0 --to 999] [--ink 0.3] [--self] [--rows] [--base tail]
//   --top: 위에서 잘라 낼 비율(원작 영상의 제목 띠). --from/--to: 쓸 프레임 범위. --ink: 대상의 잉크 높이/화면 높이.
//   --base tail: 기준선을 끝의 여섯 프레임에서 잡는다. 원작은 맞는 쪽으로 카메라가 넘어가므로, 그 컷만 잘라(--from/--to)
//     연출이 다 사라진 끝을 기준선으로 쓴다(컷마다 배경의 색이 달라 앞 컷은 기준선이 못 된다).
//   --self: 맞는 순간이 없는 기술. --rows: 프레임별 수치도 함께 낸다.
// pngjs는 Reanimate 스킬(~/.claude/skills/reanimate/scripts)의 것을 쓴다(shoot.mjs가 npx 캐시의 Playwright를 쓰듯이).
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createRequire } from "node:module";
import { homedir } from "node:os";
import { typeWindow, classify, phasesOf } from "./fxphases.mjs";

const { PNG } = createRequire(join(homedir(), ".claude/skills/reanimate/scripts/"))("pngjs");
const argv = process.argv.slice(2), dir = argv[0];
const opt = (k, d) => { const i = argv.indexOf(`--${k}`); return i < 0 ? d : argv[i + 1]; };
const has = k => argv.includes(`--${k}`);
if (!dir || !opt("type")) { console.error("node fxmeasure.mjs <frames> --type <type> [--fps 30] [--top 0] [--from N] [--to N] [--ink 1] [--self] [--rows]"); process.exit(1); }

const win = typeWindow(opt("type")), fps = Number(opt("fps", 30)), top = Number(opt("top", 0));
const files = readdirSync(dir).filter(f => f.endsWith(".png")).sort().slice(Number(opt("from", 0)), Number(opt("to", 1e9)) + 1);
const rows = files.map(f => {
  const { width: w, height: h, data: d } = PNG.sync.read(readFileSync(join(dir, f)));
  let n = 0, white = 0, type = 0, cx = 0;
  for (let y = Math.floor(h * top); y < h; y += 2) for (let x = 0; x < w; x += 2) {
    const k = (y * w + x) * 4, c = classify([d[k], d[k + 1], d[k + 2]], win);
    n++;
    if (c === "white") white++; else if (c === "type") { type++; cx += x / w; }
  }
  return { white: white / n, type: type / n, cx: type ? cx / type : null };
});
const tail = rows.slice(-6), avg = k => tail.reduce((a, r) => a + r[k], 0) / tail.length;
const baseline = opt("base") === "tail" ? { white: avg("white"), type: avg("type") } : undefined;
// --marks play,emit,hit: 실험실이 알려 준 시각(ms). 빈칸은 없는 것(예: "800,,2100")
const mk = opt("marks") ? opt("marks").split(",").map(x => (x === "" ? undefined : Number(x))) : null;
const marks = mk ? { play: mk[0], emit: mk[1], hit: mk[2] } : undefined;
const out = phasesOf(rows, { fps, baseline, marks, ink: Number(opt("ink", 1)), hit: !has("self") });
console.log(JSON.stringify(has("rows") ? { ...out, rows } : out, null, 1));
