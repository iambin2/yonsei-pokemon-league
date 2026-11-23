// T-120 (2026-11-23): the reigning champion's name as one long unbroken word (김현민 → a 24-letter Latin name), 명예의 전당. node t120.cjs <WxH> <theme> [korean]
const { open, go, shot } = require("./lib.cjs");
const [size = "390x844", theme = "dark", ko] = process.argv.slice(2); const [w, h] = size.split("x").map(Number);
const NAME = ko ? "김현민" : "Abcdefghijklmnopqrstuvwx";
(async () => {
  const swap = j => JSON.parse(JSON.stringify(j).replaceAll("김현민", NAME));
  const { b, p } = await open({ w, h, theme, opts: { patch: [{ match: /rest\/v1/, fn: swap }] } });
  await go(p, "/?view=champions", 3000);
  console.log(size, theme, NAME, JSON.stringify(await p.evaluate(() => { const n = document.querySelector(".hof-crown-name"); if (!n) return null; let pn = n; while (pn && !/(^| )(pn|inv)( |$)/.test(pn.className)) pn = pn.parentElement; const cs = getComputedStyle(pn), r = document.createRange(); r.selectNodeContents(n); const ink = [...r.getClientRects()].reduce((m, x) => Math.max(m, x.right), 0);
    return { nameRight: Math.round(ink), panelInner: Math.round(pn.getBoundingClientRect().right - parseFloat(cs.paddingRight)), lines: r.getClientRects().length, docW: document.documentElement.scrollWidth }; })));
  await shot(p, "T-120", `${ko ? "ko" : "long"}-${size}-${theme}`);
  await b.close();
})();
