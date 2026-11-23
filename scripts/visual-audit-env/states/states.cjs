// Loading / error / empty states (group 2). node states.cjs <W> <H> <theme> [pageKey ...]
// Shots: docs/visual-audit/shots/U-LOAD-<page>/<mode>-<WxH>-<theme>.png ; measures: r/states-out-<W>-<theme>.json
// modes: hold (every Supabase GET held 3 s; shot at 300 ms, 1500 ms and after arrival, with layout shifts recorded), fail (500), empty ([]).
const {open,go,shot,OVER,BASE}=require("./lib.cjs");const fs=require("fs");
const [W,H,theme,...only]=process.argv.slice(2);const w=+W,h=+H;
const PAGES={home:"/",news:"/?view=news","news-missing":"/?view=news&notice=no-such-notice",board:"/?view=board",records:"/?view=records","records-sheet":"/?view=records&trainer="+encodeURIComponent("이제빈"),bracket:"/?view=bracket",titles:"/?view=titles",champions:"/?view=champions",calc:"/?view=calc",builder:"/?view=builder",alerts:"/?view=alerts"};
const CLS=`window.__ls=[];new PerformanceObserver(l=>{for(const e of l.getEntries())if(!e.hadRecentInput)window.__ls.push({v:+e.value.toFixed(4),t:Math.round(e.startTime),s:(e.sources||[]).slice(0,3).map(s=>({n:s.node&&(s.node.className||s.node.nodeName).toString().slice(0,40),from:[Math.round(s.previousRect.y),Math.round(s.previousRect.height)],to:[Math.round(s.currentRect.y),Math.round(s.currentRect.height)]}))});}).observe({type:"layout-shift",buffered:true});`;
const MARKS=`(()=>{const q=s=>{const e=document.querySelector(s);if(!e)return null;const r=e.getBoundingClientRect();return [Math.round(r.y+scrollY),Math.round(r.height)]};return {h1:q("main h1"),main:q("main"),footer:q("footer"),docH:document.documentElement.scrollHeight,busy:document.querySelectorAll(".busy,[class*=busy],[class*=loader]").length,text:(document.querySelector("main")?.innerText||"").replace(/\s+/g," ").slice(0,220)}})()`;
const emptyAll=(j,url)=>{if(/site_data/.test(url)&&Array.isArray(j)&&j[0]&&j[0].value&&typeof j[0].value==="object"){const v=j[0].value;for(const k in v)if(Array.isArray(v[k]))v[k]=[];return j;}return Array.isArray(j)?[]:j;};
(async()=>{const out={};
  for(const [key,q] of Object.entries(PAGES)){if(only.length&&!only.includes(key))continue;const tag=`${w}x${h}-${theme}`;
    for(const mode of (process.env.MODES||"hold,fail,empty").split(",")){const SFX=process.env.PART||""; /* PART=q: site_data is let through, so each page's own loading state shows */
      const local=/calc|builder/.test(key);
      const opts=mode==="hold"?{hold:[{match:process.env.PART?/rest\/v1\/(?!site_data)|functions/:/rest\/v1|functions/,ms:3000}]}:mode==="fail"?{fail:[{match:/rest\/v1\/(?!player_accounts)|functions/,status:500}]}:{patch:[{match:/rest\/v1/,fn:emptyAll}],rpc:{push_inbox:[],handover_features_ready:true}};
      const {b,c,p}=await open({w,h,theme,opts});await c.addInitScript(CLS);
      if(local)await p.route(/champions-data\.json/,async r=>{if(mode==="hold"){await new Promise(x=>setTimeout(x,3000));return r.continue();}if(mode==="fail")return r.fulfill({status:500,body:"x"});return r.continue();});
      try{
        if(mode==="hold"){
          await p.goto(BASE+q,{waitUntil:"commit"});const t0=Date.now();
          await p.waitForTimeout(300);await shot(p,"U-LOAD-"+key,"hold300"+SFX+"-"+tag);const a=await p.evaluate(MARKS).catch(()=>null);
          await p.waitForTimeout(Math.max(0,1500-(Date.now()-t0)));await shot(p,"U-LOAD-"+key,"hold1500"+SFX+"-"+tag);const m1=await p.evaluate(MARKS).catch(()=>null);
          await p.waitForLoadState("networkidle",{timeout:15000}).catch(()=>{});await p.waitForTimeout(2500);await shot(p,"U-LOAD-"+key,"arrived"+SFX+"-"+tag);
          out[key+"/hold"+SFX]={at300:a,at1500:m1,arrived:await p.evaluate(MARKS),shifts:await p.evaluate("window.__ls")};
        }else{await go(p,q,2500);await shot(p,"U-LOAD-"+key,mode+"-"+tag,{fullPage:true});out[key+"/"+mode]={marks:await p.evaluate(MARKS),over:await p.evaluate(OVER),err:await p.evaluate(()=>[...document.querySelectorAll("[role=alert],.err-note,[class*=error],[class*=empty]")].map(e=>{const r=e.getBoundingClientRect();return {c:e.className.toString().slice(0,40),t:e.textContent.trim().slice(0,60),x:Math.round(r.x),y:Math.round(r.y),w:Math.round(r.width),h:Math.round(r.height)}}).slice(0,8))};}
      }catch(e){out[key+"/"+mode+"/ERR"]=String(e).slice(0,200);}
      await b.close();
    }
    fs.writeFileSync(__dirname+`/states-out-${w}-${theme}${process.env.PART?"-"+process.env.PART:""}.json`,JSON.stringify(out,null,1));
  }
})();
