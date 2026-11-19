// Disposable PostgreSQL check of docs/db/tower_cups.sql (BATTLE_STREAK.md 18). Never connects to Supabase.
//   node scripts/verify-tower-cups-db.mjs <path-to-pglite-dist/index.js>
// The battles tables are built as the live database has them (2026-11-07: columns, checks and both triggers read from it), the
// accounts table as player_accounts.sql makes it, then streak_runs.sql runs on top and every rule is tried as service_role and anon.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { randomUUID } from "node:crypto";

const { PGlite } = await import(process.argv[2] ? pathToFileURL(resolve(process.argv[2])).href : "@electric-sql/pglite");
const pg = new PGlite();
const q = async (query, params = []) => (await pg.query(query, params)).rows;
const one = async (query, params) => (await q(query, params))[0];
const as = async (role, user) => {
  await pg.exec(`reset role; set role ${role}`);
  await q("select set_config('request.jwt.claims', $1, false)", [JSON.stringify(user ? { sub: user } : {})]);
};
let checks = 0;
async function check(name, run) { await pg.exec("reset role"); await run(); checks++; console.log(`PASS ${name}`); }

await pg.exec(`
  create role anon; create role authenticated; create role service_role bypassrls; -- as on Supabase
  create schema auth;
  create table auth.users (id uuid primary key);
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub', '')::uuid $$;
  grant usage on schema auth to anon, authenticated, service_role;
  grant execute on function auth.uid() to anon, authenticated, service_role;

  create table public.battles (
    id text primary key check (id ~ '^[a-z0-9]{12}$'),
    regulation text not null check (regulation ~ '^[a-z0-9-]{1,12}$'),
    format_id text not null, engine text not null,
    status text not null default 'waiting' check (status in ('waiting', 'active', 'ended')),
    p1_name text not null check (char_length(btrim(p1_name)) between 1 and 20),
    p2_name text check (char_length(btrim(p2_name)) between 1 and 20),
    turn integer not null default 0,
    winner text check (winner in ('p1', 'p2', 'tie')),
    ended_by text check (ended_by in ('battle', 'forfeit', 'void', 'timeout')),
    spectator_log text not null default '', log text, input_log text,
    version integer not null default 0,
    created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
    kind text not null default 'friendly', event_id uuid, source_node_key text,
    p1_entry_id uuid, p2_entry_id uuid, p1_player_id uuid, p2_player_id uuid, applied_at timestamptz, apply_error text,
    deadline_at timestamptz, room text check (room is null or room in ('open', 'code')), rematch_id text,
    check ((status = 'ended') = (winner is not null and log is not null and input_log is not null)),
    constraint battles_kind check (kind in ('friendly', 'official') and ((kind = 'friendly') = (event_id is null and source_node_key is null)))
  );
  create table public.battle_secrets (
    battle_id text primary key references public.battles (id) on delete cascade,
    p1_token_hash text not null, p2_token_hash text, p1_team jsonb not null, state jsonb,
    pending jsonb not null default '{}'::jsonb, room_code text
  );
  alter table public.battles enable row level security;
  alter table public.battle_secrets enable row level security;
  revoke all on table public.battles, public.battle_secrets from public, anon, authenticated;
  grant select (id, status, kind, p1_name, p2_name, winner) on table public.battles to anon, authenticated;
  create policy battles_read on public.battles for select to anon, authenticated using (true);
  grant select on table public.battles, public.battle_secrets to service_role;
  create function public.battles_keep_official() returns trigger language plpgsql set search_path = '' as $$
  begin
    if old.kind = 'official' and old.status = 'ended' then raise exception using errcode = 'P0001', message = 'official'; end if;
    return old;
  end $$;
  create trigger battles_keep_official before delete on public.battles for each row execute function public.battles_keep_official();

  create table public.player_accounts (
    auth_user_id uuid primary key references auth.users (id) on delete cascade,
    requested_name text not null, status text not null default 'pending' check (status in ('pending', 'approved', 'rejected'))
  );
`);
const timer = readFileSync("docs/db/battle_timer.sql", "utf8");
await pg.exec(timer.slice(timer.indexOf("alter table public.battles add column if not exists deadline_at")).replace(/^update public\.battles[^;]*;/m, ""));
await pg.exec(readFileSync("docs/db/streak_runs.sql", "utf8"));
// push_outbox as push_kinds.sql makes it (the rest of that file needs the whole site schema)
await pg.exec(`
  create table public.push_outbox (
    id bigint generated always as identity primary key, dedup text not null unique, kind text not null,
    auth_user_id uuid references auth.users (id) on delete cascade, title text not null check (char_length(title) <= 40),
    body text not null check (char_length(body) <= 200), url text not null check (url ~ '^\\?view='),
    created_at timestamptz not null default now(), taken_at timestamptz);
`);
// run twice: the file must be safe to run again
await pg.exec(readFileSync("docs/db/tower_cups.sql", "utf8"));
await pg.exec(readFileSync("docs/db/tower_cups.sql", "utf8"));

