import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

import { buildPokemon, damageFor, emptySide } from "../src/services/calculatorCore.js";
import { commonSets, estimate, koMark, spreadOf, weaker } from "../src/services/battleDamage.js";

const detail = JSON.parse(readFileSync(new URL("../src/data/champions-data.json", import.meta.url), "utf8"));
const sets = JSON.parse(readFileSync(new URL("../src/data/random-sets.json", import.meta.url), "utf8"));
const ranker = JSON.parse(readFileSync(new URL("../src/data/ranker-teams.json", import.meta.url), "utf8"));

test("a request's final stats give back the spread that makes them", () => {
  const side = { ...emptySide(), nature: "adamant", sp: { hp: 4, atk: 32, def: 0, spa: 0, spd: 30, spe: 0 } };
  const mon = buildPokemon(detail, { ...detail.pokedex.garchomp, id: "garchomp" }, side);
  const { hp, ...stats } = mon.rawStats;
  const back = spreadOf(detail.pokedex.garchomp.baseStats, stats, hp);
  const again = buildPokemon(detail, { ...detail.pokedex.garchomp, id: "garchomp" }, { ...emptySide(), ...back });
  assert.deepEqual(again.rawStats, mon.rawStats);
});

test("the mark: 확정 and 난수 by the range, the fewest hits by the top of it", () => {
  assert.equal(koMark(130, 153, 100).word, "확정 1타");
  assert.equal(koMark(80, 104, 100).word, "난수 1타");
  assert.equal(koMark(54, 64, 100).word, "확정 2타");
  assert.equal(koMark(45, 55, 100).word, "난수 2타");
  assert.equal(koMark(34, 40, 100).word, "확정 3타");
  assert.equal(koMark(14, 17, 100).word, "4타 이상");
  assert.equal(koMark(30, 36, 30).word, "확정 1타", "from the HP it has now");
  assert.equal(koMark(0, 0, 100), null);
  assert.equal(weaker(koMark(54, 64), koMark(45, 55)).word, "난수 2타");
  assert.equal(weaker(koMark(14, 17), koMark(130, 153)).word, "4타 이상");
});

test("a foe's range spans its unknown spreads and holds the calculator's own number for each end", () => {
  const user = { species: "Garchomp", stats: { atk: 182, def: 115, spa: 100, spd: 105, spe: 122 }, maxhp: 183, hp: 183, ability: "roughskin", item: "", boosts: {}, status: "" };
  const target = { species: "Dragonite", hp: 100, maxhp: 100, ability: "Inner Focus", item: "Leftovers", boosts: {}, status: "" };
  const got = estimate({ detail, user, target, moveId: "outrage", field: {} });
  assert.ok(got && got.lo < got.hi, "a range");
  // the bottom end is the calculator's lowest roll against 32 HP, 32 Def with a Defense nature
  const atk = buildPokemon(detail, { ...detail.pokedex.garchomp, id: "garchomp" }, { ...emptySide(), ability: "Rough Skin", ...spreadOf(detail.pokedex.garchomp.baseStats, user.stats, 183) });
  const side = { ...emptySide(), ability: "Inner Focus", item: "leftovers", nature: "bold", sp: { hp: 32, atk: 0, def: 32, spa: 0, spd: 0, spe: 0 } };
  const ref = damageFor({ detailData: detail, attacker: atk, defender: buildPokemon(detail, { ...detail.pokedex.dragonite, id: "dragonite" }, side), attackerSide: {}, defenderSide: side, field: {}, moveId: "outrage" });
  assert.equal(Math.floor(got.lo * 10) / 10, ref.minPct);
  assert.ok(got.hi > ref.maxPct, "the top end is the frailest spread, over the bulkiest one's top");
  assert.equal(estimate({ detail, user, target, moveId: "swordsdance", field: {} }), null, "a status move has no mark");
  assert.equal(estimate({ detail, user, target: { ...target, species: "Skarmory", ability: "Sturdy" }, moveId: "earthquake", field: {} }), null, "none against an immune foe");
  const screened = estimate({ detail, user, target, moveId: "outrage", field: {}, screens: ["reflect"] });
  assert.ok(screened.hi < got.hi, "the target's screen counts");
});

test("a foe's ability and item stand in from the common set until shown", () => {
  const guess = commonSets(sets, ranker);
  const set = guess("Venusaur", "m-c", "singles");
  assert.ok(set.ability, "the heaviest sample set's ability");
  assert.equal(typeof set.item, "string");
  assert.deepEqual(guess("Notamon", "m-c", "singles"), { ability: "", item: "" });
});
