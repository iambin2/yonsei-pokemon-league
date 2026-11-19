/* 등반전 (docs/BATTLE_STREAK.md 18장, DESIGN.md "Battle" 도전의 탑, 등반전): a board with a window of time and its own players. It
   counts the players' ordinary runs started in the window (docs/db/tower_cups.sql), so there is one tower and one way to climb it; a
   meet (정모) is one 등반전 opened for its evening. The tab lists them beside the month's board; one opened is its own screen, the big
   board a room puts on its projector, read again while it runs. */
import React, { useEffect, useState } from "react";
import Button from "../../components/common/Button.jsx";
import Modal from "../../components/common/Modal.jsx";
import ErrorNote from "../../components/common/ErrorNote.jsx";
import { BackLink, Choice, Counter, Dock, Question, Row, SectionHead, Toast } from "../../components/common/Board.jsx";
import StandTable from "../../components/common/StandTable.jsx";
import { siteConfirm } from "../../components/common/SiteDialog.jsx";
import { closeTowerCup, createTowerCup, joinTowerCup, readTowerCup, readTowerCups } from "../../services/visitorAuth.js";
import { formatDate } from "../../services/dateFormat.js";

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
const cupUrl = id => {
  const url = new URL(window.location.href);
  url.searchParams.set("view", "battle"); url.searchParams.set("tab", "streak");
  if (id) url.searchParams.set("cup", id); else url.searchParams.delete("cup");
  return url;
};
export const askedCup = () => new URLSearchParams(window.location.search).get("cup") || null;
export const showCupInAddress = id => window.history.replaceState(window.history.state, "", cupUrl(id));

/* the tab's list: the cups open now, coming, and ended this week, open ones and one's own. undefined while read, null before the SQL
   (the section is left out), else the rows */
export function useCups(asked = 0) {
  const [cups, setCups] = useState(undefined);
  useEffect(() => { let on = true; readTowerCups().then(rows => on && setCups(rows), () => on && setCups(false)); return () => { on = false; }; }, [asked]);
  return cups;
}

export function CupList({ cups, onCup, onMake, onRetry }) {
  if (cups === null) return null;
  return <section className="streak-cups" aria-labelledby="streak-cups">
    <SectionHead id="streak-cups" title="등반전" link="열기" onLink={onMake} />
    {cups === undefined ? <div className="stack"><div className="pn row" /></div>
      : cups === false ? <ErrorNote action="다시 불러오기" onRetry={onRetry}>등반전을 불러오지 못했습니다.</ErrorNote>
      : !cups.length ? <div className="stack"><Row title="열린 등반전이 없습니다." /></div>
      : <div className="stack">{cups.map(c => {
        const phase = phaseOf(c);
        return <Row key={c.id} title={c.title} line={`${c.host_name}, ${lineOf(c)}`} value={<span className="t15">{c.players}명</span>}
          lamp={phase === "on"} sig onClick={() => onCup(c.id)} label={`${c.title}, ${lineOf(c)}, ${c.players}명`} />;
      })}</div>}
  </section>;
}

// a datetime-local field's value for a time: "2026-11-22T19:00" in this device's zone
const fieldTime = ms => { const d = new Date(ms - new Date(ms).getTimezoneOffset() * 60000); return d.toISOString().slice(0, 16); };
const ROOMS = { 공개: "open", 코드: "code" };
const LIMITS = { "모든 도전": null, "처음 1번": 1, "처음 3번": 3 };

/* 등반전 열기: its name, when it opens and closes, who comes in, how many runs count. The sheet's one key opens it and its board */
export function CupMake({ onClose, onMade }) {
  const [title, setTitle] = useState("");
  // it starts now by default (the server takes a start already past as now), so a meet opens it and climbs at once
  const [start, setStart] = useState(() => fieldTime(Date.now()));
  const [end, setEnd] = useState(() => fieldTime(Math.ceil(Date.now() / 600000) * 600000 + 2 * 3600e3));
  const [room, setRoom] = useState("공개");
  const [limit, setLimit] = useState("모든 도전");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const make = async () => {
    if (busy) return;
    if (!title.trim()) { setError("등반전 이름을 입력해 주세요."); document.getElementById("cup-title")?.focus(); return; }
    if (!(Date.parse(end) > Date.parse(start))) { setError("마감은 시작보다 뒤여야 합니다."); return; }
    setBusy(true); setError("");
    try {
      const made = await createTowerCup({ title: title.trim(), startsAt: new Date(start).toISOString(), endsAt: new Date(end).toISOString(), room: ROOMS[room], limit: LIMITS[limit] });
      onMade(made.id);
    } catch (e) { setError(e.message); setBusy(false); }
  };
  return <Modal title="등반전 열기" onClose={onClose}>
    <Question id="cup-title" label="이름" error={error === "등반전 이름을 입력해 주세요." ? error : ""}>
      <input id="cup-title" className="in" maxLength={24} autoComplete="off" enterKeyHint="done" value={title} placeholder="11월 정모"
        onChange={e => { setTitle(e.target.value); if (error) setError(""); }} />
    </Question>
    <Question id="cup-start" label="시작">
      <input id="cup-start" className="in" type="datetime-local" value={start} onChange={e => setStart(e.target.value)} />
    </Question>
    <Question id="cup-end" label="마감">
      <input id="cup-end" className="in" type="datetime-local" value={end} onChange={e => setEnd(e.target.value)} />
    </Question>
    <Question id="cup-room" label="입장" group><Choice name="cup-room" options={Object.keys(ROOMS)} value={room} onChange={setRoom} /></Question>
    <Question id="cup-limit" label="반영" group><Choice name="cup-limit" options={Object.keys(LIMITS)} value={limit} onChange={setLimit} /></Question>
    {error && error !== "등반전 이름을 입력해 주세요." && <Toast error>{error}</Toast>}
    <div className="modal-actions"><Button variant="main" onClick={make} loading={busy}>열기</Button></div>
  </Modal>;
}

