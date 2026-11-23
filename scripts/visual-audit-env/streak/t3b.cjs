// The lists and the rematch offer the first pass missed. The stand-in's small PostgREST compares timestamps as text, so the two list reads
// (방 목록, 중계) are passed on without their "since" filter; the rematch is made as the function makes it (a new room, rematch_id on the old row) by SQL,
// because the stand-in's supabase-js cannot run the function's own search for a free code.   node t3b.cjs
const { launch, context, shoot, play, weak, BASE, STAND } = require("./lib.cjs");
const sql = q => fetch(STAND + "/harness/sql", { method: "POST", body: q }).then(r => r.json());
(async () => {
  const b = await launch();
  const log = (...a) => console.log(new Date().toISOString().slice(14, 19), ...a);
  const open = async name => { const ctx = await context(b, { signed: false, name }), p = await ctx.newPage(); p.on("pageerror", e => log("pageerror", name, e.message));
    await p.route(/rest\/v1\/battles\?.*(created_at|updated_at)=gte/, async r => { const u = new URL(r.request().url()); u.searchParams.delete("created_at"); u.searchParams.delete("updated_at"); const out = await fetch(u, { headers: { accept: r.request().headers().accept || "" } }); r.fulfill({ status: out.status, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: await out.text() }); });
    await p.goto(BASE + "?view=battle"); await p.waitForTimeout(2500); return p; };
  const say = p => p.evaluate(() => (document.querySelector(".bt-page, .bt-main, main")?.innerText || "").replace(/\s+/g, " ").slice(0, 420));
  const make = (p, name, battleFormat = "singles") => p.evaluate(async a => { const s = await import("/src/services/battleService.js"); return (await s.createBattle({ regulation: a.reg || "m-c", team: "random", room: "open", name: a.name, battleFormat: a.battleFormat })).id; }, { name, battleFormat });
  const join = (p, id, name) => p.evaluate(async a => { const s = await import("/src/services/battleService.js"); await s.joinBattle(a.id, { name: a.name, team: "random" }); }, { id, name });
  await sql("delete from public.battles where status = 'waiting'");
  const A = await open("레드"), B = await open("그린"), C = await open("관전자");
  const rooms = [await make(C, "아주긴트레이너이름열여섯글자입니다", "doubles"), await make(C, "LongEnglishName20chr"), await make(C, "블루"), await make(C, "오박사", "doubles"), await make(C, "웅"), await make(C, "이슬")];
  await sql(`update public.battles set room = 'code' where id in ('${rooms[1]}', '${rooms[3]}')`);
  await B.goto(BASE + "?view=battle&tab=rooms"); await B.waitForTimeout(3500); await shoot(B, "BTL-05", "rooms-filled", { full: true }); log("rooms", await say(B));
  // three live battles: two friendly ones left at their picks, one played
  const live1 = await make(C, "아주긴트레이너이름열여섯글자입니다"); await join(B, live1, "LongEnglishName20chr");
  const live2 = await make(C, "블루", "doubles"); await join(B, live2, "오박사");
  const main = await make(A, "레드"); await join(B, main, "그린");
  await C.goto(BASE + "?view=battle&tab=live"); await C.waitForTimeout(3500); await shoot(C, "BTL-25", "live-filled", { full: true }); log("live", await say(C));
  await C.goto(BASE + "?view=battle&id=" + live1); await C.waitForTimeout(4000); await shoot(C, "EXT-01", "watch-long-names"); log("watch", await say(C));
  await A.goto(BASE + "?view=battle&id=" + main); await B.goto(BASE + "?view=battle&id=" + main);
  await Promise.all([play(A, { side: null, stop: "move" }), play(B, { side: null, stop: "move" })]);
  await weak(main, 1); await Promise.all([play(A, { side: null }), play(B, { side: null })]); await A.waitForTimeout(2500);
  // 다시하기: A's new room, named on the old row
  const next = await make(A, "레드");
  await A.evaluate(id => { const k = "ypl-battle:seats:v1", all = JSON.parse(localStorage.getItem(k) || "{}"); if (all[id]) all[id].rematch = true; localStorage.setItem(k, JSON.stringify(all)); }, next);
  log("rematch row", JSON.stringify(await sql(`update public.battles set rematch_id = '${next}', version = version where id = '${main}' returning id, rematch_id`)));
  await B.reload(); await B.waitForTimeout(6000); await shoot(B, "BTL-22", "rematch-offered"); log("B", await say(B), await B.evaluate(() => [...document.querySelectorAll(".bt-end-keys button, .bt-end-line")].map(x => x.textContent + "|" + x.className)));
  await A.goto(BASE + "?view=battle&id=" + next); await A.waitForTimeout(4000); await shoot(A, "BTL-22", "rematch-waiting"); log("A", await say(A));
  await b.close();
})().catch(e => { console.log("FAILED", e.message.slice(0, 700)); process.exit(1); });
