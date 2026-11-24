// Common-sense checks on the sample sets (src/data/random-sets.json): an item, ability or move that does nothing in the set it is in
// (a Light Clay with no screen, a Heat Rock with no sun, a Choice item with a status move, a physical set with a Modest nature).
// The owner, 2026-11-19: "빛의점토인데 벽 기술이 없는 경우 같이 상식에서 벗어난 샘플들 좀 있음. 전부 상식 선에서의 샘플로 완성 부탁".
// tests/sampleSets.test.mjs holds every m-c set to it, and learn-cpu-sets.mjs lets no player's set in that it refuses.
//   node scripts/check-sets.mjs [m-c|m-b]     lists every set it refuses
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { Dex, toID } from "@pkmn/sim";
import * as champions from "@pkmn/mods/champions";

const dex = Dex.mod("champions", champions);
const ids = list => new Set(list.map(toID));
const SCREENS = ids(["Reflect", "Light Screen", "Aurora Veil"]);
const WEATHER = {
  heatrock: [ids(["Sunny Day"]), ids(["Drought", "Orichalcum Pulse"])],
  damprock: [ids(["Rain Dance"]), ids(["Drizzle"])],
  smoothrock: [ids(["Sandstorm"]), ids(["Sand Stream", "Sand Spit"])],
  icyrock: [ids(["Snowscape", "Hail", "Chilly Reception"]), ids(["Snow Warning"])],
};
const TERRAINS = ids(["Electric Terrain", "Grassy Terrain", "Misty Terrain", "Psychic Terrain"]);
const SURGES = ids(["Electric Surge", "Grassy Surge", "Misty Surge", "Psychic Surge", "Hadron Engine", "Seed Sower"]);
const ANY_WEATHER_MOVE = ids(["Sunny Day", "Rain Dance", "Sandstorm", "Snowscape", "Hail", "Chilly Reception"]);
const ANY_WEATHER_ABILITY = ids(["Drought", "Drizzle", "Sand Stream", "Snow Warning", "Orichalcum Pulse", "Sand Spit", "Primordial Sea", "Desolate Land", "Delta Stream", "Mega Sol"]);
const SUN = ids(["Sunny Day"]), DROUGHT = ids(["Drought", "Orichalcum Pulse", "Desolate Land", "Mega Sol"]);
const CHARGE = ids(["Solar Beam", "Solar Blade", "Meteor Beam", "Electro Shot", "Sky Attack", "Skull Bash", "Geomancy", "Razor Wind", "Freeze Shock", "Ice Burn", "Phantom Force", "Shadow Force", "Dig", "Dive", "Fly", "Bounce"]);
const DRAIN = ids(["Giga Drain", "Drain Punch", "Horn Leech", "Leech Life", "Draining Kiss", "Parabolic Charge", "Leech Seed", "Strength Sap", "Bitter Blade", "Oblivion Wing", "Ingrain", "Aqua Ring", "Absorb", "Mega Drain"]);
const BIND = ids(["Wrap", "Bind", "Fire Spin", "Whirlpool", "Sand Tomb", "Magma Storm", "Infestation", "Snap Trap", "Thunder Cage", "Clamp"]);
const ORB_ABILITY = { flameorb: ids(["Guts", "Flare Boost", "Magic Guard", "Quick Feet", "Marvel Scale"]), toxicorb: ids(["Poison Heal", "Guts", "Toxic Boost", "Magic Guard", "Quick Feet", "Marvel Scale"]) };
const FLING = ids(["Fling", "Trick", "Switcheroo", "Facade", "Psycho Shift"]);
const HEALS = ids(["Recover", "Roost", "Slack Off", "Soft-Boiled", "Moonlight", "Morning Sun", "Synthesis", "Shore Up", "Milk Drink", "Wish", "Rest", "Heal Order", "Strength Sap", "Pain Split"]);
const WEATHERED = ids(["Swift Swim", "Chlorophyll", "Sand Rush", "Slush Rush", "Leaf Guard", "Snow Cloak", "Sand Veil", "Rain Dish", "Ice Body", "Solar Power", "Hydration", "Sand Force", "Dry Skin", "Flower Gift", "Harvest"]);
const TRICK = ids(["Trick", "Switcheroo", "Transform"]);
const SLEEP = ids(["Spore", "Sleep Powder", "Hypnosis", "Yawn", "Lovely Kiss", "Sing", "Grass Whistle", "Dark Void"]);
const SETUP_ABILITY = ids(["Speed Boost", "Moxie", "Beast Boost", "Contrary", "Simple"]);
const TYPE_ITEM = {
  charcoal: "Fire", mysticwater: "Water", miracleseed: "Grass", magnet: "Electric", nevermeltice: "Ice", blackbelt: "Fighting", poisonbarb: "Poison",
  softsand: "Ground", sharpbeak: "Flying", twistedspoon: "Psychic", silverpowder: "Bug", hardstone: "Rock", spelltag: "Ghost", dragonfang: "Dragon",
  blackglasses: "Dark", metalcoat: "Steel", fairyfeather: "Fairy", silkscarf: "Normal",
};
// a Normal move an ability turns into another type
const ATE = { pixilate: "Fairy", aerilate: "Flying", refrigerate: "Ice", galvanize: "Electric" };

