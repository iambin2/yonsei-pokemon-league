import React, { useState } from "react";
import { Chips, Dock } from "../../components/common/Board.jsx";
import Icon from "../../components/common/Icon.jsx";
import Button from "../../components/common/Button.jsx";
import { onSpriteError, spriteUrl } from "../../services/teamBuilderCore.js";
import { parseHP, toID } from "../../services/battleLog.js";
import { STATUS, nameOf, typesOf } from "./Stage.jsx";
import { maxPP, moveType } from "./battleWords.js";
import { defensiveMatchups, statRange } from "../../services/calculatorCore.js";

/* 파티를 읽는 카드 (DESIGN.md "Battle", The party). 선출 화면과 배틀 중의 파티 정보가 같은 카드를 쓴다.
   내 포켓몬은 엔진이 가져온 그대로(특성, 도구, 네 기술과 남은 PP, 능력치), 상대는 보인 만큼(특성, 도구, 쓴 기술과 쓴 횟수).
   크기의 순서: 포켓몬과 이름이 가장 크고, 다음이 기술, 그 다음이 특성과 도구, 능력치는 가장 작게. */

const STAT_ROW = [["atk", "공격"], ["def", "방어"], ["spa", "특공"], ["spd", "특방"], ["spe", "스피드"]];
const STATUS_TYPE = { brn: "fire", par: "electric", psn: "poison", tox: "poison", slp: "normal", frz: "ice" };
const hpTone = share => (share <= .2 ? "type-fire" : share <= .5 ? "type-electric" : "type-grass");
const says = (res, table, id) => (id ? res.info?.[table]?.[toID(id)] || "" : "");
const named = (res, table, id) => (id ? res.text[table]?.[toID(id)]?.name || res.detail[table]?.[toID(id)]?.name || id : "");
const Types = ({ res, species }) => <span className="bt-card-types">
  {typesOf(res, species).map(t => <span key={t} className={`tb-type type-${toID(t)}`}>{res.text.types[t] || t}</span>)}
</span>;

/* one Pokémon. moves: [{ id, pp: "12/16" or "2회" or "" }]; known: what the viewer may see (false keeps ability and item unknown);
   pick: { order, onPick, off } when it is chosen from (the team preview); short: the phone's team preview, the picture, the name, the
   types and the item only (its full card opens from its info mark); explain: the ability and the item say what they do, in the
   games' own words (DESIGN.md "Battle", Information at hand). A foe not yet out is its head alone (2026-11-09: a note saying it had
   nothing to show stood six times over) */
export function MonCard({ res, species, hp, share, status, fainted, ability, item, moves, stats, pick, out, unseen, compact, short, explain }) {
  const Box = pick ? "button" : "div";
  const label = `${nameOf(res, species)}${fainted ? ", 쓰러짐" : ""}${pick?.order ? `, ${pick.order}번째로 선출` : ""}`;
  return <Box className={"bt-card" + (pick?.order ? " on" : "") + (pick?.off ? " off" : "") + (fainted ? " fnt" : "") + (out ? " out" : "") + (compact ? " compact" : "") + (short ? " short" : "") + (unseen ? " unseen" : "")}
    {...(pick ? { type: "button", onClick: pick.onPick, "aria-pressed": Boolean(pick.order), disabled: pick.locked } : {})} aria-label={pick ? label : undefined}>
    <span className="bt-card-head">
      <span className="bt-card-pic"><img src={spriteUrl(species)} alt="" draggable="false" loading="lazy" onError={onSpriteError()} /></span>
      <span className="bt-card-id">
        <b className="bt-card-name">{nameOf(res, species)}</b>
        <Types res={res} species={species} />
      </span>
      {pick ? pick.order > 0 && <span className="bt-card-order" aria-hidden="true">{pick.order}</span>
        : <span className="bt-card-hp">
          <span className="bt-card-num">{fainted ? "쓰러짐" : unseen ? "" : hp}</span>
          {status && !fainted && <span className={`bt-st type-${STATUS_TYPE[status] || "normal"}`}>{STATUS[status] || status}</span>}
        </span>}
    </span>
    {share != null && !unseen && <span className={`bt-hp ${hpTone(share)}`} aria-hidden="true"><b style={{ "--f": Math.max(0, Math.min(1, share)) }} /></span>}
    {short ? <span className="bt-card-item">{item ? named(res, "items", item) : ""}</span> : unseen ? null : <>
      <span className="bt-card-facts">
        <span><small>특성</small><b className={ability ? "" : "unknown"}>{ability ? named(res, "abilities", ability) : "모름"}</b></span>
        <span><small>도구</small><b className={item ? "" : "unknown"}>{item ? named(res, "items", item) : item === "" ? "모름" : "없음"}</b></span>
      </span>
      <span className="bt-card-moves">
        {moves.length ? moves.map(m => {
          const type = m.type || res.detail.moves[toID(m.id)]?.type || "Normal";
          return <span key={m.id} className={`bt-cmove type-${toID(type)}${m.empty ? " empty" : ""}`}>
            <b>{named(res, "moves", m.id)}</b>{m.pp && <i>{m.pp}</i>}
          </span>;
        }) : <span className="bt-card-note">아직 보인 기술이 없습니다.</span>}
      </span>
      {explain && (says(res, "abilities", ability) || says(res, "items", item)) && <span className="bt-card-says">
        {says(res, "abilities", ability) && <span><b>{named(res, "abilities", ability)}</b>{says(res, "abilities", ability)}</span>}
        {says(res, "items", item) && <span><b>{named(res, "items", item)}</b>{says(res, "items", item)}</span>}
      </span>}
      {stats && <span className="bt-card-stats">{STAT_ROW.map(([k, w]) => <span key={k}><small>{w}</small>{stats[k]}</span>)}</span>}
    </>}
  </Box>;
}

