// Disposable PostgreSQL check of docs/db/account_self.sql. Never connects to Supabase.
//   node scripts/verify-account-self-db.mjs [<path-to-pglite-dist/index.js>]
// The account tables are built with the live foreign keys (player_accounts, account_teams, streak_runs cascade; battles set null),
// account_self.sql runs twice, then a visitor unlinks, deletes their account, and an operator unlinks someone else.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { randomUUID } from "node:crypto";

const { PGlite } = await import(process.argv[2] ? pathToFileURL(resolve(process.argv[2])).href : "@electric-sql/pglite");
const pg = new PGlite();
const q = async (query, params = []) => (await pg.query(query, params)).rows;
let checks = 0;
async function check(name, run) { await pg.exec("reset role"); await run(); checks++; console.log(`PASS ${name}`); }
const as = async (role, claims = {}) => {
  await pg.exec(`reset role; set role ${role}`);
  await q("select set_config('request.jwt.claims', $1, false)", [JSON.stringify({ role, ...claims })]);
};

await pg.exec(`
  create role anon; create role authenticated; create role service_role bypassrls;
  create schema auth;
  create table auth.users (id uuid primary key);
  create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}') $$;
  create function auth.uid() returns uuid language sql stable as $$ select nullif(auth.jwt() ->> 'sub', '')::uuid $$;
  grant usage on schema auth to anon, authenticated;
  grant execute on all functions in schema auth to anon, authenticated;
  create schema ypl_schema_validation;
  grant usage on schema ypl_schema_validation to anon, authenticated;
  create function ypl_schema_validation.is_ypl_admin() returns boolean language sql stable set search_path = '' as $$
    select coalesce((auth.jwt() -> 'app_metadata' ->> 'ypl_admin')::boolean, false) $$;
  grant execute on function ypl_schema_validation.is_ypl_admin() to anon, authenticated;
  create table public.player_accounts (auth_user_id uuid primary key references auth.users (id) on delete cascade, requested_name text not null, status text not null);
  create table public.account_teams (auth_user_id uuid not null references auth.users (id) on delete cascade, id text not null, primary key (auth_user_id, id));
  create table public.streak_runs (id uuid primary key default gen_random_uuid(), auth_user_id uuid not null references auth.users (id) on delete cascade, wins integer not null);
  create table public.battles (id text primary key, p1_name text not null, p1_auth_user_id uuid references auth.users (id) on delete set null);
`);
const sql = readFileSync("docs/db/account_self.sql", "utf8");
await pg.exec(sql);
await pg.exec(sql);

const [a, b, admin] = [randomUUID(), randomUUID(), randomUUID()];
for (const id of [a, b, admin]) await q("insert into auth.users values ($1)", [id]);
await q("insert into public.player_accounts values ($1, '이제빈', 'approved'), ($2, '김선수', 'approved')", [a, b]);
await q("insert into public.account_teams values ($1, 't1')", [a]);
await q("insert into public.streak_runs (auth_user_id, wins) values ($1, 5)", [a]);
await q("insert into public.battles values ('b1', '이제빈', $1)", [a]);

try {
  await check("a visitor unlinks their own record only, and keeps their account", async () => {
    await as("authenticated", { sub: a });
    assert.equal((await q("select public.account_unlink() as r"))[0].r, true);
    await pg.exec("reset role");
    assert.deepEqual((await q("select requested_name from public.player_accounts")).map(r => r.requested_name), ["김선수"]);
    assert.equal((await q("select count(*)::int as n from auth.users where id = $1", [a]))[0].n, 1);
  });

  await check("a visitor deletes their account: their teams and tower runs go, the battle keeps its name without the account", async () => {
    await as("authenticated", { sub: a });
    assert.equal((await q("select public.account_delete() as r"))[0].r, true);
    await pg.exec("reset role");
    assert.equal((await q("select count(*)::int as n from auth.users where id = $1", [a]))[0].n, 0);
    assert.equal((await q("select count(*)::int as n from public.account_teams"))[0].n, 0);
    assert.equal((await q("select count(*)::int as n from public.streak_runs"))[0].n, 0);
    assert.deepEqual(await q("select p1_name, p1_auth_user_id from public.battles"), [{ p1_name: "이제빈", p1_auth_user_id: null }]);
  });

  await check("an operator unlinks another's record; nobody else can, an operator cannot delete themselves this way, anon calls nothing", async () => {
    await as("authenticated", { sub: randomUUID() });
    await assert.rejects(q("select public.admin_unlink_player($1)", [b]), /운영자만/);
    const op = { sub: admin, app_metadata: { ypl_admin: true } };
    await as("authenticated", op);
    assert.equal((await q("select public.admin_unlink_player($1) as r", [b]))[0].r, true);
    await assert.rejects(q("select public.account_delete()"), /운영자 계정/);
    await as("anon");
    await assert.rejects(q("select public.account_unlink()"), /permission denied/);
    await assert.rejects(q("select public.account_delete()"), /permission denied/);
    await pg.exec("reset role");
    assert.equal((await q("select count(*)::int as n from public.player_accounts"))[0].n, 0);
  });
  console.log(`\n${checks} checks passed`);
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}
