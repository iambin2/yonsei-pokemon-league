// The frames a battle scene draws at a phone's speed (docs/BATTLE_FRAMES.md): Chrome with the CPU four times slower, a phone's
// viewport and touch, every animation frame's gap recorded from the page's first script. Over 50 ms is a frame the eye sees stop.
//   node scripts/measure-frames.cjs <scene> [--base http://localhost:4173] [--reduced] [--desktop] [--profile] [--id <battle id>]
// scenes: replay-open (an ended battle's page, opened and played 12 s), tower-tab (도전의 탑 tab, 10 s), lobby (the battle page, 8 s),
// tab-switch (lobby → 도전의 탑 → 배틀 열기 → 도전의 탑, 10 s). Measure on the built site (npm run build, vite preview): the dev
// server serves modules one by one and measures its own loading.
// --profile prints the functions that held the main thread longest (self time) from the start to the end of the last frame over 50 ms.
// Exit code 1 when a frame in motion passes 50 ms (a still screen's long frame is reported, not failed). Playwright is not a dependency: it is taken from the npx cache (npx playwright once).
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
const scene = process.argv[2];
const BASE = arg("--base", "http://localhost:4173"), ID = arg("--id", "2firh2l7xbhn");
const desktop = process.argv.includes("--desktop"), reduced = process.argv.includes("--reduced"), profile = process.argv.includes("--profile");
const SCENES = {
  "replay-open": { url: `/?view=battle&id=${ID}`, ms: 12000 },
  "tower-tab": { url: "/?view=battle&tab=streak", ms: 10000 },
  lobby: { url: "/?view=battle", ms: 8000 },
  "tab-switch": { url: "/?view=battle", ms: 4000, act: async page => {
    for (const name of ["도전의 탑", "배틀 열기", "도전의 탑"]) { await page.getByRole("tab", { name }).first().click().catch(() => page.getByText(name, { exact: true }).first().click()); await page.waitForTimeout(2000); }
  } },
};
if (!SCENES[scene]) { console.error(`scenes: ${Object.keys(SCENES).join(", ")}`); process.exit(2); }
(async () => {
  const { chromium } = playwright();
  const browser = await chromium.launch({ channel: "chrome", args: ["--use-angle=d3d11"] });
  const ctx = await browser.newContext(desktop ? { viewport: { width: 1440, height: 900 } } : { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 3 });
  const page = await ctx.newPage();
  page.on("pageerror", e => console.log("pageerror", e.message));
  if (reduced) await page.emulateMedia({ reducedMotion: "reduce" });
  const cdp = await ctx.newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: desktop ? 1 : 4 });
  await page.addInitScript(() => {
    /* each frame: when it began, how long it took, and whether anything was moving in it (a CSS or Web animation running, a stage's
       tween or particle, a tower's move): a long frame on a still screen is a wait, one in motion is a stutter the eye sees */
    window.__frames = []; let last = performance.now();
    const moving = () => document.getAnimations().some(a => a.playState === "running")
      || [...document.querySelectorAll(".bs-stage, .tw")].some(el => el.__gl?.tweens?.length || el.__gl?.sprites?.length || el.tower?.anims?.size);
    const f = now => { window.__frames.push([last, now - last, moving() ? 1 : 0]); last = now; requestAnimationFrame(f); };
    requestAnimationFrame(f);
  });
  const t0 = Date.now();
  await page.goto(BASE + SCENES[scene].url, { waitUntil: "domcontentloaded", timeout: 60000 });
  // the profile starts once the page has a clock, which it is then read against (the page's time at the profile's start)
  let at0 = 0;
  if (profile) { await cdp.send("Profiler.enable"); await cdp.send("Profiler.setSamplingInterval", { interval: 200 }); await cdp.send("Profiler.start"); at0 = await page.evaluate(() => performance.now()); }
  if (SCENES[scene].act) await SCENES[scene].act(page);
  await page.waitForTimeout(Math.max(0, SCENES[scene].ms - (Date.now() - t0)));
  const frames = (await page.evaluate(() => window.__frames)).slice(1);
  const gaps = frames.map(f => f[1]), long = frames.filter(f => f[1] > 50);
  const seen = long.filter(f => f[2]);
  console.log(`${scene}${desktop ? " desktop" : ""}${reduced ? " reduced" : ""}: frames ${gaps.length} over34 ${gaps.filter(g => g > 34).length} over50 ${long.length} inMotion ${seen.length} worst ${Math.round(Math.max(0, ...gaps))} worstInMotion ${Math.round(Math.max(0, ...seen.map(f => f[1])))} sumLong ${Math.round(long.reduce((s, f) => s + f[1], 0))}`);
  console.log("long frames at (ms from navigation start, length, * in motion):", long.map(f => `${Math.round(f[0])}+${Math.round(f[1])}${f[2] ? "*" : ""}`).join(" "));
  if (profile) {
    const { profile: p } = await cdp.send("Profiler.stop");
    const byId = new Map(p.nodes.map(n => [n.id, n]));
    // per long frame: its biggest self times (a frame of the load, before the page had a clock, is not profiled)
    const per = long.map(() => new Map());
    const self = new Map();
    let t = 0;
    for (let i = 0; i < p.samples.length; i++) {
      t += p.timeDeltas[i];
      const ms = at0 + t / 1000, k = long.findIndex(f => ms >= f[0] && ms <= f[0] + f[1]);
      if (k < 0) continue;
      const n = byId.get(p.samples[i]), cf = n.callFrame;
      if (["(idle)", "(program)"].includes(cf.functionName) && !cf.url) continue;
      const key = `${cf.functionName || "(anonymous)"} ${cf.url.split("/").pop()}:${cf.lineNumber + 1}`;
      const d = (p.timeDeltas[i + 1] || 200) / 1000;
      self.set(key, (self.get(key) || 0) + d);
      per[k].set(key, (per[k].get(key) || 0) + d);
    }
    long.forEach((f, k) => { if (per[k].size) console.log(`  ${Math.round(f[0])}+${Math.round(f[1])}: ${[...per[k]].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([n, v]) => `${n} ${v.toFixed(0)}`).join(", ")}`); });
    for (const [k, v] of [...self].sort((a, b) => b[1] - a[1]).slice(0, 25)) console.log(`${v.toFixed(0).padStart(6)} ms  ${k}`);
  }
  await browser.close();
  process.exit(seen.length ? 1 : 0);
})();
