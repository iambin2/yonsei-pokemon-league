// Curates the current regulation's sample sets (src/data/random-sets.json, m-c singles and doubles; m-b is left as the ladder has it)
// after scripts/tune-sets.mjs: the ladder gave almost every species five sets that mostly differ by one move, each with a list of
// back-up items a party fell down to when the item clause took the first (a Focus Sash lead holding Leftovers). The owner,
// 2026-11-18: "다양한 형태가 가능한 포켓몬(한카리아스 등)과 메가진화가 여러 개인 포켓몬만 복수의 샘플을 만들고, 상당히 마이너한 포켓몬은
// 샘플 하나에만 집중해도 좋아". So (docs/SAMPLE_SETS.md 5장):
//
//   1. one build, one item: a set holds exactly the item that fits it (its own first item, but no Choice item with a status move
//      other than Trick, no Focus Sash with a recovery move; 포켓몬 챔피언스 has no Assault Vest: the engine's champions mod marks it Past);
//   2. sets of one species sharing ability, item kind (BULK, POWER, otherwise the item itself; each Mega Stone its own) and at least
//      3 of 4 moves are one build: the heaviest one's moves and spread, the weights summed;
//   3. a species with two or more Mega Stones keeps one build per stone;
//   4. a MAJOR species (the top MAJOR_RANK by usage) keeps one build for each role it is played in (role below: each Mega Stone, each
//      Choice item, setting up, hazards, Trick Room, walling, support, attacking), up to MAX_BUILDS, each role carrying at least SHARE
//      of the species' weight; builds of one role that differ by a few moves or by an item (a Focus Sash for a Life Orb) are one build.
//      A build beside others keeps at least FLOOR. The owner's own builds (ADDED) are added after;
//   5. every other species keeps its heaviest build only.
//
//   node scripts/curate-sets.mjs [--dry]     (then node scripts/render-sample-sets.mjs)
// Rerunning it on its own output changes nothing. scripts/learn-cpu-sets.mjs keeps to the same builds (sameBuild below).
import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { Dex, toID } from "@pkmn/sim";
import * as champions from "@pkmn/mods/champions";
import { KO } from "../src/data/teamBuilderLocalization.js";

export const MAJOR_RANK = 80, SHARE = 0.1, MAX_BUILDS = 4;
const REG = "m-c";
const MOVED = "정리(docs/SAMPLE_SETS.md 5장) 뒤 가장 많이 쓰이는 빌드는 다른 세트:";
const dex = Dex.mod("champions", champions);

const BULK = new Set(["leftovers", "blacksludge", "rockyhelmet", "shellbell", "airballoon", "bigroot"]);
const POWER = new Set(["lifeorb", "expertbelt", "scopelens", "widelens", "razorclaw", "kingsrock", "metronome", "loadeddice", "punchingglove", "muscleband", "wiseglasses"]);
const RECOVERY = new Set(["recover", "roost", "slackoff", "softboiled", "moonlight", "morningsun", "synthesis", "shoreup", "milkdrink", "strengthsap", "wish", "rest", "healorder", "junglehealing", "lunarblessing"]);
const TRICK = new Set(["trick", "switcheroo", "transform"]);

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
  if (id === "focussash") return !moves.some(m => RECOVERY.has(toID(m)));
  return true;
}
// the item a build holds: its own first, else the first back-up that fits, else its own first anyway
const fitItem = set => set.items.find(item => fits(item, set.moves)) || set.items[0];
const shared = (a, b) => a.moves.filter(m => b.moves.includes(m)).length;
/* two sets of a species that are one build (rule 2): one ability, one kind of item, three of four moves, and one role, so a Calm Mind
   set is not folded into the Encore set it shares three moves with (2026-11-18: 누리레느's set-up build was lost so). learn-cpu-sets.mjs
   counts a player's near copy toward the build it copies */
