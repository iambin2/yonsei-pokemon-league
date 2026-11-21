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
// --diff: 마지막 프레임과 다른 화소의 비율(any)도 잰다. 카메라가 서 있는 우리 무대에서만 뜻이 있다: 색이 옅은 물, 얼음, 바람도 남아 있는 동안은 잡힌다
// 기준은 마지막 프레임이다(다 끝나고 선 무대): 첫 프레임은 카메라가 아직 덜 돌아온 때가 있어 끝까지 다르게 나왔다
let first = has("diff") && files.length ? PNG.sync.read(readFileSync(join(dir, files.at(-1)))).data : null;
const rows = files.map(f => {
  const { width: w, height: h, data: d } = PNG.sync.read(readFileSync(join(dir, f)));
  let n = 0, white = 0, type = 0, cx = 0, any = 0;
  for (let y = Math.floor(h * top); y < h; y += 2) for (let x = 0; x < w; x += 2) {
    const k = (y * w + x) * 4, c = classify([d[k], d[k + 1], d[k + 2]], win);
    n++;
    if (c === "white") white++; else if (c === "type") { type++; cx += x / w; }
    if (first && Math.abs(d[k] - first[k]) + Math.abs(d[k + 1] - first[k + 1]) + Math.abs(d[k + 2] - first[k + 2]) > 60) any++;
  }
  return { white: white / n, type: type / n, cx: type ? cx / type : null, ...(first ? { any: any / n } : {}) };
});
const tail = rows.slice(-6), avg = k => tail.reduce((a, r) => a + r[k], 0) / tail.length;
const baseline = opt("base") === "tail" ? { white: avg("white"), type: avg("type") } : undefined;
// --marks play,emit,hit: 실험실이 알려 준 시각(ms). 빈칸은 없는 것(예: "800,,2100")
const mk = opt("marks") ? opt("marks").split(",").map(x => (x === "" ? undefined : Number(x))) : null;
const marks = mk ? { play: mk[0], emit: mk[1], hit: mk[2] } : undefined;
const out = phasesOf(rows, { fps, baseline, marks, ink: Number(opt("ink", 1)), hit: !has("self") });
console.log(JSON.stringify(has("rows") ? { ...out, rows } : out, null, 1));
