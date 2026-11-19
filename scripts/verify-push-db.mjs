// Disposable PostgreSQL check of docs/db/push_kinds.sql. Never connects to Supabase.
//   node scripts/verify-push-db.mjs <path-to-pglite-dist/index.js>
// The tables push_kinds.sql reads are built with the columns it uses (as the live database has them, 2026-11-18), then
// announcement_push.sql and push_kinds.sql (twice) run on top, and every rule is tried as service_role, anon and a signed-in account.
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
async function check(name, run) { await pg.exec("reset role"); await run(); await pg.exec("reset role"); checks++; console.log(`PASS ${name}`); }

await pg.exec(`
  create role anon; create role authenticated; create role service_role bypassrls;
  create schema auth;
  create table auth.users (id uuid primary key);
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub', '')::uuid $$;
  grant usage on schema auth to anon, authenticated, service_role;
  grant execute on function auth.uid() to anon, authenticated, service_role;

  create schema ypl_schema_validation;
  create table ypl_schema_validation.events (id uuid primary key, name text not null, status text not null, record_applied_at timestamptz);
  create table ypl_schema_validation.bracket_runtimes (id uuid primary key, event_id uuid not null, created_at timestamptz not null default now());
  create table ypl_schema_validation.matches (id uuid primary key, event_id uuid, entry_a_id uuid, entry_b_id uuid, source_node_key text);
  create table ypl_schema_validation.event_registrations (id uuid primary key, registration_name text not null);
  create table ypl_schema_validation.entry_participants (id uuid primary key, event_id uuid, entry_id uuid, registration_id uuid, player_id uuid);

  create table public.site_data (key text primary key, value jsonb);
  create table public.player_accounts (
    auth_user_id uuid primary key references auth.users (id) on delete cascade,
    requested_name text not null,
    name_key text generated always as (lower(regexp_replace(requested_name, '\\s', '', 'g'))) stored,
    player_id uuid, status text not null default 'pending'
  );
  create table public.community_items (
    id text primary key, board text not null, parent_id text, payload jsonb not null,
    secret boolean not null default false, has_pin boolean not null default false, created_at timestamptz not null default now()
  );
  create table public.battles (
    id text primary key, kind text not null default 'friendly', status text not null default 'waiting', p1_name text not null,
    event_id uuid, source_node_key text, p1_entry_id uuid
  );
  create table public.streak_runs (
    id uuid primary key default gen_random_uuid(), auth_user_id uuid not null references auth.users (id), trainer_name text not null,
    month date not null, wins integer not null default 0, daily date,
    started_at timestamptz not null default now(), last_win_at timestamptz
  );
`);
await pg.exec(readFileSync("docs/db/announcement_push.sql", "utf8"));

const EP = n => `https://fcm.googleapis.com/fcm/send/${n}`;
const save = (n, role = "anon", user = null) => as(role, user).then(() => q("select public.save_push_subscription($1, 'key', 'auth')", [EP(n)]));
await save("old");  // subscribed before the kinds existed
await pg.exec("reset role");

const sql = readFileSync("docs/db/push_kinds.sql", "utf8");
await pg.exec(sql);
await pg.exec(sql); // the file must be safe to run again

// the board written as an account (docs/db/community_accounts.sql) on top: the closed pins of visitor_gates.sql, an admin switch, the
// read grants the live table has, then the file twice
const gates = readFileSync("docs/db/visitor_gates.sql", "utf8");
await pg.exec(gates.slice(gates.indexOf("-- 1."), gates.indexOf("-- 2.")));
await pg.exec(`
  create or replace function ypl_schema_validation.is_ypl_admin() returns boolean language sql stable as $$
    select coalesce(current_setting('test.admin', true), '') = 'on' $$;
  grant usage on schema ypl_schema_validation to anon, authenticated, service_role;
  grant execute on function ypl_schema_validation.is_ypl_admin() to anon, authenticated, service_role;
  alter table public.community_items enable row level security;
  grant select on table public.community_items to anon, authenticated;
`);
const accounts = readFileSync("docs/db/community_accounts.sql", "utf8");
await pg.exec(accounts);
await pg.exec(accounts);
const inboxSql = readFileSync("docs/db/push_inbox.sql", "utf8");
await pg.exec(inboxSql);
await pg.exec(inboxSql);

