// Disposable PostgreSQL check of docs/db/handover_features.sql. Never connects to Supabase.
//   node scripts/verify-handover-features-db.mjs
// The tables the file reads are built with the columns it uses, is_ypl_admin answers from a switch, then every rule is tried.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";

const pg = new PGlite();
const q = async (query, params = []) => (await pg.query(query, params)).rows;
const one = async (query, params) => (await q(query, params))[0];
let checks = 0;
async function check(name, run) { await run(); checks++; console.log(`PASS ${name}`); }

const E = "00000000-0000-0000-0000-0000000000e1", E2 = "00000000-0000-0000-0000-0000000000e2";
const N1 = "00000000-0000-0000-0000-0000000000a1", N2 = "00000000-0000-0000-0000-0000000000b1";
const P1 = "00000000-0000-0000-0000-000000000001", P2 = "00000000-0000-0000-0000-000000000002", P3 = "00000000-0000-0000-0000-000000000003";
const U1 = "00000000-0000-0000-0000-0000000000f1";

await pg.exec(`
  create role anon; create role authenticated; create role service_role bypassrls;
  create schema auth; create table public.uid_switch (u uuid); insert into public.uid_switch values (null);
  create function auth.uid() returns uuid language sql as $$ select u from public.uid_switch $$;
  create schema ypl_schema_validation;
  create table public.admin_switch (on_ boolean); insert into public.admin_switch values (true);
  create function ypl_schema_validation.is_ypl_admin() returns boolean language sql as $$ select on_ from public.admin_switch $$;
  create table ypl_schema_validation.events (id uuid primary key, name text, status text, record_applied_at timestamptz, team_revealed_at timestamptz, held_on date, is_team_event boolean default false, event_type text default 'pokecup');
  create table ypl_schema_validation.players (id uuid primary key default gen_random_uuid(), display_name text, status text default 'active', updated_at timestamptz);
  create table ypl_schema_validation.entries (id uuid primary key, event_id uuid, display_name text, updated_at timestamptz);
  create table ypl_schema_validation.event_registrations (id uuid primary key default gen_random_uuid(), event_id uuid,
    player_id uuid references ypl_schema_validation.players(id), registration_name text, unique (event_id, player_id));
  create table ypl_schema_validation.entry_participants (id uuid primary key default gen_random_uuid(), event_id uuid, entry_id uuid,
    registration_id uuid, player_id uuid references ypl_schema_validation.players(id), unique (event_id, player_id));
  create table ypl_schema_validation.matches (id uuid primary key default gen_random_uuid(), event_id uuid, source text, source_node_key text,
    entry_a_id uuid, entry_b_id uuid, winner_entry_id uuid, winner_player_id uuid references ypl_schema_validation.players(id));
  create table ypl_schema_validation.bracket_runtimes (event_id uuid, round_schedule jsonb);
  create table ypl_schema_validation.registration_submissions (id uuid primary key default gen_random_uuid(), registration_id uuid);
  create table public.player_accounts (player_id uuid references ypl_schema_validation.players(id), auth_user_id uuid, status text);
  create table public.site_data (key text primary key, value jsonb);
  create table public.battles (id text primary key, kind text, status text, event_id uuid, spectator_log text, deadline_at timestamptz);
  alter table ypl_schema_validation.events add column competition_settings jsonb default '{}';
  create table public.push_outbox (id bigint generated always as identity, dedup text unique, kind text, auth_user_id uuid, title text, body text, url text);
  create function public.push_closes_at(p_value text) returns timestamptz language plpgsql stable as $$
  declare v text := btrim(coalesce(p_value, ''));
  begin
    if v = '' then return null; end if;
    return case when v ~ '(Z|[+-]\\d\\d(:?\\d\\d)?)$' then v::timestamptz else v::timestamp at time zone 'Asia/Seoul' end;
  exception when others then return null;
  end $$;
`);
await q(`insert into ypl_schema_validation.events values ($1, '1회 파이컵', 'running', null), ($2, '2회 파이컵', 'open', null)`, [E, E2]);
await q(`insert into ypl_schema_validation.players (id, display_name) values ($1, '가나'), ($2, '가 나2'), ($3, '다라')`, [P1, P2, P3]);
await q(`insert into ypl_schema_validation.entries values ($1, $3), ($2, $3)`, [N1, N2, E]);

