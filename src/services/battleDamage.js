/* 기술 키의 타수 표시와 길게 누른 카드의 피해 범위 (DESIGN.md "Battle", Choices, Information at hand).
   계산은 계산기와 같은 엔진(calculatorCore.js의 damageFor, @smogon/calc 0세대: 레벨 50, 개체값 없음, 능력 포인트 0~32)이다.
   내 포켓몬: 요청은 능력치만 알려 주므로 그 능력치를 내는 성격과 능력 포인트를 되짚는다.
   상대: 배분을 모르므로 쇼다운 툴팁처럼 0에서 최대(성격 포함)까지의 범위다. 가장 단단한 배분의 최저 난수가 아래 끝,
   가장 무른 배분의 최고 난수가 위 끝. 특성과 도구는 드러나기 전까지 그 종의 흔한 세트(random-sets.json, 랭커 구축)로 둔다. */
import { GEN, buildPokemon, damageFor } from "./calculatorCore.js";
import { ALIGNMENTS, STAT_KEYS, calculatedStat } from "./teamBuilderCore.js";
import { toID } from "./championsData.js";

const clamp32 = n => Math.max(0, Math.min(32, Math.round(Number(n) || 0)));
const BATTLE = ["atk", "def", "spa", "spd", "spe"];

// the stat points and nature that give these final stats (a request tells the stats, never the spread)
export function spreadOf(base, stats, maxhp) {
  const hp = clamp32(maxhp - base.hp - 75);
  for (const nature of ALIGNMENTS) {
    const sp = {};
    for (const k of BATTLE) {
      let s = 0;
      while (s <= 32 && calculatedStat(base[k], s, k, nature) !== stats[k]) s += 1;
      if (s > 32) break;
      sp[k] = s;
    }
    if (Object.keys(sp).length === BATTLE.length) return { nature: nature.id, sp: { hp, ...sp } };
  }
  // stats the formula cannot give: the nearest neutral spread
  return { nature: "serious", sp: Object.fromEntries(STAT_KEYS.map(k => [k, k === "hp" ? hp : clamp32(stats[k] - base[k] - 20)])) };
}

/* the mark on a move key: how many hits it takes from the HP the target has now (cur, percent), the range lo to hi in percent of its
   whole HP. 확정 when even the lowest roll on the bulkiest spread does it in that many, 난수 when only some rolls do */
export function koMark(lo, hi, cur = 100) {
  if (!(hi > 0) || !(cur > 0)) return null;
  const n = Math.ceil(cur / hi - 1e-9);
  if (n >= 4) return { n: 4, sure: false, word: "4타 이상" };
  const sure = lo * n >= cur - 1e-9;
  return { n, sure, word: `${sure ? "확정" : "난수"} ${n}타` };
}
// the weaker of two marks (doubles: the lower of the two foes)
export const weaker = (a, b) => (!a ? b : !b ? a : (b.n - a.n || Number(a.sure) - Number(b.sure)) > 0 ? b : a);

const WEATHER = { sunnyday: "Sun", desolateland: "Harsh Sunshine", raindance: "Rain", primordialsea: "Heavy Rain", sandstorm: "Sand", snow: "Snow", snowscape: "Snow", hail: "Hail" };
const TERRAIN = { electricterrain: "Electric", grassyterrain: "Grassy", mistyterrain: "Misty", psychicterrain: "Psychic" };
const SCREENS = { reflect: "reflect", lightscreen: "lightScreen", auroraveil: "auroraVeil" };
// the scene's field as the calculator's: weather (none while Cloud Nine or Air Lock is out), terrain, gravity, and the target's screens
function calcField({ weather, fields = [], suppressed = false } = {}, screens = [], doubles = false) {
  const ids = fields.map(toID);
  return {
    field: { format: doubles ? "Doubles" : "Singles", weather: suppressed ? "" : WEATHER[toID(weather)] || "", terrain: TERRAIN[ids.find(f => TERRAIN[f])] || "", flags: { isGravity: ids.includes("gravity") } },
    defenderSide: { conds: Object.fromEntries(screens.map(toID).filter(c => SCREENS[c]).map(c => [SCREENS[c], true])) },
  };
}
const abilityName = a => (a ? GEN.abilities.get(toID(a))?.name || "" : "");
const recordOf = (detail, species) => {
  const r = detail?.pokedex?.[toID(species)];
  return r ? { ...r, id: toID(r.name || species) } : null;
};

/* the species' common set as the ladder plays it: the heaviest sample set's ability and first item, else the item rankers give it
   most. Loaded once a battle opens (loadCommonSets); until then a foe has its first ability and no item */
