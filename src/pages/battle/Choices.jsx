import React, { useEffect, useRef, useState } from "react";
import { desktop, handOff, light, place } from "../../components/common/motion.js";
import Button from "../../components/common/Button.jsx";
import Icon from "../../components/common/Icon.jsx";
import { Dock } from "../../components/common/Board.jsx";
import { onSpriteError, spriteUrl } from "../../services/teamBuilderCore.js";
import { fourMoves, josa, parseHP, revives, slotPasses, toID } from "../../services/battleLog.js";
import { STATUS, effLabel, effectiveness, nameOf } from "./Stage.jsx";
import { SPEED_POWER, currentTypes, movePower, moveType } from "./battleWords.js";
import { estimate, weaker } from "../../services/battleDamage.js";
import { MonCard, TeamPick } from "./Sets.jsx";

export function tipFor(key, { res, own, picks, foeCards = () => [], foeAt = () => "상대", beaten = () => [] }) {
  const [kind, ...rest] = String(key).split(":");
  if (kind === "swap") {
    const [side, species, why] = rest;
    // one of theirs held back says only why: what would be received stays unseen (2026-11-18)
    if (side === "foe") return why ? <div className="bt-tip"><p className="bt-tip-say">{why}</p></div> : null;
    /* a Pokémon that changed its form in the game (a Mega) stands in the cards under its new name: it is still the one the row names
       (2026-11-10: its i opened a sheet with nothing in it) */
    const same = c => c.species === species || toID(c.species).startsWith(toID(species)) || toID(species).startsWith(toID(c.species));
    const card = (side === "own" ? own() : [...beaten(), ...foeCards()]).find(same);
    return card ? <div className="bt-tip">{why && <p className="bt-tip-say">{why}</p>}<MonCard res={res} {...card} key={card.key} explain /></div> : null;
  }
  if (kind === "own" || kind === "pick") {
    const card = (kind === "own" ? own() : picks())[Number(rest[0])];
    return card ? <MonCard res={res} {...card} key={card.key} explain /> : null;
  }
  if (kind === "move") {
    const [id, type, power, pp, hits = ""] = rest;
    /* the damage, right under the move's name so a phone's card shows it unscrolled (2026-11-16, the owner's draft 1-C in B): its range in percent of the foe's whole HP as
       numbers beside the foe it is for, and as a bar on a track of that HP, the hit mark at the right; in doubles one for each foe */
    const ranges = hits.split(",").filter(Boolean).map(s => s.split("~").map(Number));
    const markWord = (n, sure) => (n >= 4 ? "4타 이상" : n > 0 ? `${sure ? "확정" : "난수"} ${n}타` : "");
    const pct = v => `${Math.max(0, Math.min(100, v))}%`;
    const data = res.detail.moves[id] || {};
    const cells = [["분류", CATEGORY[data.category] || ""], data.category !== "Status" && Number(power || data.basePower) > 0 && ["위력", power || String(data.basePower)],
      ["명중", data.accuracy === true ? "필중" : String(data.accuracy || "")], data.priority ? ["우선도", `${data.priority > 0 ? "+" : ""}${data.priority}`] : null,
      pp ? ["PP", pp] : null].filter(Boolean);
    return <div className="bt-tip">
      <div className="bt-tip-head"><b className="bt-tip-name">{res.text.moves[id]?.name || data.name || id}</b><span className={`tb-type type-${toID(type || data.type || "Normal")}`}>{res.text.types[type || data.type] || type}</span></div>
      {ranges.map(([slot, lo, hi, cur, n, sure]) => <div key={slot} className="bt-dmg">
        <div className="bt-dmg-top">
          <span><b>{`${lo}~${hi}%`}</b><small>{`${foeAt(slot)} HP ${cur}%`}</small></span>
          {n > 0 && <b>{markWord(n, sure === 1)}</b>}
        </div>
        <div className="bt-dmg-track" aria-hidden="true"><u style={{ width: pct(lo) }} /><i style={{ left: pct(lo), width: `calc(${pct(hi)} - ${pct(lo)})` }} /></div>
        <div className="bt-dmg-foot" aria-hidden="true"><span>0</span><span>50</span><span>100</span></div>
      </div>)}
      <div className="stack bt-tip-cells">{cells.map(([k, v]) => <span key={k} className="pn2"><small>{k}</small><b>{v}</b></span>)}</div>
      {res.info?.moves?.[id] && <p className="bt-tip-say">{res.info.moves[id]}</p>}
    </div>;
  }
  if (kind === "mega") {
    const [species, item, why] = rest;
    const form = Object.values(res.detail.pokedex || {}).find(p => /^Mega/.test(p.forme) && toID(p.requiredItem) === toID(item));
    const ability = form?.abilities?.[0];
    return <div className="bt-tip">
      <div className="bt-tip-head"><b className="bt-tip-name">{`${nameOf(res, species)} 메가진화`}</b>{form && <span className="tb-types">{form.types.map(t => <span key={t} className={`tb-type type-${toID(t)}`}>{res.text.types[t] || t}</span>)}</span>}</div>
      {why && <p className="bt-tip-say">{why}</p>}
      {ability && <div className="pn2 bt-tip-fact"><small>특성</small><b>{res.text.abilities[toID(ability)]?.name || ability}</b>{res.info?.abilities?.[toID(ability)] && <span>{res.info.abilities[toID(ability)]}</span>}</div>}
    </div>;
  }
  return null;
}

