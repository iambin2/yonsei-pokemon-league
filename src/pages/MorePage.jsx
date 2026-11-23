import React, { useEffect, useState } from "react";
import { Choice, Row } from "../components/common/Board.jsx";
import Icon from "../components/common/Icon.jsx";
import { DISCORD_URL } from "../components/layout/SiteHeader.jsx";
import { alertsSeenAt, readInbox, readPushKinds } from "../services/announcementPush.js";
import { PUSH_KINDS, unreadCount } from "../services/announcementPushPolicy.js";
import { viewHref } from "../services/appRouting.js";
import AccountKeys from "../components/AccountKeys.jsx";
import { useAccount } from "../components/common/useMe.js";
import { formatDate } from "../services/dateFormat.js";
import { pushOnHere } from "../services/announcementPush.js";
import { readAccountTeams, readMyBattles } from "../services/accountTeams.js";
import { accountsEnabled, readStreakBoard, signInWithGoogle } from "../services/visitorAuth.js";

/* 더보기 (DESIGN.md "Bars and navigation"): 탭 바에 없는 화면을 묶음 제목 아래 같은 줄로 두고,
   그 아래에 설정(테마)과 관리자 로그인을 둔다. 알림 화면은 함께하기의 첫 줄이고, 새 알림이 있으면 램프가 켜진다. 줄은 52, 오른쪽 끝에 → 또는 바깥으로 나가는 표시. */
const GROUPS = [
  ["기록", [["titles", "칭호"], ["champions", "명예의 전당"]]],
  ["함께하기", [["alerts", "알림"], ["board", "게시판"], ["builder", "팀 빌더"], ["battle", "배틀"], ["calc", "계산기"]]],
  ["리그", [["about", "소개"], ["privacy", "개인정보처리방침"]]],
];

const THEMES = [["dark", "어둡게"], ["light", "밝게"], ["contrast", "고대비"], ["system", "기기 설정"]];
/* 알림 줄의 새 알림: 이 기기가 받는 종류(꺼진 기기는 모든 종류)에서 지난번 알림 화면을 본 뒤에 온 것이 있는가. 읽지 못하면 램프는 꺼진 채다. */
function useNewAlerts() {
  const [fresh, setFresh] = useState(false);
  useEffect(() => {
    let cancelled = false;
    readPushKinds().catch(() => null)
      .then(k => readInbox(k?.kinds ?? PUSH_KINDS.map(x => x.kind)))
      .then(rows => { if (!cancelled && rows) setFresh(unreadCount(rows, alertsSeenAt()) > 0); }, () => {});
    return () => { cancelled = true; };
  }, []);
  return fresh;
}
/* 내 계정 (2026-11-22, the owner's draft A): at the top of 더보기, where the phone's tab bar already leads, what the Google account holds
   (its record link, saved teams, battles, the tower, alerts on this device) a row each, each a door to its place, and the account's keys
   under them. Signed out, one row to sign in. Each line is read as the block opens; one that cannot be read stays a plain door. */