/* the foe's six in the team preview: small, a picture, the name and the types, as the game shows them before the choice */
export function FoeSix({ res, species, title }) {
  return <section className="bt-pv-foe">
    <h2 className="bt-pv-title">{title}</h2>
    <div className="stack bt-foe-six">
      {species.map((s, i) => <div key={s + i} className="bt-foe-cell">
        <img src={spriteUrl(s)} alt="" draggable="false" onError={onSpriteError()} />
        <b>{nameOf(res, s)}</b>
        <Types res={res} species={s} />
      </div>)}
    </div>
  </section>;
}

// our brought Pokémon as cards, from the request: the whole set, with PP when it is known
/* the type each move goes out as for this Pokémon (its ability, its form, the weather and terrain now: battleWords.js moveType), as
   the move keys show it (feedback 2026-11-07: the party kept 하이퍼보이스 Normal under Pixilate) */
const asType = (res, id, mon, field) => moveType(id, res.detail.moves[toID(id)]?.type || "Normal", { species: mon.species, ability: mon.ability, item: mon.item, types: typesOf(res, mon.species) }, field);

export function ownCards(res, pokemon, { active = [], used = {}, maxpp = {}, field = {} } = {}) {
  return pokemon.map((mon, i) => {
    const species = String(mon.details).split(", ")[0];
    const { hp, maxhp, status } = parseHP(mon.condition);
    const slot = mon.active ? active[i] : null;
    const name = String(mon.ident).split(": ")[1] || species;
    const moves = (mon.moves || []).map(id => {
      const live = slot?.moves?.find(m => m.id === id);
      const max = live?.maxpp ?? maxpp[id];
      const left = live?.pp ?? (max != null ? max - (used[name]?.[id] || 0) : null);
      return { id, pp: left != null && max != null ? `${Math.max(0, left)}/${max}` : "", type: asType(res, id, { species, ability: mon.ability || mon.baseAbility, item: mon.item }, field) };
    });
    return { key: mon.ident + i, species, hp: `${hp}/${maxhp}`, share: maxhp ? hp / maxhp : 0, status: status === "fnt" ? "" : status, fainted: status === "fnt",
      ability: mon.ability || mon.baseAbility, item: mon.item || null, moves, stats: mon.stats, out: Boolean(mon.active) };
  });
}

// a side's Pokémon as cards, from what the log has shown: HP in percent, the ability and item once seen, the moves used and how often
export function seenCards(res, roster, field = {}) {
  return roster.map((m, i) => ({
    key: m.species + i, species: m.species, unseen: !m.seen && !m.fainted,
    hp: `${Math.max(m.hp > 0 ? 1 : 0, Math.round((m.hp / (m.maxhp || 1)) * 100))}%`, share: m.maxhp ? m.hp / m.maxhp : 0,
    status: m.status, fainted: m.fainted, ability: m.ability, item: m.item, out: m.out,
    // what it has left, as Showdown counts the foe's: the full PP less what it was seen to spend
    moves: m.moves.map(name => { const max = maxPP(res, name), used = m.ppUsed[toID(name)] || 0; return { id: toID(name), pp: max ? `${Math.max(0, max - used)}/${max}` : "", type: asType(res, name, m, field) }; }),
  }));
}