const sql = readFileSync("docs/db/handover_features.sql", "utf8");
await pg.exec(sql);
await pg.exec(sql); // safe to run again
// the trigger battle_timer.sql laid in production, on the function this file replaces
await pg.exec(`create trigger battles_deadline before insert or update on public.battles for each row execute function public.battle_set_deadline()`);

await check("an operator marks a withdrawal and a disqualification, changes it and clears it; a visitor cannot", async () => {
  await q(`select ypl_schema_validation.set_entry_departure($1, $2, 'withdrew', ' 몸이 아파서 ')`, [E, N1]);
  assert.deepEqual(await one(`select kind, note from ypl_schema_validation.entry_departures where entry_id = $1`, [N1]), { kind: "withdrew", note: "몸이 아파서" });
  await q(`select ypl_schema_validation.set_entry_departure($1, $2, 'disqualified')`, [E, N1]);
  assert.equal((await one(`select kind from ypl_schema_validation.entry_departures where entry_id = $1`, [N1])).kind, "disqualified");
  await q(`select ypl_schema_validation.set_entry_departure($1, $2, null)`, [E, N1]);
  assert.equal((await q(`select 1 from ypl_schema_validation.entry_departures`)).length, 0);
  await assert.rejects(q(`select ypl_schema_validation.set_entry_departure($1, $2, 'withdrew')`, [E2, N1]), /진행 중인 대회/);
  await q(`update public.admin_switch set on_ = false`);
  await assert.rejects(q(`select ypl_schema_validation.set_entry_departure($1, $2, 'withdrew')`, [E, N1]), /관리자/);
  await q(`update public.admin_switch set on_ = true`);
});

await check("a visitor's error goes in once, trimmed, and only an operator reads it", async () => {
  await q(`select public.report_client_error($1, 'stack', '/?view=home', 'b1', 'ua')`, ["x".repeat(3000)]);
  await q(`select public.report_client_error($1, 'stack', '/?view=home', 'b1', 'ua')`, ["x".repeat(3000)]);
  await q(`select public.report_client_error('  ')`);
  const rows = await q(`select * from public.admin_client_errors(10)`);
  assert.equal(rows.length, 1); assert.equal(rows[0].message.length, 2000);
  await q(`update public.admin_switch set on_ = false`);
  await assert.rejects(q(`select * from public.admin_client_errors(10)`), /관리자/);
  await q(`update public.admin_switch set on_ = true`);
});

await check("renaming refuses a name another player already has, ignoring spaces and case", async () => {
  await assert.rejects(q(`select ypl_schema_validation.admin_rename_player($1, '다 라')`, [P1]), /같은 이름/);
  await q(`select ypl_schema_validation.admin_rename_player($1, '가나다')`, [P1]);
  assert.equal((await one(`select display_name from ypl_schema_validation.players where id = $1`, [P1])).display_name, "가나다");
});

await check("merging moves every reference and deletes the duplicate; two players in one event stop it whole", async () => {
  await q(`insert into ypl_schema_validation.event_registrations (event_id, player_id) values ($1, $2)`, [E2, P2]);
  await q(`insert into ypl_schema_validation.matches (event_id, winner_player_id) values ($1, $2)`, [E, P2]);
  await q(`insert into public.player_accounts values ($1, $2, 'approved')`, [P2, U1]);
  assert.equal((await one(`select ypl_schema_validation.admin_merge_players($1, $2) as n`, [P1, P2])).n, 3);
  assert.equal((await q(`select 1 from ypl_schema_validation.players where id = $1`, [P2])).length, 0);
  assert.equal((await one(`select player_id from public.player_accounts`)).player_id, P1);
  await q(`insert into ypl_schema_validation.event_registrations (event_id, player_id) values ($1, $2)`, [E2, P3]);
  await assert.rejects(q(`select ypl_schema_validation.admin_merge_players($1, $2)`, [P1, P3]), /함께 있어/);
  assert.equal((await q(`select 1 from ypl_schema_validation.players where id = $1`, [P3])).length, 1);
});

