const { launch, context, shoot, MEASURE, BASE } = require("./lib.cjs");
(async () => {
  const b = await launch(), ctx = await context(b), page = await ctx.newPage();
  page.on("pageerror", e => console.log("pageerror", e.message));
  page.on("response", r => { if (r.status() >= 400 && /54321/.test(r.url())) console.log("HTTP", r.status(), r.request().method(), r.url().slice(22, 140)); });
  await page.goto(BASE + "?view=battle&tab=streak"); await page.waitForTimeout(4000);
  console.log(await page.evaluate(() => [...document.querySelectorAll(".bt-end-keys button, .streak-side b, .streak-side .t12")].map(e => e.textContent).slice(0, 30)));
  await shoot(page, "TWR-02", "approved-idle");
  await shoot(page, "TWR-04", "board", { full: true });
  console.log("measure", JSON.stringify(await page.evaluate(MEASURE, ".bt-page")));
  await page.click(".bt-end-keys button:has-text('도전 시작')"); await page.waitForTimeout(3500);
  console.log(await page.evaluate(() => document.querySelector(".streak-draft")?.outerHTML.slice(0, 1500) || document.querySelector(".bt-page")?.innerText.slice(0, 500)));
  await b.close();
})();