const users = {};
for (const [key, name, status] of [["a", "이제빈", "approved"], ["b", "김선수", "approved"], ["c", "대기중", "pending"], ["d", "박도전", "approved"]]) {
  users[key] = randomUUID();
  await q("insert into auth.users values ($1)", [users[key]]);
  await q("insert into public.player_accounts values ($1, $2, $3)", [users[key], name, status]);
}
const call = async (user, query, params = []) => { await as(user ? "authenticated" : "anon", user); try { return await one(query, params); } finally { await pg.exec("reset role"); } };
const create = (user, room = "open", limit = null) =>
  call(user, "select public.tower_cup_create('정모 등반전', now(), now() + interval '2 hours', $1, $2) as r", [room, limit]).then(r => r.r);
const join = (user, id, code = null) => call(user, "select public.tower_cup_join($1, $2) as r", [id, code]).then(r => r.r);
const begin = async (user, daily = false) => (await one("select public.streak_begin($1, 'gen9championsbssregmc', '{}'::jsonb, $2) as r", [user, daily])).r.run_id;
const win = run => q("update public.streak_runs set wins = wins + 1, last_win_at = now() where id = $1", [run]);
const board = async (id, user) => (await call(user, "select public.tower_cup_board($1) as r", [id])).r;
const pause = () => new Promise(r => setTimeout(r, 5));