/* a code cup asks its four digits once */
function CupCode({ onClose, onJoin }) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const go = async () => {
    if (code.length !== 4) { setError("코드 4자리를 입력해 주세요."); return; }
    setBusy(true); setError("");
    try { await onJoin(code); } catch (e) { setError(e.message); setBusy(false); }
  };
  return <Modal title="코드 입력" onClose={onClose}>
    <Question id="cup-code" label="코드" error={error}>
      <input id="cup-code" className="in" inputMode="numeric" autoComplete="off" maxLength={4} enterKeyHint="go" value={code} placeholder="숫자 4자리" autoFocus
        onChange={e => { setCode(e.target.value.replace(/[^0-9]/g, "").slice(0, 4)); if (error) setError(""); }}
        onKeyDown={e => { if (e.key === "Enter" && !e.nativeEvent.isComposing) go(); }} />
    </Question>
    <div className="modal-actions"><Button variant="main" onClick={go} loading={busy}>참가</Button></div>
  </Modal>;
}

/* one cup's board: its name at 32, the ranking as the month's is drawn (the leader inverted at 84, live runs with their lamp and a
   door to watch), and beside it the time left, the players and the facts. Read again every 15 seconds while it runs and is seen. */
export function CupBoard({ id, approved, onGate, onOpen, onBack, onClimb }) {
  const [got, setGot] = useState(undefined);
  const [asked, setAsked] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [coding, setCoding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState(null);
  useEffect(() => {
    let on = true;
    readTowerCup(id).then(b => on && setGot(b), () => on && setGot(false));
    return () => { on = false; };
  }, [id, asked, approved]);
  const cup = got?.cup;
  const phase = cup ? phaseOf(cup, now) : null;
  useEffect(() => {
    if (!cup || phase === "over") return undefined;
    const tick = setInterval(() => setNow(Date.now()), 20_000);
    const again = setInterval(() => { if (document.visibilityState === "visible") setAsked(n => n + 1); }, 15_000);
    return () => { clearInterval(tick); clearInterval(again); };
  }, [cup?.id, phase]);
  const say = (text, error = false) => setNote({ text, error });
  const join = async code => {
    await joinTowerCup(id, code);
    setCoding(false); setAsked(n => n + 1);
  };
  const enter = () => {
    if (!approved) { onGate(); return; }
    if (cup.room === "code") { setCoding(true); return; }
    setBusy(true);
    join(null).catch(e => say(e.message, true)).finally(() => setBusy(false));
  };
  const close = async () => {
    if (!(await siteConfirm({ title: "지금 마감할까요?", body: phase === "soon" ? "시작 전이라 등반전이 지워집니다." : "지금까지의 순위로 굳습니다.", confirmLabel: "지금 마감" }))) return;
    try { const out = await closeTowerCup(id); if (out?.gone) onBack(); else setAsked(n => n + 1); } catch (e) { say(e.message, true); }
  };
  const share = async () => {
    try { await navigator.clipboard.writeText(`${window.location.origin}/?view=battle&tab=streak&cup=${id}`); say("링크를 복사했습니다."); } catch { say("링크를 복사하지 못했습니다.", true); }
  };
  useEffect(() => { if (!note) return undefined; const t = setTimeout(() => setNote(null), 3200); return () => clearTimeout(t); }, [note]);

  if (got === null) return <div className="cup-page"><BackLink to="도전의 탑" onClick={onBack} /><div className="stack"><Row title="등반전을 찾을 수 없습니다." /></div></div>;
  if (got === false) return <div className="cup-page"><BackLink to="도전의 탑" onClick={onBack} /><ErrorNote action="다시 불러오기" onRetry={() => setAsked(n => n + 1)}>등반전을 불러오지 못했습니다.</ErrorNote></div>;
  const rows = got?.rows?.map(r => ({ rank: r.place, name: r.trainer_name, points: r.wins, live: r.live,
    open: r.live && r.battle_id ? () => onOpen(r.battle_id) : null }));
  const [left, unit] = cup ? leftOf(Date.parse(phase === "soon" ? cup.starts_at : cup.ends_at) - now) : [null, ""];
  const keys = !cup || phase === "over" ? null
    : !cup.joined ? <Button variant="main" onClick={enter} loading={busy}>참가</Button>
    : <Button variant="main" onClick={onClimb}>도전하기</Button>;
  return <div className="cup-page">
    <BackLink to="도전의 탑" onClick={onBack} />
    {coding && <CupCode onClose={() => setCoding(false)} onJoin={join} />}
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
        <Counter label="참가" value={cup ? String(cup.players) : null} unit="명" cells={Math.max(2, String(cup?.players ?? 0).length)} />
        {cup?.code && <Counter label="코드" value={cup.code} cells={4} />}
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
        {cup?.hosting && phase !== "over" && <Button onClick={close}>지금 마감</Button>}
      </div>
    </div>
  </div>;
}
