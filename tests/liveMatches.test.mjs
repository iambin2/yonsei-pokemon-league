import assert from "node:assert/strict";
import test from "node:test";
import { liveMatches } from "../src/services/recordsAnalytics.js";

const people = ["a", "b", "c", "d"].map(id => ({ id, name: id.toUpperCase() }));
const graph = winners => ({
  kind: "single",
  rounds: [
    [{ id: "m1", a: { pid: "a" }, b: { pid: "b" }, winner: winners.m1 || null }, { id: "m2", a: { pid: "c" }, b: { pid: "d" }, winner: winners.m2 || null }],
    [{ id: "m3", a: { win: "m1" }, b: { win: "m2" }, winner: winners.m3 || null }],
  ],
});

test("the matches being played are the ones with two players and no winner, with their round's progress", () => {
  const start = liveMatches({ participants: people, graph: graph({}) });
  assert.deepEqual(start.live.map(m => [m.a, m.b, m.stage]), [["A", "B", "4강"], ["C", "D", "4강"]]);
  assert.deepEqual([start.stage, start.done, start.total], ["4강", 0, 2]);
  const half = liveMatches({ participants: people, graph: graph({ m1: "a" }) });
  assert.deepEqual(half.live.map(m => m.id), ["m2"]);
  assert.deepEqual([half.done, half.total], [1, 2]);
  const final = liveMatches({ participants: people, graph: graph({ m1: "a", m2: "b" }) });
  assert.deepEqual(final.live.map(m => [m.a, m.b, m.stage]), [["A", "D", "결승"]]);
  assert.deepEqual(liveMatches({ participants: people, graph: graph({ m1: "a", m2: "b", m3: "a" }) }).live, []);
  assert.deepEqual(liveMatches(null).live, []);
});

test("my next match: the first undecided one I stand in, the opponent once known, nothing when I am out", async () => {
  const { myNextMatch } = await import("../src/services/recordsAnalytics.js");
  const mine = people.map(p => ({ ...p, playerId: `P${p.id}` }));
  const start = myNextMatch({ participants: mine, graph: graph({}) }, "Pa");
  assert.deepEqual([start.id, start.stage, start.me, start.opponent], ["m1", "4강", "A", "B"]);
  const waiting = myNextMatch({ participants: mine, graph: graph({ m1: "a" }) }, "Pa");
  assert.deepEqual([waiting.id, waiting.stage, waiting.opponent], ["m3", "결승", ""], "the final, its other half still played");
  assert.equal(myNextMatch({ participants: mine, graph: graph({ m1: "a" }) }, "Pb"), null, "out");
  assert.equal(myNextMatch({ participants: mine, graph: graph({ m1: "a", m2: "c", m3: "a" }) }, "Pa"), null, "champion");
  assert.equal(myNextMatch({ participants: mine, graph: graph({}) }, "Pz"), null, "not in it");
  const team = [{ id: "t1", name: "팀1", memberIdentities: [{ playerId: "Px" }] }, { id: "t2", name: "팀2" }];
  assert.equal(myNextMatch({ participants: team, graph: { kind: "single", rounds: [[{ id: "m1", a: { pid: "t1" }, b: { pid: "t2" }, winner: null }]] } }, "Px").opponent, "팀2");
  const groups = { participants: mine, groups: [{ name: "A", matches: [{ id: "g1", a: { pid: "a" }, b: { pid: "b" }, winner: "a" }, { id: "g2", a: { pid: "c" }, b: { pid: "a" }, winner: null }] }] };
  assert.deepEqual(Object.values(myNextMatch(groups, "Pa")), ["g2", "A조", "A", "C"]);
});

test("my record: won and lost, a whole rate, and the three opponents met most named by id or by name", async () => {
  const { myMatchRecord } = await import("../src/services/recordsAnalytics.js");
  const m = (won, who) => (who.startsWith("p") ? { won, opponentPlayerId: who } : { won, opponent: who });
  const profile = { matches: [m(true, "p1"), m(false, "p1"), m(false, "p1"), m(true, "이진우"), m(true, "이진우"), m(true, "p3"), m(true, "p4"), { won: null }] };
  const rec = myMatchRecord(profile, id => ({ p1: "김성빈", p3: "강진영", p4: "정두호" })[id]);
  assert.deepEqual([rec.wins, rec.losses, rec.total, rec.rate], [5, 2, 7, 71]);
  assert.deepEqual(rec.rivals.map(r => [r.name, r.wins, r.losses]), [["김성빈", 1, 2], ["이진우", 2, 0], ["강진영", 1, 0]]);
  assert.deepEqual(myMatchRecord({}).rate, null);
});
