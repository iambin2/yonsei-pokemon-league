// Measurements behind the findings (no resizing: one context per size).   node t5.cjs   (after a run rests on its break: t2 or t4 leaves one)
const { launch, context, BASE } = require("./lib.cjs");
(async () => {
  const b = await launch();
  for (const [w, h] of [[390, 844], [1440, 900]]) {
    const ctx = await context(b, { w, h }), p = await ctx.newPage();
    await p.goto(BASE + "?view=battle&tab=streak"); await p.waitForSelector(".bt-end-keys button", { timeout: 30000 }); await p.waitForTimeout(2500);
    await p.click("button:text-is('이어서 하기')").catch(() => console.log("no resume key")); await p.waitForTimeout(6000);
    const read = () => p.evaluate(() => { const r = el => { const q = el.getBoundingClientRect(); return [Math.round(q.left), Math.round(q.top), Math.round(q.width), Math.round(q.height)]; };
      const de = document.documentElement, low = [...document.querySelectorAll(".ypl *")].map(el => [el, el.getBoundingClientRect().bottom]).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([el, bt]) => [String(el.className).slice(0, 50), Math.round(bt)]);
      return { beat: document.querySelector(".streak-break")?.className, inner: [innerWidth, innerHeight], scroll: [de.scrollWidth, de.scrollHeight], lowest: low,
        tracks: [...document.querySelectorAll(".streak-track")].map(el => [el.parentElement.className.slice(0, 40), r(el), el.getAttribute("aria-label")]),
        segs: [...document.querySelectorAll(".bt-main [role=img][aria-label*=연승], .bt-head [role=img]")].map(el => [el.getAttribute("aria-label"), r(el)]).slice(0, 8),
        headClip: [...document.querySelectorAll(".bt-head *, .bt-col *, .bt-side *")].filter(el => !el.children.length && el.scrollWidth > el.clientWidth + 1).map(el => [el.className, el.parentElement.className, el.textContent, el.scrollWidth, el.clientWidth, getComputedStyle(el).maxWidth]),
        doors: [...document.querySelectorAll(".streak-doors [role=radio]")].map(el => [el.className, el.getAttribute("aria-checked"), getComputedStyle(el).backgroundColor, r(el), getComputedStyle(el.querySelector(".streak-door-six") || el).display, el.querySelectorAll(".streak-door-mon").length]),
        endWords: [...document.querySelectorAll(".streak-result .t15, .bt-end-title, .bt-end-line")].map(el => [el.className, el.textContent, r(el)]),
        gap: (() => { const a = document.querySelector(".streak-break"), c = document.querySelector(".bt-replay, [class*=replay]"); return a && c ? [r(a), String(c.className), r(c)] : null; })() }; });
    console.log(w, "RESULT", JSON.stringify(await read()));
    await p.click("button:text-is('다음')").catch(() => {}); await p.waitForTimeout(1500);
    if (await p.$(".streak-break.beat-trade")) { console.log(w, "TRADE", JSON.stringify(await p.evaluate(() => { const r = el => { const q = el.getBoundingClientRect(); return [Math.round(q.left), Math.round(q.top), Math.round(q.width), Math.round(q.height)]; }; return { table: r(document.querySelector(".streak-trades")), rows: [...document.querySelectorAll(".streak-trades > *")].slice(0, 6).map(el => [el.className, r(el)]), empty: document.querySelectorAll(".streak-takes > span.pn").length, takes: document.querySelectorAll(".streak-take").length }; })));
      await p.click("button:text-matches('^(바꾸고 다음|바꾸지 않고 다음)$')"); await p.waitForTimeout(1500); }
    await p.evaluate(() => document.querySelectorAll(".streak-doors [role=radio]")[1]?.click()); await p.waitForTimeout(600);
    console.log(w, "DOOR", JSON.stringify(await read()));
    // the waiting screen with a twenty-letter name
    const q = await (await context(b, { w, h, signed: false, name: "LongEnglishName20chr" })).newPage(); await q.goto(BASE + "?view=battle"); await q.waitForTimeout(2000);
    const id = await q.evaluate(async () => { const s = await import("/src/services/battleService.js"); return (await s.createBattle({ regulation: "m-c", team: "random", room: "open", name: "LongEnglishName20chr", battleFormat: "singles" })).id; });
    await q.goto(BASE + "?view=battle&id=" + id); await q.waitForTimeout(3500);
    console.log(w, "WAIT", JSON.stringify(await q.evaluate(() => { const r = el => { const x = el.getBoundingClientRect(); return [Math.round(x.left), Math.round(x.top), Math.round(x.width), Math.round(x.height)]; };
      return { names: [...document.querySelectorAll(".bt-trainer")].map(el => [el.textContent, r(el), el.scrollWidth, el.clientWidth, getComputedStyle(el).maxWidth, el.parentElement.className, r(el.parentElement)]),
        counters: [...document.querySelectorAll(".bt-wait-counters > *")].map(el => [el.textContent.slice(0, 12), r(el)]), dock: [...document.querySelectorAll(".dock, [class*=dock]")].map(el => [el.className, r(el), getComputedStyle(el).position]).slice(0, 3), cancel: r(document.querySelector(".bt-cancel")), scrollH: document.documentElement.scrollHeight }; })));
  }
  await b.close();
})().catch(e => { console.log("FAILED", e.message.slice(0, 600)); process.exit(1); });
