import React, { useEffect, useRef, useState } from "react";
import ShareHere from "../components/ShareHere.jsx";
import { Row, TabsLine } from "../components/common/Board.jsx";
import Empty from "../components/common/Empty.jsx";
import Button from "../components/common/Button.jsx";
import Modal from "../components/common/Modal.jsx";
import Fig from "../components/common/Fig.jsx";
import { LitBoard, Medal, MedalBoard, bigMedal, useDesk, usePartnerMedal, usePokemonLookup } from "../components/TitleFaces.jsx";
import { medalUrl } from "../components/titleMedal.js";
import { displaySeasonLabel, generationText } from "../services/seasonLabel.js";
import { REGIONS, TITLE_TYPES, championMedal, generationOfTitle, ownMedal, regionMedal, regionOfTitle, typeMedal, typeOfTitle } from "../services/titleLooks.js";
import { useItemTitle } from "../components/layout/title.js";

/* ============================== TITLES ==============================
   (DESIGN.md "Titles and hall of fame", 2026-11-13) 모든 칭호는 메달이고, 칭호 페이지는 채워 갈 메달 도감이다.
   챔피언은 금메달, 타입은 그 문양, 지방은 그 풍경, 파트너는 발자국, 그 밖은 고른 색과 장식. 주인이 없는 칭호는 새겨지지 않은 빈 메달이다.
   메달을 누르면 그 칭호의 시트(메달과 주인들)가 열리고, 관리자 모드에서는 편집기가 열린다. */
const holdersOf = item => item?.holders || [];
const param = name => new URLSearchParams(window.location.search).get(name);
// the page's own keys in its address, written over the entry it stands on (the history state kept as it is)
const setParams = pairs => {
  const url = new URL(window.location.href);
  Object.entries(pairs).forEach(([k, v]) => { if (v) url.searchParams.set(k, v); else url.searchParams.delete(k); });
  if (url.href !== window.location.href) window.history.replaceState(window.history.state, "", url);
};
/* each group stands as its kind of title reads (2026-11-24, the owner's pick of draft C: "칭호의 카테고리마다 칭호의 배치도 각각의
   특징을 반영"): the champions as a line newest first, the types as one board to fill (nine across), the regions in their
   generations' order, the partners by trainer, the rest one title a row with its rule and its holders */
const TYPE_COLS = [9, 3], COLS = [6, 3];
const REGION_GEN = { 관동: 1, 성도: 2, 호연: 3, 신오: 4, 하나: 5, 칼로스: 6, 알로라: 7, 가라르: 8, 히스이: 8, 팔데아: 9 };
// a medal drawn wider than the small drawing's 384 device pixels is drawn large
const bigAt = px => px * (window.devicePixelRatio || 1) > 384;
/* a row names its first holders only, so a title many hold keeps its height (2026-11-24, the owner: "엄청 많은 사람이 쌓여도 괜찮아?");
   the rest are one chip, and the whole list is the title's sheet a press away */
const Names = ({ names, max = 5 }) => names.length > 0 && <span className="tl-names">
  {names.slice(0, max).map(n => <span key={n} className="t12 tl-chip">{n}</span>)}
  {names.length > max && <span className="t12 tl-chip dim">외 {names.length - max}명</span>}
</span>;

function ChampionLine({ medals, desk }) {
  return <LitBoard className="stack" role="list">{[...medals].reverse().map(m => <button type="button" key={m.key} role="listitem" aria-label={m.label}
    className={"pn tl-crow" + (m.reign ? " now" : "") + (m.on ? "" : " off")} onClick={m.onClick}>
    <span className="tl-gen"><Fig value={String(m.gen)} h={m.reign ? (desk ? 136 : 84) : (desk ? 52 : 32)} /><span className="t12 dim">대</span></span>
    <Medal spec={m.spec} off={!m.on} big={bigAt(m.reign ? (desk ? 204 : 132) : (desk ? 120 : 84))} />
    <span className="tl-rmain"><b className={m.reign ? "t32" : "t20"}>{m.name}</b>
      {(m.reign || m.season) && <span className="t12 dim">{[m.reign && "현 챔피언", m.season].filter(Boolean).join(", ")}</span>}</span>
  </button>)}</LitBoard>;
}

