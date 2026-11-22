import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

import { REGULATIONS } from "../src/data/index.js";
import { load, legalItems } from "../src/services/championsData.js";
import {
  abilitiesFor,
  dexRecord,
  learnsetFor,
  localizedPokemonName,
  matchesPokemonSearch,
  fromTeamSnapshotV1,
  makeMember,
  memberFromSaved,
  pokemonAllowedInRegulation,
  pokemonPoolForRegulation,
  resolveCanonicalPokemonIdentity,
  serializeMembers,
  spriteUrl,
  toTeamSnapshotV1,
  validateTeam,
  validateSubmissionEligibility,
} from "../src/services/teamBuilderCore.js";
import { buildTeamSnapshotSubmission } from "../src/services/teamSubmission.js";

// The real loader over the committed build output (Node fetch cannot read file: URLs).
globalThis.fetch = async url => new Response(readFileSync(new URL(url)));
const detailDataPromise = load();

function selectableEntries(detailData) {
  return Object.entries(REGULATIONS).flatMap(([regulationId, regulation]) => {
    const items = legalItems(detailData, regulationId);
    return pokemonPoolForRegulation(regulation, detailData, items)
      .map(pokemon => ({ regulationId, regulation, items, pokemon }));
  });
}

test("every selectable Pokémon and form resolves to a canonical and stable species identity", async () => {
  const detailData = await detailDataPromise;
  const entries = selectableEntries(detailData);
  const failures = [];

  for (const { regulationId, pokemon } of entries) {
    const identity = resolveCanonicalPokemonIdentity({ pokemon }, { detailData });
    const record = dexRecord(detailData, pokemon);
    if (!identity.resolved || !identity.pokemonId || !identity.speciesIdentity || record?.num == null) {
      failures.push({ regulationId, name: pokemon.name, identity, dexNumber: record?.num ?? null });
    }
  }

  assert.ok(entries.length > 0);
  assert.deepEqual(failures, []);
});

test("Vivillon cosmetic selection passes the real submission validation and payload path", async () => {
  const detailData = await detailDataPromise;
  const regulation = REGULATIONS["m-c"];
  const items = legalItems(detailData, regulation.id);
  const pool = pokemonPoolForRegulation(regulation, detailData, items);
  const pokemon = pool.find(entry => entry.name === "Vivillon [High Plains Pattern]");
  assert.ok(pokemon);

  const member = makeMember(pokemon, { detailData });
  const eligibility = validateSubmissionEligibility({
    team: [member],
    regulation,
    regulationId: regulation.id,
    cupRuleId: "monotype-challenge",
    assignedTypeId: "flying",
    detailData,
    detailStatus: "ready",
    legalItems: items,
    displayPokemon: entry => entry.name === pokemon.name ? "비비용" : entry.name,
  });
  assert.equal(eligibility.errors.some(error => error.includes("canonical Pokémon identity")), false);
  assert.equal(eligibility.eligible, true);

  const payload = buildTeamSnapshotSubmission({
    event: { id: "vivillon-event", status: "open", cup_rule_id: "monotype-challenge" },
    registration: {
      id: "vivillon-registration",
      event_id: "vivillon-event",
      registration_name: "테스터",
      registration_source: "application",
    },
    registrationName: "테스터",
    eligibility,
    team: [member],
    regulationId: regulation.id,
    cupRuleId: "monotype-challenge",
    detailData,
  });
  assert.equal(payload.members[0].pokemon_id, "vivillon");
  assert.equal(payload.members[0].pokemon_name_snapshot, "Vivillon [High Plains Pattern]");

  const snapshotRestore = fromTeamSnapshotV1({
    snapshot: payload.snapshot,
    members: payload.members,
    regulation,
    detailData,
  });
  assert.equal(snapshotRestore.ok, true);
  assert.equal(snapshotRestore.team[0].pokemon.name, "Vivillon [High Plains Pattern]");

  const saved = serializeMembers([member], { detailData });
  const restored = memberFromSaved(saved[0], regulation, { detailData, legalItems: items });
  assert.equal(saved[0].pokemonId, "vivillon");
  assert.equal(restored.pokemon.name, "Vivillon [High Plains Pattern]");
});

