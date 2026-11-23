// T-119 (2026-11-23): the tower's gate sheet for a visitor signed out (none: signed in, no link) and refused. node gate119.cjs <WxH> <theme>
const { open, go, shot } = require("./lib.cjs");
const [size = "390x844", theme = "dark"] = process.argv.slice(2); const [w, h] = size.split("x").map(Number);
const S = { none: null, rejected: { requested_name: "다른이름요청", status: "rejected", player_id: null, email: "v@gmail.com" } };
(async () => {
  for (const [st, account] of Object.entries(S)) {
    const { b, p } = await open({ w, h, theme, session: true, opts: { account, fn: () => ({ ok: true, rows: [], runs: [], board: [], battles: [] }), rpc: { push_inbox: [], my_battles: [] } } });
    await go(p, "/?view=battle&tab=streak", 4000);
    const key = p.locator("button").filter({ hasText: /^(도전 시작|새로 도전)$/ }).locator("visible=true").first();
    if (await key.count()) { await key.click(); await p.waitForTimeout(1200); }
    console.log(st, size, theme, JSON.stringify(await p.evaluate(() => { const d = [...document.querySelectorAll(".modal")].pop(); return d ? { title: d.querySelector("h2, .modal-title")?.innerText, text: d.innerText.replace(/\n/g, "/").slice(0, 120), keys: [...d.querySelectorAll(".modal-actions .btn")].map(x => x.innerText) } : "no sheet"; })));
    await shot(p, "T-119", `${st}-${size}-${theme}`);
    await b.close();
  }
})();
