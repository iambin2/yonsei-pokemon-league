import React, { useEffect, useState } from "react";
import Button from "../components/common/Button.jsx";
import Empty from "../components/common/Empty.jsx";
import Loader from "../components/common/Loader.jsx";
import { Counter, Row, SectionHead, Steps, TabsLine } from "../components/common/Board.jsx";
import Field from "../components/common/Field.jsx";
import Modal from "../components/common/Modal.jsx";
import { DEFAULT_POINT_TABLE } from "../services/bracketRankingAwardSnapshot.js";
import { isHttpUrl, resolveSiteConfig, sanitizeSiteConfig } from "../services/siteConfig.js";
import Icon from "../components/common/Icon.jsx";
import LinkRequests from "../components/LinkRequests.jsx";
import ChangeLog from "../components/ChangeLog.jsx";
import ClientErrors from "../components/ClientErrors.jsx";
import CommunityReports from "../components/CommunityReports.jsx";
import { formatDate } from "../services/dateFormat.js";
import { ADMIN_STEPS, adminTasks, readAdminOverview } from "../services/adminOverview.js";
import { cancelEventWithoutBracket, db as normalizedDb } from "../services/normalizedCompetitionService.js";
import { siteAlert, siteConfirm } from "../components/common/SiteDialog.jsx";
import { readTowerMonthTops } from "../services/visitorAuth.js";
import { TOWER_TITLE, towerMonthLabel, towerTitlesDue } from "../services/towerTitles.js";
import { applyTitleAwards } from "../services/titleAwards.js";
import { buildExportCsvs, downloadText, fetchExportTables } from "../services/recordsExport.js";
import { FREE_BOARD_KEY, readCommunity } from "../services/communityStore.js";

/* 운영 (DESIGN.md "Admin", 2026-11-08): the operators' one place. Their work had stood scattered inside the public pages (a notice's
   responses, a bracket's result entry and record, the trainer tab's link requests), found only by going to each. Here: four counts as large thin figures,
   what waits as rows in the order things happen now, each going to the screen that does it; beside them (the 439 on desktop, held in
   view) each event in progress with its four steps and the one action its step asks for; under the rows, the doors to every editor. */
const DOORS = [
  ["공지 쓰기", "news", "대회 공지와 신청서"],
  ["대진표", "bracket", "새 대진표, 결과 입력, 기록 반영"],
  ["기록", "records", "트레이너, 대회, 랭킹", { tab: "trainer" }],
  ["칭호", "titles", "칭호와 보유자"],
  ["명예의 전당", "champions", "역대 챔피언"],
  ["게시판", "board", "글과 댓글 정리"],
];
/* 내보내기 (2026-11-22): every official record as files an operator keeps or opens in a spreadsheet. The tables are read once, on the
   first press; each row is one file, so the browser never asks to allow several downloads at once. */
const EXPORTS = [
  ["전체 기록", "모든 표, JSON", "json"],
  ["결과", "대회별 순위, CSV", "results"],
  ["경기", "승자, 점수, 불참, CSV", "matches"],
  ["랭킹", "시즌별 포인트, CSV", "ranking"],
  ["명단", "대회별 신청, CSV", "roster"],
];
function Exports({ flash }) {
  const [busy, setBusy] = useState("");
  const [tables, setTables] = useState(null);
  const take = async key => {
    if (busy) return;
    setBusy(key);
    try {
      const t = tables || await fetchExportTables(normalizedDb());
      setTables(t);
      const day = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });
      if (key === "json") downloadText(`ypl-records-${day}.json`, JSON.stringify({ exportedAt: new Date().toISOString(), tables: t }, null, 1), "application/json");
      else downloadText(`ypl-${key}-${day}.csv`, buildExportCsvs(t)[key], "text/csv;charset=utf-8");
    } catch (error) { flash(`받지 못했습니다. ${error?.message || "잠시 뒤 다시 시도해 주세요."}`); }
    finally { setBusy(""); }
  };
  return <section className="ad-block" aria-labelledby="ad-export-h">
    <SectionHead id="ad-export-h" title="내보내기" />
    <div className="stack ad-doors">{EXPORTS.map(([title, line, key]) => <Row key={key} title={title} line={busy === key ? "받는 중" : line} onClick={() => void take(key)} label={`${title} 받기, ${line}`} />)}</div>
  </section>;
}
/* 관리자 전용 글 (2026-11-24, the owner: 관리자에게만 보이게 쓴 글을 운영 화면에서 눈에 잘 띄게): the board's posts written for the
   operators, newest first; one nobody has answered yet says 답글 전 at its end, lit. A row opens the post. With none, nothing shows. */
