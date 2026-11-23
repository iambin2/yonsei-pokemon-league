// Measures two phone states seen cut in the shots: the waiting screen of a code room (what stands under the dock) and the tower draft
// after three picks (the pick's stats against the dock).   node t8.cjs [w=390] [h=844]
const { launch, context, BASE } = require("./lib.cjs");
const W = +(process.argv[2] || 390), H = +(process.argv[3] || 844);
const rects = sels => { const o = {}; for (const s of sels) { const el = [...document.querySelectorAll(s)].filter(e => e.getBoundingClientRect().height).pop(); if (el) { const r = el.getBoundingClientRect(); o[s] = [Math.round(r.top), Math.round(r.bottom), Math.round(r.height)]; } } o.docH = document.scrollingElement.scrollHeight; o.innerH = innerHeight; return o; };
(async () => {
  const b = await launch(), ctx = await context(b, { w: W, h: H, name: "레드" }), p = await ctx.newPage();
  await p.goto(BASE + "?view=battle"); await p.waitForTimeout(2500);
  const id = await p.evaluate(async () => { const s = await import("/src/services/battleService.js"); return (await s.createBattle({ regulation: "m-c", team: "random", room: "open", name: "레드", battleFormat: "singles" })).id; });
  await fetch("http://localhost:54321/harness/sql", { method: "POST", body: `update public.battles set room = 'code' where id = '${id}'` });
  await fetch("http://localhost:54321/harness/sql", { method: "POST", body: `update public.battle_secrets set room_code = '4821' where battle_id = '${id}'` });
  await p.evaluate(id => { const k = "ypl-battle:seats:v1", all = JSON.parse(localStorage.getItem(k) || "{}"); if (all[id]) all[id].code = "4821"; localStorage.setItem(k, JSON.stringify(all)); }, id);
  await p.goto(BASE + "?view=battle&id=" + id); await p.waitForTimeout(4000);
  console.log("BTL-07 code", JSON.stringify(await p.evaluate(rects, [".dock", ".bt-lobby .dock", ".bt-cancel", ".bt-wait-counters", ".bt-wait-counters > :last-child", ".bt-lobby-set", ".tabbar"])));
  await p.goto(BASE + "?view=battle&tab=streak"); await p.waitForSelector(".bt-end-keys button", { timeout: 30000 }); await p.waitForTimeout(2500);
  await p.evaluate(() => [...document.querySelectorAll(".bt-end-keys button")].find(x => /새로 도전|도전 시작|다시 도전/.test(x.textContent))?.click()); await p.waitForTimeout(1500);
  if (!(await p.$(".streak-draft"))) await p.evaluate(() => [...document.querySelectorAll("button")].filter(x => x.textContent.trim() === "새로 도전" && x.getBoundingClientRect().width).pop().click());
  await p.waitForSelector(".streak-draft"); await p.waitForTimeout(2000);
  for (let k = 0; k < 3; k++) { await p.evaluate(() => { const q = document.querySelector(".streak-draft-row .streak-pick"); (q.querySelector(".streak-pick-stats") || q.querySelector("button")).click(); }); await p.waitForTimeout(1500); }
  console.log("TWR-05 draft-3", JSON.stringify(await p.evaluate(rects, [".streak-draft", ".streak-draft-row", ".streak-pick", ".streak-pick-stats", ".bt-end-keys", ".dock", ".tabbar"])));
  console.log("pick overflow", JSON.stringify(await p.evaluate(() => [...document.querySelectorAll(".streak-draft, .streak-draft-row, .streak-pick, .streak-pick-stats")].slice(0, 4).map(e => [e.className, e.scrollHeight, e.clientHeight, getComputedStyle(e).overflowY]))));
  await p.screenshot({ path: "sheets/t8-draft3-" + W + ".png" });
  await b.close();
})().catch(e => { console.log("FAILED", e.message.slice(0, 500)); process.exit(1); });