/* ---------- choices: built from the request alone, as the engine asks ---------- */
const NEEDS_TARGET = { normal: "any", any: "any", adjacentFoe: "foe", adjacentAlly: "ally", adjacentAllyOrSelf: "allyOrSelf" };
const CATEGORY = { Physical: "물리", Special: "특수", Status: "변화" };
const EFF_WORD = { 4: "효과 매우 굉장 ×4", 2: "효과 굉장 ×2", .5: "효과 별로 ×½", .25: "효과 매우 별로 ×¼", 0: "효과 없음" };
const effClass = m => "bt-eff" + (m >= 2 ? " hard" : m === 0 ? " none" : "");
// the hit mark's light: a sure one-hit inverted, a chance of one lit, two and three plain, four and more dim
const koClass = ko => "bt-ko" + (ko.n === 1 ? (ko.sure ? " sure" : " one") : ko.n >= 4 ? " far" : "");

// each Mega Stone and the species it is for, from the Mega formes (Venusaurite → venusaur)
let stoneCache = null;
function megaStones(detail) {
  if (stoneCache?.detail !== detail) stoneCache = { detail, map: new Map(Object.values(detail?.pokedex || {}).filter(p => /^Mega/.test(p.forme) && p.requiredItem).map(p => [toID(p.requiredItem), toID(p.baseSpecies)])) };
  return stoneCache.map;
}
// the Mega forme a stone makes (Gardevoirite → Gardevoir-Mega), its ability and typing
const megaFormOf = (detail, item) => Object.values(detail?.pokedex || {}).find(p => /^Mega/.test(p.forme) && p.requiredItem && toID(p.requiredItem) === toID(item)) || null;

/* locked: the keys of a request already answered, shown dimmed while the turn plays; ghost: the last move request, whose keys stand
   locked over the bench in a forced switch, so the moves keep their place */
