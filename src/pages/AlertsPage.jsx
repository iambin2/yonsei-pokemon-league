import React, { useEffect, useRef, useState } from "react";
import { follow, useArrival } from "../components/common/Board.jsx";
import { PushBoard, usePush } from "../components/common/PushControl.jsx";
import { alertsSeenAt, markAlertsSeen, readInbox } from "../services/announcementPush.js";
import { PUSH_KINDS, inboxDays, kindLabel } from "../services/announcementPushPolicy.js";

/* 알림 (?view=alerts, draft B 2026-11-19): 받은 알림이 709, 설정이 439에 화면에 남아 선다. 휴대폰에서는 받은 알림 아래에 설정.
   받은 알림은 지난 7일, 이 기기가 받는 종류(꺼진 기기는 모든 종류)의 알림이다(docs/db/push_inbox.sql). 지난번에 본 뒤에 온 줄은
   밝고 램프가 켜지며, 화면에 온 때가 다음 방문의 기준이 된다. */
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
  const seen = useRef(alertsSeenAt());
  // seen once the page has stood: this visit still lights what came since the last one (seen.current), the next visit does not.
  // Marked on arrival, not on leaving, since a reload or a closed tab never runs a page's cleanup.
  useEffect(() => { markAlertsSeen(); }, []);
  useEffect(() => {
    if (!push.checked || push.mode === "none") return undefined;
    let cancelled = false;
    readInbox(kinds).then(rows => { if (!cancelled) setItems(rows); }, error => { console.error(error); if (!cancelled) setItems([]); });
    return () => { cancelled = true; };
  }, [push.checked, push.mode, kinds.join()]);
  const arrival = useArrival(items !== undefined);
  const open = opener(go);
  const days = items ? inboxDays(items, new Date(), seen.current) : [];

  return (
    <section className="alerts">
      <h1 className="t32">알림</h1>
      {items !== null && push.mode !== "none" && <div className="alerts-main" ref={arrival}>
        {items === undefined ? null : !days.length ? <div className="ypl-empty"><p className="t15">최근 7일의 알림이 없습니다.</p></div>
          : days.map(({ day, items: list }) => <div className="alerts-day" key={day}>
            <p className="t12 dim push-label">{day}</p>
            <div className="stack">{list.map((item, i) => (
              <a key={i} href={item.url} onClick={follow(() => open(item.url))} className={"pn row row--2 alerts-row" + (item.unread ? "" : " read")}>
                <span className="row-main"><b className="t15">{item.body}</b><span className="t12 dim alerts-meta"><span>{kindLabel(item.kind)}</span><span>{item.time}</span></span></span>
                <span className="row-lamp">{item.unread && <i className="lamp" aria-label="새 알림" />}</span>
              </a>
            ))}</div>
          </div>)}
      </div>}
      <aside className="alerts-side"><PushBoard push={push} /></aside>
    </section>
  );
}
