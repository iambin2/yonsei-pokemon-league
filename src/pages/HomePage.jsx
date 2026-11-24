import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { lastEventResult } from "../services/lastEvent.js";
import ChampionSheet from "../components/common/ChampionSheet.jsx";
import ErrorNote from "../components/common/ErrorNote.jsx";
import Button from "../components/common/Button.jsx";
import { coverOpen, light } from "../components/common/motion.js";
import { BrandMark } from "../components/layout/SiteHeader.jsx";
import { loadChampions, seenChampions } from "../components/home/homeFacts.js";
import { getEvent, getLeagueIntakeEvents, listNormalizedBracketRuntimes } from "../services/normalizedCompetitionService.js";
import { freshRead } from "../services/readCache.js";
import { liveMatches, myNextMatch } from "../services/recordsAnalytics.js";
import { useMe } from "../components/common/useMe.js";
import { myCheckin } from "../services/visitorAuth.js";
import { listEventBattles } from "../services/battleService.js";
import { submissionDue } from "../services/submissionDue.js";
import { applicationsOpen } from "../services/announcementTimes.js";
import { readBracketSchedule, roundKeyOf, tableWord } from "../services/bracketSchedule.js";

const DAY_MS = 86400000;
/* "2026-10-04", "2026.10.04", "2026-10-04T15:21" → 그날 0시의 Date. 일까지 없으면 null. */
function dayOf(s) {
  const n = String(s || "").match(/\d+/g);
  if (!n || n.length < 3) return null;
  const d = new Date(+n[0], +n[1] - 1, +n[2]);
  return Number.isNaN(d.getTime()) ? null : d;
}
/* 홈의 다음 행동. 이미 불러온 공지(site_data)의 대회 정보만 읽는다. */
function nextEvent(announcements, now = new Date()) {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let best = null;
  for (const a of announcements || []) {
    const draft = a?.form?.enabled ? a.form.eventDraft : null;
    if (!draft) continue;
    const champions = draft.eventType === "champions";
    // each day with its start time (HH:MM, announcementTimes.js): the event-day clock reads it
    const dates = champions ? [[draft.qualifierHeldOn ?? draft.heldOn, draft.qualifierStartTime], [draft.finalHeldOn, draft.finalStartTime]] : [[draft.heldOn, draft.startTime]];
    for (const [raw, time] of dates) {
      const day = dayOf(raw);
      if (!day) continue;
      const dday = Math.round((day - today) / DAY_MS);
      if (dday < 0 || (best && best.dday <= dday)) continue;
      best = { a, draft, champions, raw, time, dday };
    }
  }
  return best;
}

/* 오늘 열리는 대회: 바의 램프, 대진표 탭의 램프, 다른 화면의 진행 띠가 읽는다. 없으면 null. */
export function todayEvent(announcements) {
  const upcoming = nextEvent(announcements);
  return upcoming?.dday === 0 ? { name: upcoming.draft.name || upcoming.a.title } : null;
}

/* 첫 등장은 사이트에 들어올 때마다 한 번이다. 판정은 처음 그릴 때 받아 두고 그려진 뒤에 지운다
   (개발 모드의 두 번 호출도 같은 답을 받는다). 홈에 다시 오면 보통의 화면 전환으로 선다. */
let firstOpen = true;
const opening = () => firstOpen;

const WEEKDAY = "일월화수목금토";

/* 지난 대회: 다음 대회가 없는 날의 첫 자리. 기록 화면과 같은 정규 기록 읽기(캐시 "records")에서 찾고, 지난 방문의 답을 첫 그림부터 쓴다. */
const LAST_KEY = "ypl-home-last";
const seenLast = () => { try { return JSON.parse(localStorage.getItem(LAST_KEY) || "null"); } catch { return null; } };
async function loadLast(admin) {
  const records = await import("../services/normalizedRecordsService.js");
  if (!records.normalizedRecordsReadEnabled()) return null;
  const last = lastEventResult(await freshRead("records", records.fetchNormalizedRecordsSnapshot, admin ? 0 : 60_000));
  try { last ? localStorage.setItem(LAST_KEY, JSON.stringify(last)) : localStorage.removeItem(LAST_KEY); } catch { /* 다음에 다시 읽는다 */ }
  return last;
}


/* 리그의 이름 세 줄이 단을 채운다: 한 줄씩 100에서 잰 폭으로 크기를 정하고(넓은 화면은 줄 끝의 사실 자리를 비운다), 이름이 첫 화면의
   남은 높이를 넘으면 세 줄을 같은 비율로 줄인다. 줄은 단 끝까지 그대로다. 글꼴이 다 온 뒤와 창이 바뀔 때 다시 잰다 */
