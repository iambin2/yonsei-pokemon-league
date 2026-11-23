// Linked-account checks for the visual-audit leftovers T-103..T-108 (2026-11-23). node acct2.cjs [WxH-theme ...]
// A fake signed-in visitor whose account is approved for 이제빈 (states/lib.cjs guard: no write reaches production).
const { open, go, shot } = require("./lib.cjs");
const PID = "4b8fe65f-5e75-5f59-ad54-3c19112ee28a", NAME = "이제빈";
const VPS = (process.argv.slice(2).length ? process.argv.slice(2) : ["390x844-dark", "390x844-light", "1440x900-dark", "1440x900-light"]).map(s => { const [wh, t] = s.split("-"); const [w, h] = wh.split("x").map(Number); return [w, h, t]; });
const KEYS = `(()=>{const g=document.querySelector(".acct-keys");if(!g)return null;const ks=[...g.querySelectorAll(".btn")].map(b=>{const r=b.getBoundingClientRect();const t=document.createRange();t.selectNodeContents(b);const tr=t.getBoundingClientRect();return {t:b.textContent.trim(),x:Math.round(r.x),w:Math.round(r.width),h:Math.round(r.height),textBottom:Math.round(tr.bottom),textLeft:Math.round(tr.left)}});
  const sec=g.parentElement;const other=[...sec.querySelectorAll("b,h2,h3,.t15,.row-title,p")].filter(e=>!g.contains(e)&&e.offsetParent).slice(0,4).map(e=>{const t=document.createRange();t.selectNodeContents(e);return {t:e.textContent.trim().slice(0,20),left:Math.round(t.getBoundingClientRect().left)}});return {keys:ks,others:other};})()`;
const ORDER = `(()=>{const c=document.querySelector(".rc-counts");if(!c)return "no counter";let e=c;const seq=[];while(e&&seq.length<4){let n=e.nextElementSibling;while(!n&&e.parentElement&&!e.parentElement.matches("main,#ypl-main")){e=e.parentElement;n=e.nextElementSibling;}if(!n)break;seq.push((n.className+"").slice(0,30)+" | "+n.innerText.replace(/\\n+/g," / ").slice(0,50));e=n;}return seq;})()`;
(async () => {
  for (const [w, h, theme] of VPS) {
    const tag = `${w}x${h}-${theme}`, blocked = [];
    const { b, p } = await open({ w, h, theme, session: true, storage: { "ypl-me": JSON.stringify({ name: NAME, playerId: PID }) },
      opts: { account: { requested_name: NAME, status: "approved", player_id: PID, email: "visitor.account@gmail.com" }, blocked, fn: () => ({ ok: true, rows: [], runs: [], board: [], battles: [] }), rpc: { push_inbox: [], handover_features_ready: true } } });
    const out = {};
    await go(p, "/?view=more", 1800);
    out.more = await p.evaluate(`(()=>({alertRows:[...document.querySelectorAll(".row, [class*=row]")].filter(e=>e.offsetParent&&/^알림/.test(e.innerText.trim())&&!e.querySelector(".row")).length, keys:${KEYS}}))()`);
    await shot(p, "T-106", tag, { fullPage: true });
    await go(p, "/?view=records&tab=trainer&me=1", 1800);
    out.find = await p.evaluate(KEYS); await shot(p, "T-103", "find-" + tag);
    await go(p, "/?view=records&trainer=" + encodeURIComponent(NAME), 2500);
    out.sheetOrder = await p.evaluate(ORDER);
    out.sheetKeys = await p.evaluate(KEYS);
    out.rivalLabel = await p.evaluate(`[...document.querySelectorAll("p,span,div")].filter(e=>e.children.length===0&&e.textContent.includes("자주 만난")).map(e=>e.className+":"+e.textContent)`);
    out.mineNote = await p.evaluate(`!!document.querySelector(".rc-mine-note")`);
    await shot(p, "T-104", "sheet-" + tag, { fullPage: true });
    await go(p, "/?view=records&tab=trainer", 2000);
    out.meTag = await p.evaluate(`(()=>{const rows=[...document.querySelectorAll("#ypl-main a, #ypl-main button, #ypl-main [role=button], #ypl-main .row")].filter(e=>e.offsetParent&&/이제빈|강진영|김성빈|정두호/.test(e.innerText)&&e.querySelector("*"));const pick=rows.slice(0,40).map(r=>{const kids=[...r.querySelectorAll("*")].filter(k=>k.children.length===0&&k.offsetParent);const name=r.innerText.split("\\n")[0];const marks=kids.map(k=>{const b=k.getBoundingClientRect();return Math.round(b.x)+":"+(k.textContent.trim()||k.className+"").slice(0,8)});return name.slice(0,12)+" => "+marks.join(" ")});return pick.slice(0,6);})()`);
    await shot(p, "T-108", tag);
    console.log("### " + tag + "\n" + JSON.stringify(out, null, 1) + "\nblocked: " + [...new Set(blocked)].slice(0, 6).join(" ; "));
    await b.close();
  }
})();
