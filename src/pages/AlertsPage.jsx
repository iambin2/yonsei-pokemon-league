import React, { useEffect, useRef, useState } from "react";
import { follow, useArrival } from "../components/common/Board.jsx";
import ErrorNote from "../components/common/ErrorNote.jsx";
import { PushBoard, usePush } from "../components/common/PushControl.jsx";
import { alertsSeenAt, markAlertsSeen, readInbox } from "../services/announcementPush.js";
import { PUSH_KINDS, inboxDays, kindLabel } from "../services/announcementPushPolicy.js";

/* 알림 (?view=alerts, 2026-11-24 다시 짬, the owner: "알림창도 가독성이 최악이야. 새로 설계해야 할 것 같아"): 한 단에 페이지 이름,
   이 기기 알림의 스위치, 받을 알림의 목록, 그리고 받은 알림을 날짜별로. 날마다 작은 회색 머리가 2px 줄 위에 서고, 알림 한 줄은 밝은
   제목, 회색 줄의 종류, 오른쪽 끝의 시각이다. 받은 알림은 지난 7일, 이 기기가 받는 종류(꺼진 기기는 모든 종류)의 알림이다
   (docs/db/push_inbox.sql). 지난번에 본 뒤에 온 줄은 밝고 굵게 서며 회색 줄에 새 알림이 밝게 붙고, 읽은 줄은 흐리게 선다.
   화면에 온 때가 다음 방문의 기준이 된다. 개수를 크게 세워 두지 않는다(Made by people). */
const ALL = PUSH_KINDS.map(k => k.kind);

/* an alert's address opened as the site's own move where the shell knows it, otherwise as a page load (a battle seat) */
function opener(go) {
  return url => {
    const p = new URLSearchParams(url.replace(/^\?/, "")), view = p.get("view");
    if (view === "news") return go("news", { notice: p.get("notice") || undefined });
    if (view === "board") return go("board", { tab: p.get("tab") || undefined, post: p.get("post") || undefined });
    if (view === "bracket" && p.get("eventId")) return go("bracket", { eventId: p.get("eventId") });
    if (view === "battle" && !p.has("event")) return go("battle", { tab: p.get("tab") || undefined });
    window.location.assign(url);
  };
}

export default function AlertsPage({ go }) {
  const push = usePush("새 소식을 알림으로 받습니다.");
  const kinds = push.on && push.kinds ? push.kinds.kinds : ALL;
  // undefined while reading, null when push_inbox.sql has not run
  const [items, setItems] = useState(undefined);
  // a failed read is said as one (T-110), not shown as seven quiet days; 다시 불러오기 reads again
  const [failed, setFailed] = useState(false), [again, setAgain] = useState(0);
  const seen = useRef(alertsSeenAt());
  // seen once the page has stood: this visit still lights what came since the last one (seen.current), the next visit does not.
  // Marked on arrival, not on leaving, since a reload or a closed tab never runs a page's cleanup.
  useEffect(() => { markAlertsSeen(); }, []);
  useEffect(() => {
    if (!push.checked || push.mode === "none") return undefined;
    let cancelled = false;
    readInbox(kinds).then(rows => { if (!cancelled) { setFailed(false); setItems(rows); } }, error => { console.error(error); if (!cancelled) { setFailed(true); setItems([]); } });
    return () => { cancelled = true; };
  }, [push.checked, push.mode, kinds.join(), again]);
  const arrival = useArrival(items !== undefined);
  const open = opener(go);
  const days = items ? inboxDays(items, new Date(), seen.current) : [];
  return (
    <section className="alerts">
      <h1 className="page-title">알림</h1>
      <div className="alerts-set"><PushBoard push={push} /></div>
      {items !== null && push.mode !== "none" && <div className="alerts-main" ref={arrival}>
        <h2 className="t20 alerts-h">받은 알림</h2>
        {items === undefined ? null : failed ? <ErrorNote action="다시 불러오기" onRetry={() => { setItems(undefined); setAgain(n => n + 1); }}>알림을 불러오지 못했습니다.</ErrorNote>
          : !days.length ? <div className="ypl-empty"><p className="t15">최근 7일의 알림이 없습니다.</p></div>
          : days.map(({ day, items: list }) => <section className="alerts-day" key={day} aria-label={day}>
            <p className="t12 alerts-day-h">{day}</p>
            <div className="stack opens">{list.map((item, i) => (
              <a key={i} href={item.url} onClick={follow(() => open(item.url))} className={"pn row row--2 alerts-row" + (item.unread ? " fresh" : "")}>
                <span className="row-main"><b className="t15">{item.body}</b><span className="t12 dim reg">{kindLabel(item.kind)}{item.unread && <>, <b className="alerts-new">새 알림</b></>}</span></span>
                <span className="row-value t15 alerts-time">{item.time}</span>
              </a>
            ))}</div>
          </section>)}
      </div>}
    </section>
  );
}
