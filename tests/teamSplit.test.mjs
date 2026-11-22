import test from "node:test";
import assert from "node:assert/strict";
import { splitTeams } from "../src/services/teamSplit.js";

test("applicants are dealt in a snake by points, every one placed once, the teams near even", () => {
  const pts = { a: 90, b: 80, c: 70, d: 60, e: 50, f: 40, g: 30, h: 20 };
  const teams = splitTeams(Object.keys(pts), n => pts[n], 4, () => 0.5);
  assert.deepEqual(teams.map(t => t.members), [["a", "h"], ["b", "g"], ["c", "f"], ["d", "e"]]);
  assert.deepEqual(teams.map(t => t.points), [110, 110, 110, 110]);
  const odd = splitTeams(["x", "y", "z", "x", " "], () => 0, 2);
  assert.equal(odd.flatMap(t => t.members).sort().join(), "x,y,z");
});
