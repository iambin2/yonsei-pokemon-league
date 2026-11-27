import React, { createContext, useContext, useEffect, useLayoutEffect, useReducer, useRef, useState, useSyncExternalStore } from "react";
import Fig from "./common/Fig.jsx";
import { place } from "./common/motion.js";
import { medalDrawn, medalUrl } from "./titleMedal.js";
import { loadRecordsPokemonDirectory } from "../services/recordsPokemon.js";
import { spriteUrl } from "../services/teamBuilderCore.js";
import { REGIONS, TITLE_TYPES, championMedal, ownMedal, partnerMedal, regionMedal, regionOfTitle, typeMedal, typeOfTitle } from "../services/titleLooks.js";

/* ============================== 칭호의 메달 (DESIGN.md "Titles and hall of fame") ==============================
   칭호 페이지, 칭호 시트, 트레이너 시트가 같은 메달과 같은 판을 쓴다. */

const DESK = "(min-width: 860px)";
const deskNow = () => typeof window !== "undefined" && Boolean(window.matchMedia?.(DESK).matches);
const onDesk = fn => { const m = typeof window !== "undefined" && window.matchMedia?.(DESK); m?.addEventListener("change", fn); return () => m?.removeEventListener("change", fn); };
export const useDesk = () => useSyncExternalStore(onDesk, deskNow, () => false);

/* the theme and contrast a seal is drawn in: its ring and cut lines read tokens, so a seal redraws when theme or contrast turns */
const groundNow = () => typeof document === "undefined" ? "" : `${document.documentElement.dataset.theme || ""}:${document.documentElement.dataset.contrast || ""}`;
const onGround = fn => { const o = new MutationObserver(fn); o.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "data-contrast"] }); return () => o.disconnect(); };
const useGround = () => useSyncExternalStore(onGround, groundNow, () => "");

/* a partner's medal takes its Pokémon's first type and its picture (the silhouette on it): read from the records' Pokémon directory, once */
let partnerFacts = null;
export function usePokemonLookup() {
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
  if (!map) return null;
  const list = [...map.values()];
  const pictureOf = name => {
    const record = map.get(name);
    return record?.canonicalName ? spriteUrl(record.canonicalName) : "";
  };
  return { byName: map, list, pictureOf };
}

export function usePartnerMedal() {
  const lookup = usePokemonLookup();
  return lookup ? name => { const record = lookup.byName.get(name); return partnerMedal(record?.type || "normal", lookup.pictureOf(name)); } : null;
}

/* a medal shown wider than the small drawing's 384 device pixels is drawn large: a board's cell is the board's width over its columns,
   and the medal some .8 of its cell */
export const bigMedal = (n, desk) => (desk ? 1200 : window.innerWidth) / n * .8 * window.devicePixelRatio > 384;

/* one medal: nothing until it is drawn, then it is there (a medal switches on, it does not arrive). While it waits it says so
   (data-wait), and tells its board when that changes */
const Drawn = createContext(null);
export function Medal({ spec, off = false, big = false }) {
  const onDrawn = useContext(Drawn);
  const ground = useGround(), key = JSON.stringify(spec) + off + big + ground;
  const [drawn, setDrawn] = useState(() => { const src = spec ? medalDrawn(spec, off, big) : ""; return { key, src, done: Boolean(src) }; });
  useEffect(() => {
    if (!spec) return;
    const ready = medalDrawn(spec, off, big);
    if (ready) { setDrawn({ key, src: ready, done: true }); return; }
    let on = true;
    medalUrl(spec, off, big).then(src => on && setDrawn({ key, src, done: true }));
    return () => { on = false; };
  }, [key]);
  const now = drawn.key === key, src = now ? drawn.src : "", wait = !(now && drawn.done);
  useLayoutEffect(() => { onDrawn?.(); }, [wait]);
  /* a medal asked for at the other size (a board's medal opened on its sheet) stands in while its own is drawn */
  const shown = src || (spec && wait ? medalDrawn(spec, off, !big) : "");
  return <span className="tl-medal" aria-hidden="true" data-wait={wait ? "" : undefined}>{shown && <img src={shown} alt="" decoding="async" />}</span>;
}

/* anything that holds medals switches them on together, once the last is drawn (2026-11-22: they came on one by one, some 100 apart
   at a phone's speed, 1.7 s for the eighteen types, and the board read as stuttering). Medals that were waiting come on by tone as a
   group, as late pictures do (DESIGN.md "Motion"), instead of popping in; medals drawn before the board stood light with the page */
export function LitBoard({ className = "", children, ...rest }) {
  const board = useRef(null), [lit, setLit] = useState(false), [, drawn] = useReducer(x => x + 1, 0), waited = useRef(false);
  useLayoutEffect(() => { const all = !board.current.querySelector("[data-wait]"); if (!all) waited.current = true; if (all !== lit) setLit(all); });
  useLayoutEffect(() => { if (lit && waited.current) { waited.current = false; place([...board.current.querySelectorAll(".tl-medal > img")]); } }, [lit]);
  return <Drawn.Provider value={drawn}><div ref={board} className={"tl-lit " + className + (lit ? " lit" : "")} {...rest}>{children}</div></Drawn.Provider>;
}

