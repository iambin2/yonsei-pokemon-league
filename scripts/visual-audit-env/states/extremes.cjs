// Data extremes (group 3, EXT-01..05) by patching real responses. node extremes.cjs <long|many|zero> [W H theme]
// Shots: docs/visual-audit/shots/EXT-<variant>-<screen>/<WxH>-<theme>.png ; measures: r/ext-out-<variant>-<W>-<theme>.json
const {open,go,shot,OVER}=require("./lib.cjs");const fs=require("fs");
const [variant,W="390",H="844",theme="dark"]=process.argv.slice(2);const w=+W,h=+H;
const KO="가나다라마바사아자차카타파하거너",EN="Abcdefghijklmnopqrstuvwx";
const LONGEV="연세대학교 포켓몬 센터 연세점 공식 파이컵 루키 리그 리전 더블배틀 특별 초청 앙코르전";
const LONGT="아주 긴 제목이 들어왔을 때 줄이 어떻게 넘어가는지 보기 위한 공지입니다 띄어쓰기없이이어지는아주긴낱말도하나넣어둡니다 그리고 한 줄 더";
const swap=j=>JSON.parse(JSON.stringify(j).replaceAll("정두호",KO).replaceAll("김현민",EN).replaceAll("파이컵 루키 리그 리전 더블배틀",LONGEV));
const firstTitles=o=>{if(Array.isArray(o)){let done=false;for(const x of o){if(x&&typeof x==="object"){if(!done&&typeof x.title==="string"){x.title=LONGT;done=true;}firstTitles(x);}}}else if(o&&typeof o==="object")for(const k in o)firstTitles(o[k]);return o;};
const longFn=(j,url)=>{j=swap(j);if(/site_data/.test(url))firstTitles(j);
  if(/community_items/.test(url)&&Array.isArray(j)&&j[0]&&j[0].payload){j[0].payload.title=LONGT;if(j[1])j[1].payload.name=KO;}
  if(/ranking_baselines|ranking_awards/.test(url)&&Array.isArray(j)&&j[0]){for(const k of ["points","points_delta"])if(typeof j[0][k]==="number")j[0][k]=1200;if("wins" in j[0])j[0].wins=120;}
  if(/rest\/v1\/matches/.test(url)&&Array.isArray(j))for(const m of j){const ks=Object.keys(m).filter(k=>/score/.test(k));if(ks.length>=2){m[ks[0]]=10;m[ks[1]]=9;}}
  return j;};
const times=(a,n,f)=>{const out=[];for(let i=0;out.length<n&&a.length;i++)out.push(f(JSON.parse(JSON.stringify(a[i%a.length])),i));return out;};
const manyFn=(j,url)=>{
  if(/site_data/.test(url)&&j[0]&&j[0].value){const v=j[0].value;for(const k in v)if(Array.isArray(v[k])&&v[k][0]&&typeof v[k][0].title==="string"&&v[k].length<100)v[k]=times(v[k],100,(x,i)=>{if(i>=v[k].length)x.id=String(x.id)+"-x"+i;return x;});}
  if(/community_items/.test(url)&&Array.isArray(j)&&j.length){const tops=j.filter(x=>!x.parent_id);return times(tops,200,(x,i)=>{x.id=x.id.slice(0,-6)+String(100000+i);return x;});}
  if(/hall_of_fame_entries/.test(url)&&Array.isArray(j)&&j.length)return times(j,20,(x,i)=>{if(i>=j.length){x.id=x.id.slice(0,-6)+String(100000+i);x.generation_number=i+1;x.generation_label=(i+1)+"대";}return x;});
  return j;};
const zeroFn=(j,url)=>{if(/site_data/.test(url)&&Array.isArray(j)&&j[0]&&j[0].value){const v=j[0].value;for(const k in v)if(Array.isArray(v[k]))v[k]=[];return j;}return Array.isArray(j)?[]:j;};
const fnOf={long:longFn,many:manyFn,zero:zeroFn}[variant];
const SCREENS={home:"/",news:"/?view=news",board:"/?view=board",records:"/?view=records","records-rank":"/?view=records&tab=rank","records-event":"/?view=records&tab=event",sheet:"/?view=records&trainer="+encodeURIComponent(variant==="long"?KO:"정두호"),"sheet-en":"/?view=records&trainer="+(variant==="long"?EN:encodeURIComponent("김현민")),bracket:"/?view=bracket",champions:"/?view=champions",titles:"/?view=titles"};
(async()=>{const out={};const tag=`${w}x${h}-${theme}`;
  const {b,p}=await open({w,h,theme,opts:{patch:[{match:/rest\/v1/,fn:fnOf}],rpc:{push_inbox:[],handover_features_ready:true}}});
  for(const [key,q] of Object.entries(SCREENS)){try{await go(p,q,1800);await shot(p,`EXT-${variant}-${key}`,tag,{fullPage:variant!=="many"});
    const o=await p.evaluate(OVER);o.docH=await p.evaluate("document.documentElement.scrollHeight");
    o.out=o.out.filter(x=>!(x.k==="SPILL"&&x.sw-x.w===12));
    o.long=await p.evaluate(([KO,EN,T,EV])=>[...document.querySelectorAll(".ypl *")].filter(e=>e.children.length===0&&[KO,EN,T.slice(0,12),EV.slice(0,10)].some(s=>e.textContent.includes(s))).slice(0,8).map(e=>{const r=e.getBoundingClientRect(),c=getComputedStyle(e),pr=e.parentElement.getBoundingClientRect();return {c:(e.className||e.tagName).toString().slice(0,28),t:e.textContent.trim().slice(0,10),x:Math.round(r.x),w:Math.round(r.width),h:Math.round(r.height),lh:c.lineHeight,sw:e.scrollWidth,cw:e.clientWidth,ws:c.whiteSpace,to:c.textOverflow,pastParent:Math.round(r.right-pr.right)}}),[KO,EN,LONGT,LONGEV]);
    out[key]=o;}catch(e){out[key+"/ERR"]=String(e).slice(0,200);}}
  await b.close();fs.writeFileSync(__dirname+`/ext-out-${variant}-${w}-${theme}.json`,JSON.stringify(out,null,1));
})();