function RegionLine({ medals, desk }) {
  return <LitBoard className="stack tl-regions" role="list">{medals.map(m => <button type="button" key={m.key} role="listitem" aria-label={m.label}
    className={"pn tl-tick" + (m.on ? "" : " off")} onClick={m.onClick} disabled={!m.onClick}>
    <span className="tl-gen"><Fig value={String(m.gen)} h={32} /><span className="t12 dim">세대</span></span>
    <Medal spec={m.spec} off={!m.on} big={bigAt(desk ? 204 : 132)} /><b className="t15">{m.name}</b>
    {/* a region's cell is narrow, so three a cell */}<Names names={holdersOf(m.item)} max={3} />
  </button>)}</LitBoard>;
}

/* the partners by trainer: each trainer a row, the Pokémon they won with twice on a shelf beside them */
function PartnerShelves({ items, medals, open }) {
  return <LitBoard className="stack">{items.filter(item => holdersOf(item).length).map(item => <div key={item.id || item.name} className="pn tl-trainer">
    <span className="tl-tname"><b className="t20">{item.name}</b><span className="t12 dim">파트너 {holdersOf(item).length}</span></span>
    <span className="tl-shelf" role="list" aria-label={`${item.name}의 파트너`}>{holdersOf(item).map(p => { const m = medals.find(x => x.key === p);
      return <button type="button" key={p} role="listitem" className="tl-shelf-cell" aria-label={m?.label || p} onClick={() => open(item, { pokemon: p, trainers: m?.trainers || [item.name] })}>
        <Medal spec={m?.spec} /><b className="t12">{p}</b></button>; })}</span>
  </div>)}</LitBoard>;
}

/* one title a row: its medal, its name and rule, its holders */
function TitleRows({ medals, desk }) {
  return <LitBoard className="stack tl-rows" role="list">{medals.map(m => <button type="button" key={m.key} role="listitem" aria-label={m.label}
    className={"pn tl-trow" + (m.on ? "" : " off")} onClick={m.onClick}>
    <Medal spec={m.spec} off={!m.on} big={bigAt(desk ? 120 : 84)} />
    <span className="tl-rmain"><b className="t20">{m.name}</b>{m.item?.desc && <span className="t12 dim">{m.item.desc}</span>}<Names names={holdersOf(m.item)} /></span>
  </button>)}</LitBoard>;
}

/* the medals of one group, in the board's order */
function groupMedals(group, items, open, champions, partnerMedalOf, ownOpts) {
  const medal = (item, extra) => ({ key: item?.id || extra.key, item, on: holdersOf(item).length > 0, n: holdersOf(item).length, onClick: item ? open(item) : undefined, ...extra });
  if (group.key === "champion") {
    const hung = items.map(item => ({ item, gen: generationOfTitle(item.name) })).filter(x => x.gen).sort((a, b) => a.gen - b.gen);
    const reign = Math.max(0, ...hung.filter(x => holdersOf(x.item).length).map(x => x.gen));
    const seasonOf = gen => { const c = (champions || []).find(x => generationText(x.gen) === `${gen}대`); return c ? displaySeasonLabel(c.slabel || ("시즌 " + c.season)) : ""; };
    return hung.map(({ item, gen }) => {
      const who = holdersOf(item).join(", "), season = seasonOf(gen), now = gen === reign;
      return medal(item, { key: `g${gen}`, gen, season, n: 0, name: who || `${gen}대`, sub: now ? "현 챔피언" : season, reign: now, spec: championMedal(gen),
        label: `${gen}대 챔피언 ${who || "없음"}${season ? `, ${season}` : ""}${now ? ", 현 챔피언" : ""}` });
    });
  }
  if (group.key === "type") {
    const by = new Map(items.map(item => [typeOfTitle(item.name), item]));
    return TITLE_TYPES.map(t => medal(by.get(t.id), { key: t.id, name: t.korean, spec: typeMedal(t.id), label: `${t.korean} 엑스퍼트${holdersOf(by.get(t.id)).length ? `, ${holdersOf(by.get(t.id)).join(", ")}` : ", 없음"}` }));
  }
  if (group.key === "region") {
    const by = new Map(items.map(item => [regionOfTitle(item.name), item]));
    return REGIONS.map(([r]) => medal(by.get(r), { key: r, name: r, gen: REGION_GEN[r], spec: regionMedal(r), label: `${r} 엘리트${holdersOf(by.get(r)).length ? `, ${holdersOf(by.get(r)).join(", ")}` : ", 없음"}` }));
  }
  if (group.key === "partner") {
    /* 파트너는 거꾸로 적힌다: 항목의 이름이 트레이너, holders 가 포켓몬. 같은 포켓몬은 메달 하나에 그 트레이너들이 함께 선다. */
    const by = new Map();
    items.forEach(item => holdersOf(item).forEach(p => { const g = by.get(p) || { item, trainers: [] }; g.trainers.push(item.name); by.set(p, g); }));
    return [...by].map(([p, g]) => ({ key: p, item: g.item, trainers: g.trainers, on: true, n: g.trainers.length, name: p, onClick: open(g.item, { pokemon: p, trainers: g.trainers }),
      spec: partnerMedalOf ? partnerMedalOf(p) : null, label: `${g.trainers.join(", ")}의 파트너 ${p}` }));
  }
  return items.map(item => medal(item, { key: item.name, name: item.name, spec: ownMedal(item, ownOpts), label: `${item.name}${holdersOf(item).length ? `, ${holdersOf(item).join(", ")}` : ", 없음"}` }));
}

