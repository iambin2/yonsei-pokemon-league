// Probe for the tower transitions found in rec/: logs per animation frame (CPU x4) what stands on screen while 출발 and 다음 판 go into a
// game (how many .bt-match mounts, the first card's opacity, the veil, the site bars, scrollY), and the scroll at each beat of the break.
// Keys are pressed with element.click() so Playwright does not scroll them into view.   node t6.cjs [w=390] [h=844]
const { launch, context, play, BASE } = require("./lib.cjs");
const W = +(process.argv[2] || 390), H = +(process.argv[3] || 844);
(async () => {
  const b = await launch(), ctx = await context(b, { w: W, h: H }), page = await ctx.newPage(), cdp = await ctx.newCDPSession(page);
  const log = (...a) => console.log(...a);
  await page.addInitScript(() => {
    let mounts = 0, prev = null;
    new MutationObserver(ms => { for (const m of ms) for (const n of m.addedNodes) if (n.nodeType === 1 && (n.matches?.(".bt-match") || n.querySelector?.(".bt-match"))) mounts++; })
      .observe(document, { childList: true, subtree: true });
    window.__frames = []; window.__rec = false; const t0 = performance.now();
    const tick = () => { if (window.__rec) {
      const card = document.querySelector(".bt-match .bt-card"), main = document.getElementById("ypl-main");
      const op = el => { let o = 1; for (let x = el; x && x !== document; x = x.parentElement) o *= +getComputedStyle(x).opacity; return Math.round(o * 100) / 100; };
      const s = [mounts, card ? op(card) : "-", document.querySelector(".tw-veil") ? "veil" : "", document.querySelector(".topbar")?.getBoundingClientRect().height ? "bars" : "",
        document.querySelector(".bt-match") ? "match" : document.querySelector(".streak-break") ? "break" : "", Math.round(scrollY), main?.classList.contains("page--battle") ? "pb" : ""].join(" ");
      if (s !== prev) { window.__frames.push(Math.round(performance.now() - t0) + " " + s); prev = s; } }
      requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  });
  const press = re => page.evaluate(re => { const k = [...document.querySelectorAll("button")].find(x => new RegExp(re).test(x.textContent.trim()) && x.getBoundingClientRect().width); k.click(); return k.textContent; }, re);
  const watch = async (name, ms, act) => { await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 }); await page.evaluate(() => { window.__frames = []; window.__rec = true; });
    await act(); await page.waitForTimeout(ms); await page.evaluate(() => { window.__rec = false; }); await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
    log("==", name, "(ms mounts cardOpacity veil bars screen scrollY pageBattle)"); for (const f of await page.evaluate(() => window.__frames)) log("  ", f); };
  const metrics = tag => page.evaluate(tag => { const se = document.scrollingElement, k = [...document.querySelectorAll(".bt-end-keys button, .bt-deck button")].filter(x => x.getBoundingClientRect().width).map(x => [x.textContent.trim(), Math.round(x.getBoundingClientRect().top), Math.round(x.getBoundingClientRect().bottom)]);
    const top = document.querySelector(".bt-head, .bt-match > header, .bt-top")?.getBoundingClientRect();
    return tag + " scrollY " + Math.round(scrollY) + " docH " + se.scrollHeight + " innerH " + innerHeight + " active " + (document.activeElement?.textContent || "").trim().slice(0, 12) + " keys " + JSON.stringify(k) + " head " + (top ? Math.round(top.top) : "-"); }, tag);
  await page.goto(BASE + "?view=battle&tab=streak"); await page.waitForSelector(".bt-end-keys button", { timeout: 30000 }); await page.waitForTimeout(2500);
  log("keys", await page.evaluate(() => [...document.querySelectorAll(".bt-end-keys button")].map(x => x.textContent)));
  if (!(await page.$(".streak-draft"))) { await press("^(도전 시작|새로 도전|다시 도전)$"); await page.waitForTimeout(1500); if (!(await page.$(".streak-draft"))) { log("after new:", await page.evaluate(() => [...document.querySelectorAll("button")].filter(x => x.getBoundingClientRect().width).map(x => x.textContent.trim()).join("|"))); await page.evaluate(() => [...document.querySelectorAll("button")].filter(x => x.textContent.trim() === "새로 도전" && x.getBoundingClientRect().width).pop().click()); } } await page.waitForSelector(".streak-draft", { timeout: 20000 }); await page.waitForTimeout(2000);
  for (let k = 0; k < 6; k++) { await page.evaluate(() => { const p = document.querySelector(".streak-draft-row .streak-pick"); (p?.querySelector(".streak-pick-stats") || p?.querySelector("button"))?.click(); }); await page.waitForTimeout(1500); }
  await page.waitForTimeout(1000);
  await watch("enter (출발)", 6000, () => press("^출발$"));
  if (!(await play(page, { side: 1 }))) throw new Error("game 1 stuck");
  await page.waitForTimeout(3000);
  log(await metrics("result"));
  await press("^다음$"); await page.waitForTimeout(1500); log(await metrics("after 다음"));
  if (await page.$(".streak-break.beat-trade")) { await press("^(바꾸고 다음|바꾸지 않고 다음)$"); await page.waitForTimeout(1500); log(await metrics("after trade")); }
  await watch("next game (다음 판)", 6000, () => press("^다음 판$"));
  await b.close();
})().catch(e => { console.log("FAILED", e.message.slice(0, 600)); process.exit(1); });