export function Choices({ request, locked = false, fresh = false, ghost = null, doubles, res, foes, typesAt, nameAt, monAt, field, perspective, onSend, setAsk, onAim, toast, narrow = false, screensAt = () => [], formatId = "" }) {
  const root = useRef(null);
  const side = request.side;
  const foeSide = side.id === "p1" ? "p2" : "p1";
  const [picks, setPicks] = useState([]);
  const [mega, setMega] = useState(false);
  const [sending, setSending] = useState(false);
  const [aiming, setAiming] = useState(null);
  // Escape lets a move waiting for its target go, as tapping it again does
  useEffect(() => {
    if (aiming == null) return undefined;
    const off = e => { if (e.key === "Escape") back(); };
    window.addEventListener("keydown", off);
    return () => window.removeEventListener("keydown", off);
  }, [aiming]);
  // a new request mounts a new Choices (keyed by the turn and the request: the engine sets no rqid, a switch after a faint keeps the turn,
  // and a locked move can ask the very same thing two turns running), so nothing chosen for the last one carries over
  useEffect(() => () => { setAsk(""); }, []);
  /* a desktop plays from the keys as a game's pad does: 1 to 4 the moves (or the places of a target), 5 and 6 the bench, M Mega
     Evolution (DESIGN.md "Battle", Information at hand); a key's title names its key */
  useEffect(() => {
    if (locked || narrow) return undefined;
    const onKey = e => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.repeat || e.target.closest?.("input, textarea, select, [contenteditable]")) return;
      const el = root.current?.querySelector(`[data-key="${e.key.toLowerCase()}"]`);
      if (el && !el.disabled && el.getAttribute("aria-disabled") !== "true") { e.preventDefault(); el.click(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [locked, narrow]);
  const species = details => String(details).split(", ")[0];
  const name = details => nameOf(res, species(details));
  const moveName = id => res.text.moves[id]?.name || res.detail.moves[id]?.name || id;
  const send = async (choice, said) => { setSending(true); const went = await onSend(choice, said); setSending(false); if (!went) setPicks([]); };
  const slots = side.pokemon.slice(0, request.active?.length || request.forceSwitch?.length || 1);
  const forced = request.forceSwitch;
  // a slot that has nothing to choose passes: a fainted one, one not asked to switch, or one asked when the bench has run out
  const passes = i => slotPasses(request, i);
  const at = (() => { let i = picks.length; while (i < slots.length && passes(i)) i += 1; return i; })();
  const complete = at >= slots.length;
  // the question stands in the message box, as the game puts it there
  const aimed = aiming != null && request.active?.[at]?.moves?.[aiming];
  // Revival Blessing: this place names a fainted Pokémon to bring back, not one to send in
  const reviving = !complete && revives(request, at);
  const question = request.teamPreview || complete ? ""
    : reviving ? "누구를 되살릴까?"
    : forced ? `${name(slots[at].details)} 대신 누구를 내보낼까?`
    : aimed ? `${name(slots[at].details)}의 ${moveName(aimed.id)}, 누구에게 쓸까?`
    : `${josa(name(slots[at].details), "topic")} 무엇을 할까?`;
  useEffect(() => { if (!locked) setAsk(question); }, [question, locked]);

  // the team preview is chosen on its own screen (TeamPick, battle/Sets.jsx)
  if (request.teamPreview) return null;

  const add = (text, said) => {
    const next = [...picks];
    while (next.length < at) next.push("pass");
    next[at] = text;
    next.said = [...(picks.said || []), said];
    setPicks(next);
    setAiming(null); setMega(false);
    // the last Pokémon's choice sends the turn at once; the ones before it wait for it
    let i = next.length; while (i < slots.length && passes(i)) i += 1;
    if (i >= slots.length) send(slots.map((_, k) => next[k] || "pass").join(", "), next.said.filter(Boolean).join(", "));
  };
  const reset = () => { setPicks([]); setMega(false); setAiming(null); };
  // the picker gives the moves' place back as it took it: it dims to the locked light, the moves come up from there
  function back() { handOff(root.current?.querySelector(".bt-targets")).then(() => setAiming(null)); }
  const switchedIn = new Set(picks.filter(p => p?.startsWith?.("switch")).map(p => Number(p.split(" ")[1]) - 1));

  /* sent (or on its way) or locked: the same keys stay where they stood, every one off, and the message box says what was chosen
     (feedback 2026-11-06: the keys gave way to a line of words and back each turn, so the spaces under them never held) */
  const frozen = locked || complete;
  const k = frozen ? (() => { let i = 0; while (i < slots.length - 1 && passes(i)) i += 1; return i; })() : at;
  const active = request.active?.[k];
  const who = name(slots[k].details);
  const trapped = !forced && active?.trapped;
  /* one Mega Evolution a battle. Its key stands over the moves from the first turn until it is spent (or its holder falls), off
     while the holder is not the one choosing, so it never comes and goes with each switch; in doubles, once the first takes it,
     the second's key is off */
  const stones = megaStones(res.detail);
  const holder = side.pokemon.find(p => stones.get(toID(p.item)) && toID(species(p.details)).startsWith(stones.get(toID(p.item))) && !String(p.condition).endsWith(" fnt"));
  const megaSpent = side.pokemon.some(p => /-Mega\b/.test(p.details));
  const megaTaken = picks.some(p => / mega$/.test(p || ""));
  const megaRow = active?.canMegaEvo || (holder && !megaSpent);
  const megaOpen = active?.canMegaEvo && !megaTaken && !frozen;
  // the bench: every brought Pokémon not out, one tap to send it in (Showdown keeps them under the moves)
  // no label over it: the message box asks the question (누구를 내보낼까?), and the row of pictures says it is the bench (2026-11-09)
  const bench = extra => <Bench pokemon={side.pokemon} res={res}
    narrow={narrow} extra={extra} lit={Boolean(forced || reviving)}
    pick={i => {
      if (frozen) return null;
      const mon = side.pokemon[i];
      const fainted = mon.condition.endsWith(" fnt");
      if (reviving) return !mon.active && fainted && !switchedIn.has(i) ? () => add(`switch ${i + 1}`, `${josa(name(mon.details), "object")} 되살린다`) : null;
      const free = !trapped && !mon.active && !fainted && !switchedIn.has(i);
      return free ? () => add(`switch ${i + 1}`, `${who} 대신 ${name(mon.details)}`) : null;
    }} />;
  /* the four keys, always four (a locked move, a recharge or Struggle asks one alone: the rest stand off beside it); off: all locked.
     mega: the Mega key, a column at the moves' right end two rows tall (2026-11-16, the owner's draft 2-C: it left the bench row) */
  const moveKeys = (entry, off, megaEl = null) => <div className={"stack bt-moves" + (megaEl ? " with-mega" : "")}>
      {fourMoves(entry, slots[k]?.moves).map(({ move, i }, n) => {
        const data = res.detail.moves[move.id] || {};
        const type = typeOf(move);
        // every foe now out, in the order they stand; shown only when one of them is not ×1
        const marks = data.category && data.category !== "Status" ? foes.filter(Boolean).map(f => ({ f, m: effectiveness(type, f.types, move.id) })) : [];
        const shown = marks.some(x => x.m !== 1) ? marks : [];
        /* how many hits it takes (battleDamage.js), one mark at the line's right end: the lower of the two foes in doubles; the range
           itself waits in the held card */
        const hits = data.category && data.category !== "Status" ? foes.filter(Boolean).map(f => ({ slot: f.slot, e: hitsOn(move, foeSide, f.slot) })).filter(x => x.e) : [];
        const ko = hits.reduce((m, x) => weaker(m, x.e.mark), null);
        /* the gauge on the key's foot (2026-11-18, the owner's KO draft A without its word; the user: "\"난수 1타\" 와 같은 배틀 도우미가
           너무 붕 떠 보여"): the foe's HP left now is the key's width, lit what the lowest roll takes, dim what the highest adds, for the
           foe the mark is for (the lower of two in doubles). The word stays in the key's name for assistive technology and in the held card */
        const at = hits.find(x => x.e.mark === ko)?.e;
        const gauge = at && at.cur > 0 ? { "--lo": Math.min(1, at.lo / at.cur).toFixed(3), "--hi": Math.min(1, at.hi / at.cur).toFixed(3) } : null;
        const range = hits.map(x => [x.slot, Math.floor(x.e.lo * 10) / 10, Math.floor(x.e.hi * 10) / 10, x.e.cur, x.e.mark?.n || 0, x.e.mark?.sure ? 1 : 0].join("~")).join(",");
        // two lines, every move alike, as a game's move key: the name and how it lands; its type, category and power, its accuracy and priority, and its PP
        const power = powerOf(move), moved = power !== (data.basePower || 0);
        const foot = [data.category !== "Status" && data.accuracy !== true && data.accuracy < 100 && `명중 ${data.accuracy}`,
          data.priority ? `우선도 ${data.priority > 0 ? "+" : ""}${data.priority}` : null, SPEED_POWER.has(move.id) && "스피드에 따라"].filter(Boolean).join(" ");
        const info = `move:${move.id}:${type}:${power > 0 ? power : ""}:${move.pp != null ? `${move.pp}/${move.maxpp}` : ""}:${range}`;
        return <button key={move.id} type="button" className={`bt-move type-${toID(type)}${aiming === i ? " on" : ""}${move.disabled ? " off" : ""}`} disabled={off || move.disabled || sending} data-was={move.disabled ? undefined : ""} onClick={() => choose(move, i)} aria-pressed={aiming === i}
          data-info={info} data-key={n + 1} title={narrow ? undefined : `단축키 ${n + 1}`}
          aria-label={`${moveName(move.id)}, ${res.text.types[type] || type}, ${CATEGORY[data.category] || ""}${power > 0 ? ` 위력 ${power}${moved && data.basePower > 0 ? `, 기본 ${data.basePower}` : ""}` : ""}, ${data.accuracy === true ? "필중" : `명중 ${data.accuracy}`}${move.pp != null ? `, PP ${move.pp} / ${move.maxpp}` : ""}${shown.map(x => { const word = EFF_WORD[x.m] || effLabel(x.m); return word ? `, ${doubles ? x.f.name + " " : ""}${word}` : ""; }).join("")}${ko ? `, ${ko.word}` : ""}`}>
          <span className="bt-move-top">
            <b className="bt-move-name">{moveName(move.id)}</b>
            {shown.length > 0 && <span className="bt-effs" aria-hidden="true">{shown.map(x => <span key={x.f.slot} className={effClass(x.m)}>{effLabel(x.m)}</span>)}</span>}
          </span>
          <span className="bt-move-line" aria-hidden="true">
            <span className="bt-move-type">{res.text.types[type] || type}</span>
            {/* the power it goes out with now; lit when that is not its book power (feedback 2026-11-07: 어시스트파워, 웨더볼) */}
            <span className="bt-move-kind"><span>{CATEGORY[data.category] || ""}{power > 0 && !moved ? ` ${power}` : ""}</span>{power > 0 && moved && <b className="bt-move-pow">{power}</b>}{foot && <span>{foot}</span>}</span>
            {/* a move locked in (Outrage, a charging move) is asked without its PP */}
            <span className="bt-move-pp">{move.pp != null ? `${move.pp}/${move.maxpp}` : ""}</span>
          </span>
          {gauge && <span className="bt-move-gauge" style={gauge} aria-hidden="true"><i /><u /></span>}
        </button>;
      })}
      {megaEl}
    </div>;
  /* the type a move goes out as for this Pokémon now (its ability, the weather, the terrain, its form: battleWords.js moveType); the key
     shows that type, its colour and its matchups */
  /* with 메가진화 checked the keys read as the Mega Pokémon will use them, its ability and typing (feedback 2026-11-07: a Mega with
     Pixilate kept its Normal moves Normal on the key) */
  const seen = monAt(side.id, k), megaForm = mega && megaFormOf(res.detail, slots[k].item);
  const user = { species: megaForm?.name || species(slots[k].details), ability: megaForm ? megaForm.abilities[0] : slots[k].ability, item: slots[k].item,
    types: megaForm ? megaForm.types : typesAt(side.id, k) || [], ...parseHP(slots[k].condition), boosts: seen?.boosts, volatiles: seen?.volatiles, hits: seen?.hits,
    fainted: side.pokemon.filter(p => String(p.condition).endsWith(" fnt")).length };
  const typeOf = move => moveType(move.id, res.detail.moves[move.id]?.type || "Normal", user, field);
  // the damage a move does to a foe standing at a place, as the calculator counts it (battleDamage.js); null at an ally or an empty place
  const { hp: userHp, maxhp: userMax, status: userStatus } = parseHP(slots[k].condition);
  const dmgUser = { species: user.species, base: species(slots[k].details), stats: slots[k].stats, hp: userHp, maxhp: userMax, ability: user.ability, item: slots[k].item,
    boosts: seen?.boosts || {}, status: userStatus === "fnt" ? "" : userStatus };
  const hitsOn = (move, fieldSide, slot) => (fieldSide === side.id ? null
    : estimate({ detail: res.detail, user: dmgUser, target: monAt(fieldSide, slot), moveId: move.id, field, screens: screensAt(fieldSide), doubles, formatId }));
  /* the power a move goes out with now (battleWords.js movePower): its user's HP, boosts and item, the weather and terrain, and, when
     one foe stands, that foe; Return and Frustration come with theirs in the request ("Return 102") */
  const lone = foes.filter(Boolean);
  const targetAt = (fieldSide, slot) => { const m = monAt(fieldSide, slot); return m && !m.fainted ? { ...m, types: currentTypes(res, m) } : null; };
  const powerOf = (move, target = lone.length === 1 ? targetAt(foeSide, lone[0].slot) : null) =>
    Number(/ (\d+)$/.exec(move.move || "")?.[1]) || movePower(move.id, res.detail.moves[move.id]?.basePower || 0, user, target, field);
  /* who a move can be aimed at (doubles): the places it reaches with someone standing there; an empty place is offered only when
     there is no one at all (Showdown's rule). null when it needs no target */
  const reach = (move, index) => {
    const want = doubles ? NEEDS_TARGET[move.target] : null;
    if (!want) return null;
    const data = res.detail.moves[move.id] || {}, type = typeOf(move), tail = mega ? " mega" : "";
    const label = `${who}${mega ? "(메가진화)" : ""}의 ${moveName(move.id)}`;
    const fits = (fieldSide, slot) => {
      const own = fieldSide === side.id;
      return want === "any" ? !(own && slot === at) : want === "foe" ? !own : want === "ally" ? own && slot !== at : own;
    };
    const standing = ["p1", "p2"].flatMap(s => [0, 1].filter(slot => fits(s, slot) && typesAt(s, slot)).map(slot => [s, slot]));
    const targeting = (fieldSide, slot) => {
      if (!fits(fieldSide, slot) || (standing.length && !typesAt(fieldSide, slot))) return null;
      const own = fieldSide === side.id;
      const types = typesAt(fieldSide, slot);
      const mark = types && data.category !== "Status" ? effectiveness(type, types, move.id) : null;
      // a power that turns on who it hits (로킥, 병상첨병) is said at each place
      const power = types ? powerOf(move, targetAt(fieldSide, slot)) : null;
      const ko = !own && types && data.category !== "Status" ? hitsOn(move, fieldSide, slot)?.mark : null;
      return { mark, ko, power: power !== powerOf(move, null) ? power : null, onPick: () => add(`move ${index + 1} ${own ? -(slot + 1) : slot + 1}${tail}`, `${label}, ${nameAt(fieldSide, slot)}에게`) };
    };
    return { standing, targeting };
  };
  const choose = (move, index) => {
    const tail = mega ? " mega" : "";
    if (aiming === index) { back(); return; }
    const aim = reach(move, index);
    if (!aim) { add(`move ${index + 1}${tail}`, `${who}${mega ? "(메가진화)" : ""}의 ${moveName(move.id)}`); return; }
    // when only one is left (a lone foe for a move at foes, the partner for one at the ally), it goes there at once,
    // as the game does not ask a question with one answer
    if (aim.standing.length === 1) { aim.targeting(...aim.standing[0]).onPick(); return; }
    /* and when no one stands where it reaches (Helping Hand once the partner has fallen), it goes to its one empty place, where the
       game uses it and it fails. The picker drew that place as 빈 자리 with nothing to press, so the move could not be chosen, and a
       player left with only it could not choose at all (battle-fuzz, 2026-11-07) */
    if (!aim.standing.length) {
      const place = ["p1", "p2"].flatMap(s => [0, 1].map(slot => [s, slot])).find(([s, slot]) => aim.targeting(s, slot));
      if (place) { aim.targeting(...place).onPick(); return; }
    }
    // otherwise the moves give way to the targets, as Showdown and Champions ask: the field as it stands, foes over us
    // the moves hand their place to the picker: they dim to the locked light, then it comes up from there
    handOff(root.current?.querySelector(".bt-moves")).then(() => setAiming(index));
    onAim?.();
  };
  /* Mega Evolution: a key the moves' width above them, set before a move is chosen, as the game asks for it first. Its emblem is
     the games' rainbow helix (public/brand/mega-evolution.png) as given; the key inverts while it is on */
  // why the key is off, said by its information, never on the key (DESIGN.md "Battle", Mega Evolution)
  const megaWhy = mega || (active?.canMegaEvo && !megaTaken) ? "" : active?.canMegaEvo ? "이번 턴에 이미 메가진화를 골랐습니다." : "나와 있을 때 켤 수 있습니다.";
  const megaWho = active?.canMegaEvo || !holder ? slots[k] : holder;
  const megaKey = off => <button key="mega" type="button" className={"bt-mega" + (mega ? " on" : "") + (off ? " is-off" : "")} aria-pressed={mega} aria-disabled={off || undefined}
      onClick={() => { if (!off) setMega(!mega); }} aria-label={`${name(megaWho.details)} 메가진화`}
      data-info={`mega:${species(megaWho.details)}:${megaWho.item || ""}:${megaWhy}`} data-key="m" title={narrow ? undefined : `${megaWhy || `${name(megaWho.details)} 메가진화`} (M)`}>
      <img className="bt-mega-mark" src="/brand/mega-evolution.png" alt="" draggable="false" />
    </button>;
  /* 처음부터 다시 고르기, where a choice has more than one place (doubles): a square at the bench row's end, standing every turn and off
     while there is nothing to take back, so the deck keeps one height. As a row of its own under the moves it came with the first
     place's pick and went with the choice, and the phone's deck, which never shrinks within a battle, kept its room as an empty band
     over the moves (2026-11-10, the user: "기술과 상태 표시줄 사이의 의미 없는 큰 공백") */
  const undoOff = !picks.length || frozen;
  const undoKey = slots.length > 1 && <button key="undo" type="button" className={"bt-mega bt-undo" + (undoOff ? " is-off" : "")} aria-disabled={undoOff || undefined}
      onClick={() => { if (!undoOff) reset(); }} aria-label="처음부터 다시 고르기">
      <Icon n="refresh" size={20} />
    </button>;
  const extras = (...keys) => keys.filter(Boolean);
  // fresh: locked keys nothing was asked on yet (the stage has just taken the team preview's place) come as they are, never down from lit
  const lockedClass = locked ? (fresh ? " locked fresh" : " locked") : "";
  // a forced switch: the bench, under the last moves (and the Mega key) standing off where they were
  if (forced) return <div className={"bt-choices forced" + lockedClass} ref={root}>
    {moveKeys(ghost?.active?.[at] || null, true, megaRow && megaKey(true))}
    {bench(extras(undoKey))}
    {toast && <Dock toast={toast} />}
  </div>;
  /* the target picker (doubles): the move keys give way to the field as the stage shows it, the foe's two over ours, each place its
     picture, name, HP and how the move lands there; a place the move cannot reach is muted; 돌아가기 brings the moves back
     (feedback 2026-11-06: rings drawn round the Pokémon on the stage read as dated) */
  if (aiming != null && aimed) {
    const aim = reach(aimed, aiming);
    const cell = (fieldSide, slot) => {
      const own = fieldSide === side.id, m = monAt(fieldSide, slot), t = aim?.targeting(fieldSide, slot);
      if (!m || m.fainted) return <div key={slot} className={"bt-target empty" + (own ? " own" : "")}><span className="t12 mute">빈 자리</span></div>;
      const hp = own ? `${m.hp}/${m.maxhp}` : `${Math.max(m.hp > 0 ? 1 : 0, Math.round(m.hp / (m.maxhp || 1) * 100))}%`;
      const nm = `${own ? "" : "상대 "}${nameOf(res, m.species)}`;
      return <button key={slot} type="button" className={"bt-target" + (own ? " own" : "")} disabled={!t || sending} onClick={t?.onPick} data-key={(own ? 3 : 1) + slot}
        aria-label={`${nm}, HP ${hp}${t?.power ? `, 위력 ${t.power}` : ""}${t?.mark != null ? `, ${EFF_WORD[t.mark] || effLabel(t.mark)}` : ""}${t?.ko ? `, ${t.ko.word}` : ""}${own && slot === at ? ", 자신" : ""}`}>
        <img src={spriteUrl(m.species)} alt="" draggable="false" onError={onSpriteError()} />
        {/* the row says whose side it is (theirs over ours), so the name stands alone; the matchup sits by the HP */}
        <span className="bt-target-say"><b>{nameOf(res, m.species)}</b>
          <span className="bt-target-line">{own && slot === at ? "자신" : hp}{t?.power > 0 && <span className="bt-move-pow">{`위력 ${t.power}`}</span>}{t?.mark != null && <span className={effClass(t.mark)} aria-hidden="true">{effLabel(t.mark)}</span>}{t?.ko && <span className={koClass(t.ko)} aria-hidden="true">{t.ko.word}</span>}</span></span>
      </button>;
    };
    return <div className={"bt-choices" + (locked ? " locked" : "")} ref={root}>
      <div className="bt-targets" role="group" aria-label={`${moveName(aimed.id)}의 대상`}>
        <div className="stack bt-target-row">{[0, 1].map(slot => cell(foeSide, slot))}</div>
        <div className="stack bt-target-row">{[0, 1].map(slot => cell(side.id, slot))}</div>
      </div>
      <Button onClick={back}>돌아가기</Button>
      {toast && <Dock toast={toast} />}
    </div>;
  }
  return <div className={"bt-choices" + lockedClass} ref={root}>
    {moveKeys(active, frozen, megaRow && megaKey(!megaOpen))}
    {bench(extras(undoKey))}
    {toast && <Dock toast={toast} />}
  </div>;
}


/* the bench: a row of the brought Pokémon not out, each its picture, name and HP; one that cannot come in is muted. On a phone it is
   the deck's bench row, the Mega key at its end (extra); lit: the bench is what is asked (a forced switch, Revival Blessing) */
// extra: the squares at the row's end (처음부터 다시 고르기 in doubles, the Mega key)
export function Bench({ pokemon, res, pick, narrow = false, extra = [], lit = false }) {
  const out = pokemon.map((mon, i) => ({ mon, i })).filter(({ mon }) => !mon.active);
  if (!out.length && !extra.length) return null;
  return <div className={"bt-bench" + (lit ? " lit" : "")}>
    <div className={"stack bt-bench-row" + (extra.length ? " with-mega" : "")} style={{ "--n": out.length, "--x": extra.length }}>
      {out.map(({ mon, i }, n) => {
        const go = pick(i);
        const species = String(mon.details).split(", ")[0];
        const { hp, maxhp, status } = parseHP(mon.condition);
        const fainted = status === "fnt";
        const was = !mon.active && !String(mon.condition).endsWith(" fnt");
        return <button key={mon.ident + i} type="button" className="bt-sw" disabled={!go} onClick={go || undefined} data-was={was ? "" : undefined} data-info={`own:${i}`}
          data-key={n < 2 ? String(5 + n) : undefined} title={narrow || n >= 2 ? undefined : `단축키 ${5 + n}`}
          aria-label={`${nameOf(res, species)}${fainted ? ", 쓰러짐" : `, HP ${hp} / ${maxhp}`} 교체`}>
          <img src={spriteUrl(species)} alt="" draggable="false" />
          <span className="bt-sw-say">
            <b className="t15">{nameOf(res, species)}</b>
            <span className="t12 dim">{fainted ? "쓰러짐" : `${hp}/${maxhp}`}{status && !fainted ? `, ${STATUS[status] || status}` : ""}</span>
          </span>
        </button>;
      })}
      {extra}
    </div>
  </div>;
}

