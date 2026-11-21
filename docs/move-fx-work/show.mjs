// match.tsv를 읽기 쉽게 찍는다: node show.mjs [type]
import { readFileSync } from "node:fs";
const rows = readFileSync(new URL("match.tsv", import.meta.url), "utf8").trim().split(/\r?\n/).slice(1).map(l => l.split("\t"));
const f = o => o.phases.map(p => `${p.name[0]}:${p.start}..${p.end}`).join(" ") + ` | flash ${o.flash ? `${o.flash.end - o.flash.start}ms ${o.flash.peak.toFixed(2)}` : "-"} | area ${o.typePeak.toFixed(2)} | end ${o.residueEnd}`;
for (const r of rows) {
  if (process.argv[2] && r[2] !== process.argv[2]) continue;
  console.log(`${r[3] || "----"} ${r[1]} [${r[4]}]`);
  if (r[5]) { console.log("  ref ", f(JSON.parse(r[5]))); console.log("  ours", f(JSON.parse(r[6]))); }
}