/* 칭호의 시트: 그 칭호의 메달과 조건, 주인 수, 주인을 받은 순서대로. 이름을 누르면 그 트레이너의 기록. */
/* 파트너 메달은 포켓몬 하나에 그 트레이너들이 함께 서므로, 시트의 주인은 그 트레이너들이다(partner: { pokemon, trainers }). 메달은 다른 칭호와 같이 선다. */
function TitleSheet({ group, item, spec, partner, go, onClose }) {
  const holders = partner ? partner.trainers : holdersOf(item);
  // a champion's medal and a trainer's sheet say 1대 챔피언; the record keeps its own name (초대 챔피언)
  const title = partner ? `파트너 ${partner.pokemon}` : group.key === "champion" ? `${generationText(item.name)} 챔피언` : item.name;
  const record = name => go ? () => { onClose(); go("records", { trainer: name }); } : undefined;
  return <Modal title={title} hint={partner ? group.desc : item.desc || group.desc} className="tl-sheet" onClose={onClose}>
    {spec && <div className="tl-sheet-face"><Medal spec={spec} off={!holders.length} big /></div>}
    <section className="tl-sheet-sec">
      {/* the sheet's title is its h3, so the section under it is an h4 in the section head's own form; with no holder the empty line says it alone */}
      {holders.length > 0 && <div className="sh"><h4 className="t20">{`주인 ${holders.length}명`}</h4></div>}
      {holders.length ? <div className="stack">
        {holders.map((name, i) => <Row key={name} lead={<span className="tl-ord"><span className="num t20">{i + 1}</span><span className="t12 dim">호</span></span>} title={name}
            onClick={record(name)} label={`${i + 1}호 ${name}, 기록 보기`} />)}
      </div> : <Empty title="아직 주인이 없습니다." />}
    </section>
    <ShareHere title={title} className="tl-sheet-share" />
  </Modal>;
}

