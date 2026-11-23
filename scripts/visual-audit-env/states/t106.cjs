// T-106: rows that start with 알림 on a signed-in 더보기. node t106.cjs
const { open, go } = require("./lib.cjs");
(async () => {
  const PID = "4b8fe65f-5e75-5f59-ad54-3c19112ee28a";
  const { b, p } = await open({ w: 390, h: 844, session: true, storage: { "ypl-me": JSON.stringify({ name: "이제빈", playerId: PID }) }, opts: { account: { requested_name: "이제빈", status: "approved", player_id: PID, email: "v@gmail.com" }, rpc: { push_inbox: [] } } });
  await go(p, "/?view=more", 1800);
  console.log(await p.evaluate(() => [...document.querySelectorAll("#ypl-main *")].filter(e => e.offsetParent && /^알림/.test(e.innerText || "")).map(e => e.tagName + "." + e.className + " | " + e.innerText.replace(/\n/g, "/").slice(0, 40))));
  await b.close();
})();