function MyAccount({ go, account, fresh }) {
  const [lines, setLines] = useState({});
  useEffect(() => {
    if (!account) return undefined;
    let on = true;
    const set = (key, value) => on && setLines(l => ({ ...l, [key]: value }));
    readAccountTeams().then(t => t && set("teams", `${t.length}팀, 이 계정의 모든 기기에서`), () => {});
    readMyBattles().then(b => b && set("battles", b.length ? `${b.length}판, 마지막 ${formatDate(b[0].updated_at)}` : "아직 한 배틀이 없습니다."), () => {});
    readStreakBoard().then(rows => { const mine = rows?.find(r => r.mine); set("tower", mine ? `이번 달 최고 ${mine.wins}연승, ${mine.place}위` : "이번 달 기록이 없습니다."); }, () => {});
    pushOnHere().then(on => set("alerts", on ? "이 기기에서 켬" : "이 기기에서 꺼짐"), () => {});
    return () => { on = false; };
  }, [account?.status]);
  if (!accountsEnabled() || account === undefined) return null;
  const chev = <Icon n="chevr" size={20} />;
  if (!account) return <div className="more-group more-account">
    <p className="t12 dim more-label">내 계정</p>
    <div className="stack"><Row title="구글 계정으로 로그인" line="내 기록, 저장한 팀, 배틀을 계정에 둡니다." value={chev} onClick={() => signInWithGoogle("", `${window.location.origin}${window.location.pathname}?view=more`)} /></div>
  </div>;
  const linked = account.status === "approved" && account.player_id;
  const state = { approved: "기록 연결됨", pending: "연결 확인 중", rejected: "연결 요청 거절됨" }[account.status] || "기록 연결 전";
  return <div className="more-group more-account">
    <p className="t12 dim more-label">내 계정</p>
    <div className="stack">
      <Row className={linked ? "inv" : ""} title={account.requested_name || "이름 연결 전"} line={`Google 계정${account.email ? ` ${account.email}` : ""}, ${state}`} value={chev} onClick={() => go("records", { tab: "trainer", me: "1" })} />
      {linked && <Row title="내 기록" line="우승, 준우승, 4강과 지난 대회" value={chev} onClick={() => go("records", { trainer: account.requested_name })} />}
      <Row title="저장한 팀" line={lines.teams} value={chev} onClick={() => go("builder")} />
      <Row title="내 배틀" line={lines.battles} value={chev} onClick={() => go("battle", { tab: "mine" })} />
      {linked && <Row title="도전의 탑" line={lines.tower} value={chev} onClick={() => go("battle", { tab: "streak" })} />}
      {/* signed in, 알림 stands here only, with its 새 알림 lamp (2026-11-23 audit, H-04: it stood twice) */}
      <Row title="알림" line={lines.alerts} value={<>{fresh && <span className="t12 more-new"><i className="lamp" aria-hidden="true" />새 알림</span>}{chev}</>} onClick={() => go("alerts")} />
    </div>
    <AccountKeys link={account.requested_name ? account : null} />
  </div>;
}

export default function MorePage({ go, themePref, onTheme, admin, onAdmin }) {
  const fresh = useNewAlerts();
  const account = useAccount();
  const own = accountsEnabled() && Boolean(account);
  return (
    <section className="more">
      <h1 className="t32">더보기</h1>
      <MyAccount go={go} account={account} fresh={fresh} />
      {GROUPS.map(([label, items]) => (
        <div className="more-group" key={label}>
          <p className="t12 dim more-label">{label}</p>
          <div className="stack">
            {items.filter(([key]) => !(own && key === "alerts")).map(([key, text]) => <Row key={key} title={text} value={<>{key === "alerts" && fresh && <span className="t12 more-new"><i className="lamp" aria-hidden="true" />새 알림</span>}<Icon n="chevr" size={20} /></>} onClick={() => go(key)} href={viewHref(key)} />)}
            {label === "리그" && <a className="pn row" href={DISCORD_URL} target="_blank" rel="noopener noreferrer">
              <span className="row-main"><b className="t15">디스코드 참여</b></span><span className="row-value"><Icon n="ext" size={20} /></span>
            </a>}
          </div>
        </div>
      ))}
      <div className="more-side">
        <div className="more-group">
          <p className="t12 dim more-label">설정</p>
          {/* Choice's radiogroup takes no name of its own (Board.jsx), so the group around it carries one */}
          <div role="group" aria-label="테마">
            <Choice name="theme" options={THEMES.map(([, label]) => label)} value={THEMES.find(([key]) => key === themePref)?.[1]} onChange={v => { const key = THEMES.find(([, label]) => label === v)?.[0]; if (key && key !== themePref) onTheme(key); }} />
          </div>
        </div>
        <div className="more-group">
          <div className="stack"><Row title={admin ? "관리자 로그아웃" : "관리자 로그인"} value={<Icon n={admin ? "logout" : "login"} size={20} />} onClick={onAdmin} /></div>
        </div>
      </div>
    </section>
  );
}
