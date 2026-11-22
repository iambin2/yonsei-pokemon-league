/* 쇼다운 텍스트 (2026-11-22): a team as Pokémon Showdown and PokePaste write it, in and out of the builder, so a party is not typed
   again by hand. Champions keeps its stat points in the EV fields (as the battle function does, supabase/functions/battle), 0 to 32 a
   stat; text from a game with real EVs (any over 32) is read as points, 8 EVs a point, rounded up from 4.
   Members are the builder's saved shape (serializeMembers): English species, ability and nature, item and moves as ids. */
import { toID } from "./championsData.js";
import { ALIGNMENTS, STAT_KEYS } from "./teamBuilderCore.js";

const STAT_TEXT = { hp: "HP", atk: "Atk", def: "Def", spa: "SpA", spd: "SpD", spe: "Spe" };
const STAT_BY_TEXT = Object.fromEntries(Object.entries(STAT_TEXT).map(([key, text]) => [text.toLowerCase(), key]));

// names: { item(id), move(id) } giving the English name to write
export function teamToText(members, names = {}) {
  const item = names.item || (id => id), move = names.move || (id => id);
  return (members || []).filter(m => m.pokemonName).map(m => {
    const lines = [`${m.pokemonName}${m.item ? ` @ ${item(m.item)}` : ""}`];
    if (m.ability) lines.push(`Ability: ${m.ability}`);
    lines.push("Level: 50");
    const points = STAT_KEYS.filter(key => Number(m.statPoints?.[key]) > 0).map(key => `${Number(m.statPoints[key])} ${STAT_TEXT[key]}`);
    if (points.length) lines.push(`EVs: ${points.join(" / ")}`);
    const nature = ALIGNMENTS.find(a => a.id === m.alignment);
    if (nature) lines.push(`${nature.name} Nature`);
    for (const id of m.moves || []) if (id) lines.push(`- ${move(id)}`);
    return lines.join("\n");
  }).join("\n\n") + "\n";
}

// the first line: "Nickname (Species) (M) @ Item" in any of its shortenings
function headLine(line) {
  let [left, itemText = ""] = line.split(/\s+@\s+/);
  left = left.replace(/\s+\((M|F)\)\s*$/, "").trim();
  const inner = /\(([^()]+)\)\s*$/.exec(left);
  return { species: (inner ? inner[1] : left).trim(), item: itemText.trim() };
}

// text → up to six members in the saved shape, and the lines it could not read (shown to the player, never silently dropped)
export function textToTeam(text) {
  const blocks = String(text || "").replace(/\r/g, "").split(/\n\s*\n/).map(b => b.split("\n").map(l => l.trim()).filter(Boolean)).filter(b => b.length);
  const members = [], skipped = [];
  for (const block of blocks.slice(0, 6)) {
    const head = headLine(block[0]);
    if (!head.species) { skipped.push(block[0]); continue; }
    const m = { pokemonName: head.species, resolutionState: "resolved", pokemonId: "", ability: "", alignment: "serious",
      statPoints: Object.fromEntries(STAT_KEYS.map(k => [k, 0])), item: head.item ? toID(head.item) : "", moves: [] };
    let evs = null;
    for (const line of block.slice(1)) {
      let match;
      if ((match = /^Ability:\s*(.+)$/i.exec(line))) m.ability = match[1].trim();
      else if ((match = /^EVs:\s*(.+)$/i.exec(line))) {
        evs = {};
        for (const part of match[1].split("/")) {
          const [n, stat] = part.trim().split(/\s+/);
          const key = STAT_BY_TEXT[String(stat || "").toLowerCase()];
          if (key && Number.isFinite(Number(n))) evs[key] = Number(n);
        }
      } else if ((match = /^(\w+)\s+Nature$/i.exec(line))) {
        const nature = ALIGNMENTS.find(a => a.name.toLowerCase() === match[1].toLowerCase());
        if (nature) m.alignment = nature.id; else skipped.push(line);
      } else if ((match = /^[-~]\s*(.+)$/.exec(line))) { if (m.moves.length < 4) m.moves.push(toID(match[1].replace(/\s*\[.*\]$/, ""))); }
      else if (!/^(Level|Tera Type|Shiny|Happiness|IVs|Gigantamax|Dynamax Level|Hidden Power):/i.test(line)) skipped.push(line);
    }
    if (evs) {
      const real = Object.values(evs).some(v => v > 32);
      for (const key of STAT_KEYS) m.statPoints[key] = Math.max(0, Math.min(32, real ? Math.floor(((evs[key] || 0) + 4) / 8) : evs[key] || 0));
    }
    while (m.moves.length < 4) m.moves.push("");
    members.push(m);
  }
  return { members, skipped };
}