const users = {};
for (const key of ["a", "b", "c", "d"]) { users[key] = randomUUID(); await q("insert into auth.users values ($1)", [users[key]]); }
const DAY = "2026-11-18T03:00:00Z", NIGHT = "2026-11-18T15:00:00Z"; // 12:00 and 24:00 in Seoul
const take = async (sweep = false, at = DAY) => { await as("service_role"); return q("select * from public.push_take($1, $2)", [sweep, at]); };
const settings = async n => { await as("anon"); return (await one("select public.push_settings($1) as s", [EP(n)])).s; };
const setKinds = async (n, kinds) => { await as("anon"); return (await one("select public.set_push_kinds($1, $2) as s", [EP(n), kinds])).s; };
const to = (rows, n) => rows.filter(r => r.endpoint === EP(n));

try {
  await check("a subscription saved before keeps only notices; a new one takes notices, its own matches and replies to it", async () => {
    assert.deepEqual(await settings("old"), { kinds: ["notice"], linked: false });
    await save("new");
    assert.deepEqual(await settings("new"), { kinds: ["notice", "match", "reply"], linked: false });
    assert.equal(await settings("nobody"), null);
  });

  await check("saving while signed in links the account from the session; saving signed out unlinks it", async () => {
    await save("a", "authenticated", users.a);
    assert.equal((await settings("a")).linked, true);
    await pg.exec("reset role");
    assert.equal((await one("select auth_user_id from public.push_subscriptions where endpoint = $1", [EP("a")])).auth_user_id, users.a);
    await save("a");
    assert.equal((await settings("a")).linked, false);
    await save("a", "authenticated", users.a);
    for (const [n, u] of [["b", users.b], ["c", users.c], ["d", users.d]]) await save(n, "authenticated", u);
  });

  await check("visitors reach their own settings only through the functions", async () => {
    await as("anon");
    await assert.rejects(q("select * from public.push_subscriptions"), /permission denied/);
    await assert.rejects(q("select * from public.push_outbox"), /permission denied/);
    await assert.rejects(q("select * from public.push_take()"), /permission denied/);
    await assert.rejects(q("insert into public.push_outbox (dedup, kind, title, body, url) values ('x', 'notice', 't', 'b', '?view=news')"), /permission denied/);
    await assert.rejects(setKinds("a", ["notice", "spam"]), /알 수 없는 알림 종류/);
    assert.deepEqual((await setKinds("a", ["match", "notice", "match", "tower"])).kinds, ["match", "notice", "tower"]);
    assert.equal(await setKinds("nobody", ["notice"]), null);
  });

  await check("a notice goes once to every device that keeps notices, day or night", async () => {
    await as("service_role");
    await q("select public.push_queue_notice('n1', '새 공지')");
    await assert.rejects(q("insert into public.push_outbox (dedup, kind, title, body, url) values ('x', 'notice', 't', 'b', '?view=news')"), /permission denied/, "only through the functions");
    const rows = await take(false, NIGHT);
    assert.deepEqual(rows.map(r => r.endpoint).sort(), ["old", "new", "a", "b", "c", "d"].map(EP).sort());
    assert.ok(rows.every(r => r.kind === "notice" && r.url === "?view=news&notice=n1"));
    assert.equal((await take(false, NIGHT)).length, 0, "taken once");
    await as("service_role");
    await q("select public.push_queue_notice('n1', '새 공지')");
    assert.equal((await take()).length, 0, "the same notice saved again is not sent again");
  });

  const event = randomUUID(), entryA = randomUUID(), entryB = randomUUID();
  await check("the first player into an official match's battle tells the other side's account, at once, at night too", async () => {
    const regA = randomUUID(), regB = randomUUID(), playerB = randomUUID();
    await pg.exec("reset role");
    await q("insert into public.player_accounts (auth_user_id, requested_name, player_id, status) values ($1, '이 제빈', null, 'approved'), ($2, '김선수', $3, 'approved'), ($4, '대기중', null, 'pending')", [users.a, users.b, playerB, users.c]);
    await q("insert into ypl_schema_validation.event_registrations values ($1, '이제빈'), ($2, '김 선수')", [regA, regB]);
    await q("insert into ypl_schema_validation.entry_participants values ($1, $2, $3, $4, null), ($5, $2, $6, $7, $8)", [randomUUID(), event, entryA, regA, randomUUID(), entryB, regB, playerB]);
    await q("insert into ypl_schema_validation.matches values ($1, $2, $3, $4, 'single:w1:1')", [randomUUID(), event, entryA, entryB]);
    // b (김선수, linked by player id) opens the room: a (이제빈, a new trainer linked by name) is told
    await q("insert into public.battles (id, kind, p1_name, event_id, source_node_key, p1_entry_id) values ('bat1', 'official', '김선수', $1, 'single:w1:1', $2)", [event, entryB]);
    await q("insert into public.battles (id, kind, p1_name) values ('fr1', 'friendly', '아무개')");
    // a battle whose match cannot be found is still written
    await q("insert into public.battles (id, kind, p1_name, event_id, source_node_key, p1_entry_id) values ('bat2', 'official', '김선수', $1, 'nowhere', $2)", [randomUUID(), entryB]);
    const rows = await take(false, NIGHT);
    assert.equal(rows.length, 1);
    assert.deepEqual([rows[0].kind, rows[0].endpoint, rows[0].body, rows[0].url], ["match", EP("a"), "김선수 님이 배틀에서 기다립니다.", `?view=battle&event=${event}&match=single:w1:1`]);
    // a team bout's key finds its parent match; the other side's account (b) is told this time
    await pg.exec("reset role");
    await q("insert into public.battles (id, kind, p1_name, event_id, source_node_key, p1_entry_id) values ('bat3', 'official', '이제빈', $1, 'single:w1:1:bout:2', $2)", [event, entryA]);
    assert.deepEqual((await take(false, NIGHT)).map(r => r.endpoint), [EP("b")]);
  });

  await check("an alert that fails to be made never stops the battle or the run being written", async () => {
    await pg.exec("reset role");
    await pg.exec("alter table ypl_schema_validation.matches rename to matches_gone; alter table public.player_accounts rename to accounts_gone");
    try {
      await q("insert into public.battles (id, kind, p1_name, event_id, source_node_key, p1_entry_id) values ('bat9', 'official', '김선수', $1, 'single:w1:1', $2)", [event, entryB]);
      const run = (await one("insert into public.streak_runs (auth_user_id, trainer_name, month, wins, last_win_at) values ($1, '김선수', '2026-10-01', 1, now()) returning id", [users.b])).id;
      await q("update public.streak_runs set wins = 2, last_win_at = now() where id = $1", [run]);
      assert.equal((await one("select count(*)::int as c from public.battles where id = 'bat9'")).c, 1);
    } finally {
      await pg.exec("alter table ypl_schema_validation.matches_gone rename to matches; alter table public.accounts_gone rename to player_accounts");
    }
  });

  await check("a device that turned matches off, or is not signed in, is not told", async () => {
    await setKinds("a", ["notice"]);
    await pg.exec("reset role");
    await q("insert into public.battles (id, kind, p1_name, event_id, source_node_key, p1_entry_id) values ('bat4', 'official', '김선수', $1, 'single:w1:1', $2)", [event, entryB]);
    assert.equal((await take()).length, 0);
    await setKinds("a", ["notice", "match", "tower"]);
  });

  await check("passing someone on this month's tower board tells them, once in six hours a device, by day only", async () => {
    await pg.exec("reset role");
    const month = "2026-11-01";
    const run = async (user, name, wins, reached, daily = null) => (await one(
      "insert into public.streak_runs (auth_user_id, trainer_name, month, wins, last_win_at, started_at, daily) values ($1, $2, $3, $4, $5, $5::timestamptz - interval '1 hour', $6) returning id",
      [user, name, month, wins, wins ? reached : null, daily])).id;
    await setKinds("b", ["tower"]); await setKinds("d", ["tower"]);
    await pg.exec("reset role");
    await run(users.a, "이제빈", 3, "2026-11-10T00:00:00Z");      // a reached 3 first
    await run(users.b, "김선수", 3, "2026-11-12T00:00:00Z");      // b reached 3 later
    const dRun = await run(users.d, "박선수", 3, "2026-11-11T00:00:00Z"); // d between them
    await run(users.c, "대기중", 2, "2026-11-01T00:00:00Z");
    // d wins its fourth: a stood above d (passed), b stood below (not passed), c is lower
    await q("update public.streak_runs set wins = 4, last_win_at = now() where id = $1", [dRun]);
    assert.equal((await take(false, NIGHT)).length, 0, "waits for the morning");
    let rows = await take();
    assert.deepEqual(rows.map(r => [r.kind, r.endpoint, r.body]), [["tower", EP("a"), "박선수 님이 4연승으로 이번 달 순위에서 앞섰습니다."]]);
    // b passes a again: a was told within six hours, so nothing; a daily run never counts
    await pg.exec("reset role");
    const bRun = (await one("select id from public.streak_runs where auth_user_id = $1 and month = $2", [users.b, month])).id;
    await q("update public.streak_runs set wins = 4, last_win_at = now() where id = $1", [bRun]);
    await q("update public.streak_runs set wins = 5, last_win_at = now() where id = $1", [bRun]);
    rows = await take();
    assert.deepEqual(rows.map(r => r.endpoint), [EP("d")], "d (told nothing yet) hears of b; a is quiet for six hours");
    await pg.exec("reset role");
    const daily = await run(users.c, "대기중", 1, "2026-11-18T00:00:00Z", "2026-11-18");
    await q("update public.streak_runs set wins = 9, last_win_at = now() where id = $1", [daily]);
    assert.equal((await take()).length, 0);
  });

  await check("taking this month's first place tells every device that keeps records, once a record, by day only", async () => {
    await pg.exec("reset role");
    const month = "2026-12-01";
    const run = async (user, name, wins) => (await one(
      "insert into public.streak_runs (auth_user_id, trainer_name, month, wins, last_win_at) values ($1, $2, $3, $4, now()) returning id", [user, name, month, wins])).id;
    const win = async (id, wins) => { await pg.exec("reset role"); await q("update public.streak_runs set wins = $2, last_win_at = now() where id = $1", [id, wins]); };
    await take(); // nothing left from the checks before
    await setKinds("a", ["record"]); await setKinds("b", ["notice", "record"]); await setKinds("d", ["tower"]);
    await pg.exec("reset role");
    const top = await run(users.a, "이제빈", 5);
    const chaser = await run(users.b, "김선수", 4);
    await win(chaser, 5);                       // equal to first place is not past it
    assert.equal((await take()).length, 0);
    await win(chaser, 6);                       // past it: a record, to both devices that keep records, none that does not
    assert.equal((await take(false, NIGHT)).length, 0, "waits for the morning");
    const rows = await take();
    assert.deepEqual(rows.map(r => [r.kind, r.endpoint, r.body]).sort(), [
      ["record", EP("a"), "김선수 님이 6연승으로 이번 달 1위 기록을 새로 썼습니다."],
      ["record", EP("b"), "김선수 님이 6연승으로 이번 달 1위 기록을 새로 썼습니다."]]);
    await win(chaser, 7); await win(chaser, 8);  // first place growing its own record is not a new record taken
    assert.equal((await take()).length, 0);
    await win(top, 6); await win(top, 7); await win(top, 8); await win(top, 9); // a passes 8: a new record
    assert.deepEqual((await take()).map(r => r.body), ["이제빈 님이 9연승으로 이번 달 1위 기록을 새로 썼습니다.", "이제빈 님이 9연승으로 이번 달 1위 기록을 새로 썼습니다."]);
    await pg.exec("reset role");
    const daily = (await one("insert into public.streak_runs (auth_user_id, trainer_name, month, wins, daily) values ($1, '대기중', $2, 1, '2026-12-02') returning id", [users.c, month])).id;
    await win(daily, 30);                       // the day's tower never counts
    assert.equal((await take()).length, 0);
  });

  await check("the sweep announces a closing application, a new bracket, applied results and the day's tower, once each, by day", async () => {
    await pg.exec("reset role");
    const soon = new Date(Date.now() + 5 * 3600e3);
    const kst = new Date(soon.getTime() + 9 * 3600e3).toISOString().slice(0, 16); // the editor's wall time in Seoul
    await q("insert into public.site_data values ('ypl_data_v4', $1)", [JSON.stringify({ announcements: [
      { id: "n9", title: "37회 파이컵", form: { enabled: true, closesAt: kst } },
      { id: "n8", title: "지난 대회", form: { enabled: true, closesAt: "2026-01-01T00:00" } },
      { id: "n7", title: "꺼진 신청서", form: { enabled: false, closesAt: kst } },
      { id: "n6", title: "망가진 시각", form: { enabled: true, closesAt: "언젠가" } },
    ] })]);
    const ev = randomUUID(), old = randomUUID(), done = randomUUID();
    await q("insert into ypl_schema_validation.events values ($1, '37회 파이컵', 'running', null), ($2, '예전 대회', 'completed', now() - interval '30 days'), ($3, '36회 파이컵', 'completed', now())", [ev, old, done]);
    await q("insert into ypl_schema_validation.bracket_runtimes values ($1, $2, now()), ($3, $4, now() - interval '30 days')", [randomUUID(), ev, randomUUID(), old]);
    await setKinds("new", ["schedule", "daily"]);
    assert.equal((await take(true, NIGHT)).length, 0, "nothing at night");
    const rows = await take(true);
    const said = to(rows, "new").map(r => `${r.title}|${r.body}|${r.url}`).sort();
    const at = new Date(soon.getTime() + 9 * 3600e3);
    const h = at.getUTCHours();
    const clock = `${at.getUTCMonth() + 1}월 ${at.getUTCDate()}일 ${h < 12 ? "오전" : "오후"} ${h % 12 || 12}:${String(at.getUTCMinutes()).padStart(2, "0")}`;
    assert.deepEqual(said, [
      `결과 등록|36회 파이컵 결과를 기록에 반영했습니다.|?view=bracket&eventId=${done}`,
      `대진표 공개|37회 파이컵 대진표를 공개했습니다.|?view=bracket&eventId=${ev}`,
      `신청 마감 임박|37회 파이컵 신청이 ${clock}에 마감됩니다.|?view=news&notice=n9`,
      "오늘의 탑|오늘의 탑이 열렸습니다.|?view=battle&tab=streak",
    ].sort());
    assert.equal(to(rows, "old").length, 0, "kept notices only");
    assert.equal(to(await take(true), "new").length, 0, "once each");
  });

  await check("board: new public posts since a device's last board alert come as one alert, at most hourly", async () => {
    await setKinds("c", ["board"]);
    await pg.exec("reset role");
    await q("update public.push_subscriptions set board_pushed_at = now() - interval '2 hours' where endpoint = $1", [EP("c")]);
    await q("insert into public.community_items (id, board, parent_id, payload, secret, created_at) values ('p0', 'free', null, '{\"title\": \"옛 글\"}', false, now() - interval '3 hours')");
    await q("insert into public.community_items (id, board, parent_id, payload, secret) values ('p1', 'free', null, '{\"title\": \"첫 글\"}', false)");
    await q("insert into public.community_items (id, board, parent_id, payload, secret) values ('c1', 'free', 'p1', '{\"body\": \"댓글\"}', false)");
    await q("insert into public.community_items (id, board, parent_id, payload, secret) values ('s1', 'free', null, '{\"title\": \"비밀\"}', true)");
    await q("insert into public.community_items (id, board, parent_id, payload, secret) values ('pb', 'private_bracket', null, '{\"title\": \"사설\"}', false)");
    let rows = to(await take(true), "c");
    assert.deepEqual(rows.map(r => [r.kind, r.title, r.body, r.url]), [["board", "게시판 새 글", "첫 글", "?view=board&tab=free&post=p1"]]);
    await pg.exec("reset role");
    await q("insert into public.community_items (id, board, parent_id, payload, secret) values ('p2', 'showcase', null, '{\"title\": \"파티 소개\", \"kind\": \"party\"}', false)");
    assert.equal(to(await take(true), "c").length, 0, "within the hour");
    await pg.exec("reset role");
    // an hour on: the clock is moved back instead of waiting (p1 was already told)
    await q("update public.push_subscriptions set board_pushed_at = now() - interval '61 minutes' where endpoint = $1", [EP("c")]);
    await q("update public.community_items set created_at = now() - interval '2 hours' where id = 'p1'");
    await q("insert into public.community_items (id, board, parent_id, payload, secret) values ('p3', 'showcase', null, '{\"title\": \"샘플\", \"kind\": \"sample\"}', false)");
    rows = to(await take(true), "c");
    assert.equal(rows.length, 1);
    assert.match(rows[0].body, / 외 1개$/);
    assert.equal(rows[0].url, "?view=board");
    // turning the board on again starts counting from then
    await setKinds("c", []);
    await setKinds("c", ["board"]);
    await pg.exec("reset role");
    assert.ok((await one("select board_pushed_at > now() - interval '1 minute' as fresh from public.push_subscriptions where endpoint = $1", [EP("c")])).fresh);
  });

  await check("an approved account writes in its own name, and only it edits or deletes what it wrote", async () => {
    await pg.exec("reset role");
    await q("insert into public.player_accounts (auth_user_id, requested_name, status) values ($1, '이제빈', 'approved'), ($2, '김선수', 'approved'), ($3, '대기중', 'pending') on conflict (auth_user_id) do update set requested_name = excluded.requested_name, status = excluded.status", [users.a, users.b, users.c]);
    const write = (user, action, id, payload = {}, { parent = null, pin = "", board = "free", secret = false } = {}) =>
      as(user ? "authenticated" : "anon", user).then(() => one("select public.community_write($1, $2, $3, $4, $5, $6, $7) as r", [action, board, id, parent, payload, secret, pin])).then(r => r.r);
    assert.equal(await write(users.a, "create", "acct1", { nick: "가짜이름", title: "제목", body: "본문", _byAccount: true }), "ok");
    await pg.exec("reset role");
    let row = await one("select payload, has_pin, by_account from public.community_items where id = 'acct1'");
    assert.deepEqual([row.payload.nick, row.payload._byAccount, row.has_pin, row.by_account], ["이제빈", undefined, false, true]);
    await assert.rejects(write(users.c, "create", "acct2", { nick: "x", _byAccount: true }), /승인된 계정/);
    await assert.rejects(write(null, "create", "acct3", { nick: "x", _byAccount: true }), /승인된 계정/);
    await assert.rejects(write(users.a, "create", "acct4", { name: "x", _byAccount: true }, { board: "private_bracket", pin: "1234" }), /사설 대진표/);
    await as("anon");
    await assert.rejects(q("select * from public.community_authors"), /permission denied/);
    // the author edits without a pin and cannot rename itself; another account, a stranger and a pin are refused; an admin may
    assert.equal(await write(users.a, "update", "acct1", { nick: "바꾼이름", body: "고친 본문" }), "ok");
    await pg.exec("reset role");
    row = await one("select payload from public.community_items where id = 'acct1'");
    assert.deepEqual([row.payload.nick, row.payload.body], ["이제빈", "고친 본문"]);
    assert.equal(await write(users.b, "update", "acct1", { body: "남의 글" }), "not_yours");
    assert.equal(await write(null, "delete", "acct1", {}, { pin: "1234" }), "not_yours");
    assert.equal(await write(users.b, "verify", "acct1"), "not_yours");
    assert.equal(await write(users.a, "verify", "acct1"), "ok");
    await pg.exec("set test.admin = 'on'");
    assert.equal(await write(null, "update", "acct1", { body: "운영진" }), "ok");
    await pg.exec("reset test.admin");
    // a pin post is as before
    assert.equal(await write(null, "create", "pin1", { nick: "손님", title: "t" }, { pin: "1234" }), "ok");
    assert.equal(await write(users.a, "update", "pin1", { body: "x" }, { pin: "0000" }), "wrong_pin");
    assert.equal(await write(null, "update", "pin1", { body: "x" }, { pin: "1234" }), "ok");
    assert.equal(await write(users.b, "delete", "acct1"), "not_yours");
    assert.equal(await write(users.a, "delete", "acct1"), "ok");
    await pg.exec("reset role");
    assert.equal((await one("select count(*)::int as n from public.community_authors where item_id = 'acct1'")).n, 0);
  });

  await check("private brackets keep their pin and their stale check under the new writer", async () => {
    const write = (action, id, payload = {}, pin = "2468") => as("anon").then(() => one("select public.community_write($1, 'private_bracket', $2, null, $3, false, $4) as r", [action, id, payload, pin])).then(r => r.r);
    await assert.rejects(write("create", "nopin", {}, ""), /비밀번호/);
    assert.equal(await write("create", "privatea", { name: "A", graph: { first: null } }), "ok");
    assert.equal(await write("verify", "privatea", {}, "0000"), "wrong_pin");
    await pg.exec("reset role");
    const at = (await one("select payload->>'updatedAt' as at from public.community_items where id = 'privatea'")).at;
    assert.equal(await write("update", "privatea", { graph: { first: "A" }, _expectedUpdatedAt: at }), "ok");
    assert.equal(await write("update", "privatea", { graph: { first: "B" }, _expectedUpdatedAt: at }), "stale");
    assert.equal(await write("update", "privatea", { name: "old client" }), "stale");
    await pg.exec("reset role");
    const row = await one("select payload from public.community_items where id = 'privatea'");
    assert.deepEqual([row.payload.graph.first, "_expectedUpdatedAt" in row.payload], ["A", false]);
    assert.equal(await write("delete", "privatea"), "ok");
  });

  await check("an account reads its own secret post and what was said under it; nobody else does", async () => {
    const write = (user, id, payload, opts = {}) => as(user ? "authenticated" : "anon", user)
      .then(() => one("select public.community_write('create', 'free', $1, $2, $3, $4, '') as r", [id, opts.parent || null, payload, opts.secret || false]));
    await write(users.a, "secret1", { title: "건의", body: "비밀", _byAccount: true }, { secret: true });
    await pg.exec("set test.admin = 'on'");
    await write(null, "secret1c", { nick: "운영진", body: "답변" }, { parent: "secret1" });
    await pg.exec("reset test.admin");
    const seen = async (role, user) => { await as(role, user); return (await q("select id from public.community_items where id like 'secret1%' order by id")).map(r => r.id); };
    assert.deepEqual(await seen("authenticated", users.a), ["secret1", "secret1c"]);
    assert.deepEqual(await seen("authenticated", users.b), []);
    assert.deepEqual(await seen("anon"), []);
  });

  await check("a reply to what an account wrote tells that account's devices, never the writer itself, by day", async () => {
    await take(); // nothing left from the checks before
    await setKinds("a", ["reply"]); await setKinds("b", ["reply"]); await setKinds("d", ["notice"]);
    const write = (user, id, payload, parent) => as(user ? "authenticated" : "anon", user)
      .then(() => one("select public.community_write('create', 'free', $1, $2, $3, false, '') as r", [id, parent || null, payload]));
    await write(users.a, "post1", { title: "글", body: "본문", _byAccount: true });
    await write(users.a, "post1a", { body: "내가 단 댓글", _byAccount: true }, "post1");       // the writer's own comment: nobody
    assert.equal((await take()).length, 0);
    await write(users.b, "post1b", { body: "김선수의 댓글", _byAccount: true }, "post1");     // to a (the post's)
    assert.equal((await take(false, NIGHT)).length, 0, "waits for the morning");
    let rows = await take();
    assert.deepEqual(rows.map(r => [r.kind, r.endpoint, r.body, r.url]), [["reply", EP("a"), "김선수 님이 내 글에 댓글을 남겼습니다: 김선수의 댓글", "?view=board&tab=free&post=post1"]]);
    await write(null, "post1c", { nick: "손님", body: "답글", replyTo: "post1b" }, "post1");   // to b (the comment's) and a (the post's)
    rows = await take();
    assert.deepEqual(rows.map(r => [r.endpoint, r.body]).sort(), [
      [EP("a"), "손님 님이 내 글에 댓글을 남겼습니다: 답글"],
      [EP("b"), "손님 님이 내 댓글에 답글을 남겼습니다: 답글"]]);
    await write(users.a, "post1d", { body: "고마워요", replyTo: "post1b", _byAccount: true }, "post1"); // a answers b: only b
    rows = await take();
    assert.deepEqual(rows.map(r => [r.endpoint, r.body]), [[EP("b"), "이제빈 님이 내 댓글에 답글을 남겼습니다: 고마워요"]]);
    // a secret post's alert says nothing of what was written
    await pg.exec("set test.admin = 'on'");
    await write(null, "secret1d", { nick: "운영진", body: "비밀 답변" }, "secret1");
    await pg.exec("reset test.admin");
    rows = await take();
    assert.deepEqual(rows.map(r => [r.endpoint, r.body]), [[EP("a"), "운영진 님이 내 글에 댓글을 남겼습니다."]]);
  });

  await check("outbox rows older than a day are never sent", async () => {
    await pg.exec("reset role");
    await q("insert into public.push_outbox (dedup, kind, title, body, url, created_at) values ('notice:late', 'notice', 'YPL 공지', '늦은 공지', '?view=news', now() - interval '2 days')");
    assert.equal((await take()).length, 0);
  });

  await check("the inbox reads this week's alerts of the asked kinds: everyone's, the reader's own, and the board's open posts", async () => {
    await pg.exec("reset role");
    await q("delete from public.push_outbox"); await q("delete from public.community_items");
    await q(`insert into public.push_outbox (dedup, kind, auth_user_id, title, body, url, created_at) values
      ('i1', 'record', null, '도전의 탑 신기록', '모두의 신기록', '?view=battle&tab=streak', now() - interval '1 hour'),
      ('i2', 'tower', $1, '도전의 탑', 'a의 순위', '?view=battle&tab=streak', now() - interval '2 hours'),
      ('i3', 'tower', $2, '도전의 탑', 'b의 순위', '?view=battle&tab=streak', now() - interval '3 hours'),
      ('i4', 'record', null, '도전의 탑 신기록', '지난주 신기록', '?view=battle&tab=streak', now() - interval '8 days'),
      ('i5', 'daily', null, '오늘의 탑', '오늘의 탑이 열렸습니다.', '?view=battle&tab=streak', now() - interval '1 hour')`, [users.a, users.b]);
    await q(`insert into public.community_items (id, board, parent_id, payload, secret, created_at) values
      ('ib1', 'showcase', null, '{"title":"샘플 글","kind":"sample"}', false, now() - interval '30 minutes'),
      ('ib2', 'free', null, '{"title":"비밀 글"}', true, now() - interval '30 minutes'),
      ('ib3', 'free', 'ib1', '{"body":"댓글"}', false, now() - interval '30 minutes'),
      ('ib4', 'free', null, '{"title":"옛 글"}', false, now() - interval '8 days')`);
    const inbox = async (kinds, role = "anon", user = null) => { await as(role, user); return q("select kind, body, url from public.push_inbox($1)", [kinds]); };
    assert.deepEqual(await inbox(["record", "tower", "daily"]), [{ kind: "record", body: "모두의 신기록", url: "?view=battle&tab=streak" }]);
    assert.deepEqual((await inbox(["record", "tower"], "authenticated", users.a)).map(r => r.body), ["모두의 신기록", "a의 순위"]);
    assert.deepEqual(await inbox(["tower"], "authenticated", users.c), []);
    assert.deepEqual(await inbox(["board"]), [{ kind: "board", body: "샘플 글", url: "?view=board&tab=sample&post=ib1" }]);
    assert.deepEqual((await inbox(["board", "record"])).map(r => r.kind), ["board", "record"]);
    assert.deepEqual(await inbox([]), []);
    assert.deepEqual(await inbox(null), []);
  });

  console.log(`\n${checks} checks passed`);
} catch (error) {
  console.error(`FAIL: ${error.message}`);
  process.exitCode = 1;
} finally {
  await pg.close();
}
