// 쇼다운 텍스트: a team in and out of the builder as Pokémon Showdown and PokePaste write it.
import test from "node:test";
import assert from "node:assert/strict";
import { teamToText, textToTeam } from "../src/services/showdownText.js";

const PASTE = `Leafy (Venusaur) (F) @ Life Orb
Ability: Overgrow
Level: 50
Tera Type: Grass
EVs: 2 HP / 32 SpA / 32 Spe
Modest Nature
- Giga Drain
- Sludge Bomb
- Earth Power
- Sleep Powder

Garchomp @ Choice Scarf
Ability: Rough Skin
EVs: 4 HP / 252 Atk / 252 Spe
Jolly Nature
IVs: 0 SpA
- Earthquake
- Dragon Claw [Dragon]
`;

test("a paste reads into members: nickname, gender and Tera dropped, Champions points kept, real EVs turned to points", () => {
  const { members, skipped } = textToTeam(PASTE);
  assert.deepEqual(skipped, []);
  assert.equal(members.length, 2);
  const [v, g] = members;
  assert.equal(v.pokemonName, "Venusaur");
  assert.equal(v.item, "lifeorb");
  assert.equal(v.ability, "Overgrow");
  assert.equal(v.alignment, "modest");
  assert.deepEqual(v.statPoints, { hp: 2, atk: 0, def: 0, spa: 32, spd: 0, spe: 32 });
  assert.deepEqual(v.moves, ["gigadrain", "sludgebomb", "earthpower", "sleeppowder"]);
  assert.deepEqual(g.statPoints, { hp: 1, atk: 32, def: 0, spa: 0, spd: 0, spe: 32 });
  assert.deepEqual(g.moves, ["earthquake", "dragonclaw", "", ""]);
});

test("a team written out reads back the same, and lines it cannot read are reported", () => {
  const { members } = textToTeam(PASTE);
  const names = { item: id => ({ lifeorb: "Life Orb", choicescarf: "Choice Scarf" })[id], move: id => id.toUpperCase() };
  const text = teamToText(members, names);
  assert.match(text, /^Venusaur @ Life Orb\nAbility: Overgrow\nLevel: 50\nEVs: 2 HP \/ 32 SpA \/ 32 Spe\nModest Nature\n- GIGADRAIN/);
  const again = textToTeam(teamToText(members, { item: names.item, move: id => id }));
  assert.deepEqual(again.members.map(m => [m.pokemonName, m.item, m.alignment, m.statPoints, m.moves]), members.map(m => [m.pokemonName, m.item, m.alignment, m.statPoints, m.moves]));
  assert.deepEqual(textToTeam("Pikachu\nWeird line\nSilly Nature").skipped, ["Weird line", "Silly Nature"]);
  assert.equal(textToTeam("a\n\nb\n\nc\n\nd\n\ne\n\nf\n\ng").members.length, 6, "six at most");
});
