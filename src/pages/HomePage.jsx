import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ChampionPanel, Counter, Lead, Mon, SectionHead } from "../components/common/Board.jsx";
import { lastEventResult } from "../services/lastEvent.js";
import { NoticeLead, NoticeRow } from "../components/common/NoticeRows.jsx";
import Button from "../components/common/Button.jsx";
import ChampionSheet from "../components/common/ChampionSheet.jsx";
import ErrorNote from "../components/common/ErrorNote.jsx";
import { DUR, light } from "../components/common/motion.js";
import Seg from "../components/common/Seg.jsx";
import StandTable from "../components/common/StandTable.jsx";
import { loadChampions, loadFacts, seenChampions, seenFacts } from "../components/home/homeFacts.js";
import { dotDate, formatDate } from "../services/dateFormat.js";
import { getEvent, getLeagueIntakeEvents, listNormalizedBracketRuntimes } from "../services/normalizedCompetitionService.js";
import { freshRead } from "../services/readCache.js";
import { liveMatches, myNextMatch } from "../services/recordsAnalytics.js";
import { useMe } from "../components/common/useMe.js";
import { myCheckin } from "../services/visitorAuth.js";
import { listEventBattles } from "../services/battleService.js";
import { submissionDue } from "../services/submissionDue.js";
import { applicationsOpen } from "../services/announcementTimes.js";

const BATTLE = { singles: "싱글 배틀", doubles: "더블 배틀" };
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

/* 좁은 줄의 날짜: 11.07, 그 옆에 흐린 요일 */
const Day = ({ d }) => d && <span className="num">{d.day}<span className="dim wd">{d.weekday}</span></span>;

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


/* ============================== HOME ==============================
   전광판 한 장 (DESIGN.md "Layout and pages").
   첫 화면: 다음 대회까지의 날(없으면 꺼진 판), 대회 이름, 주 행동, 현 챔피언의 패널, 세 카운터. 아래: 시즌 순위, 공지, 역대 챔피언.
   데스크톱은 709와 439의 두 단이고, 두 단은 머리글 줄과 마지막 줄을 함께 쓴다. */
