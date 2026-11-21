// 원작 영상에서 시각이 적힌 시트를 만든다.
// node refsheet.mjs index <video> <outPrefix>            2초 간격 색인(8x8칸, 여러 장): 칸의 글자는 시:분:초
// node refsheet.mjs cut <video> <from> <to> <out.png>    10fps 시트(10칸 폭): 칸의 숫자는 영상의 시각 x 10 (1237 = 123.7초)
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { homedir } from "node:os";
const FF = join(homedir(), ".claude/skills/reanimate/scripts/node_modules/ffmpeg-static", process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg");
const [mode, video, a, b, c] = process.argv.slice(2);
const run = args => { const r = spawnSync(FF, ["-nostdin", "-hide_banner", "-loglevel", "error", ...args], { encoding: "utf8" }); if (r.status !== 0) console.error(r.stderr); };
const box = "x=3:y=3:fontsize=13:fontcolor=yellow:box=1:boxcolor=black", C = String.fromCharCode(92) + ":"; // a colon escaped for ffmpeg
if (mode === "index") run(["-i", video, "-vf", `fps=1/2,scale=240:-1,drawtext=text='%{pts${C}hms}':${box},tile=8x8`, "-y", `${a}%d.png`]);
else if (mode === "cut") run(["-ss", a, "-to", b, "-i", video, "-vf", `fps=10,scale=192:-1,drawtext=text='%{eif${C}(t+${a})*10${C}d}':${box},tile=10x${Math.ceil(b - a)}`, "-frames:v", "1", "-y", c]);
else { console.error("node refsheet.mjs index <video> <outPrefix> | cut <video> <from> <to> <out.png>"); process.exit(1); }