/* a side's whole party as it was sent to the engine (the input log's ">player p2 {…team}" line, Showdown's packed form:
   nickname|species|item|ability|moves|…, one Pokémon each between ]). An ability left blank is the species' first, 1 its second, H its
   hidden one. Only a battle with the computer has its log on the device; null when the line is not there */
export function packedCards(res, inputLog, side) {
  const line = String(inputLog || "").split("\n").find(l => l.startsWith(`>player ${side} `));
  let team;
  try { team = JSON.parse(line.slice(`>player ${side} `.length)).team; } catch { return null; }
  if (typeof team !== "string" || !team) return null;
  // the ones brought, in the order the team preview sent them (">p1 team 3, 1, 2"); all six when there was no preview
  const sent = String(inputLog).split("\n").filter(l => l.startsWith(`>${side} team `)).pop()?.slice(`>${side} team `.length).match(/\d/g)?.map(n => Number(n) - 1);
  const six = team.split("]");
  return (sent?.length ? sent.map(i => six[i]).filter(Boolean) : six).map((packed, i) => {
    const f = packed.split("|");
    const species = f[1] || f[0];
    const abilities = Object.values(res.detail.pokedex?.[toID(species)]?.abilities || {});
    const ability = !f[3] ? abilities[0] : f[3] === "1" ? abilities[1] : f[3] === "H" ? abilities[abilities.length - 1] : f[3];
    return { key: species + i, species, ability: ability || "", item: f[2] || null,
      moves: (f[4] || "").split(",").filter(Boolean).map(id => ({ id, pp: "", type: asType(res, id, { species, ability, item: f[2] }, {}) })) };
  });
}

/* the team preview on the stage (2026-11-18, the owner's draft A, the user: "선출 과정에서 더 많은 정보를 쉽게 조회 가능했으면 좋겠음.
   중요한 정보일수록 더더욱. 무대 때문에 낭비되는 공간이 있으니"): it stands in the stage's frame as the battle will, the foe's strip with
   their six, the court's room and our strip with the places in order, and under it our six as short cards. The court's room is the
   board of the Pokémon looked at: ours whole (its moves, ability and item with what they do, its stats), a foe's as far as its kind
   says (its types, its possible abilities, what hits it hard, its base stats and its speed at Lv50). A card's tap chooses it and
   shows it there, its i key shows it without choosing, a foe's picture shows that foe. Nothing comes up because a pointer rests.
   ownName: our strip's name; stake: a run's band over the stage; keeper: a 도전의 탑
   gatekeeper's game, whose gatekeeper's cell among the foe's six inverts */
const STAT_BASE = [["hp", "HP"], ["atk", "공격"], ["def", "방어"], ["spa", "특공"], ["spd", "특방"], ["spe", "스피드"]];
function FoeBoard({ res, species }) {
  const dex = res.detail.pokedex[toID(species)] || {};
  const types = typesOf(res, species);
  const weak = defensiveMatchups(types);
  const tag = t => <span key={t} className={`tb-type type-${toID(t)}`}>{res.text.types[t] || t}</span>;
  const [lo, hi] = dex.baseStats ? statRange(dex.baseStats.spe, "spe") : [0, 0];
  return <div className="bt-card bt-pv-card">
    <span className="bt-card-head"><span className="bt-card-id"><b className="bt-card-name">{nameOf(res, species)}</b><Types res={res} species={species} /></span></span>
    <span className="bt-card-facts">
      <span><small>특성 후보</small><b>{Object.values(dex.abilities || {}).map(a => named(res, "abilities", a)).join(", ")}</b></span>
      <span><small>스피드 (Lv50)</small><b>{`${lo}에서 ${hi}`}</b></span>
    </span>
    <span className="bt-pv-weak">{[[4, "4배"], [2, "2배"], [0, "무효"]].filter(([k]) => weak[k]?.length).map(([k, w]) => <span key={k}><small>{w}</small><span className="tb-types">{weak[k].map(tag)}</span></span>)}</span>
    {dex.baseStats && <span className="bt-card-stats six">{STAT_BASE.map(([k, w]) => <span key={k}><small>{w}</small>{dex.baseStats[k]}</span>)}</span>}
  </div>;
}