function Letters({ go }) {
  const [rows, setRows] = useState(null);
  useEffect(() => {
    let on = true;
    readCommunity(FREE_BOARD_KEY).then(items => on && setRows(items.filter(p => p.secret).sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || ""))).slice(0, 8)), () => {});
    return () => { on = false; };
  }, []);
  if (!rows?.length) return null;
  return <section className="ad-block" aria-labelledby="ad-letters-h">
    <SectionHead id="ad-letters-h" title="관리자 전용 글" link="게시판" onLink={() => go("board")} />
    <div className="stack">{rows.map(p => { const cc = (p.comments || []).length;
      return <Row key={p.id} title={p.title || p.body || "(제목 없음)"} line={[p.nick, p.createdAt && formatDate(p.createdAt, { time: true })].filter(Boolean).join(", ")}
        value={<span className={"t12" + (cc ? " dim" : "")}>{cc ? `댓글 ${cc}` : "답글 전"}</span>} onClick={() => go("board", { post: p.id })} />; })}</div>
  </section>;
}

/* 포인트 (2026-11-22, the owner's draft 4 A): the points a place gives, per kind and league, for events recorded from now on. Kept in
   site_data (pointPolicy); the record sheet and the awards read it through setPointTable. A blank cell keeps the default. */
const LEAGUES = [["master", "마스터"], ["light", "라이트"]];
function PointSheet({ data, save, onClose }) {
  const [kind, setKind] = useState("individual");
  const [table, setTable] = useState(() => JSON.parse(JSON.stringify({ ...DEFAULT_POINT_TABLE, ...(data.pointPolicy || {}),
    individual: { ...DEFAULT_POINT_TABLE.individual, ...(data.pointPolicy?.individual || {}) }, team: { ...DEFAULT_POINT_TABLE.team, ...(data.pointPolicy?.team || {}) } })));
  const places = kind === "team" ? [["win", "우승"], ["ru", "준우승"]] : [["win", "우승"], ["ru", "준우승"], ["sf", "4강"]];
  const put = (league, key, value) => setTable(t => ({ ...t, [kind]: { ...t[kind], [league]: { ...t[kind][league], [key]: value.replace(/[^0-9]/g, "").slice(0, 4) } } }));
  const store = async () => {
    const clean = Object.fromEntries(["individual", "team"].map(k => [k, Object.fromEntries(LEAGUES.map(([l]) => [l,
      Object.fromEntries(Object.entries(table[k][l] || {}).filter(([, v]) => v !== "" && v != null).map(([p, v]) => [p, Math.min(1000, Number(v))]))]))]));
    if (await save({ ...data, pointPolicy: clean }, "포인트를 저장했습니다.")) onClose();
  };
  return <Modal title="포인트" hint="다음에 기록에 반영하는 대회부터 씁니다. 이미 반영한 대회는 그대로입니다." onClose={onClose}>
    <TabsLine value={kind} onChange={setKind} options={[["individual", "개인전"], ["team", "팀전"]]} label="종류" />
    {LEAGUES.map(([league, label]) => <section className="ad-points" key={league}>
      <SectionHead title={label} />
      {places.map(([key, name]) => <Field key={key} label={name} flush={key === places[places.length - 1][0]}>
        <input inputMode="numeric" aria-label={`${label} ${name} 포인트`} value={String(table[kind][league]?.[key] ?? "")} onChange={e => put(league, key, e.target.value)} /></Field>)}
    </section>)}
    <p className="t12 dim">루키 리그와 챔피언스는 포인트가 없습니다.</p>
    <div className="modal-actions"><Button variant="second" onClick={onClose}>취소</Button><Button variant="main" icon="check" onClick={store}>저장</Button></div>
  </Modal>;
}