export default function TitlesPage({ data, admin, setModal, go }) {
  const groups = data.titleGroups || [];
  // the group and the medal open are in the address (?tab=, ?title=), so a reload or a shared link opens the same medal
  const [openKey, setOpenKey] = useState(() => { const t = param("tab"); return groups.some(x => x.key === t) ? t : groups.length ? groups[0].key : null; });
  const [sheet, setSheet] = useState(null);
  useItemTitle(sheet ? (sheet.partner ? `파트너 ${sheet.partner.pokemon}` : sheet.item?.name) : null);
  const choose = key => { setOpenKey(key); setParams({ tab: key, title: null }); };
  const close = () => { setSheet(null); setParams({ title: null }); };
  const partnerMedalOf = usePartnerMedal();
  const pokemonLookup = usePokemonLookup();
  const ownOpts = pokemonLookup ? { pokemonPicture: pokemonLookup.pictureOf, pokemonList: pokemonLookup.list } : undefined;
  const g = groups.find(x => x.key === openKey) || groups[0];
  const items = g ? (g.items || []) : [];
  const medals = g ? groupMedals(g, items, (item, partner) => () => open(item, partner), data.champions, partnerMedalOf, ownOpts) : [];
  // 관리자 모드에서는 칭호가 편집기의 문이고, 그 밖에서는 칭호 시트의 문이다
  function open(item, partner) {
    if (admin) { setModal({ type: "title", groupKey: g.key, item }); return; }
    // a trainer with two partners stands on two medals of one item, so a partner's medal is found by its Pokémon
    const m = medals.find(x => partner ? x.key === partner.pokemon : x.item === item);
    setSheet({ group: g, item, partner, spec: m?.spec });
    setParams({ title: partner ? partner.pokemon : (m?.key ?? item?.name) });
  }
  // a medal named in the address opens once the board stands
  const restored = useRef(false);
  useEffect(() => {
    if (restored.current || admin || !medals.length) return;
    restored.current = true;
    const k = param("title");
    if (!k) return;
    const m = [...medals, ...(strays.length ? groupMedals({ key: "own" }, strays, item => () => open(item), undefined, undefined, ownOpts) : [])].find(x => String(x.key) === k);
    if (m?.onClick) m.onClick(); else setParams({ title: null });
  }, [medals.length]);
  // the other groups' medals are drawn while this one is read, so a tab pressed switches on whole (this board's own were asked for first)
  const desk = useDesk();
  useEffect(() => {
    if (!partnerMedalOf) return;
    for (const x of groups) if (x !== g) for (const m of groupMedals(x, x.items || [], () => undefined, data.champions, partnerMedalOf, ownOpts))
      if (m.spec) medalUrl(m.spec, !m.on, x.key === "type" ? bigMedal(TYPE_COLS[desk ? 0 : 1], desk) : bigAt(desk ? 204 : 132), true);
  }, [groups, Boolean(partnerMedalOf), desk]);
  // 타입과 지방 판에 자리가 없는 항목(운영자가 더한 이름)은 제 메달로 뒤에 선다
  const strays = g?.key === "type" ? items.filter(item => !typeOfTitle(item.name)) : g?.key === "region" ? items.filter(item => !regionOfTitle(item.name)) : [];

  return (<section className="tt">
    <header className="tt-head"><h1 className="page-title">칭호</h1>{admin && g && <Button variant="link" onClick={() => setModal({ type: "title", groupKey: g.key })}>칭호 추가</Button>}</header>
    {/* no line of counts: the board itself shows which medals are struck and which wait (2026-11-19, Made by people) */}
    {groups.length > 1 && <div className="tt-tabs"><TabsLine value={g?.key} onChange={choose} label="칭호 분류" options={groups.map(x => [x.key, x.name])} /></div>}

    {g && <div key={g.key}>
      <div className="stack tl-board">
        {g.desc && <div className="pn tl-rule"><span className="t12 dim">조건</span><b className="t15">{g.desc}</b></div>}
        {g.key === "champion" ? <ChampionLine medals={medals} desk={desk} />
          : g.key === "type" ? <MedalBoard medals={medals} cols={TYPE_COLS} label={g.name} />
          : g.key === "region" ? <RegionLine medals={medals} desk={desk} />
          : g.key === "partner" ? <PartnerShelves items={items} medals={medals} open={open} />
          : <TitleRows medals={medals} desk={desk} />}
        {strays.length > 0 && <MedalBoard medals={groupMedals({ key: "own" }, strays, item => () => open(item), undefined, undefined, ownOpts)} cols={COLS} label={`${g.name} 그 밖`} />}
      </div>
    </div>}
    {sheet && <TitleSheet {...sheet} go={go} onClose={close} />}
  </section>);
}
