// Two people and a watcher on the stand-in: rooms opened (방 목록), the waiting screen, the join screen (open and code), a live battle watched
// (중계 list, spectating), its end, a rematch offer, and the 기록 tab filled.   node t3.cjs
const { launch, context, shoot, MEASURE, play, weak, BASE } = require("./lib.cjs");
(async () => {
  const b = await launch();
  const log = (...a) => console.log(new Date().toISOString().slice(14, 19), ...a);
  const open = async (opt, url = "?view=battle") => { const ctx = await context(b, { signed: false, ...opt }), p = await ctx.newPage(); p.on("pageerror", e => log("pageerror", opt.name, e.message));
    p.on("response", r => { if (r.status() >= 400 && /54321/.test(r.url()) && !/site_data/.test(r.url())) log("HTTP", opt.name, r.status(), r.url().slice(22, 110)); });
    await p.goto(BASE + url); await p.waitForTimeout(2500); return p; };
  const snap = async (p, id, name, opt) => { await shoot(p, id, name, opt);
    for (const [w, h] of [[390, 844], [1440, 900]]) { await p.setViewportSize({ width: w, height: h }); await p.waitForTimeout(250); const m = await p.evaluate(MEASURE, ".ypl"); if (m.docW > m.vw || m.over.length || m.clipped.length) log("MEASURE", id, name, w, JSON.stringify(m)); }
    await p.setViewportSize({ width: 390, height: 844 });
    log("shot", id, name, "|", (await p.evaluate(() => (document.querySelector(".bt-page, .bt-main, main")?.innerText || "").replace(/\s+/g, " ").slice(0, 300)))); };
  // a code room is opened as an open one and turned by SQL (the stand-in's supabase-js cannot run the function's search for a free code)
  const make = async (p, name, room, battleFormat = "singles") => { const m = await p.evaluate(async a => { const s = await import("/src/services/battleService.js"); const m = await s.createBattle({ regulation: "m-c", team: "random", room: "open", ...a }); return { id: m.id }; }, { name, battleFormat });
    if (room === "code") { m.code = "4821";
      await fetch("http://localhost:54321/harness/sql", { method: "POST", body: `update public.battles set room = 'code' where id = '${m.id}'` });
      await fetch("http://localhost:54321/harness/sql", { method: "POST", body: `update public.battle_secrets set room_code = '4821' where battle_id = '${m.id}'` });
      await p.evaluate(([id, code]) => { const k = "ypl-battle:seats:v1", all = JSON.parse(localStorage.getItem(k) || "{}"); if (all[id]) all[id].code = code; localStorage.setItem(k, JSON.stringify(all)); }, [m.id, m.code]); }
    return m; };
  const A = await open({ name: "레드" }), B = await open({ name: "그린" }), C = await open({ name: "관전자" });
  const main = await make(A, "레드", "open");
  const others = [await make(C, "아주긴트레이너이름열여섯글자입니다", "open", "doubles"), await make(C, "LongEnglishName20chr", "code"), await make(C, "블루", "open"), await make(C, "오박사", "code", "doubles")];
  log("rooms", JSON.stringify([main, ...others]));
  await A.goto(BASE + "?view=battle&id=" + main.id); await A.waitForTimeout(3500); await snap(A, "BTL-07", "waiting-open");
  await C.goto(BASE + "?view=battle&id=" + others[1].id); await C.waitForTimeout(3500); await snap(C, "BTL-07", "waiting-code");
  await B.goto(BASE + "?view=battle&tab=rooms"); await B.waitForTimeout(3000); await snap(B, "BTL-05", "rooms-filled", { full: true });
  await B.goto(BASE + "?view=battle&id=" + others[1].id); await B.waitForTimeout(3000); await snap(B, "BTL-06", "join-code");
  await B.fill("#bt-code", "0000").catch(() => log("no code field")); await B.click("button:text-is('참가')").catch(() => log("no 참가")); await B.waitForTimeout(1800); await snap(B, "BTL-06", "join-code-wrong");
  await B.goto(BASE + "?view=battle&id=" + main.id); await B.waitForTimeout(3000); await snap(B, "BTL-06", "join-open");
  await B.click("button:text-is('참가')"); await B.waitForSelector(".bt-pick", { timeout: 40000 }); await B.waitForTimeout(2500);
  await snap(B, "BTL-06", "joined-pick");
  await C.goto(BASE + "?view=battle&tab=live"); await C.waitForTimeout(3000); await snap(C, "BTL-25", "live-filled", { full: true });
  await C.goto(BASE + "?view=battle&id=" + main.id); await C.waitForTimeout(4000); await snap(C, "BTL-24", "watch-picking");
  await Promise.all([play(A, { side: null, stop: "move" }), play(B, { side: null, stop: "move" })]);
  await C.waitForTimeout(5000); await snap(C, "BTL-24", "watch-turn1");
  await snap(A, "U-BTL-2p", "turn1-seat");
  await weak(main.id, 1);
  await Promise.all([play(A, { side: null }), play(B, { side: null })]);
  await A.waitForTimeout(3000); await snap(A, "BTL-22", "end-winner"); await snap(B, "BTL-22", "end-loser"); await C.waitForTimeout(1500); await snap(C, "BTL-24", "watch-ended");
  log("keys A", await A.evaluate(() => [...document.querySelectorAll(".bt-end-keys button, .bt-end-line")].map(x => x.textContent)));
  await A.click("button:has-text('다시하기')").catch(() => log("no 다시하기")); await A.waitForTimeout(3500);
  await snap(A, "BTL-22", "rematch-asked"); await B.waitForTimeout(3000); await snap(B, "BTL-22", "rematch-offered");
  log("keys B", await B.evaluate(() => [...document.querySelectorAll(".bt-end-keys button, .bt-end-line")].map(x => x.textContent)));
  await B.goto(BASE + "?view=battle&tab=mine"); await B.waitForTimeout(3000); await snap(B, "BTL-26", "mine-filled", { full: true });
  await b.close();
})().catch(e => { console.log("FAILED", e.message.slice(0, 700)); process.exit(1); });
