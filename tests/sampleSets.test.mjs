// Every sample set of the current regulation makes sense as a whole (scripts/check-sets.mjs): no Light Clay without a screen, no Heat
// Rock without the sun, no Weather Ball without weather in singles, no ability or item that does nothing for its moves (2026-11-19, the
// owner: "빛의점토인데 벽 기술이 없는 경우 같이 상식에서 벗어난 샘플들 좀 있음. 전부 상식 선에서의 샘플로 완성 부탁").
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { faults } from "../scripts/check-sets.mjs";

const sets = JSON.parse(readFileSync(new URL("../src/data/random-sets.json", import.meta.url), "utf8"));

test("every m-c sample set makes sense", () => {
  const bad = [];
  for (const kind of ["singles", "doubles"]) for (const e of sets["m-c"][kind]) for (const s of e.sets) {
    const f = faults(e.species, s, kind);
    if (f.length) bad.push(`${kind} ${e.species} [${s.items[0]}: ${s.moves.join(", ")}]: ${f.join("; ")}`);
  }
  assert.deepEqual(bad, []);
});

test("the checks catch what they are for", () => {
  const set = (items, moves, ability = "Prankster", nature = "Bold") => ({ items, moves, ability, nature, evs: { hp: 32, def: 32, spd: 2 } });
  assert.ok(faults("Klefki", set(["Light Clay"], ["Draining Kiss", "Thunder Wave", "Spikes", "Foul Play"])).length);
  assert.deepEqual(faults("Klefki", set(["Light Clay"], ["Light Screen", "Reflect", "Thunder Wave", "Draining Kiss"])), []);
  assert.ok(faults("Castform", set(["Life Orb"], ["Weather Ball", "Thunder", "Ice Beam", "Energy Ball"], "Forecast", "Modest")).length);
  assert.ok(faults("Wigglytuff", set(["Leftovers"], ["Calm Mind", "Nasty Plot", "Moonblast", "Flamethrower"], "Competitive", "Calm")).length);
  // a player's set as scripts/learn-cpu-sets.mjs reads it has one item, not a list (that threw from 2026-11-09 to 11-23)
  assert.ok(faults("Klefki", { item: "Life Orb", moves: ["Thunder Wave", "Spikes", "Reflect", "Light Screen"], ability: "Prankster" }).length);
});
