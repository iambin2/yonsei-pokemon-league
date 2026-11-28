/* 등반전 (docs/BATTLE_STREAK.md 18장, DESIGN.md "Battle" 도전의 탑, 등반전): a board with a window of time and its own players. It
   counts the players' ordinary runs started in the window (docs/db/tower_cups.sql), so there is one tower and one way to climb it; a
   meet (정모) is one 등반전 opened for its evening. The tab lists them beside the month's board; one opened is its own screen, the big
   board a room puts on its projector, read again while it runs. */
import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Button from "../../components/common/Button.jsx";
import Icon from "../../components/common/Icon.jsx";
import Modal from "../../components/common/Modal.jsx";
import ErrorNote from "../../components/common/ErrorNote.jsx";
import Fig from "../../components/common/Fig.jsx";
import { BackLink, Choice, Counter, Dock, Question, Row, SectionHead, Toast } from "../../components/common/Board.jsx";
import StandTable from "../../components/common/StandTable.jsx";
import { BrandMark } from "../../components/layout/SiteHeader.jsx";
import { siteConfirm } from "../../components/common/SiteDialog.jsx";
import { readBattleRow, readRunState } from "../../services/battleService.js";
import { floorGame, gameWords, streakFloor, streakMaster } from "../../services/streak.js";
import { closeTowerCup, createTowerCup, deleteTowerCup, joinTowerCup, joinTowerCupGuest, readCupGuestName, readTowerCup, readTowerCups, updateTowerCup } from "../../services/visitorAuth.js";
import { formatDate } from "../../services/dateFormat.js";
import { sidesOf } from "./Live.jsx";
import { Roster, rosterSaid } from "./Stage.jsx";
import { RunHearts, TrackBar } from "./Streak.jsx";

const when = iso => formatDate(iso, { time: true });
// where a cup stands now: soon (not begun), on, or over
const phaseOf = (cup, now = Date.now()) => (now < Date.parse(cup.starts_at) ? "soon" : now < Date.parse(cup.ends_at) ? "on" : "over");
const lineOf = cup => {
  const phase = phaseOf(cup);
  return phase === "soon" ? `${when(cup.starts_at)} 시작` : phase === "on" ? `${when(cup.ends_at)} 마감` : "마감";
};
const limitWords = n => (n ? `처음 ${n}번` : "모든 도전");
// the time left as a whole number of two digits at most: minutes under 100, hours under 48, then days (a cup is 31 days at most)
export function leftOf(ms) {
  const m = Math.max(0, Math.ceil(ms / 60000));
  return m >= 2880 ? [Math.floor(m / 1440), "일"] : m >= 100 ? [Math.floor(m / 60), "시간"] : [m, "분"];
}
const cupUrl = (id, cast = false) => {
  const url = new URL(window.location.href);
  url.searchParams.set("view", "battle"); url.searchParams.set("tab", "streak");
  if (id) url.searchParams.set("cup", id); else url.searchParams.delete("cup");
  if (id && cast) url.searchParams.set("cast", "1"); else url.searchParams.delete("cast");
  return url;
};
export const askedCup = () => new URLSearchParams(window.location.search).get("cup") || null;
export const askedCast = () => new URLSearchParams(window.location.search).get("cast") === "1";
export const showCupInAddress = (id, cast = false) => window.history.replaceState(window.history.state, "", cupUrl(id, cast));

/* the tab's list: the cups open now, coming, and ended this week, open ones and one's own. undefined while read, null before the SQL
   (the section is left out), else the rows */
export function useCups(asked = 0) {
  const [cups, setCups] = useState(undefined);
  useEffect(() => { let on = true; readTowerCups().then(rows => on && setCups(rows), () => on && setCups(false)); return () => { on = false; }; }, [asked]);
  return cups;
}

export function CupList({ cups, onCup, onMake, onRetry, boxRef = null, style }) {
  if (cups === null) return null;
  return <section ref={boxRef} style={style} className="streak-cups" aria-labelledby="streak-cups">
    <SectionHead id="streak-cups" title="등반전" link="열기" onLink={onMake} />
    {cups === undefined ? <div className="stack"><div className="pn row" /></div>
      : cups === false ? <ErrorNote action="다시 불러오기" onRetry={onRetry}>등반전을 불러오지 못했습니다.</ErrorNote>
      : !cups.length ? <div className="stack"><Row title="열린 등반전이 없습니다." /></div>
      : <div className="stack">{cups.map(c => {
        const phase = phaseOf(c), secret = c.room === "code";
        return <Row key={c.id} title={c.title} line={`${c.host_name}, ${lineOf(c)}`}
          value={<span className="bt-hall-kind t15">{secret && <Icon n="lock" size={16} />}{c.players}명</span>}
          lamp={phase === "on"} sig onClick={() => onCup(c.id)} label={`${c.title}, ${secret ? "비밀, " : ""}${lineOf(c)}, ${c.players}명`} />;
      })}</div>}
  </section>;
}

