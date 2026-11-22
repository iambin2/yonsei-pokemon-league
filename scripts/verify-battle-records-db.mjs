// Disposable PostgreSQL check of docs/db/battle_records.sql. Never connects to Supabase.
//   node scripts/verify-battle-records-db.mjs [<path-to-pglite-dist/index.js>]
// The battles tables are built as verify-streak-db.mjs builds them (the live shape), streak_runs.sql and cpu_battles.sql run, then
// battle_records.sql twice (it must be safe to run again; its pg_cron lines are left out, PGlite has no pg_cron).
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

await pg.exec(`
  create role anon; create role authenticated; create role service_role bypassrls;
  create schema auth; create table auth.users (id uuid primary key);
  create function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;
  create table public.battles (
    id text primary key, regulation text not null, format_id text not null, engine text not null,
    status text not null default 'waiting' check (status in ('waiting', 'active', 'ended')),
    p1_name text not null, p2_name text, turn integer not null default 0,
    winner text check (winner in ('p1', 'p2', 'tie')), ended_by text check (ended_by in ('battle', 'forfeit', 'void', 'timeout')),
    spectator_log text not null default '', log text, input_log text, version integer not null default 0,
    created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
    kind text not null default 'friendly', event_id uuid, source_node_key text,
    p1_entry_id uuid, p2_entry_id uuid, p1_player_id uuid, p2_player_id uuid, applied_at timestamptz, apply_error text,
    deadline_at timestamptz, room text, rematch_id text,
    check ((status = 'ended') = (winner is not null and log is not null and input_log is not null))
  );
  create table public.battle_secrets (
    battle_id text primary key references public.battles (id) on delete cascade,
    p1_token_hash text not null, p2_token_hash text, p1_team jsonb not null, state jsonb, pending jsonb not null default '{}'::jsonb, room_code text
  );
  create table public.player_accounts (auth_user_id uuid primary key, requested_name text not null, status text not null default 'pending');
  create schema ypl_schema_validation;
  create table ypl_schema_validation.events (id uuid primary key, competition_settings jsonb not null default '{}'::jsonb);
  create table ypl_schema_validation.event_registrations (id uuid primary key, final_submission_id uuid);
  create table ypl_schema_validation.registration_submissions (id uuid primary key, registration_id uuid not null, revision integer not null);
  create table ypl_schema_validation.entry_participants (entry_id uuid not null, player_id uuid not null, registration_id uuid not null);
`);
const timer = readFileSync("docs/db/battle_timer.sql", "utf8");
await pg.exec(timer.slice(timer.indexOf("alter table public.battles add column if not exists deadline_at")).replace(/^update public\.battles[^;]*;/m, ""));
await pg.exec(readFileSync("docs/db/streak_runs.sql", "utf8"));
await pg.exec(readFileSync("docs/db/cpu_battles.sql", "utf8"));
// a streak game here needs no run of its own: what is checked is that the jobs below leave streak games alone
await pg.exec("alter table public.battles drop constraint battles_run_kind");
const records = readFileSync("docs/db/battle_records.sql", "utf8").replace(/\r\n/g, "\n")
  .split("\n").filter(line => !/pg_cron;|cron\./.test(line)).join("\n");
await pg.exec(records);
await pg.exec(records);

const ins = (id, extra = {}) => {
  const row = { id, regulation: "m-c", format_id: "f", engine: "t", p1_name: "가", ...extra };
  const keys = Object.keys(row);
  return q(`insert into public.battles (${keys.join(",")}) values (${keys.map((_, i) => `$${i + 1}`).join(",")})`, Object.values(row));
};
const as = role => pg.exec(`reset role; set role ${role}`);

