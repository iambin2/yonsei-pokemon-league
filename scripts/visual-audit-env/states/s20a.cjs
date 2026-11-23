// 묶음 20a (2026-11-23): fail / hold / zero states measured for T-109..T-115.  node s20a.cjs <W> <H> <theme> <mode> [page ...]
// mode fail: every REST and function 500 (states.cjs) ; hold: GETs held 3 s ; zero: every list empty
const { open, go, shot } = require("./lib.cjs");
const [W, H, theme, mode, ...only] = process.argv.slice(2); const w = +W, h = +H;
const PAGES = { home: "/", news: "/?view=news", bracket: "/?view=bracket", alerts: "/?view=alerts", builder: "/?view=builder", records: "/?view=records" };
const emptyAll = (j, url) => { if (/site_data/.test(url) && Array.isArray(j) && j[0] && j[0].value && typeof j[0].value === "object") { const v = j[0].value; for (const k in v) if (Array.isArray(v[k])) v[k] = []; return j; } return Array.isArray(j) ? [] : j; };
const M = `(()=>{const r=e=>{const b=e.getBoundingClientRect();return Math.round(b.x)+","+Math.round(b.y)+" "+Math.round(b.width)+"x"+Math.round(b.height)};
 const notes=[...document.querySelectorAll(".error-note")].filter(e=>e.offsetParent).map(e=>{const p=e.previousElementSibling;return {t:e.innerText.replace(/\\n/g,"/").slice(0,40),box:r(e),key:[...e.querySelectorAll(".btn")].map(r),prev:p&&(p.tagName+"."+p.className).slice(0,40),gapAbove:p?Math.round(e.getBoundingClientRect().top-p.getBoundingClientRect().bottom):null}});
 const empties=[...document.querySelectorAll(".ypl-empty, .empty, [class*=empty]")].filter(e=>e.offsetParent&&e.innerText.trim()).map(e=>e.innerText.slice(0,30));
 const main=[...document.querySelectorAll("#ypl-main .btn--main")].filter(e=>e.offsetParent).map(e=>e.innerText.trim());
 const rankFirst=document.querySelector(".ho-rank .ls-first");const sr=document.querySelector(".tb-search-row");
 return {notes,empties,mainKeys:main,rankFirst:rankFirst&&rankFirst.className,searchTop:sr&&Math.round(sr.getBoundingClientRect().top+scrollY)}})()`;
(async () => {
  for (const [key, q] of Object.entries(PAGES)) {
    if (only.length && !only.includes(key)) continue;
    const opts = mode === "fail" ? { fail: [{ match: /rest\/v1\/(?!player_accounts)|functions/, status: 500 }] } : mode === "hold" ? { hold: [{ match: /rest\/v1|functions/, ms: 3000 }] } : { patch: [{ match: /rest\/v1/, fn: emptyAll }], rpc: { push_inbox: [], handover_features_ready: true } };
    const { b, p } = await open({ w, h, theme, opts });
    if (key === "builder" && mode === "hold") await p.route(/champions-data\.json/, async r => { await new Promise(x => setTimeout(x, 3000)); return r.continue(); });
    try {
      if (mode === "hold") { await p.goto((process.env.BASE || "http://localhost:5193") + q, { waitUntil: "commit", timeout: 300000 }); await p.waitForTimeout(1500); const a = await p.evaluate(M); await shot(p, "S20a-" + key, `hold1500-${w}x${h}-${theme}`); await p.waitForTimeout(6000); const z = await p.evaluate(M); console.log(key, mode, `${w}x${h}`, theme, "at1500", JSON.stringify(a), "\n   after", JSON.stringify(z)); }
      else { await go(p, q, 6000); console.log(key, mode, `${w}x${h}`, theme, JSON.stringify(await p.evaluate(M))); await shot(p, "S20a-" + key, `${mode}-${w}x${h}-${theme}`, { fullPage: true }); }
    } catch (e) { console.log(key, "ERR", String(e).slice(0, 200)); }
    await b.close();
  }
})();
