import React, { useEffect, useState, useSyncExternalStore } from "react";
import Seg from "./common/Seg.jsx";
import { medalDrawn, medalUrl } from "./titleMedal.js";
import { loadRecordsPokemonDirectory } from "../services/recordsPokemon.js";
import { REGIONS, TITLE_TYPES, championMedal, ownMedal, partnerMedal, regionMedal, regionOfTitle, typeMedal, typeOfTitle } from "../services/titleLooks.js";

/* ============================== 칭호의 메달 (DESIGN.md "Titles and hall of fame") ==============================
   칭호 페이지, 칭호 시트, 트레이너 시트가 같은 메달과 같은 판을 쓴다. */

const DESK = "(min-width: 860px)";
const deskNow = () => typeof window !== "undefined" && Boolean(window.matchMedia?.(DESK).matches);
const onDesk = fn => { const m = typeof window !== "undefined" && window.matchMedia?.(DESK); m?.addEventListener("change", fn); return () => m?.removeEventListener("change", fn); };
export const useDesk = () => useSyncExternalStore(onDesk, deskNow, () => false);

/* the theme a medal is lit in: its room is the board's ground, so a medal is drawn again when the theme turns */
const groundNow = () => typeof document === "undefined" ? "" : document.documentElement.dataset.theme || "";
const onGround = fn => { const o = new MutationObserver(fn); o.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] }); return () => o.disconnect(); };
const useGround = () => useSyncExternalStore(onGround, groundNow, () => "");

/* a partner's medal takes its Pokémon's first type and its national number: read from the records' Pokémon directory, once */
let partnerFacts = null;
export function usePartnerMedal() {
  const [map, setMap] = useState(partnerFacts);
  useEffect(() => {
    if (partnerFacts) return;
    let on = true;
    loadRecordsPokemonDirectory().then(directory => {
      const m = new Map();
      for (const record of directory.values()) if (record.displayName && record.type && !m.has(record.displayName)) m.set(record.displayName, record);
      partnerFacts = m;
      if (on) setMap(m);
    }, () => { if (on) setMap(new Map()); });
    return () => { on = false; };
  }, []);
  return map ? name => { const record = map.get(name); return partnerMedal(record?.type || "normal", record?.dexNumber); } : null;
}

/* one medal: nothing until it is drawn, then it is there (a medal switches on, it does not arrive) */
export function Medal({ spec: face, off = false, big = false }) {
  /* a sheet's face is drawn large, and only there does the band carry the league's name */
  const spec = face && big ? { ...face, big: true } : face;
  const ground = useGround(), key = JSON.stringify(spec) + off + ground;
  const [drawn, setDrawn] = useState(() => (spec ? { key, src: medalDrawn(spec, off) } : { key, src: "" }));
  useEffect(() => {
    if (!spec) return;
    const ready = medalDrawn(spec, off);
    if (ready) { setDrawn({ key, src: ready }); return; }
    let on = true;
    medalUrl(spec, off).then(src => on && setDrawn({ key, src }));
    return () => { on = false; };
  }, [key]);
  const src = drawn.key === key ? drawn.src : "";
  return <span className="tl-medal" aria-hidden="true">{src && <img src={src} alt="" decoding="async" />}</span>;
}

/* a board of medals, each its name under it; a short last row is closed with empty panels so the board stays a rectangle */
export function MedalBoard({ medals, cols, className = "", label }) {
  const desk = useDesk();
  const n = desk ? cols[0] : cols[1], empty = (n - medals.length % n) % n;
  return <div className={"stack tl-board-medals " + className} style={{ "--cols": n }} role="list" aria-label={label}>
    {medals.map(m => {
      const body = <>
        <Medal spec={m.spec} off={!m.on} />
        <span className="tl-name"><b className={m.big ? "t20" : ""}>{m.name}</b>{m.n > 1 && <i>×{m.n}</i>}</span>
        {m.sub && <span className={"t12 tl-sub" + (m.reign ? " reign" : "")}>{m.sub}</span>}
      </>;
      const cls = "pn tl-cell" + (m.on ? "" : " off");
      return m.onClick
        ? <button type="button" key={m.key} role="listitem" className={cls} onClick={m.onClick} aria-label={m.label || m.name}>{body}</button>
        : <span key={m.key} role="listitem" className={cls} aria-label={m.label || m.name}>{body}</span>;
    })}
    {Array.from({ length: empty }, (_, i) => <span key={"e" + i} className="pn tl-cell" aria-hidden="true" />)}
  </div>;
}

