// Curates the current regulation's sample sets (src/data/random-sets.json, m-c singles and doubles; m-b is left as the ladder has it)
// after scripts/tune-sets.mjs: the ladder gave almost every species five sets that mostly differ by one move, each with a list of
// back-up items a party fell down to when the item clause took the first (a Focus Sash lead holding Leftovers). The owner,
// 2026-11-18: "다양한 형태가 가능한 포켓몬(한카리아스 등)과 메가진화가 여러 개인 포켓몬만 복수의 샘플을 만들고, 상당히 마이너한 포켓몬은
// 샘플 하나에만 집중해도 좋아". So (docs/SAMPLE_SETS.md 5장):
//
//   1. one build, one item: a set holds exactly the item that fits it (its own first item, but no Choice item with a status move
//      other than Trick, no Assault Vest with any status move, no Focus Sash with a recovery move);
//   2. sets of one species sharing ability, item kind (BULK, POWER, otherwise the item itself; each Mega Stone its own) and at least
//      3 of 4 moves are one build: the heaviest one's moves and spread, the weights summed;
//   3. a species with two or more Mega Stones keeps one build per stone;
//   4. a MAJOR species (the top MAJOR_RANK by usage) keeps up to MAX_BUILDS builds, each carrying at least SHARE of the species'
//      weight and distinct from every heavier kept one (another Mega Stone or none, or another item kind and either at least 2 other moves
//      or a Choice item, Focus Sash or Assault Vest on one side: ROLE);
//   5. every other species keeps its heaviest build only.
//
//   node scripts/curate-sets.mjs [--dry]     (then node scripts/render-sample-sets.mjs)
// Rerunning it on its own output changes nothing. scripts/learn-cpu-sets.mjs keeps to the same builds (sameBuild below).
import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { Dex, toID } from "@pkmn/sim";
import * as champions from "@pkmn/mods/champions";
import { KO } from "../src/data/teamBuilderLocalization.js";

export const MAJOR_RANK = 60, SHARE = 0.07, MAX_BUILDS = 4;
const REG = "m-c";
const MOVED = "정리(docs/SAMPLE_SETS.md 5장) 뒤 가장 많이 쓰이는 빌드는 다른 세트:";
const dex = Dex.mod("champions", champions);

const BULK = new Set(["leftovers", "blacksludge", "rockyhelmet", "shellbell", "airballoon", "bigroot"]);
const POWER = new Set(["lifeorb", "expertbelt", "scopelens", "widelens", "razorclaw", "kingsrock", "metronome", "loadeddice", "punchingglove", "muscleband", "wiseglasses"]);
const RECOVERY = new Set(["recover", "roost", "slackoff", "softboiled", "moonlight", "morningsun", "synthesis", "shoreup", "milkdrink", "strengthsap", "wish", "rest", "healorder", "junglehealing", "lunarblessing"]);
const TRICK = new Set(["trick", "switcheroo"]);

export function itemKind(item) {
  const it = dex.items.get(item), id = it.id;
  if (it.megaStone) return id;
  if (BULK.has(id) || it.isBerry) return "bulk";
  if (POWER.has(id) || it.isGem || (it.onBasePower && !it.megaStone)) return "power";
  return id;
}
const status = moves => moves.filter(m => dex.moves.get(m).category === "Status").map(toID);
export function fits(item, moves) {
  const id = toID(item), st = status(moves);
  if (id.startsWith("choice")) return st.every(m => TRICK.has(m));
  if (id === "assaultvest") return !st.length;
  if (id === "focussash") return !moves.some(m => RECOVERY.has(toID(m)));
  return true;
}
// the item a build holds: its own first, else the first back-up that fits, else its own first anyway
const fitItem = set => set.items.find(item => fits(item, set.moves)) || set.items[0];
const shared = (a, b) => a.moves.filter(m => b.moves.includes(m)).length;
// two sets of a species that are one build (rule 2); learn-cpu-sets.mjs counts a player's near copy toward the build it copies
export const sameBuild = (a, b) => toID(a.ability) === toID(b.ability) && itemKind(a.item) === itemKind(b.item) && shared(a, b) >= Math.max(a.moves.length, b.moves.length) - 1;
// a build worth keeping beside another (rule 4)
/* an item that changes how a Pokémon is played, not how hard it hits or how long it lasts: a Choice item locks it into one move, a
   Focus Sash makes it a lead that lives one hit, an Assault Vest makes it a special wall. Two builds apart by one of these are two
   builds even on the same four moves (2026-11-18: 마스카나's Scarf and Sash were one build, and the Sash lead never came) */
const ROLE = new Set(["choicescarf", "choiceband", "choicespecs", "focussash", "assaultvest"]);
export const distinct = (a, b) => {
  const ma = a.mega ? toID(a.item) : "", mb = b.mega ? toID(b.item) : "";
  if (ma !== mb) return true;
  if (itemKind(a.item) === itemKind(b.item)) return false;
  return ROLE.has(toID(a.item)) || ROLE.has(toID(b.item)) || Math.max(a.moves.length, b.moves.length) - shared(a, b) >= 2;
};