const roleOf = x => role({ ...x, items: [x.item ?? x.items?.[0]] });
export const sameBuild = (a, b) => toID(a.ability) === toID(b.ability) && itemKind(a.item) === itemKind(b.item) && shared(a, b) >= Math.max(a.moves.length, b.moves.length) - 1 && roleOf(a) === roleOf(b);
// a build worth keeping beside another (rule 4)
/* the role a build plays (2026-11-18, the owner: "단순히 기술 몇개만 바뀌는 게 아니라 역할이 변하는 포켓몬들"): each Mega Stone its own, each
   Choice item its own (it locks the Pokémon into one move), then by its moves: raising its own stats, laying hazards, setting Trick
   Room, walling (recovery and two attacks or fewer), supporting (two status moves or more), attacking. Protect and its kin are left
   out of the count, since nearly every doubles set holds one */
const HAZARD = new Set(["stealthrock", "spikes", "toxicspikes", "stickyweb"]);
const GUARD = new Set(["protect", "detect", "spikyshield", "kingsshield", "banefulbunker", "silktrap", "burningbulwark", "obstruct", "endure"]);
export function role(set) {
  const item = toID(set.items?.[0] ?? set.item);
  // a Mega Stone makes a Mega build whether or not the set says so (a player's set read off a battle has no mega flag)
  if (set.mega || dex.items.get(item).megaStone) return `mega:${item}`;
  if (item.startsWith("choice")) return `choice:${item}`;
  const mv = set.moves.map(m => dex.moves.get(m)).filter(m => !GUARD.has(m.id));
  const status = mv.filter(m => m.category === "Status"), attacks = mv.length - status.length;
  if (status.some(m => m.target === "self" && m.boosts && (m.boosts.atk > 0 || m.boosts.spa > 0 || m.boosts.spe > 0 || m.boosts.def > 0 && m.boosts.spd > 0))) return "setup";
  if (mv.some(m => HAZARD.has(m.id))) return "hazard";
  if (mv.some(m => m.id === "trickroom")) return "room";
  if (status.some(m => RECOVERY.has(m.id)) && attacks <= 2) return "wall";
  if (status.length >= 2) return "support";
  return "attack";
}
/* builds the owner asked for that the ladder's sets do not hold (2026-11-18), added after curating with their weight in the species
   (the rest scaled to share what is left). A set already there (the same item and moves) is not added twice, so curating again changes
   nothing. Each is checked by the regulation's validator like every set (tests/cpuLearn.test.mjs) */
export const ADDED = {
  singles: {
    // "메타몽은 구애스카프가 보편적이지 않나?": the ladder's top brought Focus Sash and Quick Claw, the games' standard is the Scarf
    Ditto: [{ weight: .6, ability: "Imposter", items: ["Choice Scarf"], moves: ["Transform"], nature: "Relaxed", evs: { hp: 32, def: 17, spd: 17 } }],
    // "망나뇽 샘플도 하나 더": the Mega is special; a Multiscale Dragon Dance sweeper on the ground
    Dragonite: [{ weight: .2, ability: "Multiscale", items: ["Lum Berry"], moves: ["Dragon Dance", "Dragon Claw", "Extreme Speed", "Earthquake"], nature: "Adamant", evs: { hp: 2, atk: 32, spe: 32 } }],
    // "한카리아스는 일반 메가진화도": the ladder brought Mega Z only in singles
    Garchomp: [{ weight: .2, ability: "Rough Skin", items: ["Garchompite"], moves: ["Swords Dance", "Earthquake", "Dragon Claw", "Fire Fang"], nature: "Jolly", evs: { hp: 2, atk: 32, spe: 32 }, mega: true }],
  },
  doubles: {
    Ditto: [{ weight: .6, ability: "Imposter", items: ["Choice Scarf"], moves: ["Transform"], nature: "Relaxed", evs: { hp: 32, def: 17, spd: 17 } }],
  },
};
// the least share a build keeps beside others: a Mega form at 1% was drawn almost never and only lengthened the list
const FLOOR = .1;
const same = (a, b) => toID(a.items[0]) === toID(b.items[0]) && a.moves.map(toID).sort().join() === b.moves.map(toID).sort().join();

