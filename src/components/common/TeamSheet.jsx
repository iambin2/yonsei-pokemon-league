import React, { useEffect, useState } from "react";
import { championsData } from "../../services/index.js";
import { buildTeamSheet, fromTeamSnapshotV1, localizedPokemonName, onSpriteError, savedTeamSheet } from "../../services/teamBuilderCore.js";
import { REGULATIONS } from "../../data/index.js";
import { Bar } from "./Board.jsx";

let teamDisplay = null;
function loadTeamDisplay() {
  return teamDisplay ||= Promise.all([championsData.load(), championsData.loadSpeciesNames()])
    .then(([detailData, names]) => ({ detailData, koreanNames: names.koreanByEnglish }))
    .catch(error => { teamDisplay = null; throw error; });
}
/* 배틀 데이터. 처음 쓸 때 한 번만 받는다. 못 받으면 "error" */
export function useTeamDisplay(enabled = true) {
  const [state, setState] = useState(null);
  useEffect(() => {
    if (!enabled) return undefined;
    let live = true;
    loadTeamDisplay().then(d => live && setState(d), () => live && setState("error"));
    return () => { live = false; };
  }, [enabled]);
  return state;
}
export function sheetOf(team, display) {
  if (!display || display === "error") return [];
  return savedTeamSheet(team, { ...display, legalItems: championsData.legalItems(display.detailData, team?.regulationId) });
}
/* 공식 기록의 파티(스냅숏 멤버)를 같은 모델로 되살린다 */
export function rosterSheet(roster, display, only = null) {
  if (!display || display === "error" || !roster?.sets?.length) return [];
  const regulation = REGULATIONS[roster.regulationId] || Object.values(REGULATIONS)[0];
  const restored = fromTeamSnapshotV1({ snapshot: { schema_version: 1 }, members: only ? [only] : roster.sets, regulation, detailData: display.detailData });
  if (!restored.ok) return [];
  return buildTeamSheet(restored.team, { detailData: display.detailData, displayPokemon: pokemon => localizedPokemonName(pokemon, display.koreanNames) || pokemon?.name });
}

/* 팀 시트: 빌더 편집기에 있는 모든 값을 포켓몬마다 한 장의 케이스에. 이미지 저장도 같은 모델을 그린다. */
export default function TeamSheet({ sheet, idPrefix = "" }) {
  return <div className={"sc-sheet" + (sheet.length > 1 ? " multi" : "")}>{sheet.map((row, i) => (
    <article className="case sc-mon" key={i} id={idPrefix ? idPrefix + i : undefined}>
      <header className="case-label">
        <span className="case-who"><b>{row.name}</b><span>{[row.english !== row.name ? row.english : "", row.num != null ? `No. ${String(row.num).padStart(4, "0")}` : ""].filter(Boolean).join("  ")}</span></span>
      </header>
      <div className="case-win sc-win">
        <img src={row.sprite} alt="" onError={onSpriteError()} />
        <div className="tb-types">{row.types.map(t => <span key={t.id} className={`tb-type type-${t.id}`}>{t.label}</span>)}</div>
      </div>
      <div className="sc-spec">
        {row.unresolved && <p className="bk-hint">지금 데이터에서 확인할 수 없는 포켓몬입니다.</p>}
        <dl className="sc-facts">
          <div><dt>특성</dt><dd>{row.ability || "없음"}</dd></div>
          <div><dt>도구</dt><dd>{row.item || "없음"}</dd></div>
          <div><dt>성격</dt><dd>{row.nature}<small>{row.natureEffect}</small></dd></div>
        </dl>
        {/* no header row of column names (Composing a screen 25): the points' label and total stand over the table as the builder's do,
            and each row says its figures: the stat's name, its base with its word, the points on their bar, the stat itself */}
        <div className="sc-stat-block">
        <div className="tb-subhead"><span className="t12 dim">능력 포인트</span><b className="t12">{row.spTotal} / 66</b></div>
        <div className="sc-stats" role="table" aria-label={`${row.name} 능력치`}>
          {row.stats.map(st => (<div className="sc-stat" role="row" key={st.key}>
            <b role="cell">{st.label}{st.mark === "+" ? " ↑" : st.mark === "-" ? " ↓" : ""}</b>
            <span role="cell" className="sc-base">{st.base != null && <><small>종족값</small> <span className="tnum">{st.base}</span></>}</span>
            <span role="cell" className="sc-sp"><Bar value={st.sp / 32} /><em className={"tnum" + (st.sp ? " on" : "")}>{st.sp}</em></span>
            <strong role="cell" className="tnum">{st.final}</strong>
          </div>))}
        </div>
        </div>
        <ul className="sc-moves">{Array.from({ length: 4 }, (_, k) => {
          const mv = row.moves[k];
          return <li key={k} className={mv ? "" : "empty"}>{mv ? <><b>{mv.name}</b><span className="sc-move-line">{mv.type?.label && <span className={`tb-type type-${mv.type?.id || ""}`}>{mv.type.label}</span>}{mv.category && <small>{mv.category}</small>}</span></> : <small>기술 없음</small>}</li>;
        })}</ul>
      </div>
    </article>))}</div>;
}