/* 사이트 설정: 디스코드 초대 주소, 동아리 연혁, 개인정보처리방침 시행일, 창립 연도를 코드 수정 없이 바꿉니다. */
function SiteConfigSheet({ data, save, onClose }) {
  const [cfg, setCfg] = useState(() => resolveSiteConfig(data.siteConfig));
  const [urlErr, setUrlErr] = useState("");
  const updTimeline = (idx, key, val) => setCfg(c => ({ ...c, aboutTimeline: c.aboutTimeline.map((row, i) => (i === idx ? { ...row, [key]: val } : row)) }));
  const addTimeline = () => setCfg(c => ({ ...c, aboutTimeline: [...c.aboutTimeline, { when: "", title: "", body: "" }] }));
  const delTimeline = idx => setCfg(c => ({ ...c, aboutTimeline: c.aboutTimeline.filter((_, i) => i !== idx) }));
  const moveTimeline = (idx, dir) => setCfg(c => {
    const next = [...c.aboutTimeline];
    const target = idx + dir;
    if (target < 0 || target >= next.length) return c;
    [next[idx], next[target]] = [next[target], next[idx]];
    return { ...c, aboutTimeline: next };
  });
  const store = async () => {
    if (!isHttpUrl(cfg.discordUrl)) {
      setUrlErr("https:// 또는 http://로 시작하는 주소를 입력해 주세요.");
      return;
    }
    setUrlErr("");
    const clean = sanitizeSiteConfig(cfg);
    if (await save({ ...data, siteConfig: clean }, "사이트 설정을 저장했습니다.")) onClose();
  };
  return <Modal title="사이트 설정" hint="디스코드 주소, 소개 화면의 리그 연혁, 개인정보처리방침 시행일을 코드 수정 없이 바꿉니다." onClose={onClose}>
    <Field label="디스코드 초대 주소" error={urlErr}>
      <input type="url" value={cfg.discordUrl} onChange={e => { setUrlErr(""); setCfg(c => ({ ...c, discordUrl: e.target.value })); }} placeholder="https://discord.gg/..." />
    </Field>
    <div className="ed-r2">
      <Field label="개인정보처리방침 시행일">
        <input value={cfg.privacyEffectiveDate} onChange={e => setCfg(c => ({ ...c, privacyEffectiveDate: e.target.value }))} placeholder="예: 2026년 11월 29일" />
      </Field>
      <Field label="창립 연도">
        <input inputMode="numeric" value={String(cfg.foundedYear)} onChange={e => setCfg(c => ({ ...c, foundedYear: e.target.value.replace(/[^0-9]/g, "").slice(0, 4) }))} placeholder="2023" />
      </Field>
    </div>
    <section className="ad-points">
      <SectionHead title="리그 연혁" />
      <div className="ed-scroll">
        {cfg.aboutTimeline.map((row, idx) => (
          <div className="ed-round" key={idx}>
            <div className="ed-rtop">
              <input className="ed-w" value={row.when} onChange={e => updTimeline(idx, "when", e.target.value)} placeholder="시기 (예: 2027년 3월)" aria-label="시기" />
              <input className="ed-w" value={row.title} onChange={e => updTimeline(idx, "title", e.target.value)} placeholder="제목" aria-label="제목" />
              <button type="button" className="ed-mv" onClick={() => moveTimeline(idx, -1)} disabled={idx === 0} title="위로" aria-label="위로"><Icon n="up" size={16} /></button>
              <button type="button" className="ed-mv" onClick={() => moveTimeline(idx, 1)} disabled={idx === cfg.aboutTimeline.length - 1} title="아래로" aria-label="아래로"><Icon n="down" size={16} /></button>
              <button type="button" className="ed-del" onClick={() => delTimeline(idx)} disabled={cfg.aboutTimeline.length <= 1} title="삭제" aria-label="삭제"><Icon n="x" size={16} /></button>
            </div>
            <input value={row.body} onChange={e => updTimeline(idx, "body", e.target.value)} placeholder="설명" aria-label="설명" />
          </div>
        ))}
      </div>
      <Button variant="second" size="sm" onClick={addTimeline}>연혁 추가</Button>
    </section>
    <p className="t12 dim">마지막 연혁이 소개 화면에서 현재 단계로 강조됩니다.</p>
    <div className="modal-actions"><Button variant="second" onClick={onClose}>취소</Button><Button variant="main" icon="check" onClick={store}>저장</Button></div>
  </Modal>;
}