await check("a round about to start and a party not yet in reach the linked players once", async () => {
  const now = new Date("2026-11-22T03:00:00Z");
  await q(`insert into ypl_schema_validation.bracket_runtimes values ($1, $2)`, [E, JSON.stringify({ "single:r1": "2026-11-22T03:20:00Z", "single:r2": "2026-11-22T05:00:00Z" })]);
  await q(`insert into ypl_schema_validation.matches (event_id, source, source_node_key, entry_a_id, entry_b_id) values ($1, 'normalized_bracket_runtime', 'single:r1:m1', $2, $3), ($1, 'normalized_bracket_runtime', 'single:r2:m1', $2, $3)`, [E, N1, N2]);
  await q(`insert into ypl_schema_validation.entry_participants (event_id, entry_id, player_id) values ($1, $2, $3)`, [E, N1, P1]);
  // the notice of 2회: it starts tomorrow 10:00 Korean time (01:00Z), within a day of now
  await q(`insert into public.site_data values ('ypl_data_v4', $1)`, [JSON.stringify({ announcements: [{ id: "n1", form: { eventId: E2, eventDraft: { heldOn: "2026-11-23", startTime: "10:00" } } }] })]);
  await q(`select public.push_queue_bracket_steps($1)`, [now]);
  await q(`select public.push_queue_bracket_steps($1)`, [now]);
  const rows = await q(`select dedup, title, auth_user_id from public.push_outbox order by dedup`);
  assert.deepEqual(rows.map(r => r.title), ["파티 제출 마감 임박", "경기 시작 30분 전"]);
  assert.ok(rows.every(r => r.auth_user_id === U1));
  const reg = await one(`select id from ypl_schema_validation.event_registrations where player_id = $1`, [P1]);
  await q(`insert into ypl_schema_validation.registration_submissions (registration_id) values ($1)`, [reg.id]);
  await q(`delete from public.push_outbox`);
  await q(`select public.push_queue_bracket_steps($1)`, [now]);
  assert.deepEqual((await q(`select title from public.push_outbox`)).map(r => r.title), ["경기 시작 30분 전"]);
});

await check("a scheduled notice goes out once its time has come, and an operator can send an edited one again", async () => {
  await q(`delete from public.push_outbox`);
  await q(`update public.site_data set value = $1`, [JSON.stringify({ announcements: [
    { id: "a1", title: "예약 공지", publishAt: "2026-11-22T11:50" }, { id: "a2", title: "나중 공지", publishAt: "2026-11-22T13:00" }] })]);
  await q(`select public.push_queue_bracket_steps($1)`, [new Date("2026-11-22T03:00:00Z")]); // 12:00 in Korea
  assert.deepEqual((await q(`select dedup from public.push_outbox where kind = 'notice'`)).map(r => r.dedup), ["notice:a1"]);
  await q(`select public.push_queue_notice_edit('a2')`);
  assert.equal((await q(`select 1 from public.push_outbox where title = 'YPL 공지 수정'`)).length, 1);
  await assert.rejects(q(`select public.push_queue_notice_edit('zz')`), /찾을 수 없습니다/);
});

await check("an official battle runs on its event's turn time; an operator pauses, extends and resumes it", async () => {
  await q(`update ypl_schema_validation.events set competition_settings = '{"turnSeconds":"120"}' where id = $1`, [E]);
  await q(`insert into public.battles (id, kind, status, event_id) values ('o1', 'official', 'active', $1), ('f1', 'friendly', 'active', null)`, [E]);
  const left = async id => Number((await one(`select extract(epoch from deadline_at - now()) as s from public.battles where id = $1`, [id])).s);
  assert.ok(Math.abs(await left("o1") - 120) < 5); assert.ok(Math.abs(await left("f1") - 90) < 5);
  await q(`select public.admin_battle_clock('o1', 'pause')`);
  let row = await one(`select deadline_at, paused_left from public.battles where id = 'o1'`);
  assert.equal(row.deadline_at, null); assert.ok(row.paused_left >= 115);
  await q(`update public.battles set spectator_log = 'turn 2' where id = 'o1'`); // a turn passes while paused: still paused, a full turn left
  row = await one(`select deadline_at, paused_left from public.battles where id = 'o1'`);
  assert.equal(row.deadline_at, null); assert.equal(row.paused_left, 120);
  await q(`select public.admin_battle_clock('o1', 'extend')`);
  assert.equal((await one(`select paused_left from public.battles where id = 'o1'`)).paused_left, 180);
  await q(`select public.admin_battle_clock('o1', 'resume')`);
  assert.ok(Math.abs(await left("o1") - 180) < 5);
  await assert.rejects(q(`select public.admin_battle_clock('f1', 'pause')`), /공식 배틀/);
  await q(`update public.battles set status = 'ended' where id = 'o1'`);
  row = await one(`select deadline_at, paused_left from public.battles where id = 'o1'`);
  assert.equal(row.deadline_at, null);
});