export default function HomePage({ data, go, admin, siteFailed = false, onRetrySite }) {
  const [enter] = useState(opening);
  const root = useRef(null);
  const [champions, setChampions] = useState(seenChampions), [facts, setFacts] = useState(() => admin ? null : seenFacts()), [pop, setPop] = useState(null);
  /* a failed read is not a board still reading (DESIGN.md "Errors and empty"): the counters stay off and the note under them says so */
  const [factsFailed, setFactsFailed] = useState(false), [factsTry, setFactsTry] = useState(0);

  useEffect(() => {
    let live = true;
    loadChampions(data, admin).then(rows => { if (live) setChampions(rows); }).catch(error => { console.warn("home champions read failed", error); if (live) setChampions([]); });
    loadFacts(data, admin).then(next => { if (live) { setFacts(next); setFactsFailed(false); } }).catch(error => { console.warn("home facts read failed", error); if (live) { setFacts(seen => seen || {}); setFactsFailed(true); } });
    return () => { live = false; };
  }, [data, factsTry]);
  /* the reign and the league's numbers are one block of the board: on a first visit the champion waits for the counters (its picture
     is fetched meanwhile) so the block lights at once, never longer than a second; a returning visitor has both from the first frame */
  const [waited, setWaited] = useState(false);
  useEffect(() => {
    if (!champions || facts || waited) return undefined;
    const src = champions[0]?.party[0]?.img;
    if (src) { const picture = new Image(); picture.fetchPriority = "high"; picture.src = src; }
    const timer = setTimeout(() => setWaited(true), 1000);
    return () => clearTimeout(timer);
  }, [champions, facts, waited]);

  useLayoutEffect(() => {
    firstOpen = false;
    if (enter) light(root.current);
  }, [enter]);
  /* the season's ranking and the past champions come after the first paint (homeFacts.js): a section that appears later switches on
     the moment it appears, as the rest of the board did, instead of standing there lit */
  const litSecs = useRef(null);
  useLayoutEffect(() => {
    const secs = [...root.current.querySelectorAll(":scope > .ho-sec")];
    if (!litSecs.current) { litSecs.current = new Set(secs); return; }
    secs.filter(sec => !litSecs.current.has(sec)).forEach(sec => { litSecs.current.add(sec); light(sec, DUR.leave); });
  });

  /* 대회 단계: 남은 날과 주 행동이 같은 계산을 읽는다 */
  const now = useMemo(() => {
    const upcoming = nextEvent(data.announcements);
    if (!upcoming) return null;
    const { a, draft, raw, time, dday } = upcoming;
    const date = dotDate(raw);
    const at = time && !/\d{1,2}:\d{2}/.test(String(raw)) ? `${String(raw).slice(0, 10)}T${time}` : raw;
    // the facts that belong to the countdown stand beside it (Composing a screen 26): 일시, 신청 마감, 형식
    // on the day the clock beside them is the start, so 일시 does not stand twice (Composing a screen 22); 신청 마감 stands only while
    // applications are open, a closing already passed being no fact for the countdown (2026-11-23: it stood on the day itself)
    const spec = [...(dday === 0 ? [] : [["일시", formatDate(at, { time: true })]]), ...(applicationsOpen(a.form) ? [["신청 마감", `${formatDate(a.form.closesAt, { time: true })}까지`]] : []),
      ...(BATTLE[draft.battleFormat] ? [["형식", BATTLE[draft.battleFormat]]] : [])];
    return { today: dday === 0, dday, name: draft.name || a.title, kind: draft.isTeamEvent ? "팀전" : "개인전", spec, date: date && { ...date, clock: time || date.clock }, eventId: a.form?.eventId || null, noticeId: a.id,
      // 파티 제출은 대회 시작까지다: 그 전날까지는 남은 날이 위의 카운트다운과 같아서, 그날 시작 전에만 남은 시간을 센다
      open: dday > 0 && applicationsOpen(a.form), due: dday === 0 ? submissionDue(draft) : null };
  }, [data.announcements]);
  /* 대회 당일의 지금 경기: 그날 대회의 대진표를 대진표 화면과 같은 읽기로 가져와 아직 승자가 없는 경기를 보이고, 그 대회에서
     사이트 배틀로 치르는 경기를 모두 관전으로 잇는다. 공지 하나가 루키와 마스터를 함께 받으면 두 리그의 대회를 함께 본다.
     화면에 있는 동안 15초마다 다시 읽는다(2026-11-08, 중계 강화: 한 경기만, 한 번만 읽었다). */
  const [live, setLive] = useState(null);
  /* 내 다음 경기 (2026-11-22, the owner's draft A): on the day, a signed-in trainer whose account is linked sees their own next match
     first, with its table and its round's start (docs/db/match_schedule.sql), read with the live matches every 15 seconds */
  const me = useMe();
  const [myNext, setMyNext] = useState(null);
  /* 체크인 (2026-11-22, the owner's draft 6 A): on the event's day, before the signed-in player has a match to go to, the place of
     내 다음 경기 holds their arrival: one press, then 체크인 완료. Until handover_features.sql has run it does not show. */
  const [checkin, setCheckin] = useState(null);
  const [checkinIds, setCheckinIds] = useState([]);
  useEffect(() => {
    if (!now?.today || !now.eventId || !me?.playerId) { setCheckin(null); return undefined; }
    let on = true;
    getEvent(now.eventId).then(event => (event ? getLeagueIntakeEvents(event) : [])).then(events => events.map(e => e.id)).catch(() => [now.eventId])
      .then(ids => { if (!on) return; setCheckinIds(ids); return myCheckin(ids).then(state => on && setCheckin(state)); });
    return () => { on = false; };
  }, [now?.today, now?.eventId, me?.playerId]);
  const checkIn = async () => { try { setCheckin(await myCheckin(checkinIds, true)); } catch { /* the button stays for another press */ } };
  const [myWhere, setMyWhere] = useState(null);
  const [liveBattles, setLiveBattles] = useState([]);
  /* the live match's table and its round's start, as its sheet shows them (docs/db/match_schedule.sql; nothing until it has run) */
  const [liveWhere, setLiveWhere] = useState(null);
  // the match shown as 지금 경기 is another than my own, which stands in its own card above (2026-11-22: the same final stood twice)
  const liveMatch = live?.live?.find(m => m.id !== myNext?.id) || null;
  useEffect(() => {
    if (!liveMatch || !live?.runtimeId) { setLiveWhere(null); return undefined; }
    let on = true;
    readBracketSchedule({ eventId: live.eventId, runtimeId: live.runtimeId }).then(sc => {
      if (!on || !sc) return;
      const at = sc.rounds[roundKeyOf(liveMatch.id)], table = sc.tables.get(liveMatch.id);
      const time = at ? new Date(at).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Seoul" }) : "";
      setLiveWhere([time, table ? tableWord(table) : ""].filter(Boolean).join(", ") || null);
    }, () => {});
    return () => { on = false; };
  }, [liveMatch?.id, live?.runtimeId]);
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
      setMyWhere({ at: at || null, table: table || "" });
    }, () => {});
    return () => { on = false; };
  }, [myNext?.id, myNext?.runtimeId]);
  /* 다음 대회가 없는 날의 첫 자리는 지난 대회의 결과다 (2026-11-16): 꺼진 88 대신 날짜, 이름, 리그마다의 우승, 대진표 보기 */
  // undefined while a first visit (no kept copy) still reads it: the board then stands as the last event's, switched off (F-03)
  const [last, setLast] = useState(() => (now ? null : seenLast() ?? undefined));
  useEffect(() => {
    if (now) return undefined;
    let on = true;
    loadLast(admin).then(next => { if (on) setLast(next); }, error => { console.warn("home last event read failed", error); if (on) setLast(null); });
    return () => { on = false; };
  }, [!now, data]);
  const lastWait = !now && last === undefined;
  const primary = !now ? (last || lastWait ? ["대진표 보기", "bracket", { eventId: last?.eventId }] : ["공지 보기", "news"]) : now.today ? (myNext ? ["대진표 보기", "bracket", { eventId: myNext.eventId }] : ["대진표 보기", "bracket"]) : now.open ? ["이번 대회 신청", "news", { notice: now.noticeId }] : ["대회 공지 보기", "news", { notice: now.noticeId }];
  const notices = useMemo(() => [...data.announcements].sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || (a.date < b.date ? 1 : -1)).slice(0, 3), [data.announcements]);
  const reigning = (facts || waited) ? champions?.[0] || null : null;
  const season = facts?.season;

  return (<div className="ho" ref={root}>
    {/* the big screen (draft B): the next event and the reigning champion as one device, joined by the seam */}
    <div className="stack ho-screen">
    <section className="pn ho-next" aria-labelledby={now ? "ho-title" : undefined}>
      {!now && (last || lastWait) ? <>
        <p className="ho-label t12" data-light><span className="ho-lamp dim"><i className="lamp unlit" aria-hidden="true" />지난 대회</span></p>
        {lastWait ? <div className="stack ho-last" aria-hidden="true">
          <Lead date="  .  " title={" "} line={" "} />
          <div className="pn ho-win"><span className="ho-win-place t12 inv" /><span className="row-main" /></div>
        </div> : <div className="stack ho-last" data-light>
          <Lead date={last.date} title={last.name} line={last.leagues.map(l => [l.league, `${l.count}${l.team ? "팀" : "명"}`].filter(Boolean).join(" ")).join(", ")} />
          {last.leagues.map((l, i) => <div className="pn ho-win" key={l.eventId}>
            <span className={"ho-win-place t12 " + (i === 0 ? "inv" : "pn2")}>우승</span>
            <span className="row-main"><b className={i === 0 ? "t20" : "t15"}>{l.win}</b>
              {(l.league || l.ru.length > 0) && <span className="t12 dim">{[l.league, l.ru.length && `준우승 ${l.ru.join(", ")}`].filter(Boolean).join(", ")}</span>}</span>
          </div>)}
        </div>}
      </> : <>
      <p className="ho-label t12" data-light>
        {now?.today
          ? <span className="ho-lamp"><i className="lamp sig" aria-hidden="true" />오늘 대회 진행 중</span>
          : now?.open
            ? <span className="ho-lamp"><i className="lamp sig" aria-hidden="true" />신청 접수 중</span>
            : <span className="ho-lamp dim"><i className={"lamp" + (now ? "" : " unlit")} aria-hidden="true" />{now ? "다음 대회까지" : "다음 대회"}</span>}
        {now?.date && <span className="dim"><Day d={now.date} /></span>}
      </p>
      {now && <div className="ho-name"><h1 className="t32 ho-title" id="ho-title">{now.name}</h1><span className="t12 dim reg">{now.kind}</span></div>}
      <div className="ho-display">
        <div className={"ho-board" + (now?.today ? " today" : "")}>
          {now?.today
            ? <><Seg value={now.date?.clock || "  :  "} h={84} cells={4} label={now.date?.clock ? `${now.date.clock} 시작` : "시작 시각 미정"} /><span className="ho-unit">시작</span></>
            : <><Seg value={now ? String(now.dday).padStart(2, "0") : ""} h={120} cells={now?.dday >= 100 ? 3 : 2} label={now ? `${now.dday}일 남음` : "다음 대회 없음"} className="ho-days" /><span className={"ho-unit" + (now ? "" : " dim")} data-light>일</span></>}
        </div>
        {now?.spec.length > 0 && <dl className="stack ho-spec">
          {now.spec.map(([k, v]) => <div className="pn2 ho-spec-row" key={k}><dt className="t12 dim">{k}</dt><dd className="t15">{v}</dd></div>)}
        </dl>}
      </div>
      </>}
      {now?.due && <div className="stack ho-due">
        <Counter label={now.due.unit === "시간" ? "파티 제출 마감까지" : "파티 제출까지"} lamp={now.due.unit === "시간" ? "sig" : true} value={String(now.due.value).padStart(2, "0")} cells={now.due.value >= 100 ? 3 : 2} unit={now.due.unit}
          after={<span className="t15">{now.due.unit}</span>} onClick={() => go("news", { notice: now.noticeId })} />
      </div>}
      {/* with no event and no notice there is nowhere to go: no key (2026-11-23 audit, R-19) */}
      {!(primary[1] === "news" && !primary[2] && !data.announcements.length) && <div className={"ho-go" + (lastWait ? " wait" : "")}>
        <Button variant="main" disabled={lastWait} onClick={() => go(primary[1], primary[2])}>{primary[0]}</Button>
      </div>}
      {myNext && (() => {
        const start = myWhere?.at ? new Date(myWhere.at) : null;
        const clock = start ? start.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Seoul" }) : "";
        const ahead = start && start.getTime() > Date.now();
        const where = [myWhere?.table ? tableWord(myWhere.table) : "", clock ? `${clock} 시작` : ""];
        return <div className="stack ho-live ho-mine" role="group" aria-label="내 다음 경기">
          <button type="button" className="stack" onClick={() => go("bracket", { eventId: myNext.eventId, m: myNext.id })}
            aria-label={`내 다음 경기, ${myNext.stage}, ${myNext.opponent ? `상대 ${myNext.opponent}` : "상대 결정 전"}${where.filter(Boolean).length ? `, ${where.filter(Boolean).join(", ")}` : ""}, 경기 보기`}>
            <span className="pn2 ho-live-head t12"><span>내 다음 경기, {myNext.stage}</span>
              {!myNext.opponent ? <span className="dim">상대 결정 전</span> : ahead ? <span className="dim">곧 시작</span> : <span className="ho-lamp"><i className="lamp sig" aria-hidden="true" />진행 중</span>}</span>
            <span className="pn2 ho-live-row t15 inv">{myNext.me}</span>
            <span className={"pn2 ho-live-row t15" + (myNext.opponent ? "" : " dim")}>{myNext.opponent || "앞 경기의 승자"}</span>
          </button>
          {where.some(Boolean) && <p className="pn2 ho-live-head t12"><span className="dim">{where[0]}</span><span>{where[1]}</span></p>}
        </div>;
      })()}
      {!myNext && (checkin === "open" || checkin === "done") && <div className="stack ho-live ho-mine" role="group" aria-label="체크인">
        <p className="pn2 ho-live-head t12"><span>내 체크인</span>{checkin === "done" ? <span>체크인 완료</span> : <span className="dim">체크인 전</span>}</p>
        {checkin === "open" && <Button variant="second" icon="check" onClick={checkIn}>체크인</Button>}
      </div>}
      {live?.live.length > 0 && <div className="stack ho-live" role="group" aria-label="지금 경기">
        {/* the match is a door to its own bracket, as every panel that names a place is */}
        {liveMatch && <button type="button" className="stack" onClick={() => go("bracket", { eventId: live.eventId, m: liveMatch.id })} aria-label={`${liveMatch.stage}${liveWhere ? `, ${liveWhere}` : ""}, ${liveMatch.a} 대 ${liveMatch.b}, 진행 중, 경기 보기`}>
          <span className="pn2 ho-live-head t12"><span className="dim">{[liveMatch.stage, liveWhere].filter(Boolean).join(", ")}</span><span className="ho-lamp"><i className="lamp sig" aria-hidden="true" />진행 중</span></span>
          <span className="pn2 ho-live-row t15">{liveMatch.a}</span>
          <span className="pn2 ho-live-row t15">{liveMatch.b}</span>
        </button>}
        {/* the progress is the shown match's stage, not the bracket's first (Q-13: the card said 승자조 3라운드 over 패자조 progress) */}
        {(() => { const at = liveMatch && live.counts?.[liveMatch.stage] ? { stage: liveMatch.stage, ...live.counts[liveMatch.stage] } : live;
          return <p className="pn2 ho-live-head t12"><span className="dim">{at.stage} 진행</span><span>{at.done} / {at.total} 종료</span></p>; })()}
        {/* every match of the day being played as a site battle, one strip each, opening it to watch */}
        {liveBattles.map(b => <button key={b.id} type="button" className="pn2 ho-live-head t12" onClick={() => go("battle", { battle: b.id })}>
          <span className="ho-lamp"><i className="lamp sig" aria-hidden="true" />{`${b.p1_name} 대 ${b.p2_name} 배틀 진행 중`}</span><span>관전</span>
        </button>)}
      </div>}
    </section>
    <ChampionPanel champion={reigning} onClick={() => setPop(reigning)} />
    </div>

    {/* one note for either read: the records (facts) or the site's own copy, the seed standing in for it (2026-11-23 audit, T-109) */}
    {(factsFailed || siteFailed) && <ErrorNote action="다시 불러오기" onRetry={() => { if (factsFailed) { setFactsFailed(false); setFacts(null); setFactsTry(n => n + 1); } if (siteFailed) onRetrySite?.(); }}>리그 기록을 불러오지 못했습니다.</ErrorNote>}

    {/* while the ranking is read its place stands switched off, so the notices under it do not move when it lights; its head keeps
        the lit head's height, a blank title and link held unseen (2026-11-23 audit, T-95: a bare head stood 0 and grew 44) */}
    {(season || !facts) && <section className={"ho-sec ho-rank" + (season ? "" : " off")} aria-labelledby="ho-rank" aria-hidden={season ? undefined : true}>
      <SectionHead id="ho-rank" title={season ? `${season.name} 순위` : "\u00a0"} link={season ? "전체 보기" : "\u00a0"} onLink={() => season && go("records", { tab: "rank" })} />
      <StandTable rows={season ? season.rows : null} shown={5} onName={name => go("records", { trainer: name })} />
    </section>}

    {notices.length > 0 && <section className="ho-sec ho-news" aria-labelledby="ho-news">
      <SectionHead id="ho-news" title="공지" link="전체 보기" onLink={() => go("news")} />
      <div className="stack">
        {notices.map((a, i) => i === 0
          ? <NoticeLead key={a.id} a={a} onOpen={() => go("news", { notice: a.id })} />
          : <NoticeRow key={a.id} a={a} onOpen={() => go("news", { notice: a.id })} />)}
      </div>
    </section>}

    {/* the wall: the past champions standing side by side on one floor, the generation at 20 in type */}
    {champions?.length > 1 && <section className="ho-sec ho-hall" aria-labelledby="ho-hall">
      <SectionHead id="ho-hall" title="역대 챔피언" link="명예의 전당" onLink={() => go("champions")} />
      {/* the latest five stand on the home; the rest are the hall's (명예의 전당, the link above), so no column grows thin (R-04) */}
      <div className="stack ho-line" style={{ "--n": Math.min(champions.length - 1, 5) }}>
        {champions.slice(1, 6).map(c => <button type="button" className="pn stand ho-col" key={c.key} onClick={() => setPop(c)} aria-label={`${c.label} 챔피언 ${c.name}, ${c.line}`}>
          <span className="floor ho-col-who"><b className="t20">{c.generation > 0 ? `${c.generation}대` : c.label}</b><b className="t15">{c.name}</b><span className="t12 dim reg">{c.line.replace(/ 우승$/, "")}</span></span>
          <Mon src={c.party[0]?.img} loading="lazy" />
        </button>)}
      </div>
    </section>}

    {pop && <ChampionSheet name={pop.name} line={pop.line} generation={pop.generation} genText={pop.label} reigning={pop.key === reigning?.key}
      party={pop.party} sets={pop.sets} regulationId={pop.regulationId} onClose={() => setPop(null)}>
      {/* the sheet's bottom plane split in two on the seam (Composing a screen 20): the hall first, the champion's record the main key
          (2026-11-23, the owner: the hall's link stood alone "혼자 덩그러니") */}
      <Button variant="second" data-tab="champions" onClick={() => { setPop(null); go("champions"); }}>명예의 전당 보기</Button>
      <Button variant="main" onClick={() => { setPop(null); go("records", { trainer: pop.name }); }}>{pop.name} 기록 보기</Button>
    </ChampionSheet>}
  </div>);
}