function useFit(cover, name, deps) {
  useLayoutEffect(() => {
    const fit = () => {
      const box = name.current, page = cover.current;
      if (!box || !page) return;
      const wide = matchMedia("(min-width: 860px)").matches;
      const full = box.clientWidth;
      const facts = wide ? Math.min(Math.max(0, ...[...box.querySelectorAll(".ho-fact")].map(f => f.offsetWidth)) + 52, full / 2) : 0;
      const words = [...box.querySelectorAll("[data-fit]")];
      const sizes = words.map(el => { el.style.fontSize = "100px"; return 100 * (full - facts) / el.scrollWidth; });
      words.forEach((el, i) => { el.style.fontSize = `${sizes[i]}px`; });
      const cs = getComputedStyle(box);
      const room = parseFloat(getComputedStyle(page).minHeight) - [...page.children].filter(c => c !== box).reduce((s, c) => s + c.offsetHeight, 0)
        - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
      // only the words shrink: what else stands in the name (the facts under the words on a phone) keeps its height
      const own = [...box.children].reduce((s, c) => s + c.offsetHeight, 0), inWords = words.reduce((s, el) => s + el.offsetHeight, 0);
      const k = Math.min(1, (room - (own - inWords)) / inWords);
      if (k < 1) words.forEach((el, i) => { el.style.fontSize = `${(sizes[i] * k).toFixed(2)}px`; });
    };
    fit();
    document.fonts?.ready.then(fit);
    addEventListener("resize", fit);
    return () => removeEventListener("resize", fit);
  }, deps);
}

/* 표지의 작은 키 하나: 굵은 말, 흐린 덧말, 화살표. 누르면 간다 */
const Key = ({ mark = false, word, sub, onClick, label }) => <button type="button" className="ho-key" onClick={onClick} aria-label={label}>
  {mark && <i className="lamp sig" aria-hidden="true" />}{word}{sub && <span className="ho-key-sub">{sub}</span>}<b aria-hidden="true">→</b>
</button>;

/* ============================== HOME ==============================
   리그의 표지 (DESIGN.md "Layout and pages", Home; the owner's draft A, 2026-11-24). 위에 머리글 한 줄(리그의 이름과 오늘),
   그 아래 Yonsei, Pokémon, League가 각자 제 줄 위에 서서 첫 화면을 채운다. 줄마다 리그의 사실 하나가 그 줄 끝에 선다
   (2023년 5월부터, 현 챔피언, 지금 할 일의 작은 키). 폰에서는 사실이 단어 아래, 줄 위로 내려온다. 기능은 작은 키뿐이다. */
