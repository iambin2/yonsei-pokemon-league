// T-114 / T-113 (2026-11-23): sample the builder's search row top and the home ranking's first row while data is held. node b114.cjs <W> <H>
const { open } = require("./lib.cjs");
const [W = 390, H = 844] = process.argv.slice(2).map(Number);
(async () => {
  for (const [q, expr] of [["/?view=builder", `(()=>{const s=document.querySelector(".tb-search-row"),l=document.querySelector(".tb-data-line");return s?Math.round(s.getBoundingClientRect().top+scrollY)+" line:"+(l?JSON.stringify(l.innerText)+" h"+Math.round(l.getBoundingClientRect().height):"none"):null})()`],
    ["/", `(()=>{const f=document.querySelector(".ho-rank .ls-first");return f?f.className+" bg "+getComputedStyle(f).backgroundColor:null})()`]]) {
    const { b, p } = await open({ w: W, h: H, opts: { hold: [{ match: /rest\/v1|functions/, ms: 3000 }] } });
    await p.route(/champions-data\.json|battle-info/, async r => { await new Promise(x => setTimeout(x, 4000)); return r.continue(); });
    await p.goto((process.env.BASE || "http://localhost:5193") + q, { waitUntil: "commit", timeout: 300000 });
    const seen = [];
    for (let i = 0; i < 30; i++) { await p.waitForTimeout(500); const v = await p.evaluate(expr).catch(() => null); if (v !== seen[seen.length - 1]?.v) seen.push({ t: i * 500, v }); }
    console.log(q, JSON.stringify(seen));
    await b.close();
  }
})();
