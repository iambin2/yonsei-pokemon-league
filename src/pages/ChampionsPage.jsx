import React, { useEffect, useRef, useState } from "react";
import { normTeam as normalizeLegacyParty } from "../services/legacyPartyImages.js";
import { Empty, ErrorNote, Loader } from "../components/index.js";
import { Mon, SectionHead } from "../components/common/Board.jsx";
import Seg from "../components/common/Seg.jsx";
import Button from "../components/common/Button.jsx";
import ChampionSheet from "../components/common/ChampionSheet.jsx";
import { championsOperationsEnabled, fetchNormalizedChampionsHallOfFame } from "../services/index.js";
import {
  mergeHallOfFame,
  loadHallOfFameArtworkLookup,
  resolveHallOfFameArtwork,
} from "../services/hallOfFamePresentation.js";
import { displaySeasonLabel, generationText } from "../services/seasonLabel.js";
import { freshRead, peekRead } from "../services/readCache.js";
import { CHAMPIONS_MAX_AGE_MS } from "../components/home/homeFacts.js";
import { useItemTitle } from "../components/layout/title.js";

/* ============================== CHAMPIONS ==============================
   (DESIGN.md "Titles and hall of fame") 전당은 한 사람을 크게, 나머지를 벽에 건다.
   위: 현 챔피언의 판. 세대는 세그먼트로 켜지고, 이름은 32, 여섯 마리는 크게 이름과 함께 선다.
   가운데: 전당의 숫자 셋(세대, 챔피언, 최다 우승). 아래: 이전 챔피언의 명판이 최신부터 벽에 걸린다.
   명판은 세대, 이름, 시즌, 몇 번째 우승인지, 여섯 마리. 누르면 파티 시트가 열린다. */
