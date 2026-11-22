// Disposable PostgreSQL check of docs/db/match_outcome_more.sql. Never connects to Supabase.
//   node scripts/verify-match-outcome-more-db.mjs
// The tables the RPC and the trigger touch are built with the columns they use, then the file is run twice and every rule tried.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";

const pg = new PGlite();
const q = async (query, params = []) => (await pg.query(query, params)).rows;
const one = async (query, params) => (await q(query, params))[0];
let checks = 0;
async function check(name, run) { await run(); checks++; console.log(`PASS ${name}`); }

const SOLO = "00000000-0000-0000-0000-0000000000e1", TEAM = "00000000-0000-0000-0000-0000000000e2";
const A = "00000000-0000-0000-0000-0000000000a1", B = "00000000-0000-0000-0000-0000000000b1";

await pg.exec(`
  create role anon; create role authenticated; create role service_role bypassrls;
  create schema ypl_schema_validation;
  create table ypl_schema_validation.events (id uuid primary key, status text, record_applied_at timestamptz, is_team_event boolean);
  create table ypl_schema_validation.results (event_id uuid);
  create table ypl_schema_validation.ranking_awards (event_id uuid);
  create table ypl_schema_validation.matches (id uuid primary key default gen_random_uuid(), event_id uuid, match_kind text, source text,
    source_node_key text, entry_a_id uuid, entry_b_id uuid, winner_entry_id uuid, winner_player_id uuid, resolution text,
    score_a smallint, score_b smallint, updated_at timestamptz default now());
  create table public.battles (id text primary key, kind text, event_id uuid, source_node_key text, ended_by text, applied_at timestamptz);
`);
await q(`insert into ypl_schema_validation.events values ($1, 'running', null, false), ($2, 'running', null, true)`, [SOLO, TEAM]);
const match = (event, key, winner = A, kind = "bracket") => q(
  `insert into ypl_schema_validation.matches (event_id, match_kind, source, source_node_key, entry_a_id, entry_b_id, winner_entry_id, resolution)
   values ($1, $2, 'normalized_bracket_runtime', $3, $4, $5, $6, $7)`, [event, kind, key, A, B, winner, winner ? "played" : "unknown"]);
await match(SOLO, "group:g1:m1");
await match(SOLO, "single:r1:m1");
await match(SOLO, "single:r1:m2");
await match(TEAM, "single:r1:m1");

const sql = readFileSync("docs/db/match_outcome_more.sql", "utf8");
await pg.exec(sql);
await pg.exec(sql); // safe to run again

const outcome = (event, key, a = null, b = null, forfeit = false) =>
  one(`select * from ypl_schema_validation.set_normalized_match_outcome($1, $2, $3, $4, $5)`, [event, key, a, b, forfeit]);
const row = (event, key) => one(`select resolution, score_a, score_b from ypl_schema_validation.matches where event_id = $1 and source_node_key = $2`, [event, key]);

await check("a group-stage match takes a score and a no-show", async () => {
  await outcome(SOLO, "group:g1:m1", 2, 1);
  assert.deepEqual(await row(SOLO, "group:g1:m1"), { resolution: "played", score_a: 2, score_b: 1 });
  await outcome(SOLO, "group:g1:m1", null, null, true);
  assert.deepEqual(await row(SOLO, "group:g1:m1"), { resolution: "forfeit", score_a: null, score_b: null });
});
await check("a team match takes a no-show but not a score", async () => {
  await assert.rejects(outcome(TEAM, "single:r1:m1", 2, 1), /세부 경기/);
  await outcome(TEAM, "single:r1:m1", null, null, true);
  assert.equal((await row(TEAM, "single:r1:m1")).resolution, "forfeit");
});
await check("the loser's score above the winner's is refused, and so is a recorded event", async () => {
  await assert.rejects(outcome(SOLO, "single:r1:m1", 1, 2), /이긴 선수/);
  await q(`update ypl_schema_validation.events set record_applied_at = now() where id = $1`, [SOLO]);
  await assert.rejects(outcome(SOLO, "single:r1:m1", 2, 1), /진행 중인 대회/);
  await q(`update ypl_schema_validation.events set record_applied_at = null where id = $1`, [SOLO]);
});
await check("the site asks whether this file ran", async () => {
  assert.equal((await one(`select ypl_schema_validation.match_outcome_more_ready() as r`)).r, true);
});
await check("a battle won by a forfeit or the clock leaves its match as forfeit once applied; a played battle does not", async () => {
  await q(`insert into public.battles values ('b1', 'official', $1, 'single:r1:m1', 'timeout', null), ('b2', 'official', $1, 'single:r1:m2', 'battle', null)`, [SOLO]);
  await q(`update public.battles set applied_at = now()`);
  assert.equal((await row(SOLO, "single:r1:m1")).resolution, "forfeit");
  assert.equal((await row(SOLO, "single:r1:m2")).resolution, "played");
});

console.log(`${checks} checks passed`);