await check("an operator keeps each side's picks of a match; a visitor reads them once the event is revealed", async () => {
  await q(`select ypl_schema_validation.set_match_picks($1, 'single:r1:m1', $2, array['garchomp', 'garchomp', 'incineroar', ' '])`, [E, N1]);
  assert.deepEqual((await one(`select pokemon_ids from ypl_schema_validation.match_picks`)).pokemon_ids.sort(), ["garchomp", "incineroar"]);
  await assert.rejects(q(`select ypl_schema_validation.set_match_picks($1, 'single:r9:m9', $2, array['x'])`, [E, N1]), /출전이 아닙니다/);
  await q(`select ypl_schema_validation.set_match_picks($1, 'single:r1:m1', $2, '{}')`, [E, N1]);
  assert.equal((await q(`select 1 from ypl_schema_validation.match_picks`)).length, 0);
  await q(`update public.admin_switch set on_ = false`);
  await assert.rejects(q(`select ypl_schema_validation.set_match_picks($1, 'single:r1:m1', $2, array['x'])`, [E, N1]), /관리자/);
  await q(`update public.admin_switch set on_ = true`);
});

await check("an entrant with no result yet is replaced by another applicant, who becomes a player if new; a played one is not", async () => {
  const E3 = "00000000-0000-0000-0000-0000000000e3", X1 = "00000000-0000-0000-0000-0000000000c1", X2 = "00000000-0000-0000-0000-0000000000c2";
  await q(`insert into ypl_schema_validation.events (id, name, status) values ($1, '3회', 'running')`, [E3]);
  await q(`insert into ypl_schema_validation.entries values ($1, $3, '가나다', null), ($2, $3, '다라', null)`, [X1, X2, E3]);
  const reg = async (name, player = null) => (await one(`insert into ypl_schema_validation.event_registrations (event_id, player_id, registration_name) values ($1, $2, $3) returning id`, [E3, player, name])).id;
  const r1 = await reg("가나다", P1), r2 = await reg("다라", P3);
  await q(`insert into ypl_schema_validation.entry_participants (event_id, entry_id, registration_id, player_id) values ($1, $2, $3, $4), ($1, $5, $6, $7)`, [E3, X1, r1, P1, X2, r2, P3]);
  await q(`insert into ypl_schema_validation.matches (event_id, source, source_node_key, entry_a_id, entry_b_id) values ($1, 'normalized_bracket_runtime', 'single:r1:m1', $2, $3)`, [E3, X1, X2]);
  const newcomer = await reg("새 얼굴");
  await q(`select ypl_schema_validation.replace_bracket_entrant($1, $2, $3)`, [E3, X1, newcomer]);
  const row = await one(`select ep.registration_id, p.display_name, n.display_name as entry from ypl_schema_validation.entry_participants ep
    join ypl_schema_validation.players p on p.id = ep.player_id join ypl_schema_validation.entries n on n.id = ep.entry_id where ep.entry_id = $1`, [X1]);
  assert.deepEqual(row, { registration_id: newcomer, display_name: "새 얼굴", entry: "새 얼굴" });
  await assert.rejects(q(`select ypl_schema_validation.replace_bracket_entrant($1, $2, $3)`, [E3, X2, newcomer]), /이미 대진표에 있는/);
  await q(`update ypl_schema_validation.matches set winner_entry_id = $1 where event_id = $2`, [X2, E3]);
  await assert.rejects(q(`select ypl_schema_validation.replace_bracket_entrant($1, $2, $3)`, [E3, X2, r1]), /결과가 있는/);
});