export default function ChampionsPage({ data, admin, setModal, normTeam = normalizeLegacyParty, go }) {
  // 홈과 같은 전당 조회 캐시: 홈에서 넘어오면 기억한 값으로 바로 그린다
  const [normalizedChamps, setNormalizedChamps] = useState(() => peekRead("champions") ?? null);
  const [artworkLookup, setArtworkLookup] = useState(null);
  const normalizedEnabled = championsOperationsEnabled();
  /* a failed read is not an empty hall (DESIGN.md "Errors and empty"): what was already read stays, and the note says the rest did not come */
  const [failed, setFailed] = useState(false), [tries, setTries] = useState(0);
  useEffect(() => {
    let cancelled = false;
    if (!normalizedEnabled) return undefined;
    freshRead("champions", fetchNormalizedChampionsHallOfFame, admin ? 0 : CHAMPIONS_MAX_AGE_MS)
      .then(rows => { if (!cancelled) { setNormalizedChamps(rows); setFailed(false); } })
      .catch(error => { console.warn("normalized Champions read failed", error); if (!cancelled) { setNormalizedChamps(seen => seen ?? []); setFailed(true); } });
    return () => { cancelled = true; };
  }, [normalizedEnabled, tries]);
  const reading = normalizedEnabled && normalizedChamps == null;
  useEffect(() => {
    let cancelled = false;
    loadHallOfFameArtworkLookup()
      .then(lookup => { if (!cancelled) setArtworkLookup(lookup); })
      .catch(() => { if (!cancelled) setArtworkLookup(new Map()); });
    return () => { cancelled = true; };
  }, []);
  const champs = mergeHallOfFame(data.champions, normalizedChamps);
  // the reign open is in the address (?gen=), so a reload or a shared link opens the same party
  const [pop, setPopState] = useState(null);
  const reignKey = c => (c.generationNumber > 0 ? String(c.generationNumber) : c.name);
  const setPop = c => {
    setPopState(c);
    const url = new URL(window.location.href);
    if (c) url.searchParams.set("gen", reignKey(c)); else url.searchParams.delete("gen");
    if (url.href !== window.location.href) window.history.replaceState(window.history.state, "", url);
  };
  useItemTitle(pop ? `${pop.name}, ${generationText(pop.gen) || "챔피언"}` : null);
  const restored = useRef(false);
  useEffect(() => {
    if (restored.current || !champs.length) return;
    const k = new URLSearchParams(window.location.search).get("gen");
    if (!k) { restored.current = true; return; }
    const c = champs.find(x => reignKey(x) === k);
    if (c) { restored.current = true; setPopState(c); } else if (!reading) { restored.current = true; setPop(null); }
  }, [champs.length, reading]);

  // 세대는 어디서나 숫자로("초대"가 아니라 "1대"), 문장은 "6대 챔피언, YPL 시즌 2 우승" 한 가지로 쓴다.
  const genLabel = c => generationText(c.gen) ? `${generationText(c.gen)} 챔피언` : "챔피언";
  const seasonLabel = c => displaySeasonLabel(c.slabel) || ("시즌 " + c.season);
  const partyOf = c => normTeam(c.team).filter(m => m.name || m.img || m.pokemonId).slice(0, 6)
    .map(m => ({ name: m.name || "", img: resolveHallOfFameArtwork(m, artworkLookup) }));
  const genNo = c => c.generationNumber > 0 ? c.generationNumber : 0;
  // 몇 번째 우승인지: 오래된 것부터 세어 같은 이름이 다시 나오면 2번째, 3번째
  const nth = new Map(); const seen = new Map();
  champs.forEach(c => { const k = (seen.get(c.name) || 0) + 1; seen.set(c.name, k); nth.set(c, k); });
  const title = c => [seasonLabel(c) + " 우승", nth.get(c) > 1 ? `${nth.get(c)}번째 우승` : ""].filter(Boolean).join(", ");

  const reigning = champs.length ? champs[champs.length - 1] : null;
  // the merge builds new rows on every render, so an open sheet's row is never the same object: a reign is its generation and name
  const sameReign = (a, b) => Boolean(a && b) && a.generationNumber === b.generationNumber && a.name === b.name && a.format === b.format;
  const past = champs.slice(0, -1).reverse();
  const plate = (c, h) => genNo(c) > 0
    ? <span className="hof-gen"><Seg value={String(genNo(c))} h={h} cells={Math.max(2, String(genNo(c)).length)} label={`${genNo(c)}대`} /><span className={h > 40 ? "t20" : "t15"}>대</span></span>
    : <span className="t15">{generationText(c.gen)}</span>;

  return (<section className="hof">
    <header className="hof-head"><h1 className="t32">명예의 전당</h1>{admin && <Button variant="link" onClick={() => setModal({ type: "champion" })}>이전 챔피언 추가</Button>}</header>
    {failed && <ErrorNote action="다시 불러오기" onRetry={() => { setFailed(false); setTries(n => n + 1); }}>챔피언 기록을 불러오지 못했습니다.</ErrorNote>}
    {!reigning && (reading ? <Loader /> : !failed && <Empty title="등록된 챔피언이 없습니다." />)}
    {reigning && <section className="pn hof-crown" aria-label={`현 챔피언 ${reigning.name}`}>
      <div className="hof-crown-who">
        <span className="inv t12 hof-crown-tag">현 챔피언</span>
        {plate(reigning, 84)}
        <h2 className="t32 hof-crown-name">{reigning.name}</h2>
        <p className="t15 dim reg">{title(reigning)}</p>
        <div className="hof-crown-act">
          {go && <Button variant="link" onClick={() => go("records", { trainer: reigning.name })}>{reigning.name} 기록 보기</Button>}
          <Button variant="link" onClick={() => setPop(reigning)}>파티 보기</Button>
        </div>
      </div>
      <div className="hof-crown-six">
        {partyOf(reigning).map((m, i) => <span className="stand hof-crown-mon" key={i}><Mon src={m.img} /><b className="floor hof-band t15">{m.name}</b></span>)}
      </div>
    </section>}


    {past.length > 0 && <section className="hof-past" aria-labelledby="hof-past-h">
      <SectionHead id="hof-past-h" title="역대 챔피언" />
      {/* the wall's columns follow its champions (Composing a screen 29): four or five stand as one row on desktop, three on a tablet */}
      <div className="hof-wall" style={{ "--wc": past.length === 4 || past.length === 5 ? past.length : 3, "--tc": past.length === 3 ? 3 : 2 }}>
        {past.map((c, i) => (<div className="hof-slot" key={c.id || i}>
          <button type="button" className="pn hof-plate" onClick={() => setPop(c)} aria-label={`${genLabel(c)} ${c.name}, ${title(c)}, 파티 보기`}>
            <span className="hof-plate-top">{plate(c, 40)}<span className="t12 dim hof-plate-season">{title(c)}</span></span>
            <b className="t20 hof-plate-name">{c.name}</b>
            <span className="hof-plate-six">{partyOf(c).map((m, k) => <span className="stand hof-plate-mon" key={k}><i className="floor" aria-hidden="true" /><Mon src={m.img} small /></span>)}</span>
          </button>
          {/* the edit stands under its own plate, named by the generation, so two reigns of one trainer never read alike */}
          {admin && c.kind !== "normalized" && <Button variant="second" size="sm" onClick={() => setModal({ type: "champion", item: c })}>{[generationText(c.gen), c.name, "수정"].filter(Boolean).join(" ")}</Button>}
        </div>))}
      </div>
    </section>}

    {pop && <ChampionSheet name={pop.name} line={title(pop)} generation={genNo(pop)} genText={generationText(pop.gen)} reigning={sameReign(pop, reigning)}
      party={partyOf(pop)} sets={pop.sets} regulationId={pop.regulationId} onClose={() => setPop(null)}>
      {go && <Button variant="main" onClick={() => { setPop(null); go("records", { trainer: pop.name }); }}>{pop.name} 기록 보기</Button>}
    </ChampionSheet>}
  </section>);
}
