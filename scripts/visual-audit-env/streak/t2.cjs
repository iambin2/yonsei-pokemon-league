// One whole run of 도전의 탑 on the stand-in: draft, games won and lost by weakening a side, every beat of the break shot at 390 and 1440 in both themes.
//   node t2.cjs            (stand-in on 54321 and the dev server on 5194 must be up; the run is the seeded account's, start from a fresh stand-in)
const { launch, context, shoot, MEASURE, weak, battleId, play, BASE } = require("./lib.cjs");
const PLAN = (process.argv[2] || "W,W,L,W,W,W,W,L,L,L,L").split(",");
(async () => {
  const b = await launch(), ctx = await context(b), page = await ctx.newPage();
  const log = (...a) => console.log(new Date().toISOString().slice(14, 19), ...a);
  page.on("pageerror", e => log("pageerror", e.message));
  page.on("response", r => { if (r.status() >= 400 && /54321/.test(r.url()) && !/site_data/.test(r.url())) log("HTTP", r.status(), r.url().slice(22, 120)); });
  const seen = new Set();
  const snap = async (id, name, opt) => { if (seen.has(id + name)) return; seen.add(id + name);
    await shoot(page, id, name, opt);
    for (const [w, h] of [[390, 844], [1440, 900]]) { await page.setViewportSize({ width: w, height: h }); await page.waitForTimeout(250); const m = await page.evaluate(MEASURE, ".ypl"); if (m.docW > m.vw || m.over.length || m.clipped.length) log("MEASURE", id, name, w, JSON.stringify(m)); }
    await page.setViewportSize({ width: 390, height: 844 }); log("shot", id, name); };
  const text = () => page.evaluate(() => (document.querySelector(".streak-break, .bt-end, .bt-page")?.innerText || "").replace(/\s+/g, " ").slice(0, 260));
  await page.goto(BASE + "?view=battle&tab=streak"); await page.waitForSelector(".bt-end-keys button", { timeout: 30000 }); await page.waitForTimeout(2500);
  log("keys", await page.evaluate(() => [...document.querySelectorAll(".bt-end-keys button")].map(x => x.textContent)));
  if (!(await page.$(".streak-draft"))) await page.click(".bt-end-keys button:text-matches('^(도전 시작|새로 도전)$')"); await page.waitForSelector(".streak-draft"); await page.waitForTimeout(2500);
  await snap("TWR-05", "draft-0");
  for (let k = 0; k < 6; k++) {
    await page.evaluate(() => { const p = document.querySelector(".streak-draft-row .streak-pick"); (p.querySelector(".streak-pick-stats") || p.querySelector("button")).click(); });
    await page.waitForTimeout(1500);
    if (k === 0) { const done = await page.evaluate(() => document.querySelector(".streak-trades-title .t12")?.textContent); log("after first pick", done);
      if (/^0/.test(done)) { await page.evaluate(() => document.querySelector(".streak-draft-row .streak-pick button").click()); await page.waitForTimeout(1500); } }
    if (k === 2) await snap("TWR-05", "draft-3");
  }
  await page.waitForTimeout(1200); await snap("TWR-05", "draft-6");
  log("keys", await page.evaluate(() => [...document.querySelectorAll(".bt-end-keys button")].map(x => x.textContent + (x.disabled ? "(off)" : ""))));
  await page.click(".bt-end-keys button:has-text('출발')");
  let last = null, n = 0;
  for (const want of PLAN) {
    n++;
    await page.waitForFunction(was => new URL(location.href).searchParams.get("id") && new URL(location.href).searchParams.get("id") !== was, last, { timeout: 60000 });
    last = battleId(page); log("game", n, want, last);
    await page.waitForSelector(".bt-pick", { timeout: 60000 }); await page.waitForTimeout(3000);
    const keeper = await page.evaluate(() => Boolean(document.querySelector(".keeper, [class*=keeper]")));
    if (n === 1) await snap("U-TWR-play", "pick");
    if (keeper) await snap("U-TWR-play", "pick-keeper"); log("keeper", keeper);
    let turn = false;
    const ok = await play(page, { side: want === "W" ? 1 : 0, log: async s => { if (s === "move" && !turn && n === 1) turn = true; } });
    if (!ok) { log("play did not end"); await page.screenshot({ path: `stuck-${n}.png` }); break; }
    await page.waitForTimeout(2600);
    log("end", await text());
    const over = await page.evaluate(() => Boolean(document.querySelector(".streak-tower")));
    if (over) { await snap("TWR-08", "over", { full: true }); break; }
    const wins = await page.evaluate(() => document.querySelector(".streak-result-count")?.getAttribute("aria-label") || "");
    const won = /승리 연승/.test(await text()); if (won !== (want === "W")) log("outcome differs from plan", want);
    const tag = won ? (keeper ? "result-floor" : "result-win") : "result-loss";
    await snap(won ? "TWR-07" : "TWR-08", tag, { full: true });
    await page.click("button:text-is('다음')").catch(() => log("no 다음")); await page.waitForTimeout(1400);
    let beat = await page.evaluate(() => document.querySelector(".streak-break")?.className || "");
    log("beat", beat, wins);
    if (/beat-trade/.test(beat)) {
      const up = await page.evaluate(() => Boolean(document.querySelector(".streak-trades-head .streak-gain")));
      await snap("TWR-07", up ? "trade-up" : "trade", { full: true });
      if (!seen.has("chosen")) { seen.add("chosen"); const had = await page.evaluate(() => { const t = document.querySelector(".streak-take:not(.off)"); t?.click(); return Boolean(t); }); await page.waitForTimeout(700); if (had) { await snap("TWR-07", "trade-chosen", { full: true }); } }
      await page.click("button:text-matches('^(바꾸고 다음|바꾸지 않고 다음)$')"); await page.waitForTimeout(1400);
    }
    await snap(won ? "TWR-06" : "TWR-08", won ? (keeper ? "door-next-floor" : "door") : "door-after-loss", { full: true });
    const kinds = await page.evaluate(() => [...document.querySelectorAll(".streak-doors [role=radio]")].map(d => d.innerText.replace(/\s+/g, " ").slice(0, 40)));
    log("doors", JSON.stringify(kinds));
    if (kinds.length > 1 && n === 1) { await page.evaluate(() => document.querySelectorAll(".streak-doors [role=radio]")[1].click()); await page.waitForTimeout(600); await snap("TWR-06", "door-hard-chosen", { full: true }); }
    if (kinds.some(k => /수문장/.test(k))) await snap("TWR-06", "door-gate", { full: true });
    await page.click("button:text-matches('^(다음 판|이어서 하기)$')");
  }
  log("done", page.url());
  await page.goto(BASE + "?view=battle&tab=streak"); await page.waitForTimeout(4000);
  await snap("TWR-04", "board-after-run", { full: true });
  await b.close();
})().catch(e => { console.log("FAILED", e.message.slice(0, 600)); process.exit(1); });
