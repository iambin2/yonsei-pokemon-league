// Records the tower's transitions at phone size with the CPU four times slower (frames from Chrome's screencast, as scripts/record-transition.cjs
// takes them): 출발 into the first game, the break's beats, 다음 판 into the next game, and 다음 판 after a gatekeeper (the floor change).
//   node t4.cjs   -> p/rec/<name>/frame-<ms>.jpg and sheet.png (python PIL)
const fs = require("fs"), path = require("path"), { execFileSync } = require("child_process");
const { launch, context, play, battleId, BASE } = require("./lib.cjs");
(async () => {
  const b = await launch(), ctx = await context(b, { speed: "0" }), page = await ctx.newPage(), cdp = await ctx.newCDPSession(page);
  const log = (...a) => console.log(new Date().toISOString().slice(14, 19), ...a);
  page.on("pageerror", e => log("pageerror", e.message));
  let frames = null, t0 = null;
  cdp.on("Page.screencastFrame", f => { const t = f.metadata.timestamp * 1000; t0 ??= t; frames?.push({ t: Math.round(t - t0), data: f.data }); cdp.send("Page.screencastFrameAck", { sessionId: f.sessionId }).catch(() => {}); });
  const rec = async (name, ms, act) => {
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 }); frames = []; t0 = null;
    await cdp.send("Page.startScreencast", { format: "jpeg", quality: 60, everyNthFrame: 1 });
    await page.waitForTimeout(150); const marks = await act(); await page.waitForTimeout(ms);
    await cdp.send("Page.stopScreencast"); await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
    const dir = path.join(__dirname, "rec", name); fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
    for (const f of frames) fs.writeFileSync(path.join(dir, `frame-${String(f.t).padStart(5, "0")}.jpg`), Buffer.from(f.data, "base64"));
    const gaps = frames.slice(1).map((f, i) => f.t - frames[i].t);
    log(name, "frames", frames.length, "gaps>50:", gaps.filter(g => g > 50).length, "longest", Math.max(0, ...gaps), "at", frames[gaps.indexOf(Math.max(0, ...gaps))]?.t, "marks", JSON.stringify(marks || ""));
    execFileSync("python", [path.join(__dirname, "recsheet.py"), dir, "150"]); frames = null; };
  const press = re => page.click(`button:text-matches('${re}')`);
  await page.goto(BASE + "?view=battle&tab=streak"); await page.waitForSelector(".bt-end-keys button", { timeout: 30000 }); await page.waitForTimeout(2500);
  if (!(await page.$(".streak-draft"))) { await press("^(도전 시작|새로 도전|다시 도전)$"); await page.waitForTimeout(1500); if (!(await page.$(".streak-draft"))) await page.evaluate(() => [...document.querySelectorAll("button")].filter(x => x.textContent.trim() === "새로 도전" && x.getBoundingClientRect().width).pop()?.click()); }
  await page.waitForSelector(".streak-draft"); await page.waitForTimeout(2000);
  for (let k = 0; k < 6; k++) { await page.evaluate(() => { const p = document.querySelector(".streak-draft-row .streak-pick"); (p.querySelector(".streak-pick-stats") || p.querySelector("button")).click(); }); await page.waitForTimeout(1500); }
  await page.waitForTimeout(1000);
  await rec("enter", 6500, () => press("^출발$"));
  let last = null;
  for (let n = 1; n <= 6; n++) {
    await page.waitForFunction(was => { const id = new URL(location.href).searchParams.get("id"); return id && id !== was; }, last, { timeout: 60000 }); last = battleId(page);
    if (!(await play(page, { side: 1 }))) { log("stuck", n); break; }
    await page.waitForTimeout(3000); log("game", n, "done");
    const beats = async () => { await press("^다음$"); await page.waitForTimeout(1500); if (await page.$(".streak-break.beat-trade")) { await press("^(바꾸고 다음|바꾸지 않고 다음)$"); await page.waitForTimeout(1500); } };
    if (n === 1) { await rec("break-beats", 300, beats); await rec("next-game", 6500, () => press("^다음 판$")); continue; }
    await beats();
    if (n === 5) { await rec("floor-change", 9000, () => press("^다음 판$")); continue; }
    if (n === 6) break;
    await press("^다음 판$");
  }
  await b.close();
})().catch(e => { console.log("FAILED", e.message.slice(0, 600)); process.exit(1); });
