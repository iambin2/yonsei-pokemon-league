import React, { useEffect, useRef, useState } from "react";
import { Row, TabsLine } from "../components/common/Board.jsx";
import Empty from "../components/common/Empty.jsx";
import Button from "../components/common/Button.jsx";
import Modal from "../components/common/Modal.jsx";
import { Medal, MedalBoard, usePartnerMedal } from "../components/TitleFaces.jsx";
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
const COLS = { champion: [6, 3], type: [9, 3], region: [10, 5] };

/* the medals of one group, in the board's order */
function groupMedals(group, items, open, champions, partnerMedalOf) {
  const medal = (item, extra) => ({ key: item?.id || extra.key, item, on: holdersOf(item).length > 0, n: holdersOf(item).length, onClick: item ? open(item) : undefined, ...extra });
  if (group.key === "champion") {
    const hung = items.map(item => ({ item, gen: generationOfTitle(item.name) })).filter(x => x.gen).sort((a, b) => a.gen - b.gen);
    const reign = Math.max(0, ...hung.filter(x => holdersOf(x.item).length).map(x => x.gen));
    const seasonOf = gen => { const c = (champions || []).find(x => generationText(x.gen) === `${gen}대`); return c ? displaySeasonLabel(c.slabel || ("시즌 " + c.season)) : ""; };
    return hung.map(({ item, gen }) => {
      const who = holdersOf(item).join(", "), season = seasonOf(gen), now = gen === reign;
      return medal(item, { key: `g${gen}`, n: 0, name: who || `${gen}대`, big: true, sub: now ? "현 챔피언" : season, reign: now, spec: championMedal(gen),
        label: `${gen}대 챔피언 ${who || "없음"}${season ? `, ${season}` : ""}${now ? ", 현 챔피언" : ""}` });
    });
  }
  if (group.key === "type") {
    const by = new Map(items.map(item => [typeOfTitle(item.name), item]));
    return TITLE_TYPES.map(t => medal(by.get(t.id), { key: t.id, name: t.korean, spec: typeMedal(t.id), label: `${t.korean} 엑스퍼트${holdersOf(by.get(t.id)).length ? `, ${holdersOf(by.get(t.id)).join(", ")}` : ", 없음"}` }));
  }
  if (group.key === "region") {
    const by = new Map(items.map(item => [regionOfTitle(item.name), item]));
    return REGIONS.map(([r]) => medal(by.get(r), { key: r, name: r, spec: regionMedal(r), label: `${r} 엘리트${holdersOf(by.get(r)).length ? `, ${holdersOf(by.get(r)).join(", ")}` : ", 없음"}` }));
  }
  if (group.key === "partner") {
    /* 파트너는 거꾸로 적힌다: 항목의 이름이 트레이너, holders 가 포켓몬. 같은 포켓몬은 메달 하나에 그 트레이너들이 함께 선다. */
    const by = new Map();
    items.forEach(item => holdersOf(item).forEach(p => { const g = by.get(p) || { item, trainers: [] }; g.trainers.push(item.name); by.set(p, g); }));
    return [...by].map(([p, g]) => ({ key: p, item: g.item, on: true, n: g.trainers.length, name: p, onClick: open(g.item, { pokemon: p, trainers: g.trainers }),
      spec: partnerMedalOf ? partnerMedalOf(p) : null, label: `${g.trainers.join(", ")}의 파트너 ${p}` }));
  }
  return items.map(item => medal(item, { key: item.name, name: item.name, spec: ownMedal(item), label: `${item.name}${holdersOf(item).length ? `, ${holdersOf(item).join(", ")}` : ", 없음"}` }));
}