/* 트레이너 시트의 칭호: 챔피언은 제 판에 크게(그 사람의 가장 큰 사실), 그 밖의 가진 칭호는 모두 한 판의 메달로(타입, 지방, 그 밖의 순). 그 아래 타입 18개와 지방 10개는
   메달 대신 램프 판: 가진 칸만 반전되어 켜지고 나머지는 꺼진 채 자리를 지킨다. 판 머리에 몇 개를 가졌는지. */
export function TrainerTitles({ champions = [], titles = [] }) {
  const partnerMedalOf = usePartnerMedal();
  const mine = key => titles.filter(title => title.key === key);
  const types = new Set(mine("type").map(title => typeOfTitle(title.name)).filter(Boolean));
  const regions = new Set(mine("region").map(title => regionOfTitle(title.name)).filter(Boolean));
  const own = titles.filter(title => !["type", "region", "champion"].includes(title.key));
  const reigns = champions.map(c => ({ key: `c${c.gen}`, on: true, big: true, name: `${c.gen}대 챔피언`, spec: championMedal(c.gen) }));
  const held = [
    ...TITLE_TYPES.filter(t => types.has(t.id)).map(t => ({ key: `y${t.id}`, on: true, name: `${t.korean} 엑스퍼트`, spec: typeMedal(t.id) })),
    ...REGIONS.filter(([r]) => regions.has(r)).map(([r]) => ({ key: `r${r}`, on: true, name: `${r} 엘리트`, spec: regionMedal(r) })),
    ...own.map((title, i) => title.key === "partner"
      ? { key: `p${i}`, on: true, name: `${title.pokemon} 파트너`, label: `${title.pokemon}의 파트너`, spec: partnerMedalOf ? partnerMedalOf(title.pokemon) : null }
      : { key: `t${i}`, on: true, name: title.name, spec: ownMedal(title) }),
  ];
  const lamps = (label, items, has) => { const n = items.filter(([key]) => has(key)).length; return <div className="tl-lampset">
    <div className="tl-mhead"><span className="t12 dim">{label}</span>
      <span className="counter-board"><Seg value={String(n)} h={32} cells={2} label={`${items.length}개 중 ${n}개`} /><span className="t15">/ {items.length}</span></span></div>
    <div className="stack tl-lamps" style={{ "--n": items.length, "--m": items.length % 6 ? 5 : 6 }} role="list" aria-label={label}>
      {items.map(([key, name]) => <span key={key} role="listitem" className={"t12 tl-lamp " + (has(key) ? "inv" : "pn")} aria-label={`${name}${has(key) ? "" : ", 없음"}`}>{name}</span>)}
    </div>
  </div>; };
  /* three a row on a phone, so a held title's whole name (하나 엘리트, 해피너스 파트너) is read */
  return <div className="tl-mine">
    {reigns.length > 0 && <MedalBoard medals={reigns} cols={[6, 2]} label="챔피언" />}
    {held.length > 0 && <MedalBoard medals={held} cols={[9, 3]} label="가진 칭호" />}
    {lamps("타입 엑스퍼트", TITLE_TYPES.map(t => [t.id, t.korean]), id => types.has(id))}
    {lamps("지방 엘리트", REGIONS.map(([r]) => [r, r]), r => regions.has(r))}
  </div>;
}