/* one species' sets → its curated sets. major: keeps more than one role when they are worth it; added: the owner's builds for it */
export function curate(sets, major, added = []) {
  const builds = [];
  // the owner's builds are set aside and added again at the end, so curating the curated sets changes nothing
  const own = s => added.some(a => same(s, a));
  for (const raw of [...sets].filter(s => !s.ypl && !own(s)).sort((a, b) => (b.baseWeight ?? b.weight) - (a.baseWeight ?? a.weight))) {
    const { baseWeight, items, ...rest } = raw;
    const set = { ...rest, weight: baseWeight ?? raw.weight, item: fitItem(raw) };
    const into = builds.find(b => sameBuild(b, set));
    if (into) into.weight += set.weight;
    else builds.push(set);
  }
  // one build a role: the heaviest stands for it, and carries the role's whole weight
  const roles = new Map();
  for (const b of builds.sort((x, y) => y.weight - x.weight)) {
    const r = role({ ...b, items: [b.item] }), g = roles.get(r);
    if (g) g.weight += b.weight;
    else roles.set(r, { ...b });
  }
  const groups = [...roles.values()].sort((a, b) => b.weight - a.weight);
  const total = groups.reduce((s, b) => s + b.weight, 0) || 1;
  const stones = groups.filter(b => b.mega);
  const kept = stones.length > 1 ? [...stones] : [];
  for (const b of groups) {
    if (kept.includes(b)) continue;
    if (!kept.length) { kept.push(b); continue; }
    if (!major || kept.length >= MAX_BUILDS || b.weight / total < SHARE) continue;
    kept.push(b);
  }
  kept.sort((a, b) => b.weight - a.weight);
  let out = kept.map(b => ({ ...b, weight: b.weight / kept.reduce((s, k) => s + k.weight, 0) }));
  // a build under FLOOR is raised to it, and the others share what is left in their own proportions
  const low = out.filter(b => b.weight < FLOOR);
  if (out.length > 1 && low.length) {
    const rest = out.filter(b => b.weight >= FLOOR), was = rest.reduce((s, b) => s + b.weight, 0);
    low.forEach(b => { b.weight = FLOOR; });
    rest.forEach(b => { b.weight *= (1 - FLOOR * low.length) / was; });
  }
  // the file's own shape: weight first, items as a one-item list (every reader takes set.items)
  out = out.map(({ weight, item, ...b }) => {
    const { ability, moves, nature, evs, ivs, mega, ...other } = b;
    return { weight, ability, items: [item], moves, nature, evs, ...(ivs ? { ivs } : {}), ...(mega ? { mega } : {}), ...other };
  });
  for (const add of added) {
    if (out.some(s => same(s, add))) continue;
    out.forEach(s => { s.weight *= 1 - add.weight; });
    out.push({ ...add });
  }
  out.sort((a, b) => b.weight - a.weight);
  return out.map(s => ({ ...s, weight: Math.round(s.weight * 100) / 100 }));
}

export function curateKind(entries, kind = "singles") {
  const rank = new Map([...entries].sort((a, b) => (b.usage || 0) - (a.usage || 0)).map((e, i) => [e.species, i]));
  return entries.map(e => ({ ...e, sets: curate(e.sets, rank.get(e.species) < MAJOR_RANK, ADDED[kind]?.[e.species] || []) }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const FILE = new URL("../src/data/random-sets.json", import.meta.url);
  const NOTES = kind => new URL(`../docs/sample-sets/${REG}-${kind}.json`, import.meta.url);
  const data = JSON.parse(readFileSync(FILE, "utf8"));
  for (const kind of ["singles", "doubles"]) {
    const before = data[REG][kind];
    const after = curateKind(before, kind);
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