export default function HomePage({ data, go, admin, siteFailed = false, onRetrySite }) {
  const [enter] = useState(opening);
  const root = useRef(null), name = useRef(null);
  const [champions, setChampions] = useState(seenChampions), [pop, setPop] = useState(null);
  const [champsFailed, setChampsFailed] = useState(false), [champsTry, setChampsTry] = useState(0);

  useEffect(() => {
    let on = true;
    loadChampions(data, admin).then(rows => { if (on) { setChampions(rows); setChampsFailed(false); } })
      .catch(error => { console.warn("home champions read failed", error); if (on) { setChampions(seen => seen || []); setChampsFailed(true); } });
    return () => { on = false; };
  }, [data, champsTry]);

  /* 첫 등장은 표지만의 장면이다(coverOpen): 줄이 그어지고, 이름이 올라오고, 사실과 키가 켜지고, Wing Y가 마지막이다.
     사이트 안에서 다시 오면 보통의 화면 전환(light)으로 단어만 짧게 선다 */
  useLayoutEffect(() => {
    firstOpen = false;
    if (enter) coverOpen(root.current);
  }, [enter]);
  /* 읽는 동안 제 크기로 서 있던 자리([data-wait]: 챔피언, 지난 대회)는 그대로 서고, 들어온 것만 켜진다 */
  const waiting = useRef([]);
  useLayoutEffect(() => {
    const came = waiting.current.filter(el => el.isConnected && !el.hasAttribute("data-wait"));
    waiting.current = [...root.current.querySelectorAll("[data-wait]")];
    if (came.length) light(came, { kept: true });
  });

  /* 대회 단계: 남은 날과 키가 같은 계산을 읽는다 */
  const now = useMemo(() => {
    const upcoming = nextEvent(data.announcements);
    if (!upcoming) return null;
    const { a, draft, dday } = upcoming;
    return { today: dday === 0, dday, name: draft.name || a.title, eventId: a.form?.eventId || null, noticeId: a.id,
      // 파티 제출은 대회 시작까지다: 그날 시작 전에만 남은 시간을 센다
      open: dday > 0 && applicationsOpen(a.form), due: dday === 0 ? submissionDue(draft) : null };
  }, [data.announcements]);
  /* 대회 당일의 지금 경기, 내 다음 경기, 체크인, 사이트 배틀 관전: 그날 대회의 대진표를 대진표 화면과 같은 읽기로 가져와 15초마다
     다시 읽는다(2026-11-08). 공지 하나가 루키와 마스터를 함께 받으면 두 리그의 대회를 함께 본다. 표지에서는 모두 작은 키다 */
  const [live, setLive] = useState(null);
  const me = useMe();
  const [myNext, setMyNext] = useState(null);
  const [checkin, setCheckin] = useState(null);
  const [checkinIds, setCheckinIds] = useState([]);
  useEffect(() => {
    if (!now?.today || !now.eventId || !me?.playerId) { setCheckin(null); return undefined; }
    let on = true;
    getEvent(now.eventId).then(event => (event ? getLeagueIntakeEvents(event) : [])).then(events => events.map(e => e.id)).catch(() => [now.eventId])
      .then(ids => { if (!on) return; setCheckinIds(ids); return myCheckin(ids).then(state => on && setCheckin(state)); });
    return () => { on = false; };
  }, [now?.today, now?.eventId, me?.playerId]);
  const checkIn = async () => { try { setCheckin(await myCheckin(checkinIds, true)); } catch { /* the key stays for another press */ } };
  const [myWhere, setMyWhere] = useState(null);
  const [liveBattles, setLiveBattles] = useState([]);
  // the match shown as 지금 경기 is another than my own, which has its own key (2026-11-22: the same final stood twice)
  const liveMatch = live?.live?.find(m => m.id !== myNext?.id) || null;
  useEffect(() => {
    if (!now?.today || !now.eventId) { setLive(null); setLiveBattles([]); return undefined; }
    let on = true;
    const ids = getEvent(now.eventId).then(event => (event ? getLeagueIntakeEvents(event) : [])).then(events => events.map(e => e.id)).catch(() => [now.eventId]);
    const read = async () => {
      if (document.visibilityState !== "visible") return;
      const eventIds = await ids;
      freshRead("brackets", listNormalizedBracketRuntimes, 10_000)
        .then(rows => {
          if (!on) return;
          const plays = (rows || []).map(row => row.bracket).filter(b => eventIds.includes(b?.eventId)).map(b => ({ ...liveMatches(b), eventId: b.eventId, runtimeId: b.projection?.runtimeId || null }));
          setLive(plays.find(p => p.live.length) || null);
          const mineIn = me?.playerId ? (rows || []).map(row => row.bracket).filter(b => eventIds.includes(b?.eventId))
            .map(b => { const m = myNextMatch(b, me.playerId); return m && { ...m, eventId: b.eventId, runtimeId: b.projection?.runtimeId || null }; }).find(Boolean) : null;
          setMyNext(prev => (prev && mineIn && prev.id === mineIn.id && prev.opponent === mineIn.opponent ? prev : mineIn || null));
        })
        .catch(error => { console.warn("home live matches read failed", error); if (on) setLive(null); });
      Promise.all(eventIds.map(listEventBattles)).then(lists => { if (on) setLiveBattles(lists.flat().filter(row => row.status === "active")); }, () => {});
    };
    read();
    const timer = setInterval(read, 15_000);
    return () => { on = false; clearInterval(timer); };
  }, [now?.today, now?.eventId, me?.playerId]);
  useEffect(() => {
    if (!myNext?.runtimeId) { setMyWhere(null); return undefined; }
    let on = true;
    readBracketSchedule({ eventId: myNext.eventId, runtimeId: myNext.runtimeId }).then(sc => {
      if (!on || !sc) return;
      const at = sc.rounds[roundKeyOf(myNext.id)], table = sc.tables.get(myNext.id);
      const clock = at ? new Date(at).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Seoul" }) : "";
      setMyWhere([table ? tableWord(table) : "", clock ? `${clock} 시작` : ""].filter(Boolean).join(", ") || null);
    }, () => {});
    return () => { on = false; };
  }, [myNext?.id, myNext?.runtimeId]);
  /* 다음 대회가 없는 날의 키는 지난 대회다 (2026-11-16) */
  // undefined while a first visit (no kept copy) still reads it: its key stands at its size, unlit
  const [last, setLast] = useState(() => (now ? null : seenLast() ?? undefined));
  useEffect(() => {
    if (now) return undefined;
    let on = true;
    loadLast(admin).then(next => { if (on) setLast(next); }, error => { console.warn("home last event read failed", error); if (on) setLast(null); });
    return () => { on = false; };
  }, [!now, data]);
  const lastWait = !now && last === undefined;
  const reigning = champions?.[0] || null;
  const t = new Date();

  /* 지금 할 일의 키들: 첫 키가 오늘의 일이고, 공지가 늘 끝에 선다 */
  const keys = [];
  if (now?.today) {
    keys.push(<Key key="today" mark word="오늘 대회 진행 중" sub="대진표" label={`${now.name}, 오늘 진행 중, 대진표 보기`} onClick={() => go("bracket", myNext ? { eventId: myNext.eventId } : undefined)} />);
    if (now.due) keys.push(<Key key="due" mark={now.due.unit === "시간"} word="파티 제출" sub={`${now.due.value}${now.due.unit} 남음`} onClick={() => go("news", { notice: now.noticeId })} />);
    if (myNext) keys.push(<Key key="mine" word="내 다음 경기" sub={[myNext.stage, myNext.opponent ? `상대 ${myNext.opponent}` : "상대 결정 전", myWhere].filter(Boolean).join(", ")}
      onClick={() => go("bracket", { eventId: myNext.eventId, m: myNext.id })} />);
    else if (checkin === "open") keys.push(<Key key="in" word="체크인" onClick={checkIn} />);
    else if (checkin === "done") keys.push(<span key="in" className="ho-key done">체크인 완료</span>);
    if (liveMatch) keys.push(<Key key="live" mark word="지금 경기" sub={`${liveMatch.stage}, ${liveMatch.a} 대 ${liveMatch.b}`} onClick={() => go("bracket", { eventId: live.eventId, m: liveMatch.id })} />);
    liveBattles.forEach(b => keys.push(<Key key={b.id} mark word="관전" sub={`${b.p1_name} 대 ${b.p2_name}`} onClick={() => go("battle", { battle: b.id })} />));
  } else if (now) {
    keys.push(<Key key="next" mark={now.open} word={now.open ? "이번 대회 신청" : "다음 대회"} sub={`${now.dday}일 남음`}
      label={`${now.name}, ${now.open ? "신청 접수 중" : "다음 대회"}, ${now.dday}일 남음`} onClick={() => go("news", { notice: now.noticeId })} />);
  } else if (last || lastWait) {
    keys.push(lastWait ? <span key="last" className="ho-key" data-wait="">지난 대회</span>
      : <Key key="last" word="지난 대회" sub={last.name} onClick={() => go("bracket", { eventId: last.eventId })} />);
  }
  if (data.announcements.length) keys.push(<Key key="news" word="공지" onClick={() => go("news")} />);
  useFit(root, name, [champions, last, now, myNext, myWhere, liveMatch?.id, liveBattles.length, checkin, siteFailed, champsFailed]);

  return (<div className="ho" ref={root}>
    <div className="ho-mast t12">
      <span><b>YPL</b> 포켓몬 센터 연세점 배틀 리그</span>
      <span className="num">{t.getFullYear()}. {t.getMonth() + 1}. {t.getDate()}. {WEEKDAY[t.getDay()]}</span>
    </div>
    {/* a failed read is said, not left as an empty place (DESIGN.md "Errors and empty") */}
    {(champsFailed || siteFailed) && <ErrorNote action="다시 불러오기" onRetry={() => { if (champsFailed) { setChampsFailed(false); setChampsTry(n => n + 1); } if (siteFailed) onRetrySite?.(); }}>리그 기록을 불러오지 못했습니다.</ErrorNote>}
    <div className="ho-name" ref={name}>
      <h1 className="sr-only">Yonsei Pokémon League</h1>
      <div className="ho-entry">
        <span className="ho-fig" aria-hidden="true" data-fit><span>Yonsei</span></span>
        <span className="ho-fact">2023년 5월부터</span>
      </div>
      <div className="ho-entry decided">
        <span className="ho-fig heavy" aria-hidden="true" data-fit><span>Pokémon</span></span>
        {reigning ? <button type="button" className="ho-fact ho-champ" onClick={() => setPop(reigning)} aria-label={`현 챔피언 ${reigning.name}, ${reigning.label}, 파티 보기`}>
          <span>{reigning.generation > 0 ? `제${reigning.generation}대 챔피언` : `${reigning.label} 챔피언`}</span><b>{reigning.name}</b>
        </button> : <span className="ho-fact ho-champ" data-wait={champions ? undefined : ""}><b>{" "}</b></span>}
      </div>
      <div className="ho-entry">
        <span className="ho-fig" aria-hidden="true" data-fit><span>League</span><BrandMark className="ho-wing" /></span>
        {keys.length > 0 && <nav className="ho-fact ho-keys" aria-label="바로 가기">{keys}</nav>}
      </div>
    </div>

    {pop && <ChampionSheet name={pop.name} line={pop.line} generation={pop.generation} genText={pop.label} reigning={pop.key === reigning?.key}
      party={pop.party} sets={pop.sets} regulationId={pop.regulationId} onClose={() => setPop(null)}>
      <Button variant="second" data-tab="champions" onClick={() => { setPop(null); go("champions"); }}>명예의 전당 보기</Button>
      <Button variant="main" onClick={() => { setPop(null); go("records", { trainer: pop.name }); }}>{pop.name} 기록 보기</Button>
    </ChampionSheet>}
  </div>);
}
