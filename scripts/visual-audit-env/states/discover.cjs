// lists every Supabase request the public pages make (non-GET are mocked), and prints real names to use
const {open,go}=require("./lib.cjs");
(async()=>{const log=[];const {b,p}=await open({opts:{log}});
for(const v of ["","?view=news","?view=board","?view=records","?view=brackets","?view=titles","?view=champions","?view=more","?view=alerts","?view=battle","?view=builder","?view=calc"]){log.push("== "+v);await go(p,"/"+v,800);}
console.log([...new Set(log)].join("\n"));
await go(p,"/?view=records",1500);
console.log(await p.evaluate(()=>[...document.querySelectorAll("button,a")].map(e=>e.textContent.trim()).filter(t=>t&&t.length<40).slice(0,60).join(" | ")));
await b.close();})();