// a datetime-local field's value for a time: "2026-11-22T19:00" in this device's zone
const fieldTime = ms => { const d = new Date(ms - new Date(ms).getTimezoneOffset() * 60000); return d.toISOString().slice(0, 16); };
const ROOMS = { 공개: "open", 코드: "code" };
const LIMITS = { "모든 도전": null, "처음 1번": 1, "처음 3번": 3 };

const limitLabel = n => (n === 1 ? "처음 1번" : n === 3 ? "처음 3번" : "모든 도전");

/* 등반전 열기/수정: its name, host nickname, when it opens and closes, who comes in, how many runs count. The sheet's one key opens or saves it */
export function CupMake({ cup = null, defaultName = "", onClose, onMade }) {
  const editing = Boolean(cup);
  const started = editing && Date.parse(cup.starts_at) <= Date.now();
  const [title, setTitle] = useState(cup?.title || "");
  const [nickname, setNickname] = useState(cup?.host_name || defaultName || "");
  // it starts now by default (the server takes a start already past as now), so a meet opens it and climbs at once
  const [start, setStart] = useState(() => fieldTime(cup ? Date.parse(cup.starts_at) : Date.now()));
  const [end, setEnd] = useState(() => fieldTime(cup ? Date.parse(cup.ends_at) : Math.ceil(Date.now() / 600000) * 600000 + 2 * 3600e3));
  const [room, setRoom] = useState(cup?.room === "code" ? "코드" : "공개");
  const [limit, setLimit] = useState(() => limitLabel(cup?.run_limit));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const make = async () => {
    if (busy) return;
    if (!title.trim()) { setError("등반전 이름을 입력해 주세요."); document.getElementById("cup-title")?.focus(); return; }
    if (!nickname.trim()) { setError("닉네임을 입력해 주세요."); document.getElementById("cup-host-name")?.focus(); return; }
    if (!(Date.parse(end) > Date.parse(start))) { setError("마감은 시작보다 뒤여야 합니다."); return; }
    setBusy(true); setError("");
    try {
      const payload = { title: title.trim(), nickname: nickname.trim(), startsAt: new Date(start).toISOString(), endsAt: new Date(end).toISOString(), room: ROOMS[room], limit: LIMITS[limit] };
      const made = editing ? await updateTowerCup({ id: cup.id, ...payload }) : await createTowerCup(payload);
      onMade(made.id);
    } catch (e) { setError(e.message); setBusy(false); }
  };
  return <Modal title={editing ? "등반전 수정" : "등반전 열기"} onClose={onClose}>
    <Question id="cup-title" label="이름" error={error === "등반전 이름을 입력해 주세요." ? error : ""}>
      <input id="cup-title" className="in" maxLength={24} autoComplete="off" enterKeyHint="next" value={title} placeholder="11월 정모"
        onChange={e => { setTitle(e.target.value); if (error) setError(""); }} />
    </Question>
    <Question id="cup-host-name" label="닉네임" error={error === "닉네임을 입력해 주세요." ? error : ""}>
      <input id="cup-host-name" className="in" maxLength={20} autoComplete="nickname" enterKeyHint="done" value={nickname} placeholder="트레이너 이름"
        onChange={e => { setNickname(e.target.value); if (error) setError(""); }} />
    </Question>
    <Question id="cup-start" label="시작">
      <input id="cup-start" className="in" type="datetime-local" value={start} disabled={started} onChange={e => setStart(e.target.value)} />
    </Question>
    <Question id="cup-end" label="마감">
      <input id="cup-end" className="in" type="datetime-local" value={end} onChange={e => setEnd(e.target.value)} />
    </Question>
    <Question id="cup-room" label="입장" group><Choice name="cup-room" options={Object.keys(ROOMS)} value={room} onChange={setRoom} /></Question>
    <Question id="cup-limit" label="반영" group><Choice name="cup-limit" options={Object.keys(LIMITS)} value={limit} onChange={setLimit} /></Question>
    {error && error !== "등반전 이름을 입력해 주세요." && error !== "닉네임을 입력해 주세요." && <Toast error>{error}</Toast>}
    <div className="modal-actions"><Button variant="main" onClick={make} loading={busy}>{editing ? "저장" : "열기"}</Button></div>
  </Modal>;
}

