// A scripted walk through one flow, as a fake admin or a fake signed-in player, on patched data. Nothing is written to production (lib.cjs).
//   node flow.cjs <fixture> <shot ID> <WxH> <dark|light> <admin|visitor|anon> "<url>" step step ...
// fixtures: live (38회 마스터 running today), done (same event, every match decided, record not applied), step1 / step2 (39회 taking applications / closed, no bracket), plain
// steps:  "text"            press the first visible button/link/tab/row holding the text (topmost dialog first)
//         "sel:<css>"       click a selector          "fill:<css>=<value>"   type into a field
//         "shot:<tag>"      viewport picture          "full:<tag>"           whole page picture
//         "box:<css>"       print x,y wxh of what matches      "wait:<ms>"   "say"  print the topmost dialog's (or the page's) text and keys
const { open } = require("./lib.cjs"); const L = require("./live.cjs"); const { box, overflow } = require("./scenes.cjs");
const [fixture, id, size, theme, role, url, ...steps] = process.argv.slice(2);
const iso = d => new Date(Date.now() - d * 3600e3).toISOString();
const REQUESTS = [
  { auth_user_id: "00000000-0000-4000-8000-0000000000a1", email: "a-very-long-google-account-name.for.testing@yonsei.ac.kr", account_name: "Kim Seongbin (김성빈)", requested_name: "김성빈", player_id: "p1", status: "pending", requested_at: iso(2) },
  { auth_user_id: "00000000-0000-4000-8000-0000000000a2", email: "newcomer@example.com", account_name: "새내기", requested_name: "테스트신입생", player_id: null, status: "pending", requested_at: iso(30) },
  { auth_user_id: "00000000-0000-4000-8000-0000000000a3", email: "third@example.com", account_name: "", requested_name: "강진영", player_id: "p3", status: "pending", requested_at: iso(50) },
  { auth_user_id: "00000000-0000-4000-8000-0000000000a4", email: "linked@example.com", account_name: "이제빈", requested_name: "이제빈", player_id: L.ME.playerId, status: "approved", requested_at: iso(500) },
];
const CHANGES = Array.from({ length: 20 }, (_, i) => [
  { table_name: "matches", op: "UPDATE", old: { winner_entry_id: null }, new: { winner_entry_id: "x" }, actor_email: "yplofficial@ypl.invalid" },
  { table_name: "matches", op: "UPDATE", old: { winner_entry_id: "x" }, new: { winner_entry_id: "y" }, actor_role: "service_role" },
  { table_name: "site_data", op: "UPDATE", old: {}, new: { changed: ["announcements", "titleGroups"] }, actor_email: "yplofficial@ypl.invalid" },
  { table_name: "events", op: "UPDATE", old: {}, new: { record_applied_at: iso(1), name: "38회 파이컵 마스터 리그 NPC 배틀 7" }, actor_email: "yplofficial@ypl.invalid" },
  { table_name: "event_registrations", op: "INSERT", old: null, new: { registration_name: "테스트신입생" }, actor_role: "anon" },
][i % 5]).map((r, i) => ({ id: 1000 - i, at: iso(i * 3), ...r }));
const ERRORS = [{ id: 1, message: "TypeError: Cannot read properties of undefined (reading 'participants')\n at BracketsPage", created_at: iso(3), url: "/?view=bracket&eventId=c34f3629-ad49-4d32-82fb-38d1f989fa13&m=double:w:r3:m1", build: "1be7a96" },
  { id: 2, message: "ChunkLoadError: Loading chunk 12 failed.", created_at: iso(20), url: "/?view=battle", build: "3ffd32c" }];
const REPORTS = [{ item_id: "r1", parent_id: null, board: "free", title: "신고된 글의 제목이 꽤 길 때 어떻게 보이는지 확인하는 글입니다", reasons: { spam: 2, abuse: 1 }, last_at: iso(5) }, { item_id: "r2", parent_id: "r1", board: "free", title: "", reasons: { abuse: 1 }, last_at: iso(9) }];
const FX = {
  plain: () => ({ mocks: { streak_month_tops: [], admin_change_log: [], admin_client_errors: [], admin_community_reports: [], "fn:battle": {} },
    // SECRETS=1: the first two posts of the free board read as written for the operators (the anon read never returns the real ones)
    patches: process.env.SECRETS ? [{ re: /tbl:community_items/, fn: rows => { if (Array.isArray(rows)) rows.filter(r => !r.parent_id).slice(0, 2).forEach(r => { r.secret = true; }); return rows; } }] : [] }),
  live: () => L.live({ visitor: role === "visitor", battle: true, reports: process.env.REPORTS || "differ", report: process.env.REPORT ? JSON.parse(process.env.REPORT) : { status: "waiting", mine: null }, requests: REQUESTS }),
  done: () => { const f = L.live({ requests: REQUESTS }); const m = f.patches.find(p => String(p.re).includes("matches")); m.fn = (rows, u) => rows; const b = f.patches.find(p => String(p.re).includes("battles")); b.fn = rows => rows; return f; },
  step1: () => stepFx("2099-12-31T23:59"), step2: () => stepFx("2026-11-01T00:00"),
};
function stepFx(closesAt) { const f = FX.plain(); const far = new Date(Date.now() + 12 * 864e5).toLocaleString("sv-SE", { timeZone: "Asia/Seoul" }).slice(0, 10);
  f.patches = [{ re: /tbl:site_data/, fn: rows => { const a = rows[0].value.announcements.find(x => x.id === "mgcf6zf"); a.form.closesAt = closesAt; a.form.eventDraft.heldOn = process.env.HELD || far; if (process.env.DUE) a.form.eventDraft.submissionTargetAt = process.env.DUE; return rows; } },
    { re: /tbl:events/, fn: (rows, u) => (/held_on=lt/.test(u) ? [] : rows) }]; return f; }