/* a board of medals, each its name under it */
export function MedalBoard({ medals, cols, className = "", label }) {
  const desk = useDesk();
  // the columns follow the medals (Composing a screen 29): a board of fewer medals than columns is that many wide from the start edge,
  // and a longer one fills its rows and ends its last row early. A cell is never widened past its width at the base count, and a board
  // is never split into short rows to look even (2026-11-23, the owner: eight events as four and four left "무의미한 공백")
  const base = desk ? cols[0] : cols[1], fit = Math.min(medals.length, base);
  const n = Math.max(1, fit), big = bigMedal(base, desk);
  return <LitBoard className={"stack tl-board-medals " + className} style={{ "--cols": n, "--base": base }} role="list" aria-label={label}>
    {medals.map(m => {
      const body = <>
        <Medal spec={m.spec} off={!m.on} big={big} />
        <span className="tl-name"><b className={m.big ? "t20" : ""}>{m.name}</b>{m.n > 1 && <i>×{m.n}</i>}</span>
        {m.sub && <span className={"t12 tl-sub" + (m.reign ? " reign" : "")}>{m.sub}</span>}
      </>;
      const cls = "pn tl-cell" + (m.on ? "" : " off");
      return m.onClick
        ? <button type="button" key={m.key} role="listitem" className={cls} onClick={m.onClick} aria-label={m.label || m.name}>{body}</button>
        : <span key={m.key} role="listitem" className={cls} aria-label={m.label || m.name}>{body}</span>;
    })}
  </LitBoard>;
}

/* 트레이너 시트의 칭호: 챔피언은 제 판에 크게(그 사람의 가장 큰 사실), 그 밖의 가진 칭호는 모두 한 판의 메달로(타입, 지방, 그 밖의 순). 그 아래 타입 18개와 지방 10개는
   메달 대신 이름의 표: 가진 이름만 굵게 켜지고 나머지는 흐린 채 자리를 지킨다. 표 머리에 몇 개를 가졌는지 가는 숫자로. */
export function TrainerTitles({ champions = [], titles = [] }) {
  const pokemonLookup = usePokemonLookup();
  const partnerMedalOf = pokemonLookup ? name => { const record = pokemonLookup.byName.get(name); return partnerMedal(record?.type || "normal", pokemonLookup.pictureOf(name)); } : null;
  const mine = key => titles.filter(title => title.key === key);
  const types = new Set(mine("type").map(title => typeOfTitle(title.name)).filter(Boolean));
  const regions = new Set(mine("region").map(title => regionOfTitle(title.name)).filter(Boolean));
  const own = titles.filter(title => !["type", "region", "champion"].includes(title.key));
  const ownOpts = pokemonLookup ? { pokemonPicture: pokemonLookup.pictureOf, pokemonList: pokemonLookup.list } : undefined;
  const reigns = champions.map(c => ({ key: `c${c.gen}`, on: true, big: true, name: `${c.gen}대 챔피언`, spec: championMedal(c.gen) }));
  const held = [
    ...TITLE_TYPES.filter(t => types.has(t.id)).map(t => ({ key: `y${t.id}`, on: true, name: `${t.korean} 엑스퍼트`, spec: typeMedal(t.id) })),
    ...REGIONS.filter(([r]) => regions.has(r)).map(([r]) => ({ key: `r${r}`, on: true, name: `${r} 엘리트`, spec: regionMedal(r) })),
    ...own.map((title, i) => title.key === "partner"
      ? { key: `p${i}`, on: true, name: `${title.pokemon} 파트너`, label: `${title.pokemon}의 파트너`, spec: partnerMedalOf ? partnerMedalOf(title.pokemon) : null }
      : { key: `t${i}`, on: true, name: title.name, spec: ownMedal(title, ownOpts) }),
  ];
  const lamps = (label, items, has) => { const n = items.filter(([key]) => has(key)).length; return <div className="tl-lampset">
    <div className="tl-mhead"><span className="t12 dim">{label}</span>
      <span className="counter-board"><Fig value={String(n)} h={52} label={`${items.length}개 중 ${n}개`} /><span className="t15">/ {items.length}</span></span></div>
    <div className="stack tl-lamps" style={{ "--n": items.length, "--m": items.length % 6 ? 5 : 6 }} role="list" aria-label={label}>
      {items.map(([key, name]) => <span key={key} role="listitem" className={"t12 tl-lamp" + (has(key) ? " on" : "")} aria-label={`${name}${has(key) ? "" : ", 없음"}`}>{name}</span>)}
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
