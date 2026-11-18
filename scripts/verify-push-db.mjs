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

const users = {};
for (const key of ["a", "b", "c", "d"]) { users[key] = randomUUID(); await q("insert into auth.users values ($1)", [users[key]]); }
const DAY = "2026-11-18T03:00:00Z", NIGHT = "2026-11-18T15:00:00Z"; // 12:00 and 24:00 in Seoul
const take = async (sweep = false, at = DAY) => { await as("service_role"); return q("select * from public.push_take($1, $2)", [sweep, at]); };
const settings = async n => { await as("anon"); return (await one("select public.push_settings($1) as s", [EP(n)])).s; };
const setKinds = async (n, kinds) => { await as("anon"); return (await one("select public.set_push_kinds($1, $2) as s", [EP(n), kinds])).s; };
const to = (rows, n) => rows.filter(r => r.endpoint === EP(n));

try {
  await check("a subscription saved before keeps only notices; a new one takes notices and its own matches", async () => {
    assert.deepEqual(await settings("old"), { kinds: ["notice"], linked: false });
    await save("new");
    assert.deepEqual(await settings("new"), { kinds: ["notice", "match"], linked: false });
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

  await check("outbox rows older than a day are never sent", async () => {
    await pg.exec("reset role");
    await q("insert into public.push_outbox (dedup, kind, title, body, url, created_at) values ('notice:late', 'notice', 'YPL 공지', '늦은 공지', '?view=news', now() - interval '2 days')");
    assert.equal((await take()).length, 0);
  });

  console.log(`\n${checks} checks passed`);
} catch (error) {
  console.error(`FAIL: ${error.message}`);
  process.exitCode = 1;
} finally {
  await pg.close();
}
