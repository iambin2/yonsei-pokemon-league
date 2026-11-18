// Records a stretch of the site as it is drawn (Chrome's screencast, every frame the compositor sends) and lays the frames out as one
// contact sheet, so a transition is judged by its frames and not by a still (CLAUDE.md "Use it before calling it done").
//   node scripts/record-transition.cjs <out dir> <url> [--ms 4000] [--desktop] [--cpu 4] [--every 100] [--act "<js run in the page>"]
//     [--wait-for "<css selector>"] [--before 0]
// --act runs in the page once --wait-for is there and --before ms have passed, and the recording starts the same moment, so the
// frames show the transition the act starts. Writes <out>/frame-<ms>.jpg for every frame and <out>/sheet.png, a frame every
// --every ms with its time, and prints the frame times (gaps over 50 ms are marked).
const fs = require("fs"), path = require("path");
function playwright() {
  try { return require("playwright"); } catch { /* not installed */ }
  const cache = path.join(process.env.LOCALAPPDATA || path.join(require("os").homedir(), ".npm"), "npm-cache", "_npx");
  for (const dir of fs.existsSync(cache) ? fs.readdirSync(cache) : []) {
    const p = path.join(cache, dir, "node_modules", "playwright");
    if (fs.existsSync(p)) return require(p);
  }
  throw new Error("playwright not found: run npx playwright --version once");
}
const arg = (name, fallback) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : fallback; };
const [out, url] = process.argv.slice(2);
const MS = Number(arg("--ms", 4000)), CPU = Number(arg("--cpu", 4)), EVERY = Number(arg("--every", 100)), BEFORE = Number(arg("--before", 0));
const desktop = process.argv.includes("--desktop"), act = arg("--act", ""), waitFor = arg("--wait-for", "");
(async () => {
  fs.mkdirSync(out, { recursive: true });
  const { chromium } = playwright();
  const browser = await chromium.launch({ channel: "chrome", args: ["--use-angle=d3d11"] });
  const ctx = await browser.newContext(desktop ? { viewport: { width: 1440, height: 900 } } : { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.on("pageerror", e => console.log("pageerror", e.message));
  const cdp = await ctx.newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: CPU });
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
  if (waitFor) await page.waitForSelector(waitFor, { timeout: 30000 });
  if (BEFORE) await page.waitForTimeout(BEFORE);
  const frames = [];
  let t0 = null;
  cdp.on("Page.screencastFrame", async f => {
    const t = f.metadata.timestamp * 1000;
    t0 ??= t;
    frames.push({ t: Math.round(t - t0), data: f.data });
    cdp.send("Page.screencastFrameAck", { sessionId: f.sessionId }).catch(() => {});
  });
  await cdp.send("Page.startScreencast", { format: "jpeg", quality: 70, everyNthFrame: 1 });
  if (act) await page.evaluate(act).catch(e => console.log("act failed", e.message));
  await page.waitForTimeout(MS);
  await cdp.send("Page.stopScreencast");
  await browser.close();
  for (const f of frames) fs.writeFileSync(path.join(out, `frame-${String(f.t).padStart(5, "0")}.jpg`), Buffer.from(f.data, "base64"));
  const gaps = frames.slice(1).map((f, i) => f.t - frames[i].t);
  console.log(`frames ${frames.length}, gaps over 50 ms ${gaps.filter(g => g > 50).length}, longest ${Math.max(0, ...gaps)} ms`);
  console.log(frames.map((f, i) => `${f.t}${i && gaps[i - 1] > 50 ? "!" : ""}`).join(" "));
  // the sheet: a frame every EVERY ms (the last frame drawn by then), labelled with its time (needs Python's PIL)
  const pick = [];
  for (let at = 0; at <= MS; at += EVERY) { const f = [...frames].reverse().find(x => x.t <= at); if (f && !pick.includes(f)) pick.push(f); }
  const list = pick.map(f => path.join(out, `frame-${String(f.t).padStart(5, "0")}.jpg`).replace(/\\/g, "/"));
  const py = `
from PIL import Image, ImageDraw
files = ${JSON.stringify(list)}
ims = [Image.open(f) for f in files]
w, h = ims[0].size
scale = 0.5 if w > 800 else 1
tw, th = int(w * scale), int(h * scale)
cols = 6 if w <= 800 else 4
rows = (len(ims) + cols - 1) // cols
sheet = Image.new("RGB", (cols * (tw + 8), rows * (th + 26)), (20, 20, 20))
d = ImageDraw.Draw(sheet)
for k, (f, im) in enumerate(zip(files, ims)):
    x, y = (k % cols) * (tw + 8), (k // cols) * (th + 26)
    sheet.paste(im.resize((tw, th)), (x, y + 22))
    d.text((x + 4, y + 4), f.rsplit("frame-", 1)[1][:-4].lstrip("0") + " ms", fill=(255, 255, 255))
sheet.save(${JSON.stringify(path.join(out, "sheet.png").replace(/\\/g, "/"))})
`;
  require("child_process").execFileSync("python", ["-c", py], { stdio: "inherit" });
})();
