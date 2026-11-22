import test from "node:test";
import assert from "node:assert/strict";
import { buildPrivateGraph } from "../src/services/privateBracket.js";
import { collectGraphMatches } from "../src/services/bracketWinnerPlan.js";
import { lowerPlacements } from "../src/services/bracketLowerPlacements.js";

const ids = n => Array.from({ length: n }, (_, i) => `p${i + 1}`);
const playAll = g => { for (const m of collectGraphMatches(g)) if (m !== g.reset) m.winner = "a"; return g; };

test("a single elimination of 16 seats its quarterfinal losers 5th to 8th and its first-round losers 9th to 16th", () => {
  const g = playAll(buildPrivateGraph(ids(16), { order: "seed", random: () => 0.5 }));
  assert.notEqual(g.kind, "double");
  const rows = lowerPlacements({ graph: g });
  assert.equal(rows.length, 12);
  assert.deepEqual(new Set(rows.filter(r => r.placement_label === "8강").map(r => `${r.rank_min}-${r.rank_max}`)), new Set(["5-8"]));
  assert.equal(rows.filter(r => r.placement_label === "8강").length, 4);
  assert.deepEqual(new Set(rows.filter(r => r.placement_label === "16강").map(r => `${r.rank_min}-${r.rank_max}`)), new Set(["9-16"]));
});

test("a double elimination of 8 seats the losers' early rounds after the four who reached its last two", () => {
  const g = playAll(buildPrivateGraph(ids(8), { double: true, order: "seed", random: () => 0.5 }));
  assert.equal(g.kind, "double");
  const rows = lowerPlacements({ graph: g });
  assert.equal(rows.length, 4);
  assert.equal(new Set(rows.map(r => r.participantId)).size, 4);
  assert.ok(rows.every(r => r.rank_min >= 5 && r.rank_max <= 8));
});

test("group stage leavers rank after everyone in the knockout", () => {
  const knockout = playAll(buildPrivateGraph(["p1", "p2", "p3", "p4"], { order: "seed", random: () => 0.5 }));
  const rows = lowerPlacements({ format: "group", knockout, groups: [{ members: ["p1", "p2", "p5"] }, { members: ["p3", "p4", "p6"] }] });
  assert.deepEqual(rows.map(r => [r.participantId, r.rank_min, r.rank_max, r.placement_label]), [["p5", 5, 6, "공동 5위"], ["p6", 5, 6, "공동 5위"]]);
});
