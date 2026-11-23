// Stand-in for Supabase on :54321 for the ypl-dev-battle dev server: PGlite with the real SQL (as scripts/verify-streak-function.mjs
// builds it), the real battle function, a small PostgREST (rpc passthrough, plain selects), a fake auth refresh.
//   node server.mjs <repo root>
import http from "node:http";
import { readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { randomUUID } from "node:crypto";
const ROOT = pathToFileURL(resolve(process.argv[2])).href + "/";
const file = p => new URL(p, ROOT);
const { transform } = await import(file("node_modules/esbuild/lib/main.js").href);
const { PGlite } = await import("@electric-sql/pglite");

const pg = new PGlite();
const verify = readFileSync(file("scripts/verify-streak-db.mjs"), "utf8").replace(/\r\n/g, "\n");
await pg.exec(verify.slice(verify.indexOf("  create role anon;"), verify.indexOf("`);\nconst timer")));
const timer = readFileSync(file("docs/db/battle_timer.sql"), "utf8");
await pg.exec(timer.slice(timer.indexOf("alter table public.battles add column if not exists deadline_at")).replace(/^update public\.battles[^;]*;/m, ""));
const battles = readFileSync(file("docs/db/battles.sql"), "utf8");
await pg.exec(battles.slice(battles.indexOf("create or replace function public.battle_save"), battles.indexOf("revoke all on function public.battle_create")));
await pg.exec(readFileSync(file("docs/db/streak_runs.sql"), "utf8"));
const links = readFileSync(file("docs/db/battle_links.sql"), "utf8").replace(/\r\n/g, "\n");
await pg.exec(links.slice(links.indexOf("create or replace function public.battle_set_seat"), links.indexOf("-- 6. ")));
const USER = "11111111-1111-4111-8111-111111111111";
await pg.query("insert into auth.users values ($1)", [USER]);
await pg.query("insert into public.player_accounts values ($1, '이제빈', 'approved')", [USER]);
await pg.exec("alter table public.player_accounts add column if not exists player_id uuid, add column if not exists email text");
await pg.query("update public.player_accounts set player_id = $2, email = 'test@local' where auth_user_id = $1", [USER, randomUUID()]);

const JSONB = new Set(["p_p1_team", "p_state", "p_pending", "p_memory"]);
const fnRpc = async (name, args) => {
  const keys = Object.keys(args || {});
  const call = `public.${name}(${keys.map((k, i) => `${k} => $${i + 1}${JSONB.has(k) || (args[k] && typeof args[k] === "object") ? "::jsonb" : ""}`).join(", ")})`;
  // a set-returning function answers a list, as PostgREST does
  const set = (await pg.query("select bool_or(proretset) as s from pg_proc where proname = $1", [name])).rows[0]?.s;
  const sql = set ? `select coalesce(json_agg(x), '[]'::json) as r from ${call} x` : `select ${call} as r`;
  try {
    const rows = (await pg.query(sql, keys.map(k => (args[k] != null && (JSONB.has(k) || typeof args[k] === "object") ? JSON.stringify(args[k]) : args[k])))).rows;
    return { data: rows[0]?.r ?? null, error: null };
  } catch (e) { return { data: null, error: { code: e.code, message: e.message } }; }
};
const db = {
  rpc: fnRpc,
  from(table) {
    let columns = "*", id = null;
    const chain = {
      select(c) { columns = c; return chain; }, eq(_c, v) { id = v; return chain; },
      async maybeSingle() {
        const row = (await pg.query(`select * from public.${table} where id = $1`, [id])).rows[0];
        if (!row) return { data: null, error: null };
        if (columns.includes("battle_secrets(*)")) row.battle_secrets = (await pg.query("select * from public.battle_secrets where battle_id = $1", [id])).rows[0];
        for (const k of ["created_at", "updated_at", "deadline_at"]) if (row[k] instanceof Date) row[k] = row[k].toISOString();
        return { data: row, error: null };
      },
    };
    return chain;
  },
  auth: { async getClaims(jwt) { return jwt === USER ? { data: { claims: { role: "authenticated", sub: jwt } }, error: null } : { data: null, error: { message: "no user" } }; }, async getUser(jwt) { return jwt === USER ? { data: { user: { id: jwt } }, error: null } : { data: { user: null }, error: { message: "no user" } }; } },
};
globalThis.__db = db;
let handler;
globalThis.Deno = { env: { get: k => ({ SUPABASE_URL: "http://local", SUPABASE_SERVICE_ROLE_KEY: "service" })[k] }, serve: h => { handler = h; } };
const realFetch = globalThis.fetch;
globalThis.fetch = async () => new Response("{}");
const source = readFileSync(file("supabase/functions/battle/index.ts"), "utf8")
  .replace('import { createClient } from "npm:@supabase/supabase-js@2";', "const createClient = () => globalThis.__db;")
  .replace('import postgres from "npm:postgres@3.4.5";', "const postgres = () => null;")
  .replace('from "./engine.bundle.mjs"', `from "${file("supabase/functions/battle/engine.bundle.mjs").href}"`);
const { code } = await transform(source, { loader: "ts", format: "esm" });
const built = join(tmpdir(), `battle-function-harness-${process.pid}.mjs`);
writeFileSync(built, code);
await import(pathToFileURL(built).href);

// ---- a small PostgREST
const tableExists = async t => (await pg.query("select to_regclass($1) as r", [`public.${t}`])).rows[0].r != null;
async function select(table, params, single) {
  if (!(await tableExists(table))) return [404, { code: "42P01", message: `relation ${table} does not exist` }];
  const sel = (params.get("select") || "*").split(",").filter(c => !c.includes("(")).map(c => c.trim()).filter(Boolean);
  const where = [], vals = [];
  for (const [k, v] of params) {
    if (["select", "order", "limit", "offset"].includes(k)) continue;
    const m = /^(eq|neq|gt|gte|lt|lte|is|in)\.(.*)$/.exec(v); if (!m) continue;
    if (m[1] === "is") { where.push(`${k} is ${m[2] === "null" ? "null" : m[2]}`); continue; }
    if (m[1] === "in") { const list = m[2].replace(/^\(|\)$/g, "").split(","); where.push(`${k}::text = any($${vals.length + 1})`); vals.push(list); continue; }
    const op = { eq: "=", neq: "<>", gt: ">", gte: ">=", lt: "<", lte: "<=" }[m[1]];
    where.push(`${k}::text ${op} $${vals.length + 1}`); vals.push(m[2]);
  }
  const order = params.get("order") ? " order by " + params.get("order").split(",").map(o => { const [c, d] = o.split("."); return `${c} ${d === "desc" ? "desc" : "asc"}`; }).join(", ") : "";
  const limit = params.get("limit") ? ` limit ${Number(params.get("limit"))}` : "";
  try {
    const rows = (await pg.query(`select ${sel.join(", ") || "*"} from public.${table}${where.length ? " where " + where.join(" and ") : ""}${order}${limit}`, vals)).rows;
    for (const r of rows) for (const k in r) if (r[k] instanceof Date) r[k] = r[k].toISOString();
    if (single) return rows.length ? [200, rows[0]] : [406, { code: "PGRST116", message: "no rows" }];
    return [200, rows];
  } catch (e) { return [400, { code: e.code, message: e.message }]; }
}

const send = (res, status, body) => {
  res.writeHead(status, { "content-type": "application/json", "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*", "access-control-expose-headers": "*" });
  res.end(body === undefined ? "" : JSON.stringify(body));
};
const readBody = req => new Promise(r => { let s = ""; req.on("data", d => (s += d)); req.on("end", () => r(s)); });
http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") return send(res, 204);
  const url = new URL(req.url, "http://x"), body = await readBody(req);
  try {
    if (url.pathname === "/functions/v1/battle") {
      const out = await handler(new Request("http://local/battle", { method: "POST", headers: { authorization: req.headers.authorization || "" }, body }));
      const text = await out.text();
      res.writeHead(out.status, { "content-type": "application/json", "access-control-allow-origin": "*", "access-control-allow-headers": "*" });
      return res.end(text);
    }
    // the harness's own: weaken the computer's party of a battle (its Pokémon at 1 HP, no ability), or make ours so
    if (url.pathname === "/harness/weak") {
      const id = url.searchParams.get("id"), side = Number(url.searchParams.get("side") ?? 1);
      const { state } = (await pg.query("select state from public.battle_secrets where battle_id = $1", [id])).rows[0];
      for (const p of state.sides[side].pokemon) { p.hp = Math.min(p.hp, 1); p.ability = p.baseAbility = "noability"; }
      await pg.query("update public.battle_secrets set state = $2::jsonb where battle_id = $1", [id, JSON.stringify(state)]);
      return send(res, 200, { ok: true });
    }
    if (url.pathname.startsWith("/auth/v1/token")) return send(res, 200, { access_token: USER, refresh_token: "r", expires_in: 360000 });
    if (url.pathname.startsWith("/rest/v1/rpc/")) {
      const { data, error } = await fnRpc(url.pathname.slice(13), body ? JSON.parse(body) : {});
      return error ? send(res, 400, error) : send(res, 200, data);
    }
    if (url.pathname.startsWith("/rest/v1/") && req.method === "GET") {
      const [status, out] = await select(url.pathname.slice(9), url.searchParams, String(req.headers.accept || "").includes("vnd.pgrst.object"));
      return send(res, status, out);
    }
    if (url.pathname.startsWith("/rest/v1/")) return send(res, 400, { message: "harness: writes refused" });
    return send(res, 200, []);
  } catch (e) { console.log("ERR", req.method, url.pathname, e.message); return send(res, 500, { error: e.message }); }
}).listen(54321, () => console.log("harness on 54321, user", USER));
