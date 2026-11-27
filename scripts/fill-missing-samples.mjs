// Ensures every legal species in the active regulation has at least one legal, common-sense-checked
// sample set in src/data/random-sets.json (for computer battles and 도전의 탑), even before Smogon
// monthly usage stats are published for newly added Pokémon.
//
// Existing species in random-sets.json are never overwritten. Only missing legal species are filled.
// Usage:
//   npm run data:fill-samples [-- --reg m-c --dry-run]
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Dex, toID } from "@pkmn/sim";
import * as champions from "@pkmn/mods/champions";
import { DEFAULT_REGULATION_ID } from "../src/data/teamBuilderRegulations.js";
import { formatId, validateTeam } from "../supabase/functions/battle/engine.mjs";
import { faults } from "./check-sets.mjs";

const RANDOM_SETS_PATH = new URL("../src/data/random-sets.json", import.meta.url);
const dex = Dex.mod("champions", champions);

const CANDIDATE_ITEMS = ["Sitrus Berry", "Life Orb", "Focus Sash", "Leftovers", "Lum Berry", "Rocky Helmet", "Expert Belt"];
const STATUS_POOL = ["protect", "recover", "roost", "slackoff", "willowisp", "thunderwave", "toxic", "swordsdance", "nastyplot", "calmmind", "uturn", "voltswitch"];
const SKIP_MOVES = new Set(["focuspunch", "lastresort", "dreameater", "belch", "selfdestruct", "explosion", "mistyexplosion", "finalgambit", "healingwish", "lunarblessing", "memento", "synchronoise", "storedpower", "weatherball", "solarbeam", "solarblade", "sleeptalk", "acrobatics"]);

function isLegalSet(formatid, speciesName, set) {
  return !validateTeam(formatid, [{
    name: "",
    species: speciesName,
    ability: set.ability,
    item: set.items[0],
    moves: set.moves,
    nature: set.nature,
    evs: set.evs,
    level: 50,
  }]);
}

export function generateFallbackSet(species, formatid, kind = "singles") {
  const baseOf = dex.species.get(species.baseSpecies);
  const learnset = dex.species.getLearnsetData(species.id)?.learnset || dex.species.getLearnsetData(baseOf.id)?.learnset || {};
  const moveIds = Object.keys(learnset);
  if (!moveIds.length) return null;

  const preferPhysical = species.baseStats.atk >= species.baseStats.spa;
  const primaryCategory = preferPhysical ? "Physical" : "Special";
  const fast = species.baseStats.spe >= 80;
  const atkStat = preferPhysical ? "atk" : "spa";
  const nature = preferPhysical ? (fast ? "Jolly" : "Adamant") : (fast ? "Timid" : "Modest");
  const evs = fast ? { hp: 2, [atkStat]: 32, spe: 32 } : { hp: 32, [atkStat]: 32, def: 2 };

  const abilities = Object.values(species.abilities).filter(Boolean);
  const scoredAttacks = moveIds
    .map(id => dex.moves.get(id))
    .filter(m => m.exists && m.category === primaryCategory && m.basePower >= 50 && (m.accuracy === true || m.accuracy >= 85) && !m.flags?.charge && !m.flags?.recharge && !m.selfdestruct && !SKIP_MOVES.has(m.id))
    .sort((a, b) => (b.basePower * (species.types.includes(b.type) ? 1.5 : 1)) - (a.basePower * (species.types.includes(a.type) ? 1.5 : 1)));

  const fallbackAttacks = moveIds
    .map(id => dex.moves.get(id))
    .filter(m => m.exists && m.category !== "Status" && m.basePower > 0 && !m.flags?.charge && !m.flags?.recharge && !SKIP_MOVES.has(m.id))
    .sort((a, b) => b.basePower - a.basePower);

  const chosenMoves = [];
  for (const m of scoredAttacks) {
    if (chosenMoves.length < 3 && !chosenMoves.some(x => dex.moves.get(x).type === m.type)) chosenMoves.push(m.name);
  }
  if (kind === "doubles" && learnset.protect && chosenMoves.length < 4) chosenMoves.push("Protect");
  for (const id of STATUS_POOL) {
    if (chosenMoves.length >= 4) break;
    if (learnset[id] && !chosenMoves.includes(dex.moves.get(id).name)) chosenMoves.push(dex.moves.get(id).name);
  }
  for (const m of [...scoredAttacks, ...fallbackAttacks]) {
    if (chosenMoves.length >= 4) break;
    if (!chosenMoves.includes(m.name)) chosenMoves.push(m.name);
  }
  if (!chosenMoves.length) return null;

  for (const ability of abilities) {
    for (const item of CANDIDATE_ITEMS) {
      const candidate = { weight: 1, ability, items: [item], moves: chosenMoves.slice(0, 4), nature, evs };
      if (isLegalSet(formatid, species.name, candidate) && faults(species.name, candidate, kind).length === 0) {
        return candidate;
      }
    }
  }
  return null;
}

export function fillMissingSamples(data, reg = DEFAULT_REGULATION_ID) {
  const added = [];
  if (!data[reg]) data[reg] = { singles: [], doubles: [] };

  for (const kind of ["singles", "doubles"]) {
    const formatid = formatId(reg, kind);
    const list = (data[reg][kind] ||= []);
    const existing = new Set(list.map(entry => toID(entry.species)));

    for (const species of dex.species.all()) {
      if (!species.exists || species.battleOnly || /-Gmax$/.test(species.name)) continue;
      if (existing.has(species.id)) continue;
      const baseOf = dex.species.get(species.baseSpecies);
      if (baseOf.cosmeticFormes?.includes(species.name)) continue;

      const set = generateFallbackSet(species, formatid, kind);
      if (!set) continue;
      list.push({ species: species.name, usage: 0.0005, sets: [set] });
      existing.add(species.id);
      added.push(`${reg}/${kind}: ${species.name}`);
    }
  }
  return added;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const argv = process.argv.slice(2);
  let reg = DEFAULT_REGULATION_ID;
  let dryRun = false;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--reg" && argv[i + 1]) reg = argv[++i].toLowerCase();
    else if (argv[i] === "--dry-run") dryRun = true;
  }
  const data = JSON.parse(readFileSync(RANDOM_SETS_PATH, "utf8"));
  const added = fillMissingSamples(data, reg);
  if (!added.length) {
    console.log(`${reg}: all legal species already have sample sets.`);
  } else {
    console.log(`${reg}: generated ${added.length} missing fallback sample sets:\n  ${added.join("\n  ")}`);
    if (!dryRun) {
      writeFileSync(RANDOM_SETS_PATH, JSON.stringify(data));
      console.log("updated src/data/random-sets.json");
    }
  }
}
