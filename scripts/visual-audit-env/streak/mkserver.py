# writes standin/server.mjs from standin/server-base.mjs: PGlite taken from the repo root's node_modules, more of docs/db run, a raw SQL door
import os
here = os.path.dirname(os.path.abspath(__file__))
s = open(os.path.join(here, "..", "standin", "server-base.mjs"), encoding="utf8").read()
s = s.replace('const { PGlite } = await import("@electric-sql/pglite");',
              'const { PGlite } = await import(file("node_modules/@electric-sql/pglite/dist/index.js").href);')
extra = '''
// ---- letter p: what the screens under audit also read (rooms, rematch, records, tower history, cups); a file that fails is named, not fatal
await pg.exec(`create table if not exists public.push_outbox (id bigint generated always as identity primary key, dedup text not null unique, kind text not null,
  auth_user_id uuid, title text not null, body text not null, url text not null, created_at timestamptz not null default now(), taken_at timestamptz);`);
for (const f of (process.env.EXTRA || "battle_rooms,battle_rematch,cpu_battles,tower_history,tower_cups").split(",")) {
  try { await pg.exec(readFileSync(file("docs/db/" + f + ".sql"), "utf8")); console.log("sql ok", f); } catch (e) { console.log("sql FAILED", f, e.message.slice(0, 200)); await pg.exec("rollback").catch(() => {}); }
}
'''
s = s.replace('const USER = "11111111', extra + '\nconst USER = "11111111', 1)
s = s.replace('if (url.pathname.startsWith("/auth/v1/token"))',
              'if (url.pathname === "/harness/sql") { try { return send(res, 200, (await pg.query(body)).rows); } catch (e) { return send(res, 400, { message: e.message }); } }\n    if (url.pathname.startsWith("/auth/v1/token"))')
open(os.path.join(here, "server.mjs"), "w", encoding="utf8").write(s)
