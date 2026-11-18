import { useEffect, useState } from "react";
import { VISITOR_EVENT, accountsReady, myPlayerLink, visitorSignedIn } from "../../services/visitorAuth.js";

/* 로그인한 방문자의 트레이너: 계정이 운영진 승인으로 기록에 연결되었을 때만 { name, playerId }, 아니면 null.
   로그인과 로그아웃(VISITOR_EVENT)에 따라 다시 읽는다. 홈의 내 다음과 기록의 나 태그가 같은 답을 읽는다.
   지난 방문의 답을 첫 그림부터 쓴다: 내 다음이 한 번 오간 뒤에 서서 그 아래를 밀지 않는다(accountsKnown과 같은 까닭). */
const KEY = "ypl-me";
const saved = () => { try { return visitorSignedIn() ? JSON.parse(localStorage.getItem(KEY) || "null") : null; } catch { return null; } };
const keep = me => { try { me ? localStorage.setItem(KEY, JSON.stringify(me)) : localStorage.removeItem(KEY); } catch { /* 다음에 다시 읽는다 */ } };

export function useMe() {
  const [me, setMe] = useState(saved);
  useEffect(() => {
    let on = true;
    const sync = () => {
      if (!visitorSignedIn()) { keep(null); setMe(null); return; }
      accountsReady().then(ok => (ok ? myPlayerLink() : null)).then(row => {
        const next = row?.status === "approved" && row.player_id ? { name: row.requested_name, playerId: row.player_id } : null;
        keep(next);
        if (on) setMe(prev => (prev?.playerId === next?.playerId && prev?.name === next?.name ? prev : next));
      }, () => {});
    };
    sync();
    window.addEventListener(VISITOR_EVENT, sync);
    return () => { on = false; window.removeEventListener(VISITOR_EVENT, sync); };
  }, []);
  return me;
}

/* the signed-in visitor's account as it stands: { requested_name, status, player_id, email }, { status: "none" } before a request,
   null signed out, undefined while it is read. 도전의 탑 and the board's 계정 이름으로 쓰기 read it */
export function useAccount() {
  const [account, setAccount] = useState(undefined);
  useEffect(() => {
    const read = () => (visitorSignedIn() ? myPlayerLink().then(a => setAccount(a || { status: "none" }), () => setAccount(null)) : setAccount(null));
    read();
    window.addEventListener(VISITOR_EVENT, read);
    return () => window.removeEventListener(VISITOR_EVENT, read);
  }, []);
  return account;
}