const STEP_ACTION = { 1: null, 2: "대진표 만들기", 3: "결과 입력", 4: "기록에 반영" };
const when = e => (e.heldOn ? formatDate(e.startTime ? `${String(e.heldOn).slice(0, 10)}T${e.startTime}` : e.heldOn, { time: Boolean(e.startTime) }) : "");

// now in Korea as the notice editor writes its times ("2026-11-08T21:05"): the server reads closesAt as Korean time
const koreaNow = () => new Date().toLocaleString("sv-SE", { timeZone: "Asia/Seoul" }).slice(0, 16).replace(" ", "T");

function EventPanel({ e, main, go, onClose, onCancel }) {
  const facts = [
    e.step === 1 && e.closesAt && ["신청 마감", `${formatDate(e.closesAt, { time: true })}까지`],
    e.applicants != null && ["신청", `${e.applicants}명`],
    e.checkedIn ? ["체크인", `${e.checkedIn} / ${e.applicants}명`] : null,
    e.entrants ? ["파티 제출", `${e.submitted} / ${e.entrants}${e.late ? `, 마감 뒤 ${e.late}번` : ""}`] : null,
    e.total ? ["경기", `${e.stage} ${e.done} / ${e.total} 종료`] : null,
    e.battles ? ["배틀", `${e.battles}개 진행 중`] : null,
  ].filter(Boolean);
  const action = STEP_ACTION[e.step];
  return <section className="ad-event" aria-label={e.name}>
    <div className="pn ad-event-head">
      <b className="t20">{e.name}</b>
      <span className="t12 dim">{[when(e), e.awaiting ? "기록 반영 전" : ""].filter(Boolean).join(", ")}</span>
    </div>
    <Steps labels={ADMIN_STEPS} at={e.step} />
    {facts.length > 0 && <div className="stack">{facts.map(([k, v]) => <div className="pn spec-row" key={k}><span className="t12 dim">{k}</span><span className="t15">{v}</span></div>)}</div>}
    {action ? <Button variant={main ? "main" : "second"} icon={e.step === 4 ? "check" : "arrow"} onClick={() => go("bracket", { eventId: e.id })}>{action}</Button>
      /* while it takes applications: close them now (undone from the toast), and the applications themselves */
      : e.noticeId && <div className="stack ad-keys">
        {e.closesAt && <Button variant="second" onClick={() => onClose(e)}>지금 마감</Button>}
        <Button variant={main ? "main" : "second"} onClick={() => go("news", { notice: e.noticeId })}>신청 현황</Button>
      </div>}
    {/* an event that will not be held (2026-11-22: two stood open for weeks, the notice undeletable for its applications) */}
    {e.step <= 2 && <div className="ad-cancel"><Button variant="link" onClick={() => onCancel(e)}>대회 취소</Button></div>}
  </section>;
}