/* 칭호의 시트: 그 칭호의 메달과 조건, 주인 수, 주인을 받은 순서대로. 이름을 누르면 그 트레이너의 기록. */
/* 파트너 메달은 포켓몬 하나에 그 트레이너들이 함께 서므로, 시트도 그 포켓몬과 그 트레이너 모두를 보인다(partner: { pokemon, trainers }). */
function TitleSheet({ group, item, spec, partner, go, onClose }) {
  const holders = partner ? partner.trainers : holdersOf(item);
  const title = partner ? `파트너 ${partner.pokemon}` : item.name;
  const record = name => go ? () => { onClose(); go("records", { trainer: name }); } : undefined;
  return <Modal title={title} hint={partner ? group.desc : item.desc || group.desc} className="tl-sheet" onClose={onClose}>
    {!partner && spec && <div className="tl-sheet-face"><Medal spec={spec} off={!holders.length} /></div>}
    <section className="tl-sheet-sec">
      {/* the sheet's title is its h3, so the section under it is an h4 in the section head's own form */}
      <div className="sh"><h4 className="t20">{partner ? `트레이너 ${holders.length}명` : `주인 ${holders.length}명`}</h4></div>
      {holders.length ? <div className="stack">
        {holders.map((name, i) => partner
          ? <Row key={name} title={name} onClick={record(name)} label={`${name}, 기록 보기`} />
          : <Row key={name} lead={<span className="tl-ord"><span className="num t20">{i + 1}</span><span className="t12 dim">호</span></span>} title={name}
            onClick={record(name)} label={`${i + 1}호 ${name}, 기록 보기`} />)}
      </div> : <Empty title="아직 주인이 없습니다." />}
    </section>
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
  const g = groups.find(x => x.key === openKey) || groups[0];
  const items = g ? (g.items || []) : [];
  const medals = g ? groupMedals(g, items, (item, partner) => () => open(item, partner), data.champions, partnerMedalOf) : [];
  // 관리자 모드에서는 칭호가 편집기의 문이고, 그 밖에서는 칭호 시트의 문이다
  function open(item, partner) {
    if (admin) { setModal({ type: "title", groupKey: g.key, item }); return; }
    setSheet({ group: g, item, partner, spec: medals.find(m => m.item === item)?.spec });
    setParams({ title: partner ? partner.pokemon : (medals.find(m => m.item === item)?.key ?? item?.name) });
  }
  // a medal named in the address opens once the board stands
  const restored = useRef(false);
  useEffect(() => {
    if (restored.current || admin || !medals.length) return;
    restored.current = true;
    const k = param("title");
    if (!k) return;
    const m = [...medals, ...(strays.length ? groupMedals({ key: "own" }, strays, item => () => open(item)) : [])].find(x => String(x.key) === k);
    if (m?.onClick) m.onClick(); else setParams({ title: null });
  }, [medals.length]);
  // 타입과 지방 판에 자리가 없는 항목(운영자가 더한 이름)은 제 메달로 뒤에 선다
  const strays = g?.key === "type" ? items.filter(item => !typeOfTitle(item.name)) : g?.key === "region" ? items.filter(item => !regionOfTitle(item.name)) : [];

  return (<section className="tt">
    <header className="tt-head"><h1 className="t32">칭호</h1></header>
    {/* no line of counts: the board itself shows which medals are struck and which wait (2026-11-19, Made by people) */}
    {groups.length > 1 && <div className="tt-tabs"><TabsLine value={g?.key} onChange={choose} label="칭호 분류" options={groups.map(x => [x.key, x.name])} /></div>}

    {g && <div className="swap" key={g.key}>
      {admin && <div className="tt-add"><Button variant="second" onClick={() => setModal({ type: "title", groupKey: g.key })}>칭호 추가</Button></div>}
      <div className="stack tl-board">
        {g.desc && <div className="pn tl-rule"><span className="t12 dim">조건</span><b className="t15">{g.desc}</b></div>}
        <MedalBoard medals={medals} cols={COLS[g.key] || [6, 3]} label={g.name} className={g.key === "champion" ? "tl-champs" : ""} />
        {strays.length > 0 && <MedalBoard medals={groupMedals({ key: "own" }, strays, item => () => open(item))} cols={[6, 3]} label={`${g.name} 그 밖`} />}
      </div>
    </div>}
    {sheet && <TitleSheet {...sheet} go={go} onClose={close} />}
  </section>);
}
