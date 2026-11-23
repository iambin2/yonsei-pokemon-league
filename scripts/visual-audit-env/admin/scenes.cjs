// node scenes.cjs <scene> [WxH,WxH] [dark,light]   (shots go to docs/visual-audit/shots/<ID>/)
const { open } = require("./lib.cjs"); const L = require("./live.cjs");
const [scene, sizes = "390x844,1440x900", themes = "dark,light"] = process.argv.slice(2);
const box = sel => `(()=>[...document.querySelectorAll(${JSON.stringify(sel)})].filter(e=>e.offsetParent).slice(0,60).map(e=>{const r=e.getBoundingClientRect();return (e.innerText||e.getAttribute("aria-label")||"").replace(/\\n+/g,"/").slice(0,36)+" ."+String(e.className).split(" ").slice(0,3).join(".")+" "+Math.round(r.x)+","+Math.round(r.y)+" "+Math.round(r.width)+"x"+Math.round(r.height)}))()`;
const overflow = `(()=>({sw:document.documentElement.scrollWidth,iw:innerWidth,clipped:[...document.querySelectorAll("#ypl-main *, .modal *, [role=dialog] *")].filter(e=>e.offsetParent&&e.children.length===0&&e.scrollWidth>e.clientWidth+1).slice(0,10).map(e=>(e.innerText||"").slice(0,30)+" "+e.scrollWidth+">"+e.clientWidth)}))()`;
const say = async (t, sel) => { console.log((await t.page.evaluate(box(sel))).join("\n")); console.log(JSON.stringify(await t.page.evaluate(overflow))); };
const HO = ".ho-label, .ho-name, .ho-board, .ho-spec-row, .ho-due > *, .ho-go > *, .ho-live, .ho-live > *, .ho-live button > *";
const S = {
  // HOME-05/06/08/09: the day itself, a linked player (이제빈) signed in, their match in play, another match as a site battle
  "home-today": async o => { const t = await open({ ...o, ...L.live({ visitor: true, battle: true, due: "23:30", start: "23:50", roundAt: "08:30" }) }); await t.go("/"); await t.page.waitForTimeout(2500);
    console.log(await t.shot("HOME-08", "mynext", { fullPage: o.w < 860 })); await say(t, HO); return t; },
  // HOME-08 체크인 전 / 완료: the player is registered but has no match yet
  "home-checkin": async o => { let t; for (const c of ["open", "done"]) { const fx = L.live({ visitor: true, checkin: c, start: "23:50" }); fx.patches.push({ re: /tbl:entry_participants/, fn: rows => rows.map(r => (r.player_id === L.ME.playerId ? { ...r, player_id: null } : r)) });
      t = await open({ ...o, ...fx }); await t.go("/"); await t.page.waitForTimeout(2500); console.log(await t.shot("HOME-08", "checkin-" + c)); await say(t, HO); if (c === "open") await t.browser.close(); } return t; },
};
module.exports = { S, box, overflow, say };
if (require.main === module) (async () => {
  for (const sz of sizes.split(",")) for (const theme of themes.split(",")) { const [w, h] = sz.split("x").map(Number); console.log(`\n### ${scene} ${sz} ${theme}`);
    try { const t = await S[scene]({ w, h, theme }); if (t) { const bad = t.log.filter(l => /UNMOCKED|PAGEERROR|PATCH FAIL/.test(l)); if (bad.length) console.log([...new Set(bad)].join("\n")); await t.browser.close(); } } catch (e) { console.log("FAIL", e.message.slice(0, 400)); } }
  process.exit(0);
})();