try {
  let open, code;
  await check("only an approved account opens a cup, one at a time, and is its first player", async () => {
    await assert.rejects(create(users.c), /승인된 Google 계정/);
    await assert.rejects(create(null), /permission denied/);
    await assert.rejects(call(users.a, "select public.tower_cup_create('', now(), now() + interval '1 hour', 'open') as r"), /1자에서 24자/);
    await assert.rejects(call(users.a, "select public.tower_cup_create('x', now(), now() - interval '1 hour', 'open') as r"), /마감은 시작보다/);
    await assert.rejects(call(users.a, "select public.tower_cup_create('x', now(), now() + interval '40 days', 'open') as r"), /31일/);
    open = await create(users.a);
    assert.equal(open.code, null);
    await assert.rejects(create(users.a), /이미 연 등반전/);
    const b = await board(open.id, users.a);
    assert.deepEqual([b.cup.title, b.cup.hosting, b.cup.joined, b.cup.players, b.rows.length, b.rows[0].wins], ["정모 등반전", true, true, 1, 1, 0]);
  });

  await check("a code cup is joined only with its code, which only its players see", async () => {
    code = await create(users.b, "code", 1);
    assert.match(code.code, /^[0-9]{4}$/);
    await assert.rejects(join(users.d, code.id, "x"), /코드가 맞지 않습니다/);
    await assert.rejects(join(users.c, code.id, code.code), /승인된 Google 계정/);
    assert.equal((await board(code.id, users.d)).cup.code, null, "an outsider does not see the code");
    await join(users.d, code.id, code.code);
    await join(users.d, code.id, null);  // already in: the code is not asked again
    assert.equal((await board(code.id, users.d)).cup.code, code.code);
    const listed = async user => (await call(user, "select coalesce(jsonb_agg(c.id), '[]') as r from public.tower_cups() c")).r;
    assert.ok((await listed(null)).includes(open.id) && !(await listed(null)).includes(code.id), "a code cup is listed only to its players");
    assert.ok((await listed(users.d)).includes(code.id));
  });

  await check("visitors read no table, and the board says no account id", async () => {
    await as("anon");
    for (const t of ["tower_cups", "tower_cup_players", "tower_cup_runs"]) await assert.rejects(q(`select * from public.${t}`), /permission denied/);
    await pg.exec("reset role");
    const b = await board(open.id, null);
    assert.ok(!JSON.stringify(b).includes(users.a));
    assert.equal(b.cup.code, null);
  });

  let runA;
  await check("a run started in the cup by a player counts; one started before joining does not", async () => {
    const early = await begin(users.d);  // d is not yet in the open cup
    await join(users.d, open.id);
    await win(early);
    assert.equal((await board(open.id)).rows.find(r => r.trainer_name === "박도전").wins, 0);
    runA = await begin(users.a);
    const runD = await begin(users.d);  // also d's first counted run in the code cup (limit 1)
    await win(runA); await pause(); await win(runD);
    const rows = (await board(open.id, users.d)).rows;
    assert.deepEqual(rows.map(r => [r.place, r.trainer_name, r.wins, r.runs]), [[1, "이제빈", 1, 1], [2, "박도전", 1, 1]], "a tie goes to the first to reach it");
    assert.equal(rows.find(r => r.mine).trainer_name, "박도전");
  });

  await check("a limit of one counts only the first run", async () => {
    const second = await begin(users.d);
    await win(second); await win(second); await win(second);
    assert.equal((await board(code.id)).rows.find(r => r.trainer_name === "박도전").wins, 1, "the code cup counts d's first run only");
    assert.equal((await board(open.id)).rows[0].trainer_name, "박도전", "the open cup (no limit) counts it");
  });

  await check("passing everyone at 2 wins and more alerts the other players once", async () => {
    const out = () => q("select dedup, auth_user_id, body, url from public.push_outbox where dedup like 'cup:' || $1 || ':%' order by id", [open.id]);
    const before = (await out()).length;
    await win(runA); await win(runA); await win(runA);  // a: 4, passing d's 3 at 4
    const now = await out();
    assert.equal(now.length - before, 1, "one alert, to d");
    const last = now.at(-1);
    assert.equal(last.auth_user_id, users.d);
    assert.match(last.body, /이제빈 님이 4연승으로 정모 등반전 1위에 올랐습니다/);
    assert.equal(last.url, `?view=battle&tab=streak&cup=${open.id}`);
    await win(runA);  // still first: no new alert
    assert.equal((await out()).length, now.length);
  });

  await check("after the close nothing changes, and closing is the host's", async () => {
    await assert.rejects(call(users.d, "select public.tower_cup_close($1) as r", [open.id]), /연 사람만/);
    await q("update public.tower_cups set starts_at = now() - interval '1 hour' where id = $1", [open.id]);
    assert.equal((await call(users.a, "select public.tower_cup_close($1) as r", [open.id])).r.gone, false);
    const frozen = (await board(open.id)).rows.map(r => r.wins);
    await win(runA);
    const late = await begin(users.d);
    await win(late);
    assert.deepEqual((await board(open.id)).rows.map(r => r.wins), frozen);
    await assert.rejects(join(users.b, open.id), /마감된 등반전/);
    assert.ok(!(await board(open.id)).rows.some(r => r.live));
    const fresh = await create(users.a);  // the last one ended, so a new one may open
    await q("update public.tower_cups set starts_at = now() + interval '1 hour', ends_at = now() + interval '2 hours' where id = $1", [fresh.id]);
    assert.equal((await call(users.a, "select public.tower_cup_close($1) as r", [fresh.id])).r.gone, true, "a cup not yet begun is taken away");
    assert.equal(await board(fresh.id), null);
  });

  await check("a run of 오늘의 탑 never counts", async () => {
    const cup = await create(users.d);
    await win(await begin(users.d, true));
    assert.equal((await board(cup.id)).rows[0].runs, 0);
  });

  console.log(`\n${checks} checks passed`);
} finally {
  await pg.close();
}

