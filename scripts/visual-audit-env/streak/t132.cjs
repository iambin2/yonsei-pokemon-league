// T-132 (2026-11-24): a code room's waiting screen on a phone, what stands above the dock. node t132.cjs <w> <h> <dark|light>
const { launch, context, BASE, SHOTS } = require("./lib.cjs");
const path = require("path"), fs = require("fs");
const W = +(process.argv[2] || 390), H = +(process.argv[3] || 844), THEME = process.argv[4] || "dark";
(async () => {
  const b = await launch(), ctx = await context(b, { w: W, h: H, theme: THEME, name: "레드" }), p = await ctx.newPage();
  await p.goto(BASE + "?view=battle", { timeout: 300000 }); await p.waitForTimeout(2500);
  const id = await p.evaluate(async () => { const s = await import("/src/services/battleService.js"); return (await s.createBattle({ regulation: "m-c", team: "random", room: "open", name: "레드", battleFormat: "singles" })).id; });
  await fetch("http://localhost:54321/harness/sql", { method: "POST", body: `update public.battles set room = 'code' where id = '${id}'` });
  await fetch("http://localhost:54321/harness/sql", { method: "POST", body: `update public.battle_secrets set room_code = '4821' where battle_id = '${id}'` });
  await p.evaluate(id => { const k = "ypl-battle:seats:v1", all = JSON.parse(localStorage.getItem(k) || "{}"); if (all[id]) all[id].code = "4821"; localStorage.setItem(k, JSON.stringify(all)); }, id);
  await p.goto(BASE + "?view=battle&id=" + id); await p.waitForTimeout(4000);
  console.log(`${W}x${H} ${THEME}`, JSON.stringify(await p.evaluate(() => {
    const r = s => { const e = [...document.querySelectorAll(s)].filter(x => x.getBoundingClientRect().height).pop(); if (!e) return null; const b = e.getBoundingClientRect(); return [Math.round(b.top), Math.round(b.bottom)]; };
    const keys = [...document.querySelectorAll(".dock .btn, .bt-cancel")].filter(x => x.getBoundingClientRect().height).map(x => x.textContent.trim() + " " + Math.round(x.getBoundingClientRect().top) + "-" + Math.round(x.getBoundingClientRect().bottom) + " w" + Math.round(x.getBoundingClientRect().width));
    const g = document.querySelector(".bt-lobby-wait"); const grid = g && { cols: getComputedStyle(g).gridTemplateColumns, kids: [...g.querySelectorAll(":scope > *, :scope > .bt-lobby-main > *")].map(k => k.className.slice(0, 30) + " " + getComputedStyle(k).display + " col " + getComputedStyle(k).gridColumnStart + " ord " + getComputedStyle(k).order + " @" + Math.round(k.getBoundingClientRect().left) + "," + Math.round(k.getBoundingClientRect().top) + " w" + Math.round(k.getBoundingClientRect().width)) };
    return { grid, h1: r(".bt-page > h1"), arena: r(".bt-lobby-main > :first-child"), row: r(".bt-lobby-set > .row"), code: r(".bt-wait-counters > :first-child"), wait: r(".bt-wait-counters > :last-child"), dock: r(".dock"), tabbar: r(".tabbar"), keys, docH: document.scrollingElement.scrollHeight };
  })));
  const dir = path.join(SHOTS, "T-132"); fs.mkdirSync(dir, { recursive: true });
  await p.screenshot({ path: path.join(dir, `${W}x${H}-${THEME}.png`) });
  await b.close();
})().catch(e => { console.log("FAILED", e.message.slice(0, 300)); process.exit(1); });
