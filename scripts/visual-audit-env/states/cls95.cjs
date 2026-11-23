// T-95 (2026-11-23): a first visit to the home (no stored copy), every layout shift with its sources and the ranking's rows as they change.
// node cls95.cjs <WxH> [cpu]   (states/lib.cjs guard; cpu throttles the page through CDP)
const { open } = require("./lib.cjs");
const [size = "390x844", cpu = "4"] = process.argv.slice(2);
(async () => {
  const [w, h] = size.split("x").map(Number);
  const { b, c, p } = await open({ w, h });
  const cdp = await c.newCDPSession(p); await cdp.send("Emulation.setCPUThrottlingRate", { rate: Number(cpu) });
  await p.addInitScript(() => {
    window.__shifts = []; window.__rank = [];
    new PerformanceObserver(l => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__shifts.push({ v: +e.value.toFixed(4), t: Math.round(e.startTime), src: e.sources.map(s => (s.node && (s.node.className || s.node.nodeName) + "").slice(0, 40) + " " + Math.round(s.previousRect.y) + "->" + Math.round(s.currentRect.y) + " h" + Math.round(s.previousRect.height) + "->" + Math.round(s.currentRect.height)) }); }).observe({ type: "layout-shift", buffered: true });
    const tick = () => { const r = document.querySelector(".ho-rank"); if (r) { const s = [...r.querySelectorAll(".sh, .line-score, .line-score > *")].map(e => (e.className + "").split(" ")[0].slice(0, 10) + ":" + Math.round(e.getBoundingClientRect().height)).join(" "); const last = window.__rank[window.__rank.length - 1]; if (!last || last.s !== s) window.__rank.push({ t: Math.round(performance.now()), top: Math.round(r.getBoundingClientRect().top), h: Math.round(r.getBoundingClientRect().height), s }); } requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  });
  await p.goto((process.env.BASE || "http://localhost:5193") + "/", { waitUntil: "load", timeout: 300000 });
  await p.waitForTimeout(8000);
  const out = await p.evaluate(() => ({ cls: +window.__shifts.reduce((a, s) => a + s.v, 0).toFixed(4), shifts: window.__shifts, rank: window.__rank }));
  console.log(size, "cpu", cpu, JSON.stringify(out, null, 1));
  await b.close();
})();
