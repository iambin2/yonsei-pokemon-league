// Which docs/db files the live database runs, function by function. Prints one read-only query; paste it into the Supabase SQL
// editor (or the read-only MCP) and each row is a file with how many of its functions live as the file has them.
//   node scripts/db-ledger.mjs > ledger.sql
// A function counts as the file's when its body, whitespace ignored, is the live body. "→ other.sql" means a later file replaced it
// (expected); "≠" means the live body is in no file at all: someone changed it on the database, and docs/db no longer describes it.
// First run 2026-11-22: docs/db/README.md holds the result, and live_drift_2026_11_22.sql brought the seven "≠" functions home.
import { readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";

const dir = new URL("../docs/db/", import.meta.url);
const md5 = s => createHash("md5").update(s.replace(/\s+/g, "")).digest("hex");
const rows = [];
for (const f of readdirSync(dir).filter(f => f.endsWith(".sql")).sort()) {
  const sql = readFileSync(new URL(f, dir), "utf8");
  for (const m of sql.matchAll(/create\s+(?:or\s+replace\s+)?function\s+([\w."]+)\s*\(/gi)) {
    const rest = sql.slice(m.index), q = /\bas\s+(\$\w*\$)/i.exec(rest);
    if (!q) continue;
    const start = q.index + q[0].length, name = m[1].replace(/"/g, "");
    rows.push([f, name.includes(".") ? name : `public.${name}`, md5(rest.slice(start, rest.indexOf(q[1], start)))]);
  }
}
const live = `select s.nspname||'.'||p.proname n, md5(regexp_replace(p.prosrc, '[[:space:]]+', '', 'g')) h from pg_proc p join pg_namespace s on s.oid = p.pronamespace`;
console.log(`with x(f, n, h) as (values
${rows.map(r => `  ('${r.join("', '")}')`).join(",\n")}),
live as (${live})
select x.f file, count(*) functions,
  count(*) filter (where exists (select 1 from live where live.n = x.n and live.h = x.h)) as live_as_file,
  string_agg(case when not exists (select 1 from live where live.n = x.n and live.h = x.h) then split_part(x.n, '.', 2) ||
    coalesce(' → ' || (select min(y.f) from x y where y.n = x.n and y.f <> x.f and exists (select 1 from live where live.n = y.n and live.h = y.h)),
             case when exists (select 1 from live where live.n = x.n) then ' ≠' else ' (none)' end) end, ', ') as not_from_this_file
from x group by x.f order by x.f;`);
