// 한 타입의 각본들을 원작과 비교해 match.tsv를 다시 쓴다.
// node match.mjs <type> <work> [--reshoot id,id|all] [--only id,id] [--ink 0.42] [--ms 5000]
//   <work>/videos/<type>.mp4   원작 영상(저장소 밖, 스크래치패드)
//   <work>/ref/<move>/frames   segments.tsv의 맞는 쪽 컷을 30fps로 자른 것(없으면 자른다)
//   <work>/ours/<move>/frames  실험실(?view=lab, 개발 서버 5182)을 찍은 것(없거나 --reshoot이면 다시 찍는다)
//   --ink: 실험실에서 맞는 포켓몬의 잉크 높이/캔버스 높이(기본 포켓몬 기준). 원작 쪽은 segments.tsv의 ink 칸.
// 가상 시계(--clock virtual)는 쓰지 못한다: Vite 개발 서버에서 load가 끝나지 않고, 실험실은 빌드에 없다. 실제 시계와 실제 GPU로 찍는다.
import { existsSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";
import { compareRow } from "./fxphases.mjs";

const HERE = dirname(fileURLToPath(import.meta.url)), SKILL = join(homedir(), ".claude/skills/reanimate/scripts");
const [type, work, ...rest] = process.argv.slice(2);
const opt = (k, d) => { const i = rest.indexOf(`--${k}`); return i < 0 ? d : rest[i + 1]; };
if (!type || !work) { console.error("node match.mjs <type> <work> [--reshoot id,id|all] [--only id,id] [--ink 0.42] [--ms 5000]"); process.exit(1); }
const reshoot = (opt("reshoot", "") || "").split(","), only = opt("only") ? opt("only").split(",") : null;
const tsv = path => readFileSync(path, "utf8").trim().split(/\r?\n/).map(l => l.split("\t"));
// bun is an npm shim (bun.cmd) on Windows, which Node only starts through a shell
const sh = (cmd, args) => { const r = spawnSync([cmd, ...args].map(a => (/\s/.test(a) ? `"${a}"` : a)).join(" "), { shell: true, encoding: "utf8", maxBuffer: 64 << 20 }); if (r.status !== 0) throw new Error(`${cmd} ${args.join(" ")}\n${r.stderr || r.stdout}`); return r.stdout; };
const measure = args => JSON.parse(sh("node", [join(HERE, "fxmeasure.mjs"), ...args]));

// the lab plays the move 800ms after the page is ready, so the recording holds a still stage first (the baseline)
const PRE = id => `(async () => { await new Promise(r => { const t = setInterval(() => { if (window.__bench && window.__bench.stage()?.__gl) { clearInterval(t); r(); } }, 100); }); window.__bench.setFormat("singles"); await new Promise(r => setTimeout(r, 2500));
  const m = document.createElement("div"); m.id = "fxmark"; m.style.cssText = "position:fixed;left:0;top:0;width:1px;height:1px;pointer-events:none"; document.body.append(m);
  let hit = false; window.__fxMark = n => { if (n === "hit") { if (hit) return; hit = true; } m.style.opacity = { play: ".9", emit: ".8", hit: ".7" }[n]; };
  setTimeout(() => window.__bench.play(${JSON.stringify(id)}), 800); })()`;
// stageFx.js marks a move's start, the end of its charge and its first landing on #fxmark's opacity; the capture samples it every frame
const marksOf = dir => {
  const s = JSON.parse(readFileSync(join(dir, "track.json"), "utf8")).samples.filter(x => x.t >= 0 && x.els["#fxmark"]);
  const firstAt = v => s.find(x => Math.abs(x.els["#fxmark"].opacity - v) < .01)?.t, hit = firstAt(.7);
  const emits = s.filter((x, i) => Math.abs(x.els["#fxmark"].opacity - .8) < .01 && Math.abs(s[i - 1]?.els["#fxmark"].opacity - .8) > .01);
  return [firstAt(.9), emits.at(-1)?.t, hit].map(x => (x == null ? "" : Math.round(x))).join(",");
};

const [head, ...segs] = tsv(join(HERE, "segments.tsv"));
const col = Object.fromEntries(head.map((h, i) => [h, i]));
const out = [];
for (const s of segs) {
  const g = k => s[col[k]] || "";
  if (g("type") !== type || (only && !only.includes(g("move")))) continue;
  const move = g("move"), self = g("self") === "1";
  if (!g("hit")) { out.push([g("recipe"), move, type, "", "no-ref", "", "", g("note")]); continue; }
  // 원작의 단계는 10fps 시트를 눈으로 읽어 적은 시각(초)이다: charge(모으기 시작), emit(물질이 떠나는 순간), hit(맞는 순간),
  // flashEnd(흰 섬광의 끝, 없으면 빈칸), end(남는 것이 사라진 때). 컷마다 배경색이 달라 단계는 자동으로 자르지 못한다.
  // 면적(섬광의 크기, 타입 색의 최댓값)만 맞는 쪽 컷(hit-0.2 ~ end+0.3)에서 잰다.
  const n = k => Number(g(k)), at = k => Math.round((n(k) - n("hit")) * 1000);
  const refDir = join(work, "ref", move, "frames"), ourDir = join(work, "ours", move);
  if (!existsSync(refDir)) sh("bun", [join(SKILL, "frames.ts"), "--in", join(work, "videos", `${type}.mp4`), "--out", refDir, "--fps", "30", "--start", String(n("hit") - .2), "--end", String(n("end") + .3)]);
  if (!existsSync(join(ourDir, "frames")) || reshoot.includes(move) || reshoot.includes("all")) {
    rmSync(ourDir, { recursive: true, force: true });
    const pre = join(work, "pre.js"); writeFileSync(pre, PRE(move));
    sh("bun", [join(SKILL, "capture.ts"), "--url", "http://localhost:5182/?view=lab", "--out", ourDir, "--viewport", "1280x720", "--selector", "canvas", "--track", "#fxmark", "--trigger", "none", "--pre-js", pre, "--wait-before", "1500", "--duration", opt("ms", "6500"), "--pre-roll", "0", "--fps", "30", "--gpu", "hardware"]);
  }
  const flag = self ? ["--self"] : [];
  const area = measure([refDir, "--type", type, "--top", "0.12", "--base", "tail", "--ink", g("ink") || "1", ...flag]);
  const phases = [];
  if (g("charge") && n("charge") < n("emit")) phases.push({ name: "charge", start: at("charge"), end: at("emit") });
  if (n("emit") < n("hit")) phases.push({ name: "travel", start: at("emit"), end: 0 });
  phases.push({ name: self ? "show" : "residue", start: 0, end: at("end") });
  const ref = { phases, flash: g("flashEnd") ? { start: 0, end: at("flashEnd"), peak: area.flash ? area.flash.peak : 0 } : null, typePeak: area.typePeak, residueEnd: at("end") };
  const ours = measure([join(ourDir, "frames"), "--type", type, "--ink", opt("ink", "0.42"), "--marks", marksOf(ourDir), ...flag]);
  const { pass, fails } = compareRow(ref, ours);
  out.push([g("recipe"), move, type, pass ? "pass" : "fail", fails.join(","), JSON.stringify(ref), JSON.stringify(ours), g("note")]);
  console.log(`${pass ? "PASS" : "FAIL"} ${move} ${fails.join(",")}`);
}
const file = join(HERE, "match.tsv"), HEAD = ["recipe", "move", "type", "pass", "fails", "ref", "ours", "note"];
const kept = existsSync(file) ? tsv(file).slice(1).filter(r => !out.some(o => o[1] === r[1])) : [];
writeFileSync(file, [HEAD, ...kept, ...out].map(r => r.join("\t")).join("\n") + "\n");
