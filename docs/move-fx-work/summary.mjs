// match.tsv를 타입별로 센다: node summary.mjs
import { readFileSync } from "node:fs";
const rows = readFileSync(new URL("match.tsv", import.meta.url), "utf8").trim().split(/\r?\n/).slice(1).map(l => l.split("\t"));
const K = ["lead", "charge", "travel", "residue", "flash", "flash-size", "flash-extra", "area"], by = {};
for (const r of rows) {
  const b = by[r[2]] ||= { n: 0, pass: 0, noref: 0, err: 0, ...Object.fromEntries(K.map(k => [k, 0])) };
  if (r[4] === "no-ref") { b.noref++; continue; }
  if (r[4] === "error") { b.err++; continue; }
  b.n++; if (r[3] === "pass") b.pass++;
  const f = new Set(r[4].split(",")); for (const k of K) if (f.has(k)) b[k]++;
}
const T = {};
console.log("type      n pass noref err | fails: " + K.join(" "));
for (const [t, b] of Object.entries(by)) { console.log(t.padEnd(9), b.n, b.pass, b.noref, b.err, "|", K.map(k => b[k]).join(" ")); for (const k in b) T[k] = (T[k] || 0) + b[k]; }
console.log("TOTAL    ", T.n, T.pass, T.noref, T.err, "|", K.map(k => T[k]).join(" "));