test("representative base, regional, Mega, alternate, and cosmetic forms retain policy identities", async () => {
  const detailData = await detailDataPromise;
  const entries = selectableEntries(detailData);
  const byName = new Map(entries.map(entry => [entry.pokemon.name, entry.pokemon]));
  const cases = [
    ["Pikachu", "pikachu"],
    ["Raichu [Alolan Form]", "raichualola"],
    ["Charizard-Mega-X", "charizardmegax"],
    ["Heat Rotom", "rotomheat"],
    ["Vivillon [High Plains Pattern]", "vivillon"],
    ["Florges [Yellow Flower]", "florges"],
  ];

  for (const [name, expectedId] of cases) {
    const pokemon = byName.get(name);
    assert.ok(pokemon, `${name} must be selectable`);
    assert.equal(resolveCanonicalPokemonIdentity({ pokemon }, { detailData }).pokemonId, expectedId);
  }

  assert.equal(
    resolveCanonicalPokemonIdentity({ pokemon: { name: "Vivillon [Invented Pattern]" } }, { detailData }).resolved,
    false,
  );
});

test("M-C has all 231 species and 82 Mega selections, with usable details and sprites", async () => {
  const detailData = await detailDataPromise;
  const regulation = REGULATIONS["m-c"];
  const items = legalItems(detailData, regulation.id);
  const pool = pokemonPoolForRegulation(regulation, detailData, items);
  assert.equal(new Set(pool.map(pokemon => dexRecord(detailData, pokemon).num)).size, 231);
  assert.equal(pool.filter(pokemon => pokemon.isMegaForm).length, 82);
  assert.equal(items.length, 166);
  assert.equal(pool.filter(pokemon => pokemon.name.startsWith("Vivillon ")).length, 20);
  assert.equal(pool.filter(pokemon => pokemon.name.startsWith("Furfrou")).length, 10);
  for (const pokemon of pool) {
    assert.ok(learnsetFor(detailData, pokemon).length, pokemon.name);
    assert.ok(existsSync(new URL(`../public${spriteUrl(pokemon.name)}`, import.meta.url)), pokemon.name);
  }
});

test("Eternal Flower Floette and both Mega Meowstic forms keep their pre-Mega sets and survive submission", async () => {
  const detailData = await detailDataPromise;
  const regulation = REGULATIONS["m-c"];
  const items = legalItems(detailData, regulation.id);
  const pool = pokemonPoolForRegulation(regulation, detailData, items);
  const korean = new Map([["floette", "플라엣테"], ["meowstic", "냐오닉스"]]);
  const cases = [
    ["Floette-Mega", "Floette [Eternal Flower]", "floettemega", "floettite", "메가플라엣테"],
    ["Meowstic-M-Mega", "Meowstic", "meowsticmmega", "meowsticite", "메가냐오닉스 (수컷)"],
    ["Meowstic-F-Mega", "Meowstic [Female]", "meowsticfmega", "meowsticite", "메가냐오닉스 (암컷)"],
  ];
  for (const [name, baseName, id, stone, label] of cases) {
    const pokemon = pool.find(entry => entry.name === name);
    const base = pool.find(entry => entry.name === baseName);
    assert.equal(localizedPokemonName(pokemon, korean), label);
    assert.equal(matchesPokemonSearch(pokemon, label, label.split(" (")[0]), true);
    const learnset = learnsetFor(detailData, pokemon);
    assert.deepEqual(learnset, learnsetFor(detailData, base));
    assert.deepEqual(abilitiesFor(detailData, pokemon), dexRecord(detailData, base).abilities);

    const member = makeMember(pokemon, { detailData });
    member.moves = learnset.slice(0, 4);
    const validation = { team: [member], regulation, regulationId: regulation.id, cupRuleId: "none",
      detailData, detailStatus: "ready", legalItems: items };
    assert.deepEqual(validateTeam(validation).errors, []);
    assert.equal(validateSubmissionEligibility(validation).eligible, true);
    assert.equal(member.item, stone);
    const result = toTeamSnapshotV1({ team: [member], regulationId: regulation.id, detailData });
    assert.equal(result.ok, true);
    assert.equal(result.members[0].pokemon_id, id);
    assert.equal(result.members[0].item_id, stone);
    const restored = fromTeamSnapshotV1({ ...result, regulation, detailData });
    assert.equal(restored.team[0].pokemon.name, name);
    assert.equal(restored.team[0].item, stone);

    const otherBases = { ...regulation, pokemon: regulation.pokemon.filter(entry => entry.name !== baseName) };
    assert.equal(pokemonAllowedInRegulation({ pokemon, regulation: otherBases, detailData, legalItems: items }), false);
    assert.equal(pokemonPoolForRegulation(otherBases, detailData, items).some(entry => entry.name === name), false);
  }
  assert.equal(pool.some(entry => entry.name === "Floette"), false);
  assert.equal(learnsetFor(detailData, pool.find(entry => entry.name === "Floette-Mega")).includes("lightofruin"), true);
});
