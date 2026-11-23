// shared helpers for the tower / two-person audit (letter p). Playwright from the npx cache, real GPU.
const fs = require("fs"), path = require("path");
function playwright() {
  try { return require("playwright"); } catch {}
  const cache = path.join(process.env.LOCALAPPDATA, "npm-cache", "_npx");
  for (const d of fs.readdirSync(cache)) { const p = path.join(cache, d, "node_modules", "playwright"); if (fs.existsSync(p)) return require(p); }
  throw new Error("playwright not found");
}
const BASE = "http://localhost:5194/", STAND = "http://localhost:54321";
const USER = "11111111-1111-4111-8111-111111111111";
const SHOTS = require("path").resolve(__dirname, "../../../docs/visual-audit/shots").split(require("path").sep).join("/");
const SIZES = [[390, 844], [1440, 900]];
async function launch() { return playwright().chromium.launch({ channel: "chrome", args: ["--use-angle=d3d11", "--enable-gpu"] }); }
// signed: the stand-in's approved account; speed 0 = 건너뛰기
async function context(browser, { w = 390, h = 844, theme = "dark", signed = true, speed = "0", name = "" } = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, locale: "ko-KR", timezoneId: "Asia/Seoul", hasTouch: w < 860 });
  await ctx.addInitScript(([t, u, signed, speed, name]) => { try {
    if (!localStorage.getItem("ypl-theme")) localStorage.setItem("ypl-theme", t);
    if (signed) localStorage.setItem("ypl-visitor-session", JSON.stringify({ access: u, refresh: "r", until: Date.now() + 3e8 }));
    if (speed != null && !localStorage.getItem("ypl-battle:speed")) localStorage.setItem("ypl-battle:speed", speed);
    if (name && !localStorage.getItem("ypl-battle:name")) localStorage.setItem("ypl-battle:name", name);
    localStorage.setItem("ypl-battle:hold-hint", "1");
  } catch {} }, [theme, USER, signed, speed, name]);
  return ctx;
}
// one state at both sizes and both themes; the theme is switched on <html> as App does (canvas scenes may keep the old tone until redrawn)
async function shoot(page, id, name, { sizes = SIZES, themes = ["dark", "light"], settle = 500, full = false } = {}) {
  const dir = path.join(SHOTS, id); fs.mkdirSync(dir, { recursive: true });
  const was = page.viewportSize(), wasTheme = await page.evaluate(() => document.documentElement.dataset.theme);
  for (const [w, h] of sizes) for (const t of themes) {
    await page.setViewportSize({ width: w, height: h });
    await page.evaluate(t => { document.documentElement.dataset.theme = t; }, t);
    await page.waitForTimeout(settle);
    await page.screenshot({ path: path.join(dir, `${name}-${w}x${h}-${t}.png`), fullPage: full });
  }
  await page.setViewportSize(was); await page.evaluate(t => { document.documentElement.dataset.theme = t; }, wasTheme); await page.waitForTimeout(200);
}
// overflow and clipped text inside a root, as the first round measured them
const MEASURE = sel => { const root = document.querySelector(sel) || document.body, out = { vw: innerWidth, docW: document.documentElement.scrollWidth, clipped: [], over: [] };
  for (const el of root.querySelectorAll("*")) { const r = el.getBoundingClientRect(); if (!r.width) continue;
    if (r.right > innerWidth + 1 || r.left < -1) out.over.push([el.className?.baseVal ?? el.className, Math.round(r.left), Math.round(r.right)]);
    const cs = getComputedStyle(el); if (el.children.length === 0 && el.scrollWidth > el.clientWidth + 1 && cs.overflow !== "visible") out.clipped.push([el.className, el.textContent.slice(0, 20), el.scrollWidth, el.clientWidth]); }
  out.over = out.over.slice(0, 8); out.clipped = out.clipped.slice(0, 8); return out; };
const fn = (id, body, token = USER) => fetch(`${STAND}/functions/v1/battle`, { method: "POST", headers: { authorization: `Bearer ${token}` }, body: JSON.stringify(body) }).then(r => r.json());
const weak = (id, side = 1) => fetch(`${STAND}/harness/weak?id=${id}&side=${side}`).then(r => r.json());
const battleId = page => new URL(page.url()).searchParams.get("id");
// plays the open battle to its end with any legal choice: picks the first N, then the first live move, or a switch when one is forced
async function play(page, { side = 1, log = () => {}, max = 120, stop = "" } = {}) {
  await page.waitForSelector(".bt-pick, .bt-move, .bt-sw", { timeout: 40000 });
  if (side != null) await weak(battleId(page), side);
  for (let i = 0; i < max; i++) {
    if (side != null && i % 3 === 2) await weak(battleId(page), side).catch(() => {});
    const s = await page.evaluate(stop => {
      const vis = el => el && el.getBoundingClientRect().width > 0;
      if (document.querySelector(".streak-result, .streak-break-head, .bt-end-keys")) return "end";
      const dock = document.querySelector(".bt-pickdock button");
      if (vis(dock)) { if (!dock.disabled) { dock.click(); return "sent"; }
        const c = [...document.querySelectorAll(".bt-pick")].find(c => !c.querySelector("[aria-pressed=true], [aria-checked=true], .on")); const b = c?.querySelector("button:not(.bt-info-key)") || c?.querySelector("[role=button], label, .mc"); if (b) { b.click(); return "pick"; } return "pick?"; }
      if (stop === "move" && [...document.querySelectorAll(".bt-move")].some(b => !b.disabled && vis(b))) return "stop"; const ms = [...document.querySelectorAll(".bt-move")].filter(b => !b.disabled && vis(b)).sort((a, b) => (Number(b.dataset.info?.split(":")[3]) || 0) - (Number(a.dataset.info?.split(":")[3]) || 0)); if (ms[0]) { ms[0].click(); return "move"; }
      const sw = [...document.querySelectorAll(".bt-sw")].find(b => !b.disabled && vis(b)); if (sw) { sw.click(); return "switch"; }
      return "wait";
    }, stop);
    log(s); if (s === "end" || s === "stop") return true;
    await page.waitForTimeout(s === "wait" ? 700 : 350);
  }
  return false;
}
module.exports = { playwright, launch, context, shoot, MEASURE, fn, weak, battleId, play, BASE, STAND, USER, SHOTS };
