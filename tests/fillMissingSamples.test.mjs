import assert from "node:assert/strict";
import test from "node:test";
import { Dex } from "@pkmn/sim";
import * as champions from "@pkmn/mods/champions";
import { fillMissingSamples, generateFallbackSet } from "../scripts/fill-missing-samples.mjs";
import { formatId, validateTeam } from "../supabase/functions/battle/engine.mjs";
import { faults } from "../scripts/check-sets.mjs";

const dex = Dex.mod("champions", champions);

test("generateFallbackSet produces a legal, common-sense-passing set for a species without stats", () => {
  const garchomp = dex.species.get("Garchomp");
  const singlesFmt = formatId("m-c", "singles");
  const doublesFmt = formatId("m-c", "doubles");

  const sSet = generateFallbackSet(garchomp, singlesFmt, "singles");
  assert.ok(sSet, "expected a singles fallback set for Garchomp");
  assert.equal(validateTeam(singlesFmt, [{ name: "", species: "Garchomp", ability: sSet.ability, item: sSet.items[0], moves: sSet.moves, nature: sSet.nature, evs: sSet.evs, level: 50 }]), null);
  assert.deepEqual(faults("Garchomp", sSet, "singles"), []);

  const dSet = generateFallbackSet(garchomp, doublesFmt, "doubles");
  assert.ok(dSet, "expected a doubles fallback set for Garchomp");
  assert.equal(validateTeam(doublesFmt, [{ name: "", species: "Garchomp", ability: dSet.ability, item: dSet.items[0], moves: dSet.moves, nature: dSet.nature, evs: dSet.evs, level: 50 }]), null);
  assert.deepEqual(faults("Garchomp", dSet, "doubles"), []);
});

test("fillMissingSamples preserves existing species and fills only missing legal species", () => {
  const existingSet = { weight: 1, ability: "Rough Skin", items: ["Rocky Helmet"], moves: ["Earthquake", "Dragon Claw", "Stealth Rock", "Protect"], nature: "Jolly", evs: { hp: 2, atk: 32, spe: 32 } };
  const sampleData = {
    "m-c": {
      singles: [{ species: "Garchomp", usage: 0.25, sets: [existingSet] }],
      doubles: [],
    },
  };
  const added = fillMissingSamples(sampleData, "m-c");
  assert.ok(added.length > 0, "expected missing species to be filled");
  const kept = sampleData["m-c"].singles.find(e => e.species === "Garchomp");
  assert.deepEqual(kept.sets, [existingSet], "existing species sets must not be overwritten");
  assert.ok(sampleData["m-c"].doubles.some(e => e.species === "Garchomp"), "missing doubles entry should be filled");
});
