// Shared harness for the unseen-states audit (group r). Playwright from the npx cache, Chrome channel.
// guard(): every non-GET to *.supabase.co is answered here (never reaches production); requests carrying the fake account token are mocked too.
const path=require("path"),fs=require("fs");
let pw;try{pw=require("playwright");}catch{const cache=path.join(process.env.LOCALAPPDATA,"npm-cache","_npx");for(const d of fs.readdirSync(cache)){const p=path.join(cache,d,"node_modules","playwright");if(fs.existsSync(p)){pw=require(p);break;}}}
const BASE=process.env.BASE||"http://localhost:5193";
const SHOTS=require("path").resolve(__dirname, "../../../docs/visual-audit/shots").split(require("path").sep).join("/");
const FAKE="fake-access-token-r";
const json=(route,body,status=200)=>route.fulfill({status,contentType:"application/json",headers:{"access-control-allow-origin":"*","content-range":"0-0/*"},body:JSON.stringify(body)});
/* opts: {account: row|null|"fail"|"hold", signedIn, rpc:{name:body|fn}, patch:[{match:RegExp, fn:(json,url)=>json}], hold:[{match,ms}], fail:[{match,status|"abort"}], log:[]} */
async function guard(ctx,opts={}){
  await ctx.route(/supabase\.co/,async route=>{
    const req=route.request(),url=req.url(),m=req.method();
    if(m==="OPTIONS")return route.fulfill({status:204,headers:{"access-control-allow-origin":"*","access-control-allow-headers":"*","access-control-allow-methods":"*"}});
    opts.log&&opts.log.push(m+" "+url.replace(/^https:\/\/[^/]+/,"").slice(0,160));
    for(const f of opts.fail||[])if(f.match.test(url)){return f.status==="abort"?route.abort():json(route,{message:"mocked failure"},f.status||500);}
    for(const h of opts.hold||[])if(h.match.test(url))await new Promise(r=>setTimeout(r,h.ms));
    if(/realtime|\/auth\/v1\//.test(url))return m==="GET"&&!/auth/.test(url)?route.abort():json(route,{});
    const rpc=(url.match(/\/rpc\/([a-z_0-9]+)/)||[])[1];
    if(/player_accounts\?select=requested_name/.test(url)){
      if(opts.account==="fail")return json(route,{message:"mocked"},500);
      if(opts.account==="hold")await new Promise(r=>setTimeout(r,60000));
      return json(route,opts.account?[opts.account]:[]);
    }
    if(/player_accounts\?select=auth_user_id/.test(url))return json(route,{code:"42501",message:"permission denied"},401);
    if(rpc&&opts.rpc&&rpc in opts.rpc){const v=opts.rpc[rpc];return json(route,typeof v==="function"?v(req.postDataJSON&&req.postDataJSON()):v);}
    if(/functions\/v1\//.test(url)){const fn=opts.fn;let body={};try{body=req.postDataJSON()||{};}catch{}return json(route,fn?fn(body,url):{ok:true});}
    const auth=(req.headers().authorization||"");
    if(m!=="GET"||auth.includes(FAKE)){opts.blocked&&opts.blocked.push(m+" "+url.replace(/^https:\/\/[^/]+/,"").slice(0,140));return json(route,m==="GET"?[]:null);}
    const p=(opts.patch||[]).filter(x=>x.match.test(url));
    if(!p.length)return route.continue();
    try{const res=await route.fetch();let body=await res.json();for(const x of p)body=x.fn(body,url);return route.fulfill({response:res,body:JSON.stringify(body)});}catch(e){return route.continue().catch(()=>{});}
  });
}
async function open({w=1440,h=900,theme="dark",headless=true,session=false,opts={},storage={}}={}){
  const b=await pw.chromium.launch({channel:"chrome",headless});
  const c=await b.newContext({viewport:{width:w,height:h},locale:"ko-KR",timezoneId:"Asia/Seoul",hasTouch:w<860});
  await c.addInitScript(([t,s,st,F])=>{try{localStorage.setItem("ypl-theme",t);localStorage.setItem("ypl-accounts-ready","1");if(s)localStorage.setItem("ypl-visitor-session",JSON.stringify({access:F,refresh:"fake-refresh",until:Date.now()+36e5}));for(const k in st)localStorage.setItem(k,st[k]);}catch{}},[theme,session,storage,FAKE]);
  await guard(c,opts);
  const p=await c.newPage();
  return {b,c,p};
}
async function go(p,q,wait=1500){await p.goto(BASE+q,{waitUntil:"domcontentloaded"});await p.waitForLoadState("networkidle",{timeout:6000}).catch(()=>{});await p.waitForTimeout(wait);}
async function shot(p,id,name,o={}){const d=path.join(SHOTS,id);fs.mkdirSync(d,{recursive:true});const f=path.join(d,name+".png");await p.screenshot({path:f,...o});return f;}
// what overflows or is cut: elements whose scrollWidth exceeds clientWidth (ellipsis or spill), and elements past the viewport's right edge
const OVER=`(()=>{const vw=document.documentElement.clientWidth,out=[];for(const e of document.querySelectorAll(".ypl *")){const r=e.getBoundingClientRect();if(!r.width||!r.height)continue;const cs=getComputedStyle(e);if(e.scrollWidth>e.clientWidth+1&&e.children.length===0&&e.textContent.trim())out.push({k:cs.textOverflow==="ellipsis"?"ellipsis":cs.overflowX==="visible"?"SPILL":"clip",c:e.className.toString().slice(0,40),t:e.textContent.trim().slice(0,24),w:Math.round(e.clientWidth),sw:e.scrollWidth});else if(r.right>vw+1&&cs.position!=="fixed")out.push({k:"PAST",c:e.className.toString().slice(0,40),right:Math.round(r.right)});}return {docW:document.documentElement.scrollWidth,vw,n:out.length,out:out.slice(0,25)};})()`;
module.exports={pw,BASE,SHOTS,FAKE,guard,open,go,shot,OVER,json};