export function TeamPick({ res, foe, foeName, ownName = "나", pokemon, count, locked, picks, setPicks, stake = null, keeper = false }) {
  const n = Math.min(count, pokemon.length);
  const [look, setLook] = useState({ side: "own", i: 0 });
  const toggle = i => { setLook({ side: "own", i }); setPicks(list => list.includes(i) ? list.filter(x => x !== i) : list.length < n ? [...list, i] : list); };
  const cards = ownCards(res, pokemon);
  const seen = look.side === "foe" ? foe[look.i] : cards[look.i]?.species;
  const { key: _k, ...card } = cards[look.i] || {};
  return <div className={"bt-preview board" + (keeper ? " keeper" : "")}>
    {stake}
    <div className="bt-pv-stage">
      <div className="bt-pv-strip foe">
        <b className="bt-trainer">{foeName}</b>
        <span className="bt-pv-six" role="group" aria-label={`${foeName}의 파티`}>
          {foe.map((s, i) => <button key={s + i} type="button" className={"bt-foe-cell" + (look.side === "foe" && look.i === i ? " look" : "")} onClick={() => setLook({ side: "foe", i })}
            aria-pressed={look.side === "foe" && look.i === i} aria-label={`${nameOf(res, s)} 보기`}>
            <img src={spriteUrl(s)} alt="" draggable="false" onError={onSpriteError()} />
            <Types res={res} species={s} />
          </button>)}
        </span>
      </div>
      <div className={"bt-pv-focus " + look.side} aria-live="polite">
        {seen && <span className="bt-pv-hero" aria-hidden="true"><img src={spriteUrl(seen)} alt="" draggable="false" onError={onSpriteError()} /></span>}
        {look.side === "foe" ? foe[look.i] && <FoeBoard res={res} species={foe[look.i]} />
          : cards[look.i] && <MonCard res={res} {...card} hp={null} share={null} out={false} explain />}
      </div>
      <div className="bt-pv-strip own">
        <b className="bt-trainer">{ownName}</b>
        <ol className="bt-pv-order" aria-label="선출 순서">
          {Array.from({ length: n }, (_, k) => <li key={k} className={picks[k] != null ? "on" : ""}>
            <span className="bt-pv-n">{k + 1}</span>
            {picks[k] != null ? <img src={spriteUrl(cards[picks[k]].species)} alt={nameOf(res, cards[picks[k]].species)} draggable="false" onError={onSpriteError()} /> : null}
          </li>)}
        </ol>
        <span className="bt-pv-count" aria-live="polite"><b>{picks.length}</b>{` / ${n}`}</span>
      </div>
    </div>
    <div className="stack bt-cards">
      {/* out={false}: the engine's preview request marks the first of the party active, but nobody is out before the choice */}
      {cards.map(({ key, ...c }, i) => <div key={key} className={"bt-pick" + (look.side === "own" && look.i === i ? " look" : "")} data-info={`pick:${i}`}>
        <MonCard res={res} {...c} hp={null} share={null} out={false} short
          pick={{ order: picks.indexOf(i) + 1, onPick: () => toggle(i), off: picks.length >= n && !picks.includes(i), locked }} />
        <button type="button" className="bt-info-key" onClick={() => setLook({ side: "own", i })} aria-label={`${nameOf(res, c.species)} 보기`}><b className="bt-i" aria-hidden="true">i</b></button>
      </div>)}
    </div>
  </div>;
}

/* 선출 확정, docked on a phone and in the column on a desktop (the order stands on our strip, TeamPick) */
export function PickDock({ res, pokemon, count, picks, setPicks, onSend, toast, locked = false }) {
  const [sending, setSending] = useState(false);
  const n = Math.min(count, pokemon.length);
  const species = i => String(pokemon[i].details).split(", ")[0];
  const go = async () => {
    setSending(true);
    const went = await onSend(`team ${picks.map(i => i + 1).join(", ")}`, picks.map(i => nameOf(res, species(i))).join(", "));
    setSending(false);
    if (!went) setPicks([]);
  };
  return <div className="bt-pickdock">
    <Dock toast={toast}>
      <Button variant="main" icon="check" loading={sending || (locked && picks.length === n)} disabled={picks.length !== n || locked} onClick={go}>
        {picks.length === n ? "선출 확정" : `${n - picks.length}마리 더 고르기`}
      </Button>
    </Dock>
  </div>;
}

/* the party, beside the stage through the battle (Showdown's tooltips, laid open): one side at a time, our sets or what the foe has
   shown. The side out now first, then the rest in order */
export function TeamInfo({ res, sides, initial }) {
  const [side, setSide] = useState(initial || sides[0]?.key);
  const shown = sides.find(s => s.key === side) || sides[0];
  if (!shown) return null;
  const cards = [...shown.cards].sort((a, b) => Number(b.out) - Number(a.out));
  return <section className="bt-info-panel">
    <Chips label="파티 정보" value={shown.key} onChange={setSide} options={sides.map(s => [s.key, s.label])} />
    <div className="stack bt-cards one">
      {cards.map(({ key, ...c }) => <MonCard key={key} res={res} {...c} compact />)}
    </div>
  </section>;
}
