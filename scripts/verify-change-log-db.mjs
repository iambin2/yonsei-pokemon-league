// Disposable PostgreSQL check of docs/db/change_log.sql. Never connects to Supabase.
//   node scripts/verify-change-log-db.mjs [<path-to-pglite-dist/index.js>]
// A few of the logged tables are built in their live shape's essentials, change_log.sql runs twice, then writes as an operator, the
// battle function and a visitor are read back from the log.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { randomUUID } from "node:crypto";

const { PGlite } = await import(process.argv[2] ? pathToFileURL(resolve(process.argv[2])).href : "@electric-sql/pglite");
const pg = new PGlite();
const q = async (query, params = []) => (await pg.query(query, params)).rows;
const one = async (query, params) => (await q(query, params))[0];
let checks = 0;
async function check(name, run) { await pg.exec("reset role"); await run(); checks++; console.log(`PASS ${name}`); }
const as = async (role, claims = {}) => {
  await pg.exec(`reset role; set role ${role}`);
  await q("select set_config('request.jwt.claims', $1, false)", [JSON.stringify({ role, ...claims })]);
};

await pg.exec(`
  create role anon; create role authenticated; create role service_role bypassrls;
  create schema auth;
  create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}') $$;
  grant usage on schema auth to anon, authenticated, service_role;
  grant execute on all functions in schema auth to anon, authenticated, service_role;
  create schema ypl_schema_validation;
  grant usage on schema ypl_schema_validation to anon, authenticated, service_role;
  create function ypl_schema_validation.is_ypl_admin() returns boolean language sql stable set search_path = '' as $$
    select coalesce((auth.jwt() -> 'app_metadata' ->> 'ypl_admin')::boolean, false) $$;
  grant execute on function ypl_schema_validation.is_ypl_admin() to anon, authenticated;
  create table ypl_schema_validation.matches (id uuid primary key, winner_entry_id uuid, played_at timestamptz, updated_at timestamptz default now());
  create table public.site_data (key text primary key, value jsonb not null, revision bigint not null default 0, updated_at timestamptz default now());
  grant all on ypl_schema_validation.matches, public.site_data to anon, authenticated, service_role;
`);
const sql = readFileSync("docs/db/change_log.sql", "utf8");
await pg.exec(sql);
await pg.exec(sql);

const ADMIN = { sub: randomUUID(), email: "yplofficial@ypl.invalid", app_metadata: { ypl_admin: true } };
const log = () => q("select actor_email, actor_role, table_name, op, row_id, old, new from ypl_audit.change_log order by id");

try {
  const match = randomUUID(), [a, b] = [randomUUID(), randomUUID()];
  await check("a winner entered, corrected and the match deleted are three rows, each with who and what it was", async () => {
    await as("authenticated", ADMIN);
    await q("insert into ypl_schema_validation.matches (id) values ($1)", [match]);
    await q("update ypl_schema_validation.matches set winner_entry_id = $2, played_at = now(), updated_at = now() where id = $1", [match, a]);
    await q("update ypl_schema_validation.matches set winner_entry_id = $2, updated_at = now() where id = $1", [match, b]);
    await as("service_role");
    await q("delete from ypl_schema_validation.matches where id = $1", [match]);
    await pg.exec("reset role");
    const rows = await log();
    assert.deepEqual(rows.map(r => r.op), ["INSERT", "UPDATE", "UPDATE", "DELETE"]);
    assert.equal(rows[1].actor_email, ADMIN.email);
    assert.equal(rows[1].actor_role, "authenticated");
    assert.equal(rows[2].old.winner_entry_id, a, "the correction keeps the winner it replaced");
    assert.equal(rows[2].new.winner_entry_id, b);
    assert.ok(!("updated_at" in rows[2].old), "only what changed");
    assert.equal(rows[3].old.winner_entry_id, b, "a deleted match keeps its last state");
    assert.equal(rows[3].actor_role, "service_role");
    assert.ok(rows.every(r => r.row_id === match));
  });

  await check("a site_data save keeps only the changed parts' old values, and a save that changes nothing is not logged", async () => {
    await pg.exec("delete from ypl_audit.change_log");
    await q("insert into public.site_data (key, value) values ('ypl_data_v4', $1)", [{ announcements: [{ id: 1 }, { id: 2 }], titleGroups: [{ t: 1 }] }]);
    await as("authenticated", ADMIN);
    await q("update public.site_data set value = $1, revision = revision + 1 where key = 'ypl_data_v4'", [{ announcements: [{ id: 2 }], titleGroups: [{ t: 1 }] }]);
    await q("update public.site_data set revision = revision + 1 where key = 'ypl_data_v4'");
    await pg.exec("reset role");
    const rows = (await log()).filter(r => r.op === "UPDATE");
    assert.equal(rows.length, 1);
    assert.deepEqual(rows[0].old, { announcements: [{ id: 1 }, { id: 2 }] }, "the deleted notice can be found again");
    assert.deepEqual(rows[0].new, { changed: ["announcements"] });
    assert.equal(rows[0].row_id, "ypl_data_v4");
  });

  await check("only an operator reads the log", async () => {
    await as("authenticated", ADMIN);
    assert.ok((await q("select * from public.admin_change_log(10)")).length > 0);
    assert.equal((await q("select * from public.admin_change_log(10, null, 'matches')")).length, 0, "filtered by table, after the delete above");
    await as("authenticated", { sub: randomUUID(), email: "visitor@gmail.com" });
    await assert.rejects(q("select * from public.admin_change_log(10)"), /운영자만/);
    await assert.rejects(q("select * from ypl_audit.change_log"), /permission denied/);
    await as("anon");
    await assert.rejects(q("select * from public.admin_change_log(10)"), /permission denied|운영자만/);
  });
  console.log(`\n${checks} checks passed`);
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}
