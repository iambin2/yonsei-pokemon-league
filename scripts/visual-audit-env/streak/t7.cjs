// What makes the tower's battle page taller than the window (docH > innerH): resume the run, then at the game (picking) and, after
// playing it, at its end, list the deepest elements whose bottom passes the window.   node t7.cjs [w] [h]
const { launch, context, play, BASE } = require("./lib.cjs");
const W = +(process.argv[2] || 390), H = +(process.argv[3] || 844);
const deep = () => { const out = []; for (const el of document.querySelectorAll("body *")) { const r = el.getBoundingClientRect(); if (r.height && r.bottom > innerHeight + 1 && ![...el.children].some(c => c.getBoundingClientRect().bottom > innerHeight + 1)) out.push([[...Array(5)].reduce((a, _, i) => { let x = el; for (let k = 0; k < i; k++) x = x?.parentElement; return a + (x ? "<" + x.tagName + "." + String(x.className).split(" ")[0] : ""); }, "") + " txt:" + el.textContent.slice(0, 20) + " style:" + (el.getAttribute("style") || ""), Math.round(r.top), Math.round(r.bottom), getComputedStyle(el).position]); }
  const pg = document.querySelector(".page"), cs = pg && getComputedStyle(pg);
  return { docH: document.scrollingElement.scrollHeight, innerH: innerHeight, page: pg && [pg.className, Math.round(pg.getBoundingClientRect().height), cs.paddingBottom, cs.minHeight], deep: out.slice(0, 10) }; };
(async () => {
  const b = await launch(), ctx = await context(b, { w: W, h: H }), page = await ctx.newPage();
  await page.goto(BASE + "?view=battle&tab=streak"); await page.waitForSelector(".bt-end-keys button", { timeout: 30000 }); await page.waitForTimeout(2500);
  await page.evaluate(() => [...document.querySelectorAll(".bt-end-keys button")].find(x => /이어서/.test(x.textContent)).click());
  await page.waitForTimeout(5000);
  console.log("game", JSON.stringify(await page.evaluate(deep)));
  await play(page, { side: 1 }); await page.waitForTimeout(3000);
  console.log("end", JSON.stringify(await page.evaluate(deep)));
  await page.screenshot({ path: "sheets/t7-end-" + W + ".png" });
  await b.close();
})().catch(e => { console.log("FAILED", e.message.slice(0, 600)); process.exit(1); });
