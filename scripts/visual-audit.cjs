// The visual audit's camera (docs/visual-audit/plan.md): opens every scene of scripts/visual-audit.scenes.cjs at every viewport
// and theme, takes its picture and measures it (sideways overflow, touch targets under 44, clipped words, the type sizes in use).
//   node scripts/visual-audit.cjs [--base http://localhost:5183] [--out docs/visual-audit/shots] [--set public,modal,...]
//     [--only HOME-03,NEWS-01] [--vp 390x844,1440x900 | core | all | edges] [--theme dark,light] [--login] [--headed] [--resume: skip pictures already there]
// Writes <out>/<ID>/<width>x<height>-<theme>.png and <out>/measure.jsonl (one line a picture; appended, so delete it for a clean run).
// --login opens a window you can see, waits until the operator has signed in by hand (the admin session lives in this one tab's
// sessionStorage, so the admin scenes are shot in that same tab), and keeps the browser's storage in .visual-audit/session.json
// (ignored by git) for the next run. No password is asked for or written anywhere. In an admin run every request that is not a
// read is refused, so a key pressed by mistake changes nothing.
// Playwright is not a dependency: it is taken from the npx cache (run `npx playwright --version` once).
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
const has = name => process.argv.includes(name);
const BASE = arg("--base", "http://localhost:5183"), OUT = arg("--out", "docs/visual-audit/shots");
const SESSION = ".visual-audit/session.json";
const VIEWPORTS = {
  core: ["390x844", "1440x900"],
  all: ["360x800", "390x844", "430x932", "768x1024", "1280x800", "1440x900", "1920x1080"],
  // just under and just over every width where a stylesheet changes the layout (inventory.md, 0)
  edges: ["379x800", "380x800", "600x900", "601x900", "639x900", "640x900", "859x900", "860x900", "1099x900", "1100x900", "1199x900", "1200x900"],
};
const vps = arg("--vp", "core").split(",").flatMap(v => VIEWPORTS[v] || [v]);
const themes = arg("--theme", "dark,light").split(",");
const sets = arg("--set", "public").split(","), only = arg("--only", "").split(",").filter(Boolean);
const scenes = require("./visual-audit.scenes.cjs").filter(s => only.length ? only.includes(s.id) : sets.includes(s.set || "public"));

// What a picture cannot tell: measured in the page, after the scene has settled.
const MEASURE = () => {
  const vw = document.documentElement.clientWidth, seen = el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== "hidden"; };
  const name = el => (el.tagName.toLowerCase() + (el.id ? "#" + el.id : "") + (typeof el.className === "string" && el.className ? "." + el.className.trim().split(/\s+/).slice(0, 3).join(".") : "")) + " «" + (el.innerText || el.getAttribute("aria-label") || "").trim().slice(0, 24) + "»";
  const scope = document.querySelector(".modal, .sheet, [role=dialog]") || document.body;
  const overflow = document.documentElement.scrollWidth > vw + 1 ? [...document.querySelectorAll("body *")].filter(el => seen(el) && el.getBoundingClientRect().right > vw + 1 && !el.closest("[data-scroll-x], .bk-tree, .bk-scroll")).slice(0, 8).map(name) : [];
  const small = [...scope.querySelectorAll("a[href], button, [role=button], [role=tab], input, select, textarea, summary")].filter(seen).map(el => ({ el, r: el.getBoundingClientRect() })).filter(({ r }) => r.height < 43.5 || r.width < 43.5).slice(0, 40).map(({ el, r }) => name(el) + ` ${Math.round(r.width)}x${Math.round(r.height)}`);
  const clipped = [...scope.querySelectorAll("h1,h2,h3,h4,p,span,a,button,b,strong,td,th,li,div")].filter(el => seen(el) && el.childElementCount === 0 && el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).overflow !== "visible").slice(0, 20).map(name);
  const sizes = {}, gaps = {};
  for (const el of scope.querySelectorAll("*")) {
    if (!seen(el)) continue;
    const cs = getComputedStyle(el);
    if ([...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) { const k = `${parseFloat(cs.fontSize)}/${parseFloat(cs.lineHeight) || cs.lineHeight}/${cs.fontWeight}`; sizes[k] = (sizes[k] || 0) + 1; }
    for (const p of ["rowGap", "columnGap", "paddingTop", "paddingRight", "paddingBottom", "paddingLeft", "marginTop", "marginBottom"]) { const v = parseFloat(cs[p]); if (v > 0) gaps[v] = (gaps[v] || 0) + 1; }
  }
  return { overflow, small, clipped, sizes, gaps, height: document.documentElement.scrollHeight };
};

async function settle(page) {
  await page.waitForSelector("#ypl-main, .status-page, main", { timeout: 30000 }).catch(() => {});
  await page.waitForLoadState("networkidle", { timeout: 3000 }).catch(() => {});
  // the lighting (420 and its stagger, DESIGN.md "Motion") and late pictures (at most 1200)
  await page.waitForTimeout(1500);
}