try {
  await check("a battle stamps when it starts and when it ends, once each", async () => {
    await ins("b1");
    let b = await one("select started_at, ended_at from public.battles where id = 'b1'");
    assert.equal(b.started_at, null); assert.equal(b.ended_at, null);
    await q("update public.battles set status = 'active' where id = 'b1'");
    const started = (await one("select started_at from public.battles where id = 'b1'")).started_at;
    assert.ok(started);
    await q("update public.battles set turn = 3 where id = 'b1'");
    await q("update public.battles set status = 'ended', winner = 'p1', ended_by = 'battle', log = 'l', input_log = 'i' where id = 'b1'");
    b = await one("select started_at, ended_at from public.battles where id = 'b1'");
    assert.equal(+b.started_at, +started); assert.ok(b.ended_at);
    await ins("b2", { status: "active", kind: "streak" });
    assert.ok((await one("select started_at from public.battles where id = 'b2'")).started_at, "a battle opened active starts at once");
  });

  await check("an official battle keeps the submission each side played: the final one, else the latest, and for a team the seated player", async () => {
    const [event, entryA, entryB, playerA, playerB, playerB2, regA, regB, regB2] = Array.from({ length: 9 }, () => randomUUID());
    const [subA1, subA2, subB, subFinal] = Array.from({ length: 4 }, () => randomUUID());
    await q("insert into ypl_schema_validation.events values ($1, '{\"matchPlay\":\"site\"}')", [event]);
    await q("insert into ypl_schema_validation.event_registrations values ($1, null), ($2, $3), ($4, null)", [regA, regB, subFinal, regB2]);
    await q("insert into ypl_schema_validation.registration_submissions values ($1, $2, 1), ($3, $2, 2), ($4, $5, 1), ($6, $5, 2)", [subA1, regA, subA2, subB, regB, subFinal]);
    await q("insert into ypl_schema_validation.entry_participants values ($1, $2, $3), ($4, $5, $6), ($4, $7, $8)", [entryA, playerA, regA, entryB, playerB, regB, playerB2, regB2]);
    await ins("o1", { kind: "official", event_id: event, source_node_key: "k", p1_entry_id: entryA, p1_player_id: playerA });
    assert.equal((await one("select p1_submission_id from public.battles where id = 'o1'")).p1_submission_id, subA2, "the latest revision");
    await q("update public.battles set p2_entry_id = $1, p2_player_id = $2 where id = 'o1'", [entryB, playerB]);
    assert.equal((await one("select p2_submission_id from public.battles where id = 'o1'")).p2_submission_id, subFinal, "the frozen final one");
    await q("update public.battles set p2_player_id = $1 where id = 'o1'", [playerB2]);
    assert.equal((await one("select p2_submission_id from public.battles where id = 'o1'")).p2_submission_id, null, "the seated member has none");
    await q("update ypl_schema_validation.events set competition_settings = '{\"matchPlay\":\"random\"}' where id = $1", [event]);
    await ins("o2", { kind: "official", event_id: event, source_node_key: "k2", p1_entry_id: entryA, p1_player_id: playerA });
    assert.equal((await one("select p1_submission_id from public.battles where id = 'o2'")).p1_submission_id, null, "a random party has no submission");
    await ins("f1", { p1_entry_id: entryA });
    assert.equal((await one("select p1_submission_id from public.battles where id = 'f1'")).p1_submission_id, null, "friendly battles are left alone");
  });

  await check("housekeeping deletes only abandoned friendly rooms and clears only finished engine states", async () => {
    await ins("w-old", { created_at: "2026-01-01" });
    await ins("w-new");
    await ins("a-old", { status: "active", updated_at: "2026-01-01" });
    await ins("s-old", { status: "active", kind: "streak", updated_at: "2026-01-01" });
    for (const id of ["w-old", "w-new", "a-old", "s-old", "b1"]) await q("insert into public.battle_secrets (battle_id, p1_token_hash, p1_team, state) values ($1, 'h', '[]', '{\"s\":1}')", [id]);
    await as("service_role");
    const out = (await one("select public.battle_housekeeping() as r")).r;
    await pg.exec("reset role");
    assert.deepEqual(out, { waiting_deleted: 1, stalled_deleted: 1, states_cleared: 1 });
    const left = (await q("select id from public.battles")).map(r => r.id);
    assert.ok(left.includes("w-new") && left.includes("s-old") && !left.includes("w-old") && !left.includes("a-old"), left.join(" "));
    assert.equal((await one("select state from public.battle_secrets where battle_id = 'b1'")).state, null);
    assert.ok((await one("select state from public.battle_secrets where battle_id = 's-old'")).state, "a streak game is not this job's");
    await as("anon");
    await assert.rejects(q("select public.battle_housekeeping()"), /permission denied/);
  });

  await check("the 5000 limit counts the last 30 days only", async () => {
    await q("insert into public.battles (id, regulation, format_id, engine, p1_name, created_at) select 'x' || g, 'm-c', 'f', 't', '가', '2026-01-01' from generate_series(1, 5000) g");
    await as("service_role");
    await q("select public.battle_create('n1', 'm-c', 'f', 't', '가', 'h', '[]')");
    await pg.exec("reset role");
    await q("update public.battles set created_at = now() - interval '1 day' where id like 'x%'");
    await as("service_role");
    await assert.rejects(q("select public.battle_create('n2', 'm-c', 'f', 't', '가', 'h', '[]')"), /가득/);
  });

  await check("a computer battle keeps its level, and the old seven-argument call still works", async () => {
    await as("service_role");
    assert.equal((await one("select public.cpu_battle_record($1, 'f', 't', 'p1', 'battle', 9, 'log', 'porygon2') as r", ["a".repeat(64)])).r, true);
    assert.equal((await one("select public.cpu_battle_record($1, 'f', 't', 'p1', 'battle', 9, 'log') as r", ["b".repeat(64)])).r, true);
    await pg.exec("reset role");
    assert.deepEqual((await q("select level from public.cpu_battles order by id")).map(r => r.level), ["porygon2", null]);
  });
  console.log(`\n${checks} checks passed`);
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}
