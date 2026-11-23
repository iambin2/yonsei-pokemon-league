// Account states (group 1). node account.cjs [state ...]   states: none pending rejected approved checking long linesfail
// Shots: docs/visual-audit/shots/U-ACCT-<screen>/<state>-<WxH>-<theme>.png ; measures: r/account-out.json
const {open,go,shot,OVER}=require("./lib.cjs");const fs=require("fs");
const REAL="이제빈", OTHER="다른이름요청";
const fn=(body)=>({ok:true,rows:[{name:REAL,wins:12,place:3,mine:true,best:12}],row:null,runs:[],board:[],battles:[]});
const STATES={
  none:{account:null},
  pending:{account:{requested_name:OTHER,status:"pending",player_id:null,email:"visitor.account@gmail.com"}},
  rejected:{account:{requested_name:OTHER,status:"rejected",player_id:null,email:"visitor.account@gmail.com"}},
  approved:{account:pid=>({requested_name:REAL,status:"approved",player_id:pid,email:"visitor.account@gmail.com"})},
  checking:{account:"hold"},
  long:{account:pid=>({requested_name:"가나다라마바사아자차카타파하거너",status:"approved",player_id:pid,email:"averyveryverylongaddress.of.someone@students.yonsei.ac.kr"})},
  linesfail:{account:pid=>({requested_name:REAL,status:"approved",player_id:pid,email:"visitor.account@gmail.com"}),fail:[{match:/account_teams|my_battles/,status:500}],fnFail:true},
};
const VPS=[[390,844,"dark"],[390,844,"light"],[1440,900,"dark"],[1440,900,"light"]];
(async()=>{
  const want=process.argv.slice(2).length?process.argv.slice(2):Object.keys(STATES);
  // the real player id of REAL, read once
  let pid=null;{const {b,p}=await open();p.on("response",async r=>{if(/rest\/v1\/players\?/.test(r.url())){try{const j=await r.json();pid=(j.find(x=>x.display_name===REAL)||j[0]).id;}catch{}}});await go(p,"/?view=records",1500);await b.close();}
  const out={pid};
  for(const st of want){const S=STATES[st];const account=typeof S.account==="function"?S.account(pid):S.account;
    for(const [w,h,theme] of VPS){const tag=`${st}-${w}x${h}-${theme}`;const blocked=[];
      const {b,p}=await open({w,h,theme,session:true,opts:{account,fail:S.fail,blocked,fn:S.fnFail?()=>{throw 0}:fn,rpc:{push_inbox:[],handover_features_ready:true,request_player_link:{ok:true}}}});
      const m=async(id,full=false)=>{out[id+"/"+tag]=await p.evaluate(OVER).catch(e=>String(e));await shot(p,"U-ACCT-"+id,tag,{fullPage:full});};
      try{
        await go(p,"/",1200);await shot(p,"U-ACCT-topbar",tag,{clip:{x:0,y:0,width:w,height:w<860?844:96}});
        out["topbar/"+tag]=await p.evaluate(()=>[...document.querySelectorAll("header button,header a,nav button,nav a")].filter(e=>/계정|내 기록|이제빈|가나다|다른이름|로그인/.test(e.textContent+e.getAttribute("aria-label"))).map(e=>{const r=e.getBoundingClientRect();return {t:e.textContent.trim().slice(0,30),a:e.getAttribute("aria-label"),x:Math.round(r.x),w:Math.round(r.width),h:Math.round(r.height),sw:e.scrollWidth,cls:e.className}}));
        await go(p,"/?view=records&tab=trainer&me=1",1500);await m("find");
        if(st==="none"||st==="rejected"){const inp=p.locator("input[type=search],input[type=text]").first();if(await inp.count()){await inp.fill("새트레이너이름");await p.waitForTimeout(700);await m("find-newname");}}
        await go(p,"/?view=records&tab=trainer&me=1&trainer="+encodeURIComponent(st==="long"?REAL:REAL),1800);await m("sheet-find");
        out["sheet-find-claim/"+tag]=await p.evaluate(()=>[...document.querySelectorAll(".rc-claim *, .rc-more *, .rc-find *")].filter(e=>e.children.length===0||e.tagName==="BUTTON").map(e=>{const r=e.getBoundingClientRect();return {c:e.className.toString().slice(0,30),t:e.textContent.trim().slice(0,30),x:Math.round(r.x),y:Math.round(r.y),w:Math.round(r.width),h:Math.round(r.height)}}).slice(0,20));
        if(st==="approved"){await go(p,"/?view=records&trainer="+encodeURIComponent(REAL),1800);await m("sheet-mine");await go(p,"/?view=records&tab=trainer",1500);await m("list-me-tag");}
        await go(p,"/?view=more",1500);await m("more",true);
        await go(p,"/?view=alerts",1500);await m("alerts",true);
        await go(p,"/?view=board",1500);const wr=p.getByRole("button",{name:/글쓰기|쓰기|새 글/}).first();if(await wr.count()){await wr.click().catch(()=>{});await p.waitForTimeout(900);await m("board-write");}
        await go(p,"/?view=builder",2000);await m("builder");
        await go(p,"/?view=battle&tab=mine",2000);await m("battle-mine");
        await go(p,"/?view=battle&tab=streak",2500);await m("streak-tab");
        const st1=p.getByRole("button",{name:/도전|시작|오르기/}).first();if(await st1.count()){await st1.click().catch(()=>{});await p.waitForTimeout(900);out["gate-title/"+tag]=await p.evaluate(()=>document.querySelector("[role=dialog]")?.textContent.slice(0,120)||null);await m("tower-gate");}
      }catch(e){out["ERR/"+tag]=String(e).slice(0,200);}
      out["blocked/"+tag]=[...new Set(blocked)].slice(0,12);
      await b.close();
    }
    fs.writeFileSync(__dirname+"/account-out-"+st+".json",JSON.stringify(out,null,1));
  }
})();
