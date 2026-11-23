// 묶음 20b (2026-11-23): account states on 내 기록 찾기, 더보기, the top bar and the tower gate. node a20b.cjs <WxH> <theme> state ...
// states: none pending rejected approved checking long linesfail (account.cjs's), every write answered here (lib.cjs guard)
const { open, go, shot } = require("./lib.cjs");
const PID = "4b8fe65f-5e75-5f59-ad54-3c19112ee28a", REAL = "이제빈";
const [size, theme, ...want] = process.argv.slice(2); const [w, h] = size.split("x").map(Number);
const S = {
  none: { account: null }, checking: { account: "hold" },
  pending: { account: { requested_name: "다른이름요청", status: "pending", player_id: null, email: "visitor.account@gmail.com" } },
  rejected: { account: { requested_name: "다른이름요청", status: "rejected", player_id: null, email: "visitor.account@gmail.com" } },
  approved: { account: { requested_name: REAL, status: "approved", player_id: PID, email: "visitor.account@gmail.com" } },
  long: { account: { requested_name: "가나다라마바사아자차카타파하거너", status: "approved", player_id: PID, email: "averyveryverylongaddress.of.someone@students.yonsei.ac.kr" } },
  linesfail: { account: { requested_name: REAL, status: "approved", player_id: PID, email: "visitor.account@gmail.com" }, fail: [{ match: /account_teams|my_battles/, status: 500 }], fnFail: true },
};
(async () => {
  for (const st of want) {
    const s = S[st];
    const { b, p } = await open({ w, h, theme, session: true, opts: { account: s.account, fail: s.fail, fn: s.fnFail ? () => { throw 0; } : () => ({ ok: true, rows: [], runs: [], board: [], battles: [] }), rpc: { push_inbox: [], my_battles: [], handover_features_ready: true, request_player_link: { ok: true } } } });
    const out = {};
    try {
      await go(p, "/", 2000);
      out.bar = await p.evaluate(() => { const logo = document.querySelector("header .brand, header a[href='/'], header .wordmark, header img"); const acct = document.querySelector("header .acct"); const r = e => e && e.getBoundingClientRect(); return { logoRight: logo && Math.round(r(logo).right), acctLeft: acct && Math.round(r(acct).left), acct: acct && acct.innerText.slice(0, 20), acctW: acct && Math.round(r(acct).width) }; });
      await shot(p, "A20b-bar", `${st}-${size}-${theme}`, { clip: { x: 0, y: 0, width: w, height: 64 } });
      await go(p, "/?view=records&tab=trainer&me=1", 3000);
      out.find = await p.evaluate(() => { const all = [...document.querySelectorAll("#ypl-main button")].find(x => /전체 보기/.test(x.innerText)); const keys = [...document.querySelectorAll(".acct-keys .btn")].map(x => x.innerText); return { allY: all && Math.round(all.getBoundingClientRect().top + scrollY), keys }; });
      await go(p, "/?view=more", 3000);
      out.more = await p.evaluate(() => [...document.querySelectorAll("#ypl-main .row")].filter(r => r.offsetParent && /저장한 팀|내 배틀|내 기록|알림/.test(r.innerText)).map(r => r.innerText.replace(/\n/g, "/").slice(0, 30) + " h" + Math.round(r.getBoundingClientRect().height)));
      out.moreKeys = await p.evaluate(() => [...document.querySelectorAll(".acct-keys .btn")].map(x => x.innerText));
      await shot(p, "A20b-more", `${st}-${size}-${theme}`, { fullPage: true });
    } catch (e) { out.err = String(e).slice(0, 200); }
    console.log(st, size, theme, JSON.stringify(out));
    await b.close();
  }
})();