await check("a linked applicant checks in on the event's day, once; the day before, a stranger and the signed-out cannot", async () => {
  const today = (await one(`select (now() at time zone 'Asia/Seoul')::date::text as d`)).d;
  const E4 = "00000000-0000-0000-0000-0000000000e4";
  await q(`insert into ypl_schema_validation.events (id, name, status, held_on) values ($1, '4회', 'open', $2)`, [E4, today]);
  await q(`insert into ypl_schema_validation.event_registrations (event_id, player_id, registration_name) values ($1, $2, '가나다')`, [E4, P1]);
  const mine = (ids, go = false) => one(`select ypl_schema_validation.my_checkin($1::uuid[], $2) as r`, [ids, go]).then(x => x.r);
  assert.equal(await mine([E4]), "not_signed");
  await q(`update public.uid_switch set u = $1`, [U1]);
  assert.equal(await mine(["00000000-0000-0000-0000-0000000000ff"]), "not_registered");
  assert.equal(await mine(["00000000-0000-0000-0000-0000000000ff", E4]), "open");
  assert.equal(await mine([E4], true), "done");
  assert.equal(await mine([E4], true), "done");
  assert.equal((await q(`select 1 from ypl_schema_validation.event_checkins`)).length, 1);
  await q(`update ypl_schema_validation.events set held_on = $2::date + 1 where id = $1`, [E4, today]);
  await q(`delete from ypl_schema_validation.event_checkins`);
  assert.equal(await mine([E4], true), "closed");
  await q(`update public.uid_switch set u = null`);
});

await check("two players' matching reports put a single-elimination winner in; a disagreement or a stranger does not", async () => {
  const E5 = "00000000-0000-0000-0000-0000000000e5", Y1 = "00000000-0000-0000-0000-0000000000d1", Y2 = "00000000-0000-0000-0000-0000000000d2";
  const U2 = "00000000-0000-0000-0000-0000000000f2";
  await q(`alter table ypl_schema_validation.bracket_runtimes add column if not exists id uuid default gen_random_uuid(), add column if not exists topology_kind text`);
  await q(`alter table ypl_schema_validation.matches add column if not exists match_kind text`);
  await pg.exec(`create function ypl_schema_validation.set_normalized_single_bracket_winner(p_runtime_id uuid, p_event_id uuid, p_key text, p_winner uuid)
    returns void language sql as $f$ update ypl_schema_validation.matches set winner_entry_id = p_winner where event_id = p_event_id and source_node_key = p_key $f$`);
  await q(`insert into ypl_schema_validation.events (id, name, status) values ($1, '5회', 'running')`, [E5]);
  await q(`insert into ypl_schema_validation.bracket_runtimes (event_id, round_schedule, topology_kind) values ($1, '{}', 'single_elimination')`, [E5]);
  await q(`insert into ypl_schema_validation.entries (id, event_id) values ($1, $3), ($2, $3)`, [Y1, Y2, E5]);
  await q(`insert into ypl_schema_validation.entry_participants (event_id, entry_id, player_id) values ($1, $2, $3), ($1, $4, $5)`, [E5, Y1, P1, Y2, P3]);
  await q(`insert into public.player_accounts values ($1, $2, 'approved')`, [P3, U2]);
  await q(`insert into ypl_schema_validation.matches (event_id, match_kind, source, source_node_key, entry_a_id, entry_b_id) values ($1, 'bracket', 'normalized_bracket_runtime', 'single:r1:m1', $2, $3)`, [E5, Y1, Y2]);
  const report = async (user, won) => { await q(`update public.uid_switch set u = $1`, [user]); return (await one(`select ypl_schema_validation.report_match_result($1, 'single:r1:m1', $2) as r`, [E5, won])).r; };
  assert.deepEqual(await report(U1, true), { status: "waiting", mine: true });
  assert.deepEqual(await report(U2, true), { status: "disputed", mine: true });
  assert.equal((await one(`select winner_entry_id from ypl_schema_validation.matches where event_id = $1`, [E5])).winner_entry_id, null);
  assert.deepEqual(await report(U2, false), { status: "applied", mine: false });
  assert.equal((await one(`select winner_entry_id from ypl_schema_validation.matches where event_id = $1`, [E5])).winner_entry_id, Y1);
  assert.deepEqual(await report(U1, null), { status: "decided", mine: true });
  assert.deepEqual(await report("00000000-0000-0000-0000-0000000000f9", true), { status: "not_player" });
  await q(`update public.uid_switch set u = null`);
});

await check("the site asks whether this file ran", async () => {
  assert.equal((await one(`select public.handover_features_ready() as r`)).r, true);
});

console.log(`${checks} checks passed`);
