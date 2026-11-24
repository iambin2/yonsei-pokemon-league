// Test harness for the unseen operator / event-day states (visual audit round 2, group q).
// Dev server http://localhost:5193 reads production through anon GETs; every non-GET to *.supabase.co is answered HERE and never forwarded
// (unless named in opts.safeReads: RPCs whose SQL in docs/db only reads).
const fs = require("fs"), path = require("path");
const cache = path.join(process.env.LOCALAPPDATA, "npm-cache", "_npx");
let pw; for (const d of fs.readdirSync(cache)) { const p = path.join(cache, d, "node_modules", "playwright"); if (fs.existsSync(p)) { pw = require(p); break; } }
const BASE = process.env.BASE || "http://localhost:5193", SHOTS = require("path").resolve(__dirname, "../../../docs/visual-audit/shots").split(require("path").sep).join("/");
const SESSION = { access_token: "fake-admin-token", refresh_token: "fake-refresh", token_type: "bearer", expires_in: 3600, user: { id: "00000000-0000-4000-8000-000000000001", email: "test@ypl.invalid" } };
const nameOf = u => { const m = u.match(/\/rest\/v1\/rpc\/([a-z0-9_]+)/); if (m) return m[1]; const f = u.match(/\/functions\/v1\/([a-z-]+)/); if (f) return "fn:" + f[1]; return new URL(u).pathname.replace("/rest/v1/", "tbl:"); };
/* opts: w,h,theme, admin (bool: logs in through the sheet), visitor (object put in localStorage ypl-visitor-session), mocks {name: json | (body,url)=>json | {status,body}},
   patches [{re, fn(json,url)}] for GET answers, safeReads [names], loginFail, init (fn run as init script), log (array) */
async function open(opts = {}) {
  const { w = 1440, h = 900, theme = "dark", mocks = {}, patches = [], safeReads = [], log = [] } = opts;
  const browser = await pw.chromium.launch({ channel: "chrome", args: opts.gpu ? ["--use-angle=d3d11", "--enable-gpu"] : [] });
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: Number(process.env.DPR || 1), locale: "ko-KR", timezoneId: "Asia/Seoul", hasTouch: w < 860 });
  await ctx.addInitScript(([t, v, extra]) => { try { localStorage.setItem("ypl-theme", t); if (v) localStorage.setItem("ypl-visitor-session", JSON.stringify(v)); for (const [k, x] of Object.entries(extra || {})) localStorage.setItem(k, typeof x === "string" ? x : JSON.stringify(x)); } catch {} }, [theme, opts.visitor || null, opts.storage || null]);
  await ctx.route(/supabase\.co\//, async (route, req) => {
    const u = req.url(), m = req.method();
    if (m === "OPTIONS") return route.continue();
    if (u.includes("/auth/v1/")) {
      if (opts.loginFail === "net") return route.abort();
      if (opts.loginFail) return route.fulfill({ status: 400, contentType: "application/json", body: '{"error":"invalid_grant"}' });
      if (opts.refreshFail && u.includes("refresh_token")) return route.fulfill({ status: 400, contentType: "application/json", body: '{"error":"invalid_grant"}' });
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ...SESSION, expires_in: opts.expiresIn || 3600 }) });
    }
    const headers = { ...req.headers() }; if (headers.apikey) headers.authorization = "Bearer " + headers.apikey;
    const name = nameOf(u);
    const answer = async forward => {
      try {
        const resp = await route.fetch({ headers });
        let body = await resp.text();
        for (const p of patches) if (p.re.test(u) || p.re.test(name)) { try { const out = p.fn(JSON.parse(body), u, req.postData()); if (out !== undefined) body = JSON.stringify(out); } catch (e) { log.push("PATCH FAIL " + name + " " + e.message); } }
        return route.fulfill({ status: resp.status(), headers: resp.headers(), body });
      } catch (e) { return route.abort().catch(() => {}); }
    };
    if (m === "GET" || m === "HEAD") { if (name in mocks) { const k = mocks[name]; const out = typeof k === "function" ? k(null, u) : k; if (out && out.__status) return route.fulfill({ status: out.__status, contentType: "application/json", body: JSON.stringify(out.body ?? {}) }); if (out && out.__hang) return; return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(out) }); } log.push("GET " + name); return answer(); }
    if (name in mocks) { const k = mocks[name]; let body = null; try { body = JSON.parse(req.postData() || "null"); } catch {} const out = typeof k === "function" ? k(body, u) : k; log.push("MOCK " + m + " " + name);
      if (out && out.__hang) return; if (out && out.__status) return route.fulfill({ status: out.__status, contentType: "application/json", body: JSON.stringify(out.body ?? {}) });
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(out) }); }
    if (safeReads.includes(name)) { log.push("READ " + name); return answer(); }
    log.push("UNMOCKED " + m + " " + name + " " + (req.postData() || "").slice(0, 160));
    return route.fulfill({ status: 200, contentType: "application/json", body: "null" });
  });
  const page = await ctx.newPage();
  page.on("pageerror", e => log.push("PAGEERROR " + e.message.slice(0, 200)));
  const go = async url => { await page.goto(BASE + url, { waitUntil: "domcontentloaded", timeout: 300000 }); await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {}); await page.waitForTimeout(opts.wait || 1200); };
  const press = async (text, tag = "button, a, [role=button], [role=tab], summary") => { const el = page.locator(tag).filter({ hasText: text }).locator("visible=true").first(); await el.scrollIntoViewIfNeeded({ timeout: 5000 }); await el.click({ timeout: 5000 }); await page.waitForTimeout(700); };
  const login = async () => { await go("/?view=admin"); await press("관리자 로그인"); const ins = page.locator(".modal input, [role=dialog] input"); await ins.nth(0).fill("tester"); await ins.nth(1).fill("test-value"); await ins.nth(1).press("Enter"); await page.waitForTimeout(1500); };
  const shot = async (id, tag = "", o = {}) => { const dir = path.join(SHOTS, id); fs.mkdirSync(dir, { recursive: true }); const f = path.join(dir, `${w}x${h}-${theme}${tag ? "-" + tag : ""}.png`); await page.screenshot({ path: f, ...o }); return f; };
  if (opts.admin) await login();
  return { browser, ctx, page, go, press, login, shot, log };
}
module.exports = { open, BASE, SHOTS, SESSION };
