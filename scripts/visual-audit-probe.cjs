// The visual audit's ruler (docs/visual-audit/plan.md): opens one address at one size and theme, optionally presses something,
// and prints what an expression measures in the page; --shot keeps a picture (--clip x,y,w,h for a part of it).
//   node scripts/visual-audit-probe.cjs "<path and query>" <WxH> <dark|light> "<js expression>" [--act "<js run in the page first>"]
//     [--after 900] [--wait 1500] [--dpr 1] [--shot file.png] [--clip x,y,w,h] [--base http://localhost:5183] [--reduced]
// In Git Bash put MSYS_NO_PATHCONV=1 before it, or the leading slash of the address is rewritten to a Windows path.
// Playwright is taken from the npx cache (run `npx playwright --version` once).
const path=require("path"),fs=require("fs");
let pw;try{pw=require("playwright");}catch{const cache=path.join(process.env.LOCALAPPDATA||path.join(require("os").homedir(),".npm"),"npm-cache","_npx");for(const d of fs.readdirSync(cache)){const p=path.join(cache,d,"node_modules","playwright");if(fs.existsSync(p)){pw=require(p);break;}}}
const arg=(n,f)=>{const i=process.argv.indexOf(n);return i>0?process.argv[i+1]:f;};
const [url,vp,theme,expr]=process.argv.slice(2);
(async()=>{
  const [w,h]=vp.split("x").map(Number);
  const b=await pw.chromium.launch({channel:"chrome"});
  const c=await b.newContext({viewport:{width:w,height:h},deviceScaleFactor:Number(arg("--dpr",1)),locale:"ko-KR",timezoneId:"Asia/Seoul",hasTouch:w<860,reducedMotion:process.argv.includes("--reduced")?"reduce":"no-preference"});
  await c.addInitScript(t=>{try{localStorage.setItem("ypl-theme",t)}catch{}},theme);
  const p=await c.newPage();
  await p.goto(arg("--base","http://localhost:5183")+url,{waitUntil:"domcontentloaded"});
  await p.waitForLoadState("networkidle",{timeout:6000}).catch(()=>{});
  await p.waitForTimeout(Number(arg("--wait",1500)));
  const act=arg("--act","");
  if(act){await p.evaluate(act);await p.waitForTimeout(Number(arg("--after",900)));}
  const out=await p.evaluate(expr);
  console.log(JSON.stringify(out,null,1));
  const shot=arg("--shot","");
  if(shot){const clip=arg("--clip","");await p.screenshot({path:shot,...(clip?{clip:Object.fromEntries(clip.split(",").map((v,i)=>[["x","y","width","height"][i],Number(v)]))}:{})});}
  await b.close();
})();
