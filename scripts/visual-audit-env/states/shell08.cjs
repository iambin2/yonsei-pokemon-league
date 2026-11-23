// SHELL-08: a slow in-site move (the 기록 chunk held 8 s from the start). node shell08.cjs
const {open,go,shot}=require("./lib.cjs");const fs=require("fs");
const box=s=>`(()=>{const e=document.querySelector(${JSON.stringify(s)});if(!e)return null;const r=e.getBoundingClientRect(),c=getComputedStyle(e);return {x:Math.round(r.x),y:Math.round(r.y),w:Math.round(r.width),h:Math.round(r.height),op:c.opacity}})()`;
(async()=>{const out={};
 for(const [w,h,theme] of [[390,844,"dark"],[390,844,"light"],[1440,900,"dark"],[1440,900,"light"]]){const tag=`${w}x${h}-${theme}`;
  const {b,p}=await open({w,h,theme});await p.route(/\/src\/pages\/RecordsPage\.jsx/,async r=>{await new Promise(x=>setTimeout(x,8000));r.continue().catch(()=>{});});await go(p,"/",1200);
  await p.evaluate(()=>{const e=[...document.querySelectorAll("nav a,nav button,header a,header button")].find(x=>x.textContent.trim()==="기록");e&&e.click();});
  await p.waitForTimeout(150);await shot(p,"SHELL-08","t150-"+tag);out["a/"+tag]={main:await p.evaluate(box("main")),going:await p.evaluate(box(".y-going")),cell:await p.evaluate(box(".y-going > *"))};
  await p.waitForTimeout(850);await shot(p,"SHELL-08","t1000-"+tag);out["b/"+tag]={main:await p.evaluate(box("main")),going:await p.evaluate(box(".y-going")),cell:await p.evaluate(box(".y-going > *")),cur:await p.evaluate(`[...document.querySelectorAll("[aria-current]")].map(e=>e.textContent.trim().slice(0,10))`)};await b.close();}
 console.log(JSON.stringify(out));
})();