/* a sample post's one Pokémon (2026-11-23, the owner's draft A: one case at the left and an empty half beside it "비효율적"): the
   Pokémon large on its floor at the left, its name and types on the floor band; at the right the actions, then every value of its set
   at the right's width, as the builder lays them out: 특성, 도구 and 성격 as three cells, the points on their bars, the four moves as cells. */
export function SampleCase({ row, actions }) {
  return <div className="sc-one">
    <div className="pn stand sc-one-hero">
      <img className="mon" src={row.sprite} alt="" onError={onSpriteError()} />
      <div className="floor sc-one-band">
        <span className="sc-one-who"><b className="t20">{row.name}</b><span className="t12 dim">{row.num != null ? `No. ${String(row.num).padStart(4, "0")}` : ""}</span></span>
        <span className="tb-types">{row.types.map(t => <span key={t.id} className={`tb-type type-${t.id}`}>{t.label}</span>)}</span>
      </div>
    </div>
    <div className="sc-one-set">
      {actions}
      {row.unresolved && <p className="bk-hint">지금 데이터에서 확인할 수 없는 포켓몬입니다.</p>}
      <div className="cells sc-one-facts">
        <div className="cell"><span className="cell-label">특성</span><b>{row.ability || "없음"}</b></div>
        <div className="cell"><span className="cell-label">도구</span><b>{row.item || "없음"}</b></div>
        <div className="cell"><span className="cell-label">성격</span><b>{row.nature}<small className="t12 dim reg"> {row.natureEffect}</small></b></div>
      </div>
      <div className="sc-stat-block">
        <div className="tb-subhead"><span className="t12 dim">능력 포인트</span><b className="t12">{row.spTotal} / 66</b></div>
        <div className="sc-stats" role="table" aria-label={`${row.name} 능력치`}>
          {row.stats.map(st => (<div className="sc-stat" role="row" key={st.key}>
            <b role="cell">{st.label}{st.mark === "+" ? " ↑" : st.mark === "-" ? " ↓" : ""}</b>
            <span role="cell" className="sc-base">{st.base != null && <><small>종족값</small> <span className="tnum">{st.base}</span></>}</span>
            <span role="cell" className="sc-sp"><Bar value={st.sp / 32} /><em className={"tnum" + (st.sp ? " on" : "")}>{st.sp}</em></span>
            <strong role="cell" className="tnum">{st.final}</strong>
          </div>))}
        </div>
      </div>
      <ul className="sc-one-moves">{Array.from({ length: 4 }, (_, k) => {
        const mv = row.moves[k];
        return <li key={k} className={"pn" + (mv ? "" : " empty")}>{mv ? <><b className="t15">{mv.name}</b><span className="sc-move-line">{mv.type?.label && <span className={`tb-type type-${mv.type?.id || ""}`}>{mv.type.label}</span>}{mv.category && <small className="t12 dim">{mv.category}</small>}</span></> : <small className="t12 mute">기술 없음</small>}</li>;
      })}</ul>
    </div>
  </div>;
}