/* join with a nickname (pre-filled for Google-linked players) and 4 digits if it is a code cup */
function CupGuestJoin({ room, initialName = "", onClose, onJoin }) {
  const [name, setName] = useState(() => initialName || readCupGuestName());
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const go = async () => {
    const trimmed = name.trim();
    if (!trimmed) { setError("닉네임을 입력해 주세요."); document.getElementById("cup-guest-name")?.focus(); return; }
    if (room === "code" && code.length !== 4) { setError("코드 4자리를 입력해 주세요."); document.getElementById("cup-guest-code")?.focus(); return; }
    setBusy(true); setError("");
    try { await onJoin(trimmed, room === "code" ? code : null); } catch (e) { setError(e.message); setBusy(false); }
  };
  return <Modal title="등반전 참가" onClose={onClose}>
    <Question id="cup-guest-name" label="닉네임" error={error === "닉네임을 입력해 주세요." ? error : ""}>
      <input id="cup-guest-name" className="in" maxLength={20} autoComplete="nickname" enterKeyHint={room === "code" ? "next" : "go"} value={name} placeholder="트레이너 이름" autoFocus
        onChange={e => { setName(e.target.value); if (error) setError(""); }}
        onKeyDown={e => { if (e.key === "Enter" && !e.nativeEvent.isComposing && room !== "code") { e.preventDefault(); go(); } }} />
    </Question>
    {room === "code" && <Question id="cup-guest-code" label="코드" error={error === "코드 4자리를 입력해 주세요." ? error : ""}>
      <input id="cup-guest-code" className="in" inputMode="numeric" autoComplete="off" maxLength={4} enterKeyHint="go" value={code} placeholder="숫자 4자리"
        onChange={e => { setCode(e.target.value.replace(/[^0-9]/g, "").slice(0, 4)); if (error) setError(""); }}
        onKeyDown={e => { if (e.key === "Enter" && !e.nativeEvent.isComposing) { e.preventDefault(); go(); } }} />
    </Question>}
    {error && error !== "닉네임을 입력해 주세요." && error !== "코드 4자리를 입력해 주세요." && <Toast error>{error}</Toast>}
    <div className="modal-actions"><Button variant="main" onClick={go} loading={busy}>참가</Button></div>
  </Modal>;
}