let common = null, loading = null;
export function commonSets(sets, ranker) {
  const best = new Map();
  for (const [reg, kinds] of Object.entries(sets || {})) {
    if (!kinds || typeof kinds !== "object") continue;
    for (const [kind, list] of Object.entries(kinds)) for (const entry of Array.isArray(list) ? list : []) {
      const top = [...(entry.sets || [])].sort((a, b) => b.weight - a.weight)[0];
      if (top) best.set(`${reg}/${kind}/${toID(entry.species)}`, { ability: top.ability || "", item: top.items?.[0] || "" });
    }
  }
  const counts = new Map();
  for (const t of ranker?.teams || []) for (const m of t.team || []) {
    const by = counts.get(toID(m.species)) || new Map();
    if (m.item) by.set(m.item, (by.get(m.item) || 0) + 1);
    counts.set(toID(m.species), by);
  }
  return (species, reg, kind) => {
    for (const id of [toID(species), toID(String(species).split("-")[0])]) {
      const set = best.get(`${reg}/${kind}/${id}`);
      if (set) return set;
      const items = counts.get(id);
      if (items?.size) return { ability: "", item: [...items].sort((a, b) => b[1] - a[1])[0][0] };
    }
    return { ability: "", item: "" };
  };
}
export function loadCommonSets() {
  loading ||= Promise.all([import("../data/random-sets.json"), import("../data/ranker-teams.json")])
    .then(([s, r]) => { common = commonSets(s.default || s, r.default || r); cache.clear(); }, () => { loading = null; });
  return loading;
}
// gen9championsbssregmc → m-c
const regOf = formatId => { const m = /reg([a-z])([a-z])/.exec(String(formatId)); return m ? `${m[1]}-${m[2]}` : ""; };

const cache = new Map();
/* one move from our Pokémon at one foe. user: { species, base (the species its stats were read on), stats, maxhp, ability, item,
   boosts, status }; target: the scene's foe ({ species, hp, maxhp in percent, ability, item, boosts, status }); field: the scene's
   ({ weather, fields, suppressed }) and screens: the target side's conditions. Returns { lo, hi, cur, mark } in percent, or null for a
   move that does no damage or one the engine cannot read */
export function estimate({ detail, user, target, moveId, field, screens = [], doubles = false, formatId = "" }) {
  if (!detail || !user?.stats || !target || target.fainted || !moveId) return null;
  const key = JSON.stringify([user, target.species, target.hp, target.maxhp, target.ability, target.item, target.boosts, target.status, moveId, field, screens, doubles, formatId]);
  if (cache.has(key)) return cache.get(key);
  if (cache.size > 400) cache.clear();
  const out = compute({ detail, user, target, moveId, field, screens, doubles, formatId });
  cache.set(key, out);
  return out;
}
function compute({ detail, user, target, moveId, field, screens, doubles, formatId }) {
  const move = GEN.moves.get(toID(moveId));
  if (!move || move.category === "Status") return null;
  const ours = recordOf(detail, user.species), base = recordOf(detail, user.base || user.species), theirs = recordOf(detail, target.species);
  if (!ours || !base?.baseStats || !theirs) return null;
  const spread = spreadOf(base.baseStats, user.stats, user.maxhp);
  const attackerSide = { ability: abilityName(user.ability), item: toID(user.item), nature: spread.nature, sp: spread.sp, boosts: { ...user.boosts }, status: user.status || "", hp: 100, conds: {} };
  const attacker = buildPokemon(detail, ours, attackerSide);
  if (attacker && user.maxhp) attacker.originalCurHP = Math.max(1, Math.min(attacker.maxHP(), user.hp ?? attacker.maxHP()));
  // the log keeps an item not yet shown as "" (as it keeps one taken away): either way the common set's stands in
  const guess = (!target.ability || !target.item) && common ? common(target.species, regOf(formatId), doubles ? "doubles" : "singles") : {};
  const ability = abilityName(target.ability || guess.ability);
  const item = toID(target.item || guess.item);
  const cur = Math.max(1, Math.round((target.hp / (target.maxhp || 100)) * 100));
  // the stat the move hits (Psyshock and its kin hit Defense with a special move)
  const stat = move.overrideDefensiveStat || (move.category === "Physical" ? "def" : "spd");
  const { field: f, defenderSide: screened } = calcField(field, screens, doubles);
  const hit = (nature, sp) => {
    const side = { ability, item, nature, sp: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0, ...sp }, boosts: { ...target.boosts }, status: target.status && target.status !== "fnt" ? target.status : "", hp: cur, conds: screened.conds };
    return damageFor({ detailData: detail, attacker, defender: buildPokemon(detail, theirs, side), attackerSide, defenderSide: side, field: f, moveId: toID(moveId) });
  };
  const bulky = hit(ALIGNMENTS.find(a => a.plus === stat && a.minus === "atk")?.id || "serious", { hp: 32, [stat]: 32 });
  const frail = hit(ALIGNMENTS.find(a => a.minus === stat && a.plus === "atk")?.id || "serious", {});
  if (!bulky || !frail || bulky.error || frail.error || !(frail.max > 0)) return null;
  const lo = (bulky.min / bulky.hp) * 100, hi = (frail.max / frail.hp) * 100;
  return { lo, hi, cur, mark: koMark(lo, hi, cur) };
}