async function shoot(page, scene, vp, theme, log) {
  const [w, h] = vp.split("x").map(Number);
  const dir = path.join(OUT, scene.id), file = path.join(dir, `${vp}-${theme}.png`);
  if (has("--resume") && fs.existsSync(file)) return;
  await page.setViewportSize({ width: w, height: h });
  await page.evaluate(t => { try { localStorage.setItem("ypl-theme", t); } catch { /* the default theme */ } }, theme).catch(() => {});
  await page.goto(BASE + scene.url, { waitUntil: "domcontentloaded", timeout: 60000 });
  await settle(page);
  let note = "";
  if (scene.act) { try { await scene.act(page, { w, h, phone: w < 860 }); await page.waitForTimeout(scene.after ?? 900); } catch (e) { note = "act failed: " + e.message.split("\n")[0]; } }
  fs.mkdirSync(dir, { recursive: true });
  // a page is shot whole (to 6000 tall); a sheet, a dialog or a moment is the window as it stands
  await page.screenshot({ path: file, fullPage: scene.whole || (!scene.act && !scene.window) }).catch(e => { note += " shot failed: " + e.message.split("\n")[0]; });
  const m = await page.evaluate(MEASURE).catch(() => ({}));
  fs.appendFileSync(log, JSON.stringify({ id: scene.id, vp, theme, file: file.replace(/\\/g, "/"), note, ...m }) + "\n");
  console.log(`${scene.id} ${vp} ${theme}${note ? "  !! " + note : ""}${m.overflow?.length ? "  overflow" : ""}`);
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const log = path.join(OUT, "measure.jsonl");
  const { chromium } = playwright();
  const login = has("--login");
  const browser = await chromium.launch({ channel: "chrome", headless: !(login || has("--headed")) });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, locale: "ko-KR", timezoneId: "Asia/Seoul" });
  const page = await ctx.newPage();
  page.on("pageerror", e => console.log("pageerror", e.message));
  if (login) {
    // Reads only: the operator's session may look at everything and change nothing (auth's own calls and read RPCs pass).
    await ctx.route(/supabase\.co\/(rest|functions)\/v1\//, (route, req) => {
      const u = req.url(), m = req.method();
      if (m === "GET" || m === "HEAD" || m === "OPTIONS") return route.continue();
      // a read RPC is a POST too, so an RPC passes unless its name says it writes; every other POST, PATCH, PUT and DELETE is refused
      const rpc = (u.match(/\/rest\/v1\/rpc\/([a-z_0-9]+)/) || [])[1];
      if (m === "POST" && rpc && !/(^|_)(create|submit|set|save|revert|reset|report|replace|reopen|remove|finalize|ensure|edit|delete|decide|cancel|apply|void|unlink|rename|merge|clock|add|write|queue|open|grant|upsert|update|insert|mark|claim|link|approve|reject|clear|close|start|join|leave|record|import|sync|publish|pin|award|register|move|swap|draw)(_|$)/.test(rpc)) return route.continue();
      console.log("refused a write:", m, u.split("/v1/")[1]);
      return route.abort();
    });
    await page.goto(BASE + "/?view=admin", { waitUntil: "domcontentloaded" });
    if (fs.existsSync(SESSION)) {
      // the session kept from the last run: its refresh token is good once, so this works only if nothing used it since
      const kept = JSON.parse(fs.readFileSync(SESSION, "utf8"));
      await page.evaluate(k => { for (const [key, v] of Object.entries(k.session || {})) sessionStorage.setItem(key, v); }, kept);
      await page.reload({ waitUntil: "domcontentloaded" });
      await page.waitForTimeout(4000);
    }
    console.log("\n>>> 창에서 관리자 로그인을 해 주세요. 로그인이 끝나면 자동으로 이어집니다 (최대 15분 대기).\n");
    await page.waitForFunction(() => { try { return !!sessionStorage.getItem("ypl-admin:v1"); } catch { return false; } }, null, { timeout: 15 * 60000, polling: 1000 });
    await page.waitForTimeout(1500);
    console.log(">>> 로그인을 확인했습니다. 캡처를 시작합니다.");
  }
  for (const vp of vps) for (const theme of themes) for (const scene of scenes) {
    if (scene.vps && !scene.vps(Number(vp.split("x")[0]))) continue;
    await shoot(page, scene, vp, theme, log).catch(e => console.log(scene.id, vp, theme, "failed:", e.message.split("\n")[0]));
  }
  if (login) {
    fs.mkdirSync(path.dirname(SESSION), { recursive: true });
    fs.writeFileSync(SESSION, JSON.stringify(await page.evaluate(() => ({ local: { ...localStorage }, session: { ...sessionStorage } }))));
  }
  await browser.close();
})();