export default function AdminPage({ data, admin, go, onAdmin, save, flash, onRequests }) {
  const [overview, setOverview] = useState(null);
  const [pending, setPending] = useState(null);
  const counted = n => { setPending(n); onRequests?.(n); };
  const [failed, setFailed] = useState(false);
  const [reload, setReload] = useState(0);
  const [points, setPoints] = useState(false);
  const [siteSettings, setSiteSettings] = useState(false);
  /* 탑의 정상 (2026-11-22): a past month's first of 도전의 탑 waits here as a task until it is given; one press gives it, the toast undoes it */
  const [towerTops, setTowerTops] = useState(null);
  useEffect(() => { if (!admin) return undefined; let on = true; readTowerMonthTops().then(rows => on && setTowerTops(rows), () => {}); return () => { on = false; }; }, [admin]);
  const towerDue = towerTitlesDue(towerTops || [], data.titleGroups || []);
  const grantTower = async due => {
    const before = data.titleGroups || [];
    const next = { ...data, titleGroups: applyTitleAwards(before, [{ groupKey: "etc", title: TOWER_TITLE, holder: due.trainer_name, eventId: due.grantId, desc: "도전의 탑 달 1위" }]) };
    if (await save(next, `${due.trainer_name}에게 ${TOWER_TITLE}을 주었습니다.`)) flash(`${due.trainer_name}에게 ${TOWER_TITLE}을 주었습니다.`, { label: "되돌리기", run: () => save({ ...next, titleGroups: before }, "되돌렸습니다.") });
  };
  useEffect(() => {
    if (!admin) return undefined;
    let on = true;
    readAdminOverview(data.announcements).then(o => on && setOverview(o), () => on && setFailed(true));
    return () => { on = false; };
  }, [admin, data.announcements, reload]);
  /* 대회 취소: it is not undone from a toast (the event leaves this page), so it asks once and says what stays */
  const cancelEvent = async e => {
    if (!(await siteConfirm({ title: "대회 취소", body: `${e.name}을 취소할까요? 공지와 신청은 남고, 이 화면과 기록 반영 알림에서 빠집니다.`, confirmLabel: "대회 취소", cancelLabel: "닫기", danger: true }))) return;
    try {
      await cancelEventWithoutBracket(e.id);
      // the server already refuses applications to a cancelled event; the notice's form shuts too, so nobody fills it in for nothing
      if (e.noticeId && e.step === 1) await save({ ...data, announcements: data.announcements.map(a => (a.id === e.noticeId ? { ...a, form: { ...a.form, closesAt: koreaNow() } } : a)) }, "신청을 마감했습니다.");
      flash("대회를 취소했습니다."); setReload(n => n + 1);
    }
    catch (error) { siteAlert("대회를 취소하지 못했습니다.", error?.message || "잠시 뒤 다시 시도해 주세요."); }
  };
  /* 지금 마감: the notice's closing time becomes now, so the form shuts and the server refuses new applications
     (docs/db/application_close.sql). It can be undone, so it acts at once and the toast offers 되돌리기 (Composing a screen 18). */
  const closeNow = async e => {
    const withClose = at => ({ ...data, announcements: data.announcements.map(a => (a.id === e.noticeId ? { ...a, form: { ...a.form, closesAt: at } } : a)) });
    const before = e.closesAt;
    if (await save(withClose(koreaNow()), "신청을 마감했습니다.")) flash("신청을 마감했습니다.", { label: "되돌리기", run: () => save(withClose(before), "마감을 되돌렸습니다.") });
  };
  if (!admin) return <div className="ad-page"><h1 className="page-title">운영</h1><Empty title="관리자 로그인이 필요합니다." />
    <Button variant="main" onClick={onAdmin}>관리자 로그인</Button></div>;
  const tasks = adminTasks(overview);
  // the requests block reads them itself and says how many wait after each decision; until it does, the overview's count stands
  const requests = pending ?? overview?.requests?.length ?? null;
  const events = overview?.events || [];
  const n = v => (overview ? String(v) : null);
  const open = (t) => {
    go("bracket", { eventId: t.event.id });
  };
  return <div className="ad-page">
    <h1 className="page-title">운영</h1>
    <div className="stack ad-counts">
      <Counter label="할 일" value={n(tasks.length + towerDue.length)} h={84} />
      <Counter label="신청" value={n(events.filter(e => e.step === 1).reduce((s, e) => s + (e.applicants || 0), 0))} h={84} />
      <Counter label="남은 경기" value={n(events.reduce((s, e) => s + e.left, 0))} h={84} />
      <Counter label="연결 요청" value={requests == null ? null : String(requests)} h={84} />
    </div>
    {/* the decision operators make most: Google accounts asking for a trainer's record, first and across the page */}
    <LinkRequests id="ad-linkreq-h" onCount={counted} />
    {failed ? <Empty title="운영 현황을 불러오지 못했습니다." desc="잠시 뒤 다시 열어 주세요." />
      : !overview ? <Loader />
      : <>
        <div className="ad-cols">
          <div className="ad-main">
            <section className="ad-block ad-todo" aria-labelledby="ad-todo-h">
              <SectionHead id="ad-todo-h" title="할 일" />
              {tasks.length || towerDue.length ? <div className="stack">
                {tasks.map(t => <Row key={t.key} title={t.title} line={t.line} onClick={() => open(t)} label={`${t.title}, ${t.line}`} />)}
                {towerDue.map(d => <Row key={d.grantId} title={`${towerMonthLabel(d.month)} ${TOWER_TITLE}`} line={`도전의 탑 1위 ${d.trainer_name}, ${d.wins}연승. 누르면 칭호를 줍니다.`} onClick={() => grantTower(d)} label={`${towerMonthLabel(d.month)} ${TOWER_TITLE}, ${d.trainer_name}에게 주기`} />)}
              </div>
                : <div className="pn ad-none"><span className="t15">지금 할 일이 없습니다.</span></div>}
            </section>
            <Letters go={go} />
            <CommunityReports go={go} />
            <section className="ad-block" aria-labelledby="ad-doors-h">
              <SectionHead id="ad-doors-h" title="편집" />
              <div className="stack ad-doors">{DOORS.map(([title, view, line, options]) => <Row key={view} title={title} line={line} onClick={() => go(view, options)} />)}
                <Row title="포인트" line="순위마다 주는 랭킹 포인트" onClick={() => setPoints(true)} />
                <Row title="사이트 설정" line="디스코드 주소, 리그 연혁, 시행일" onClick={() => setSiteSettings(true)} /></div>
            </section>
          </div>
          <div className="ad-side">
            {/* 대회 진행 on the 439 beside 할 일, from the same top line, scrolling with the page (2026-11-24, the owner's draft B: the
                439 held in view took the page's width at every scroll) */}
            <section className="ad-block ad-events-block" aria-labelledby="ad-events-h">
              <SectionHead id="ad-events-h" title="대회 진행" />
              {events.length ? <div className="ad-events">{events.map((e, i) => <EventPanel key={e.id} e={e} main={i === 0} go={go} onClose={closeNow} onCancel={cancelEvent} />)}</div>
                : <div className="pn ad-none"><span className="t15">진행 중인 대회가 없습니다.</span></div>}
            </section>
            <Exports flash={flash} />
            <ChangeLog />
            <ClientErrors />
          </div>
        </div>
        {points && <PointSheet data={data} save={save} onClose={() => setPoints(false)} />}
        {siteSettings && <SiteConfigSheet data={data} save={save} onClose={() => setSiteSettings(false)} />}
      </>}
  </div>;
}