/* one species' sets → its curated sets. major: keeps more than one build when they are worth it */
export function curate(sets, major) {
  const builds = [];
  for (const raw of [...sets].filter(s => !s.ypl).sort((a, b) => (b.baseWeight ?? b.weight) - (a.baseWeight ?? a.weight))) {
    const { baseWeight, items, ...rest } = raw;
    const set = { ...rest, weight: baseWeight ?? raw.weight, item: fitItem(raw) };
    const into = builds.find(b => sameBuild(b, set));
    if (into) into.weight += set.weight;
    else builds.push(set);
  }
  builds.sort((a, b) => b.weight - a.weight);
  const total = builds.reduce((s, b) => s + b.weight, 0) || 1;
  const stones = new Set(builds.filter(b => b.mega).map(b => toID(b.item)));
  const kept = [];
  if (stones.size > 1) for (const stone of stones) kept.push(builds.find(b => b.mega && toID(b.item) === stone));
  for (const b of builds) {
    if (kept.includes(b)) continue;
    if (!kept.length) { kept.push(b); continue; }
    if (!major || kept.length >= MAX_BUILDS || b.weight / total < SHARE || !kept.every(k => distinct(b, k))) continue;
    kept.push(b);
  }
  kept.sort((a, b) => b.weight - a.weight);
  const sum = kept.reduce((s, b) => s + b.weight, 0);
  // the file's own shape: weight first, items as a one-item list (every reader takes set.items)
  return kept.map(({ weight, item, ...b }) => {
    const { ability, moves, nature, evs, ivs, mega, ...other } = b;
    return { weight: Math.round(weight / sum * 100) / 100, ability, items: [item], moves, nature, evs, ...(ivs ? { ivs } : {}), ...(mega ? { mega } : {}), ...other };
  });
}

export function curateKind(entries) {
  const rank = new Map([...entries].sort((a, b) => (b.usage || 0) - (a.usage || 0)).map((e, i) => [e.species, i]));
  return entries.map(e => ({ ...e, sets: curate(e.sets, rank.get(e.species) < MAJOR_RANK) }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const FILE = new URL("../src/data/random-sets.json", import.meta.url);
  const NOTES = kind => new URL(`../docs/sample-sets/${REG}-${kind}.json`, import.meta.url);
  const data = JSON.parse(readFileSync(FILE, "utf8"));
  for (const kind of ["singles", "doubles"]) {
    const before = data[REG][kind];
    const after = curateKind(before);
    data[REG][kind] = after;
    const count = list => list.reduce((s, e) => s + e.sets.length, 0);
    const hist = after.reduce((h, e) => ((h[e.sets.length] = (h[e.sets.length] || 0) + 1), h), {});
    const items = after.flatMap(e => e.sets.map(s => s.items[0])).reduce((m, i) => m.set(i, (m.get(i) || 0) + 1), new Map());
    console.log(`${kind}: ${before.length} species, ${count(before)} → ${count(after)} sets, sets per species ${JSON.stringify(hist)}`);
    console.log(`  items: ${[...items].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([i, n]) => `${i} ${n}`).join(", ")}`);
    for (const e of after.filter(e => e.sets.length > 1)) console.log(`  ${e.species} (${e.usage}): ${e.sets.map(s => `${s.weight} ${s.items[0]} [${s.moves.join(", ")}]`).join(" | ")}`);
    // the notes beside the docs (scripts/tune-sets.mjs) describe the most played set before curating: they now count the builds, take
    // the build's one item when the most played build is that set, and say so when it is another
    try {
      const notes = JSON.parse(readFileSync(NOTES(kind), "utf8"));
      const ko = (table, name) => KO[table][toID(name)] || name;
      for (const e of after) {
        const note = notes[e.species], top = e.sets[0];
        if (!note) continue;
        note.sets = e.sets.length;
        note.verify = note.verify.filter(line => !line.startsWith(MOVED));
        if (top.moves.map(m => ko("moves", m)).join() === note.moves.join()) note.item = ko("items", top.items[0]);
        else note.verify.push(`${MOVED} ${ko("items", top.items[0])}, ${top.moves.map(m => ko("moves", m)).join(", ")}입니다. 위의 분석은 정리 전에 가장 많이 쓰인 세트의 것입니다`);
      }
      if (!process.argv.includes("--dry")) writeFileSync(NOTES(kind), JSON.stringify(notes, null, 1) + "\n");
    } catch (err) { if (err.code !== "ENOENT") throw err; }
  }
  data.source = data.source.replace(/; m-c sets curated.*$/, "") + "; m-c sets curated to whole builds with one item (scripts/curate-sets.mjs)";
  data.built = new Date().toISOString().slice(0, 10);
  if (!process.argv.includes("--dry")) writeFileSync(FILE, JSON.stringify(data));
}