/* clock for the broadcast screen: MM:SS under 1 hour, HH:MM:SS under 48 hours, else N일 */
function castClock(ms) {
  const sec = Math.max(0, Math.floor(ms / 1000));
  if (sec >= 48 * 3600) return { value: String(Math.floor(sec / 86400)), unit: "일" };
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  const mm = String(m).padStart(2, "0"), ss = String(s).padStart(2, "0");
  return { value: h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`, unit: "" };
}

/* full-screen projector broadcast for a cup (시안 A — 연감 속보형): left 709 holds the 1st-place leader (with live party, track,
   hearts if currently climbing) and up to 2 notable active runs; right 439 holds the live standings; bottom holds a 1-line feed. */
function CupBroadcast({ id, res, cup, rawRows, onOpen, onClose, onRefresh }) {
  const [now, setNow] = useState(Date.now());
  const [liveMap, setLiveMap] = useState({});
  const [feed, setFeed] = useState(null);
  const prevRef = useRef(null);

  const phase = cup ? phaseOf(cup, now) : null;

  useEffect(() => {
    const onKey = e => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    if (!cup || phase === "over") return undefined;
    const sec = setInterval(() => setNow(Date.now()), 1000);
    const poll = setInterval(() => { if (document.visibilityState === "visible") onRefresh(); }, 10_000);
    return () => { clearInterval(sec); clearInterval(poll); };
  }, [cup?.id, phase, onRefresh]);

  const liveKey = (rawRows || []).filter(r => r.live && r.battle_id).map(r => `${r.trainer_name}:${r.battle_id}`).join(",");
  useEffect(() => {
    const liveRows = (rawRows || []).filter(r => r.live && r.battle_id);
    if (!liveRows.length) { setLiveMap({}); return undefined; }
    let on = true;
    Promise.all(liveRows.map(async r => {
      const [battle, run] = await Promise.all([
        readBattleRow(r.battle_id).catch(() => null),
        readRunState(r.battle_id).catch(() => null),
      ]);
      return [r.battle_id, { battle, run }];
    })).then(entries => {
      if (!on) return;
      const next = {};
      for (const [bid, data] of entries) if (data.battle || data.run) next[bid] = data;
      setLiveMap(next);
    });
    return () => { on = false; };
  }, [liveKey]);

  useEffect(() => {
    if (!rawRows?.length) return;
    const prev = prevRef.current;
    const snap = new Map(rawRows.map(r => [r.trainer_name, { wins: r.wins, live: r.live, place: r.place }]));
    if (prev) {
      const lead = rawRows[0];
      const prevLead = [...prev.entries()].find(([, v]) => v.place === 1)?.[0];
      let nextFeed = null;
      if (lead && prevLead && lead.trainer_name !== prevLead && lead.wins > 0) {
        nextFeed = `${lead.trainer_name} 님이 ${lead.wins}연승으로 1위에 올랐습니다`;
      } else {
        for (const r of rawRows) {
          const old = prev.get(r.trainer_name);
          if (!old) { nextFeed = `${r.trainer_name} 님이 참가했습니다`; break; }
          if (r.wins > old.wins) { nextFeed = `${r.trainer_name} 님이 ${r.wins}연승을 달성했습니다`; break; }
          if (r.live && !old.live) { nextFeed = `${r.trainer_name} 님이 도전을 시작했습니다`; break; }
          if (!r.live && old.live) { nextFeed = `${r.trainer_name} 님이 도전을 마쳤습니다`; break; }
        }
      }
      if (nextFeed) setFeed({ text: nextFeed, at: Date.now() });
    }
    prevRef.current = snap;
  }, [rawRows]);

  const rows = rawRows || [];
  const leader = rows[0] || null;
  const leaderLive = leader?.live && leader.battle_id ? liveMap[leader.battle_id] : null;
  const leaderWins = leaderLive?.run?.wins ?? leader?.wins ?? 0;
  const leaderLives = leaderLive?.run?.lives ?? null;
  const leaderParty = useMemo(() => {
    if (!res || !leaderLive?.battle) return null;
    try { return sidesOf(res, leaderLive.battle).p1; } catch { return null; }
  }, [res, leaderLive?.battle]);

  const hot = useMemo(() => {
    return rows
      .filter((r, i) => i > 0 && r.live && r.battle_id)
      .map(r => {
        const info = liveMap[r.battle_id];
        const w = info?.run?.wins ?? r.wins ?? 0;
        return { ...r, liveWins: w, lives: info?.run?.lives ?? null, gate: streakMaster(w) };
      })
      .sort((a, b) => Number(b.gate) - Number(a.gate) || b.liveWins - a.liveWins)
      .slice(0, 2);
  }, [rows, liveMap]);

  const tableRows = rows.length > 1 ? rows.slice(1) : rows;
  const liveCount = rows.filter(r => r.live).length;
  const targetMs = phase === "soon" ? Date.parse(cup.starts_at) : Date.parse(cup.ends_at);
  const clock = phase === "over" ? { value: null, unit: "" } : castClock(targetMs - now);

  const openBattle = battleId => {
    if (!battleId) return;
    onClose();
    onOpen(battleId);
  };

  const portalRoot = typeof document !== "undefined" ? (document.querySelector(".ypl") || document.body) : null;
  if (!portalRoot || !cup) return null;

  return createPortal(
    <div className="cup-cast" role="dialog" aria-modal="true" aria-label={`${cup.title} 중계 화면`}>
      <div className="cup-cast-in">
        <header className="cup-cast-top">
          <div className="cup-cast-brand">
            <BrandMark size={32} />
            <div className="cup-cast-title-wrap">
              <div className="cup-cast-meta t12 dim">
                {phase === "on" && <i className="lamp sig" aria-hidden="true" />}
                <span>{phase === "soon" ? "시작 전" : phase === "on" ? "진행 중" : "마감"}</span>
                {liveCount > 0 && <span>도전 중 {liveCount}명</span>}
                <span>{limitWords(cup.run_limit)}</span>
              </div>
              <h2 className="t32">{cup.title}</h2>
            </div>
          </div>
          <div className="cup-cast-right">
            <div className="cup-cast-counters">
              <Counter label="참가" value={String(cup.players)} unit="명" />
              {cup.code && <Counter label="코드" value={cup.code} keepZero />}
              {phase === "over"
                ? <Counter label="마감" value={null} />
                : <Counter label={phase === "soon" ? "시작까지" : "마감까지"} lamp={phase === "on" ? "sig" : undefined} value={clock.value} unit={clock.unit} />}
            </div>
            <Button size="sm" onClick={onClose}>나가기</Button>
          </div>
        </header>

        <main className="cup-cast-main">
          <section className="cup-cast-lead-col" aria-label="선두 현황">
            {leader ? <>
              <div>
                <div className="cup-cast-lead-head">
                  <span className="cup-cast-lead-tag t15">
                    {leader.live && <i className="lamp sig" aria-hidden="true" />}
                    <span>현재 1위</span>
                  </span>
                  <span className="t15 dim">
                    {leader.live ? `${gameWords(leaderWins)} 진행 중` : `${leader.runs || 0}회 도전`}
                  </span>
                </div>
                <div className="cup-cast-lead-body">
                  <div className="cup-cast-lead-id">
                    {leader.live && leader.battle_id
                      ? <button type="button" className="cup-cast-lead-btn" onClick={() => openBattle(leader.battle_id)}><span className="t32">{leader.trainer_name}</span></button>
                      : <b className="t32">{leader.trainer_name}</b>}
                    <div className="cup-cast-lead-sub t12 dim">
                      {leader.live && <TrackBar at={floorGame(leaderWins)} playing />}
                      {leader.live && <RunHearts lives={leaderLives} />}
                      {leader.live && leaderLive?.battle?.turn > 0 && <span>{leaderLive.battle.turn}턴</span>}
                      {!leader.live && <span>최고 연승 기록</span>}
                    </div>
                  </div>
                  <div className="cup-cast-lead-score">
                    <Fig value={String(leader.wins)} h={120} label={`${leader.wins}연승`} />
                    <span className="t20 dim">연승</span>
                  </div>
                </div>
              </div>

              {leaderParty && <div className="cup-cast-party">
                <div className="cup-cast-party-head t12 dim">
                  <span>현재 파티</span>
                  <span>{streakFloor(leaderWins)}층</span>
                </div>
                <div className="cup-cast-party-row">
                  <Roster list={leaderParty} slots={6} label={`${leader.trainer_name}의 파티, ${rosterSaid(res, leaderParty)}`} />
                </div>
              </div>}

              {hot.length > 0 && <div className="cup-cast-hot">
                <div className="cup-cast-hot-head t12 dim">주목할 도전</div>
                <div className="cup-cast-hot-grid">
                  {hot.map(h => <button key={h.trainer_name} type="button" className={"pn cup-cast-hot-item" + (h.gate ? " inv" : "")}
                    onClick={() => openBattle(h.battle_id)}>
                    <span className="cup-cast-hot-left">
                      <b className="t20"><i className="lamp sig" aria-hidden="true" />{h.trainer_name}</b>
                      <span className="cup-cast-hot-info t12 dim">
                        <span>{gameWords(h.liveWins)}</span>
                        <RunHearts lives={h.lives} />
                      </span>
                    </span>
                    <span className="cup-cast-hot-right">
                      <Fig value={String(h.liveWins)} h={40} label={`${h.liveWins}연승`} />
                      <span className="t12 dim">연승</span>
                    </span>
                  </button>)}
                </div>
              </div>}
            </> : <div className="pn row"><span className="t15 dim">아직 참가자가 없습니다.</span></div>}
          </section>

          <section className="cup-cast-board-col" aria-label="실시간 순위">
            <div className="cup-cast-st-head t12 dim" aria-hidden="true">
              <span>순위</span>
              <span>트레이너</span>
              <span>진행</span>
              <span>연승</span>
            </div>
            <div className="cup-cast-st-list">
              {tableRows.map(r => {
                const info = r.live && r.battle_id ? liveMap[r.battle_id] : null;
                const w = info?.run?.wins ?? r.wins ?? 0;
                const lives = info?.run?.lives ?? null;
                const Box = r.live && r.battle_id ? "button" : "div";
                return <Box key={r.trainer_name} {...(r.live && r.battle_id ? { type: "button", onClick: () => openBattle(r.battle_id) } : {})}
                  className="pn cup-cast-st-row">
                  <span className="cup-cast-st-rank t15 mute">
                    {r.live && <i className="lamp sig" aria-hidden="true" />}
                    <span>{r.place}</span>
                  </span>
                  <span className="cup-cast-st-name">
                    <b className="t15">{r.trainer_name}</b>
                    <span className="t12 dim">{r.live ? gameWords(w) : r.runs ? `${r.runs}회 도전` : "대기 중"}</span>
                  </span>
                  <span className="cup-cast-st-state">
                    {r.live ? <>
                      <TrackBar at={floorGame(w)} playing mini />
                      <RunHearts lives={lives} />
                    </> : <span className="t12 mute">{r.wins > 0 ? "종료" : ""}</span>}
                  </span>
                  <span className={"cup-cast-st-pts" + (r.wins ? "" : " mute")}>
                    <Fig value={String(r.wins)} h={32} label={`${r.wins}연승`} />
                    <span className="t12 dim">연승</span>
                  </span>
                </Box>;
              })}
            </div>
          </section>
        </main>

        <footer className="cup-cast-ticker t15">
          <span className="cup-cast-ticker-main">
            {phase === "on" && <i className="lamp sig" aria-hidden="true" />}
            <span>{feed ? feed.text : liveCount > 0 ? `현재 ${liveCount}명이 탑을 오르고 있습니다` : "도전을 기다리고 있습니다"}</span>
          </span>
          <span className="t12 mute">{cup.host_name} 님의 등반전</span>
        </footer>
      </div>
    </div>,
    portalRoot
  );
}

/* one cup's board: its name at 32, the ranking as the month's is drawn (the leader inverted at 84, live runs with their lamp and a
   door to watch), and beside it the time left, the players and the facts. Read again every 15 seconds while it runs and is seen. */
export function CupBoard({ id, res = null, approved, defaultName = "", onOpen, onBack, onClimb, onClearGuest = null }) {
  const [got, setGot] = useState(undefined);
  const [asked, setAsked] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [joining, setJoining] = useState(false);
  const [editing, setEditing] = useState(false);
  const [casting, setCasting] = useState(askedCast);
  const [note, setNote] = useState(null);
  useEffect(() => {
    let on = true;
    readTowerCup(id).then(b => on && setGot(b), () => on && setGot(false));
    return () => { on = false; };
  }, [id, asked, approved]);
  const cup = got?.cup;
  const phase = cup ? phaseOf(cup, now) : null;
  useEffect(() => {
    if (!approved && (got === null || phase === "over")) onClearGuest?.(id);
  }, [got, phase, approved, id]);
  useEffect(() => {
    if (!cup || phase === "over") return undefined;
    const tick = setInterval(() => setNow(Date.now()), 20_000);
    const again = setInterval(() => { if (document.visibilityState === "visible") setAsked(n => n + 1); }, 15_000);
    return () => { clearInterval(tick); clearInterval(again); };
  }, [cup?.id, phase]);
  const say = (text, error = false) => setNote({ text, error });
  const join = async (nickname, code) => {
    if (approved) await joinTowerCup(id, code, nickname);
    else await joinTowerCupGuest(id, nickname, code);
    setJoining(false); setAsked(n => n + 1);
  };
  const enter = () => setJoining(true);
  const close = async () => {
    if (!(await siteConfirm({ title: "지금 마감할까요?", body: phase === "soon" ? "시작 전이라 등반전이 지워집니다." : "지금까지의 순위로 굳습니다.", confirmLabel: "지금 마감" }))) return;
    try { const out = await closeTowerCup(id); if (out?.gone) onBack(); else setAsked(n => n + 1); } catch (e) { say(e.message, true); }
  };
  const remove = async () => {
    if (!(await siteConfirm({ title: "등반전을 삭제할까요?", body: "참가자와 순위 기록이 모두 지워집니다.", confirmLabel: "삭제" }))) return;
    try { await deleteTowerCup(id); onBack(); } catch (e) { say(e.message, true); }
  };
  const share = async () => {
    try { await navigator.clipboard.writeText(`${window.location.origin}/?view=battle&tab=streak&cup=${id}`); say("링크를 복사했습니다."); } catch { say("링크를 복사하지 못했습니다.", true); }
  };
  const toggleCast = open => { showCupInAddress(id, open); setCasting(open); };
  useEffect(() => { if (!note) return undefined; const t = setTimeout(() => setNote(null), 3200); return () => clearTimeout(t); }, [note]);

  if (got === null) return <div className="cup-page"><BackLink to="도전의 탑" onClick={onBack} /><div className="stack"><Row title="등반전을 찾을 수 없습니다." /></div></div>;
  if (got === false) return <div className="cup-page"><BackLink to="도전의 탑" onClick={onBack} /><ErrorNote action="다시 불러오기" onRetry={() => setAsked(n => n + 1)}>등반전을 불러오지 못했습니다.</ErrorNote></div>;
  const rows = got?.rows?.map(r => ({ rank: r.place, name: r.trainer_name, points: r.wins, live: r.live,
    open: r.live && r.battle_id ? () => onOpen(r.battle_id) : null }));
  const [left, unit] = cup ? leftOf(Date.parse(phase === "soon" ? cup.starts_at : cup.ends_at) - now) : [null, ""];
  const keys = !cup || phase === "over" ? null
    : !cup.joined ? <Button variant="main" onClick={enter}>참가</Button>
    : !approved && phase === "soon" ? <Button variant="main" disabled>시작 전</Button>
    : <Button variant="main" onClick={() => onClimb({ id: cup.id, title: cup.title })}>도전하기</Button>;
  return <div className="cup-page">
    <BackLink to="도전의 탑" onClick={onBack} />
    {joining && <CupGuestJoin room={cup.room} initialName={approved ? defaultName : ""} onClose={() => setJoining(false)} onJoin={join} />}
    {editing && <CupMake cup={cup} onClose={() => setEditing(false)} onMade={() => { setEditing(false); setAsked(n => n + 1); }} />}
    {/* two rows of the lobby's columns, so their top lines meet: the name beside the time left, then the ranking beside the facts,
        held in view on a desktop as a notice's 439 is. On a phone the time left comes right under the name */}
    <div className="bt-lobby cup-top">
      <div className="cup-head">
        <h2 className="t32">{cup?.title ?? " "}</h2>
        <span className="t15 dim">{cup ? `${cup.host_name} 님의 등반전` : " "}</span>
      </div>
      <div className="cup-counters">
        {phase === "over" ? <Counter label="마감" value={null} />
          : <Counter label={phase === "soon" ? "시작까지" : "마감까지"} lamp={phase === "on" ? "sig" : undefined} value={left == null ? null : String(left)} unit={unit} />}
        <Counter label="참가" value={cup ? String(cup.players) : null} unit="명" />
        {cup?.code && <Counter label="코드" value={cup.code} keepZero />}
      </div>
    </div>
    <div className="bt-lobby">
      <div className="bt-lobby-main">
        {!rows ? <StandTable rows={null} /> : <StandTable rows={rows} placed open unit="연승" />}
        {(keys || note) && <Dock toast={note ? <Toast error={note.error}>{note.text}</Toast> : null}>
          {keys && <div className="bt-end-keys">{keys}<Button onClick={share}>링크 복사</Button></div>}
        </Dock>}
      </div>
      <div className="bt-lobby-set cup-side">
        {cup && <div className="stack">
          <div className="pn spec-row"><span className="t12 dim">시작</span><span className="t15">{when(cup.starts_at)}</span></div>
          <div className="pn spec-row"><span className="t12 dim">마감</span><span className="t15">{when(cup.ends_at)}</span></div>
          <div className="pn spec-row"><span className="t12 dim">반영</span><span className="t15">{limitWords(cup.run_limit)}</span></div>
          <div className="pn spec-row"><span className="t12 dim">입장</span><span className="t15">{cup.room === "code" ? "코드" : "공개"}</span></div>
        </div>}
        {cup && <Button onClick={() => toggleCast(true)}>중계 화면</Button>}
        {cup?.hosting && <div className="bt-end-keys">
          <Button onClick={() => setEditing(true)}>수정</Button>
          {phase !== "over" && <Button onClick={close}>지금 마감</Button>}
          <Button onClick={remove}>삭제</Button>
        </div>}
      </div>
    </div>
    {casting && cup && <CupBroadcast id={id} res={res} cup={cup} rawRows={got?.rows} onOpen={onOpen}
      onClose={() => toggleCast(false)} onRefresh={() => setAsked(n => n + 1)} />}
  </div>;
}
