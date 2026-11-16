// 경기 일정 (docs/db/match_schedule.sql): the read stands aside (null) until the SQL has run, and maps the rows once it has.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../src/services/bracketSchedule.js", import.meta.url), "utf8")
  .replace('import { supa } from "../storage.js";', "const supa = globalThis.__fakeSupa;");
if (source.includes("../storage.js")) throw new Error("bracketSchedule.js no longer imports storage.js the way this test replaces it");

// a supabase-js stand-in: each table answers { data, error } for whatever filter chain is asked of it
function fakeSupa(tables) {
  const chain = result => {
    const q = { select: () => q, eq: () => q, maybeSingle: () => Promise.resolve(result.single ?? result), then: (ok, no) => Promise.resolve(result).then(ok, no) };
    return q;
  };
  return { schema: () => ({ from: name => chain(tables[name]) }) };
}
async function load(tables) {
  globalThis.__fakeSupa = fakeSupa(tables);
  // a fresh module each time (the stand-in is read as it loads)
  return import(`data:text/javascript;base64,${Buffer.from(`${source}\n// ${Math.random()}`).toString("base64")}`);
}

const missingColumn = { data: null, error: { code: "42703", message: "column does not exist" } };

test("before the SQL has run the read is null, so the bracket draws as it did", async () => {
  const absentSchedule = await load({ bracket_runtimes: missingColumn, matches: { data: [], error: null } });
  assert.equal(await absentSchedule.readBracketSchedule({ eventId: "e", runtimeId: "r" }), null);
  const absentTable = await load({ bracket_runtimes: { data: { round_schedule: {} }, error: null }, matches: missingColumn });
  assert.equal(await absentTable.readBracketSchedule({ eventId: "e", runtimeId: "r" }), null);
});

test("no event or runtime reads nothing", async () => {
  const mod = await load({});
  assert.equal(await mod.readBracketSchedule({ eventId: "e" }), null);
  assert.equal(await mod.readBracketSchedule({}), null);
});

test("once it has run, rounds keep valid instants and tables keep labelled matches", async () => {
  const mod = await load({
    bracket_runtimes: { data: { round_schedule: { "single:r1": "2026-11-21T04:00:00+00:00", "single:r2": "nonsense", "single:r3": 5 } }, error: null },
    matches: { data: [
      { source_node_key: "single:r1:m1", table_label: "1" },
      { source_node_key: "single:r1:m2", table_label: "  " },
      { source_node_key: "single:r1:m3", table_label: null },
      { source_node_key: "single:r2:m1", table_label: "3" },
    ], error: null },
  });
  const schedule = await mod.readBracketSchedule({ eventId: "e", runtimeId: "r" });
  assert.deepEqual(schedule.rounds, { "single:r1": "2026-11-21T04:00:00+00:00" });
  assert.deepEqual([...schedule.tables], [["single:r1:m1", "1"], ["single:r2:m1", "3"]]);
});

test("an empty schedule is read, not absent: the operator can set it", async () => {
  const mod = await load({ bracket_runtimes: { data: { round_schedule: {} }, error: null }, matches: { data: [], error: null } });
  const schedule = await mod.readBracketSchedule({ eventId: "e", runtimeId: "r" });
  assert.deepEqual(schedule.rounds, {});
  assert.equal(schedule.tables.size, 0);
});

test("round keys, table words and the event day's instants", async () => {
  const mod = await load({});
  assert.equal(mod.roundKeyOf("single:r2:m1"), "single:r2");
  assert.equal(mod.roundKeyOf("double:l:r3:m2"), "double:l:r3");
  assert.equal(mod.roundKeyOf("double:gf:m1"), "double:gf");
  assert.equal(mod.roundKeyOf("group:g1"), null);
  assert.equal(mod.tableWord("3"), "3번 테이블");
  assert.equal(mod.tableWord("본부석"), "본부석");
  assert.equal(mod.roundStartIso("2026-11-21", "13:00"), "2026-11-21T13:00:00+09:00");
  assert.equal(mod.roundStartIso("2026-11-21", ""), null);
});