(async () => {
  const [w, h] = size.split("x").map(Number); const fx = FX[fixture]();
  if (role === "admin" && fixture !== "live" && fixture !== "done") fx.mocks["tbl:player_accounts"] = (b, u) => (/limit=1/.test(u) ? { __status: 403, body: { code: "42501" } } : REQUESTS);
  if (process.env.ROWS) Object.assign(fx.mocks, { admin_change_log: CHANGES, admin_client_errors: ERRORS, admin_community_reports: REPORTS });
  if (process.env.MOCKS) Object.assign(fx.mocks, JSON.parse(process.env.MOCKS));
  const t = await open({ w, h, theme, admin: role === "admin", ...fx });
  const top = () => t.page.evaluate(() => { const ds = [...document.querySelectorAll("[role=dialog], [role=alertdialog], .modal")].filter(e => e.offsetParent); const el = ds[ds.length - 1] || document.querySelector("#ypl-main"); const r = el.getBoundingClientRect();
    return (ds.length ? "DIALOG " : "PAGE ") + Math.round(r.x) + "," + Math.round(r.y) + " " + Math.round(r.width) + "x" + Math.round(r.height) + " | " + el.innerText.replace(/\n+/g, " | ").slice(0, 1400) + "\nKEYS: " + [...el.querySelectorAll("button, a, input, select, textarea, summary")].filter(e => e.offsetParent).slice(0, 60).map(e => { const b = e.getBoundingClientRect(); return (e.tagName === "BUTTON" || e.tagName === "A" || e.tagName === "SUMMARY" ? "" : e.tagName.toLowerCase() + ":") + ((e.innerText || e.getAttribute("aria-label") || e.placeholder || e.value || "").replace(/\n+/g, "/").slice(0, 22)) + "[" + Math.round(b.width) + "x" + Math.round(b.height) + "@" + Math.round(b.x) + "," + Math.round(b.y) + "]"; }).join("  "); });
  if (role === "admin") { await t.page.evaluate(u => { history.pushState({}, "", u); dispatchEvent(new PopStateEvent("popstate")); }, url); await t.page.waitForTimeout(3000); } else { await t.go(url); await t.page.waitForTimeout(2000); }
  for (const s of steps) { try {
    if (s.startsWith("shot:")) console.log(await t.shot(id, s.slice(5)));
    else if (s.startsWith("full:")) console.log(await t.shot(id, s.slice(5), { fullPage: true }));
    else if (s.startsWith("wait:")) await t.page.waitForTimeout(Number(s.slice(5)));
    else if (s.startsWith("box:")) { console.log((await t.page.evaluate(box(s.slice(4)))).join("\n")); console.log(JSON.stringify(await t.page.evaluate(overflow))); }
    else if (s === "say") console.log(await top());
    else if (s.startsWith("eval:")) console.log(JSON.stringify(await t.page.evaluate(s.slice(5))));
    else if (s.startsWith("sel:")) { await t.page.locator(s.slice(4)).locator("visible=true").first().click({ timeout: 5000 }); await t.page.waitForTimeout(900); }
    else if (s.startsWith("fill:")) { const [css, ...v] = s.slice(5).split("="); await t.page.locator(css).locator("visible=true").first().fill(v.join("=")); await t.page.waitForTimeout(300); }
    else { const scope = t.page.locator("[role=dialog], [role=alertdialog], .modal").locator("visible=true"); const n = await scope.count(); const root = n ? scope.nth(n - 1) : t.page.locator("body");
      let el = root.locator("button, a, [role=button], [role=tab], summary, label").filter({ hasText: s }).locator("visible=true").first(); if (!(await el.count())) el = t.page.locator("button, a, [role=button], [role=tab], summary, label").filter({ hasText: s }).locator("visible=true").first();
      await el.scrollIntoViewIfNeeded({ timeout: 4000 }); await el.click({ timeout: 4000 }); await t.page.waitForTimeout(1100); }
  } catch (e) { console.log("STEP FAIL [" + s + "] " + e.message.split("\n")[0].slice(0, 160)); } }
  const bad = [...new Set(t.log.filter(l => /UNMOCKED|PAGEERROR|PATCH FAIL|MOCK POST|MOCK PATCH|MOCK DELETE/.test(l)))]; if (bad.length) console.log(bad.join("\n").slice(0, 1500));
  await t.browser.close(); process.exit(0);
})();