/* why a set makes no sense, one line a fault (none: it does). species: the set's Pokémon; kind: singles or doubles (in doubles a partner
   may call the weather, so the moves that want one are left alone there) */
export function faults(species, set, kind = "singles") {
  const out = [], name = set.items?.[0] ?? set.item ?? "", item = toID(name), it = dex.items.get(item);
  // the set's ability and, holding its Mega Stone, the Mega's (Charizard Y's Drought calls the sun)
  const own = toID(set.ability || ""), mega = it.megaStone ? toID(dex.species.get(Object.values(it.megaStone)[0]).abilities[0]) : "";
  const ab = s => s.has(own) || s.has(mega), ability = own;
  const mv = set.moves.map(m => { const x = dex.moves.get(m); return x.type === "Normal" && ATE[own] && x.category !== "Status" ? { ...x, type: ATE[own] } : x; });
  const has = s => mv.some(m => s.has(m.id)), status = mv.filter(m => m.category === "Status"), attacks = mv.filter(m => m.category !== "Status");
  const phys = attacks.filter(m => m.category === "Physical" && !["bodypress", "foulplay"].includes(m.id)), spec = attacks.filter(m => m.category === "Special");
  if (item === "lightclay" && !has(SCREENS)) out.push("빛의점토인데 벽 기술이 없음");
  if (WEATHER[item]) { const [m, a] = WEATHER[item]; if (!has(m) && !ab(a)) out.push(`${name}인데 그 날씨를 부르지 않음`); }
  if (item === "terrainextender" && !has(TERRAINS) && !ab(SURGES)) out.push("그라운드코트인데 필드를 깔지 않음");
  if (item === "powerherb" && !has(CHARGE)) out.push("파워풀허브인데 모으는 기술이 없음");
  if (item === "bigroot" && !has(DRAIN)) out.push("큰뿌리인데 흡수 기술이 없음");
  if ((item === "bindingband" || item === "gripclaw") && !has(BIND)) out.push(`${name}인데 조이는 기술이 없음`);
  if (ORB_ABILITY[item] && !ORB_ABILITY[item].has(ability) && !has(FLING)) out.push(`${name}인데 그 상태를 살리는 특성이나 기술이 없음`);
  if (item === "throatspray" && !attacks.some(m => m.flags?.sound)) out.push("목스프레이인데 소리 기술이 없음");
  if (item.startsWith("choice") && status.some(m => !TRICK.has(m.id))) out.push("구애 도구인데 변화 기술이 있음");
  if (item === "assaultvest" && status.length) out.push("돌격조끼인데 변화 기술이 있음");
  if (item === "choiceband" && !phys.length) out.push("구애머리띠인데 물리 기술이 없음");
  if (item === "choicespecs" && !spec.length) out.push("구애안경인데 특수 기술이 없음");
  if (item === "muscleband" && !phys.length) out.push("힘의머리띠인데 물리 기술이 없음");
  if (item === "wiseglasses" && !spec.length) out.push("박식안경인데 특수 기술이 없음");
  if ((item === "lifeorb" || item === "expertbelt") && !attacks.length) out.push(`${name}인데 공격 기술이 없음`);
  if (TYPE_ITEM[item] && !attacks.some(m => m.type === TYPE_ITEM[item])) out.push(`${name}인데 그 타입 기술이 없음`);
  if (it.megaStone && !Object.keys(it.megaStone).map(toID).includes(toID(species))) out.push(`${name}은 이 포켓몬의 메가스톤이 아님`);
  if (it.onPlate && !attacks.some(m => m.type === it.onPlate)) out.push(`${name}인데 그 타입 기술이 없음`);
  if (kind === "singles" && has(ids(["Weather Ball"])) && !has(ANY_WEATHER_MOVE) && !ab(ANY_WEATHER_ABILITY)) out.push("웨더볼인데 날씨를 부르지 않음");
  if (kind === "singles" && has(ids(["Solar Beam", "Solar Blade"])) && !has(SUN) && !ab(DROUGHT) && item !== "powerherb") out.push("솔라빔인데 쾌청도 파워풀허브도 없음");
  if (has(ids(["Dream Eater"])) && !has(SLEEP)) out.push("꿈먹기인데 재우는 기술이 없음");
  if (has(ids(["Sleep Talk"])) && !has(ids(["Rest"])) && ability !== "comatose") out.push("잠꼬대인데 잠자기가 없음");
  if (has(ids(["Stored Power"])) && !status.some(m => m.target === "self" && m.boosts) && !ab(SETUP_ABILITY)) out.push("어시스트파워인데 랭크를 올리지 않음");
  if (has(ids(["Acrobatics"])) && item && !it.isGem && !it.isBerry && !/(seed|herb)$/.test(item) && !["airballoon", "focussash", "boosterenergy"].includes(item)) out.push("애크로뱃인데 사라지지 않는 도구를 지님");
  // an item that does nothing for this Pokémon or these moves
  if (item === "blacksludge" && !dex.species.get(species).types.includes("Poison")) out.push("검은진흙인데 독 타입이 아님");
  if (item === "eviolite" && !dex.species.get(species).nfe) out.push("진화의휘석인데 다 진화함");
  if (item === "boosterenergy" && !ab(ids(["Protosynthesis", "Quark Drive"]))) out.push("부스트에너지인데 고대활성도 쿼크차지도 아님");
  if (item === "loadeddice" && !mv.some(m => m.multihit)) out.push("속임수주사위인데 연속 기술이 없음");
  if (item === "punchingglove" && !attacks.some(m => m.flags?.punch)) out.push("펀치글러브인데 펀치 기술이 없음");
  if (item === "roomservice" && kind === "singles" && !has(ids(["Trick Room"]))) out.push("룸서비스인데 트릭룸이 없음");
  if (item === "blunderpolicy" && !attacks.some(m => m.accuracy !== true && m.accuracy < 100)) out.push("허탕보험인데 빗나갈 기술이 없음");
  if ((item === "scopelens" || item === "razorclaw") && !ab(ids(["Super Luck", "Sniper"])) && !attacks.some(m => m.critRatio > 1)) out.push(`${name}인데 급소를 노리지 않음`);
  if (kind === "singles" && /^(electric|grassy|psychic|misty)seed$/.test(item)) {
    const t = item.replace("seed", "");
    if (!mv.some(m => m.terrain === `${t}terrain`) && !ab(new Set([`${t}surge`, ...(t === "electric" ? ["hadronengine"] : []), ...(t === "grassy" ? ["seedsower"] : [])]))) out.push(`${name}인데 그 필드를 깔지 않음`);
  }
  if (has(TRICK) && !item.startsWith("choice") && !["flameorb", "toxicorb", "ironball", "laggingtail", "stickybarb", "ringtarget", "blacksludge"].includes(item) && toID(species) !== "ditto") out.push("트릭인데 넘길 도구가 없음");
  // a move that wants something the set does not have
  if (has(ids(["Hex", "Venoshock"])) && !status.some(m => m.status || m.id === "toxic" || m.id === "willowisp" || m.id === "thunderwave")) out.push("상태이상을 거는 기술 없이 병상첨병이나 베놈쇼크");
  if (has(ids(["Baton Pass"])) && !status.some(m => m.boosts && m.target === "self") && !has(ids(["Substitute"]))) out.push("바톤터치로 넘길 것이 없음");
  if (has(ids(["Focus Punch"])) && !has(ids(["Substitute"]))) out.push("힘껏펀치인데 대타출동이 없음");
  if (has(ids(["Reversal", "Flail", "Endeavor"])) && item !== "focussash" && !has(ids(["Endure", "Substitute"])) && !ab(ids(["Sturdy"]))) out.push("기사회생류인데 체력을 깎아 둘 길이 없음");
  if (has(ids(["Trick Room"])) && dex.natures.get(set.nature || "").plus === "spe") out.push("트릭룸인데 스피드를 올리는 성격");
  if (has(ids(["Gyro Ball"])) && dex.natures.get(set.nature || "").plus === "spe") out.push("자이로볼인데 스피드를 올리는 성격");
  // an ability that does nothing for these moves (a Mega's own ability takes over once it evolves, so a Mega set's is left alone)
  if (!it.megaStone) {
    const sec = m => m.secondary || m.secondaries;
    const none = (a, ok) => own === toID(a) && !ok;
    if (none("Sheer Force", attacks.some(sec))) out.push("우격다짐인데 추가 효과가 있는 기술이 없음");
    if (none("Serene Grace", attacks.some(sec))) out.push("하늘의은총인데 추가 효과가 있는 기술이 없음");
    if (none("Technician", attacks.some(m => m.basePower && m.basePower <= 60 || m.multihit))) out.push("테크니션인데 위력 60 이하 기술이 없음");
    if (none("Skill Link", attacks.some(m => m.multihit))) out.push("스킬링크인데 연속 기술이 없음");
    if (none("Iron Fist", attacks.some(m => m.flags?.punch))) out.push("철주먹인데 펀치 기술이 없음");
    if (none("Strong Jaw", attacks.some(m => m.flags?.bite))) out.push("옹골찬턱인데 무는 기술이 없음");
    if (none("Sharpness", attacks.some(m => m.flags?.slicing))) out.push("예리함인데 베는 기술이 없음");
    if (none("Mega Launcher", attacks.some(m => m.flags?.pulse))) out.push("메가런처인데 파동 기술이 없음");
    if (none("Reckless", attacks.some(m => m.recoil || m.hasCrashDamage))) out.push("이판사판인데 반동 기술이 없음");
    if (none("Rock Head", attacks.some(m => m.recoil))) out.push("돌머리인데 반동 기술이 없음");
    if (none("Prankster", status.length)) out.push("짓궂은마음인데 변화 기술이 없음");
    if (none("Poison Heal", item === "toxicorb")) out.push("포이즌힐인데 독독구슬이 없음");
    if (none("Unburden", it.isBerry || it.isGem || /(seed|herb)$/.test(item) || ["focussash", "airballoon", "boosterenergy", "ejectbutton", "ejectpack", "redcard"].includes(item) || has(TRICK) || has(ids(["Fling"])))) out.push("곡예인데 사라질 도구가 없음");
    if (none("Contrary", mv.some(m => m.self?.boosts || (m.target === "self" && m.boosts)))) out.push("심술꾸러기인데 랭크가 바뀌는 기술이 없음");
    const other = Object.values(dex.species.get(species).abilities).some(a => !WEATHERED.has(toID(a)));
    if (kind === "singles" && other && none("Swift Swim", has(ids(["Rain Dance"])))) out.push("쓱쓱인데 비를 부르지 않음");
    if (kind === "singles" && other && none("Chlorophyll", has(SUN))) out.push("엽록소인데 쾌청이 없음");
    if (kind === "singles" && other && none("Sand Rush", has(ids(["Sandstorm"])))) out.push("모래헤치기인데 모래바람이 없음");
    if (kind === "singles" && other && none("Slush Rush", has(ids(["Snowscape"])))) out.push("눈치우기인데 설경이 없음");
  }
  // two moves doing one job: two that raise the same attacking stat, two ways to heal
  // a move raising one attacking stat and not the other (Calm Mind, Nasty Plot; Swords Dance, Bulk Up; never Shell Smash)
  const raise = st => status.filter(m => m.target === "self" && (m.boosts?.[st] || 0) > 0 && !((m.boosts?.[st === "atk" ? "spa" : "atk"] || 0) > 0));
  if (raise("spa").length > 1) out.push(`${raise("spa").map(m => m.name).join("와 ")}가 겹침`);
  if (raise("atk").filter(m => !m.boosts.spe).length > 1) out.push(`${raise("atk").map(m => m.name).join("와 ")}가 겹침`);
  const heals = status.filter(m => HEALS.has(m.id));
  if (heals.length > 1) out.push(`${heals.map(m => m.name).join("와 ")}로 회복이 겹침`);
  // a Choice Scarf with nothing in speed, an attacking item with nothing in either attacking stat
  const ev = set.evs || {};
  if (item === "choicescarf" && (ev.spe || 0) < 10 && toID(species) !== "ditto" && !has(ids(["Final Gambit"]))) out.push("구애스카프인데 스피드에 노력치가 없음");
  if (["lifeorb", "choiceband", "choicespecs", "expertbelt"].includes(item) && (ev.atk || 0) < 10 && (ev.spa || 0) < 10) out.push(`${name}인데 공격에도 특공에도 노력치가 없음`);
  if (kind === "singles" && has(ids(["Rising Voltage"])) && !mv.some(m => m.terrain === "electricterrain") && !ab(ids(["Electric Surge", "Hadron Engine"]))) out.push("라이징볼트인데 일렉트릭필드를 깔지 않음");
  // four attacks and nothing behind them: neither nature nor points raise the stat three of them hit with (a bulky set has a status
  // move or a recovery beside its attacks; this one only hits, and hits weakly)
  const nat = dex.natures.get(set.nature || "");
  if (!status.length && phys.length >= 3 && (ev.atk || 0) < 10 && nat.plus !== "atk" && !ab(ids(["Huge Power", "Pure Power"])) && !has(ids(["Final Gambit"]))) out.push("공격 기술뿐인데 공격에 아무것도 없음");
  if (!status.length && spec.length >= 3 && (ev.spa || 0) < 10 && nat.plus !== "spa") out.push("공격 기술뿐인데 특공에 아무것도 없음");
  // two guards, a stat raised for attacks the set does not have, the weather turned against its own
  if (mv.filter(m => m.stallingMove || m.id === "protect" || m.id === "detect").length > 1) out.push("방어 기술이 둘");
  if (raise("spa").length && !spec.length) out.push(`${raise("spa")[0].name}인데 특수 기술이 없음`);
  if (raise("atk").length && !phys.length && !raise("atk").every(m => m.boosts.def || m.boosts.spe)) out.push(`${raise("atk")[0].name}인데 물리 기술이 없음`);
  const sets = { drought: "sunnyday", drizzle: "raindance", sandstream: "sandstorm", snowwarning: "snowscape" };
  for (const [a, w] of Object.entries(sets)) if (ab(new Set([a])) && mv.some(m => m.weather && m.id !== w)) out.push("제 특성의 날씨를 다른 날씨로 덮음");
  // two attacks of one type and one kind where one would do (Sludge Bomb beside Sludge Wave), unless one of them is a priority move
  // or one has an effect of its own beyond its damage
  for (let i = 0; i < attacks.length; i++) for (let j = i + 1; j < attacks.length; j++) {
    const a = attacks[i], b = attacks[j];
    if (a.type === b.type && a.category === b.category && !a.priority && !b.priority && plain(a) && plain(b)) out.push(`${a.name}와 ${b.name}이 겹침`);
  }
  // a nature that raises the attacking stat the set never uses
  // (Body Press hits with Defense and Foul Play with the foe's Attack, so neither counts as a physical attack here)
  if (nat.plus === "atk" && !phys.length) out.push(`${nat.name}인데 물리 기술이 없음`);
  if (nat.plus === "spa" && !spec.length && phys.length) out.push(`${nat.name}인데 특수 기술이 없음`);
  if (nat.minus === "atk" && phys.length >= 2 && !spec.length) out.push(`${nat.name}인데 물리 기술로만 침`);
  if (nat.minus === "spa" && spec.length >= 2 && !phys.length) out.push(`${nat.name}인데 특수 기술로만 침`);
  if ((ev.atk || 0) >= 20 && !phys.length && spec.length) out.push("공격에 노력치를 몰았는데 물리 기술이 없음");
  if ((ev.spa || 0) >= 20 && !spec.length && phys.length) out.push("특공에 노력치를 몰았는데 특수 기술이 없음");
  return out;
}
// an attack with nothing but its damage (no side effect, no recoil, no lowering, no special use) is interchangeable with another
const SPECIAL_KEYS = ["secondary", "secondaries", "self", "drain", "recoil", "multihit", "selfSwitch", "selfdestruct", "ohko", "critRatio", "willCrit",
  "breaksProtect", "ignoreDefensive", "ignoreAbility", "overrideOffensivePokemon", "overrideOffensiveStat", "overrideDefensiveStat",
  "basePowerCallback", "onBasePower", "onModifyMove", "onModifyType", "onTry", "onTryHit", "onTryMove", "onHit", "onAfterHit",
  "onAfterMoveSecondarySelf", "onEffectiveness", "condition", "sideCondition", "weather", "terrain", "hasCrashDamage", "mindBlownRecoil",
  "selfBoost", "forceSwitch", "thawsTarget", "sleepUsable", "smartTarget", "stallingMove", "multiaccuracy"];
const plain = m => (m.accuracy === true || m.accuracy === 100) && !m.flags?.charge && !m.flags?.recharge && !["allAdjacentFoes", "allAdjacent"].includes(m.target)
  && SPECIAL_KEYS.every(k => !m[k]);

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const reg = process.argv[2] || "m-c", data = JSON.parse(readFileSync(new URL("../src/data/random-sets.json", import.meta.url), "utf8"));
  let n = 0;
  for (const kind of ["singles", "doubles"]) for (const e of data[reg][kind]) e.sets.forEach((s, i) => {
    const f = faults(e.species, s, kind);
    if (f.length) { n++; console.log(`${kind} ${e.species}#${i} ${s.items[0]} ${s.ability} ${s.nature} [${s.moves.join(", ")}]: ${f.join("; ")}`); }
  });
  console.log(`${n} sets refused`);
}
