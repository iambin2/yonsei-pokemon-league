import React, { useEffect, useState } from "react";
import { currentPushMode, disablePush, enablePush, isPushOn, readPushKinds, savePushKinds } from "../../services/announcementPush.js";
import { PUSH_KINDS, toggleKind } from "../../services/announcementPushPolicy.js";
import Button from "./Button.jsx";
import Icon from "./Icon.jsx";
import Modal from "./Modal.jsx";
import { siteAlert } from "./SiteDialog.jsx";

/* 알림: 켜기 전에 이유를 먼저 말하는 시트를 띄우고, 끄기는 바로 한다.
   공지 화면은 12px 단어(PushLink)로, 더보기는 스위치 줄(PushSwitch)로 같은 상태를 쓴다.
   켜져 있고 docs/db/push_kinds.sql 이 실행된 뒤면 더보기는 종류마다 스위치 줄을 더 세운다(docs/PUSH.md). 그 전에는 공지 알림 하나다. */
function usePush(title) {
  const [mode] = useState(currentPushMode);
  const [on, setOn] = useState(false); const [busy, setBusy] = useState(mode === "ready"); const [ask, setAsk] = useState(false);
  const [fail, setFail] = useState("");
  // { kinds, linked } once the device is on and the server knows kinds; null otherwise
  const [kinds, setKinds] = useState(null);
  const loadKinds = () => readPushKinds().then(setKinds, error => { console.error(error); setKinds(null); });
  useEffect(() => {
    if (mode !== "ready") return undefined;
    let cancelled = false;
    isPushOn()
      .then(value => { if (cancelled) return; setOn(value); if (value) return readPushKinds().then(k => { if (!cancelled) setKinds(k); }); })
      .catch(console.error).finally(() => { if (!cancelled) setBusy(false); });
    return () => { cancelled = true; };
  }, [mode]);
  /* a failure while the sheet stands is said in the sheet, in the key's place: a sheet never opens a dialog over itself
     (DESIGN.md "Sheets"; 2026-11-10: 알림 설정을 바꾸지 못했습니다 rose over the sheet that had asked) */
  const flip = async () => {
    setBusy(true); setFail("");
    try {
      if (on) { await disablePush(); setKinds(null); } else { await enablePush(); loadKinds(); }
      setOn(!on); setAsk(false);
    }
    catch (error) { const why = error?.message || "잠시 뒤 다시 시도해 주세요."; if (ask) setFail(why); else siteAlert("알림 설정을 바꾸지 못했습니다.", why); }
    finally { setBusy(false); }
  };
  const press = () => {
    if (mode === "unsupported") return siteAlert("이 브라우저에서는 알림을 켤 수 없습니다.", "카카오톡이나 디스코드 안에서 열었다면 최신 Chrome이나 Safari에서 다시 열어 주세요.");
    if (on) return flip();
    setFail(""); setAsk(true);
  };
  const pressKind = async ({ kind, personal }) => {
    if (personal && !kinds.linked) return siteAlert("구글 계정으로 로그인한 기기에서 받습니다.", "내 기록에서 구글 계정으로 로그인한 뒤 다시 켜 주세요.");
    setBusy(true);
    try { setKinds(await savePushKinds(toggleKind(kinds.kinds, kind))); }
    catch (error) { siteAlert("알림 설정을 바꾸지 못했습니다.", error?.message || "잠시 뒤 다시 시도해 주세요."); }
    finally { setBusy(false); }
  };
  // notifications already refused in the browser: the key could only fail, so the sheet says what to do instead of offering it
  const blocked = mode === "ready" && typeof Notification !== "undefined" && Notification.permission === "denied";
  const say = mode === "install" ? "아이폰과 아이패드는 Safari의 공유 버튼에서 홈 화면에 추가한 뒤, 그 앱의 공지 화면에서 알림을 켤 수 있습니다."
    : blocked ? "브라우저 설정에서 이 사이트의 알림을 허용해 주세요." : fail;
  const sheet = ask && <Modal title={title} onClose={() => setAsk(false)}>
    <div className="push-ask">
      {say && <p className="pn2 push-note t12 reg dim" role={mode === "install" ? undefined : "alert"}><Icon n="info" size={20} /><span>{say}</span></p>}
      {mode === "ready" && !blocked && <Button variant="main" icon="bell" disabled={busy} onClick={flip}>알림 받기</Button>}
      <Button variant="link" className="push-later" onClick={() => setAsk(false)}>나중에</Button>
    </div>
  </Modal>;
  return { mode, on, busy, press, sheet, kinds, pressKind };
}

export function PushLink() {
  const { mode, on, busy, press, sheet } = usePush("새 공지를 알림으로 받습니다.");
  if (mode === "none") return null;
  return <><button type="button" className="push-link t12" disabled={busy} onClick={press}><Icon n="bell" size={16} />{on ? "알림 끄기" : "알림 받기"}</button>{sheet}</>;
}

/* a switch row: 52 by 32, off a muted square in panel-2, on inverted with the square at the right */
const SwitchRow = ({ label, on, disabled, onClick }) => (
  <button type="button" className="pn row switch-row" role="switch" aria-checked={on} disabled={disabled} onClick={onClick}>
    <span className="row-main"><b className="t15">{label}</b></span>
    <span className={"sw" + (on ? " on" : "")} aria-hidden="true"><i /></span>
  </button>
);

// 더보기: the device's switch, then one switch for each kind while it is on (a personal kind stands off on a device with no account)
export function PushSwitch() {
  const { mode, on, busy, press, sheet, kinds, pressKind } = usePush("새 소식을 알림으로 받습니다.");
  if (mode === "none") return null;
  return <>
    <SwitchRow label={kinds ? "알림" : "공지 알림"} on={on} disabled={busy} onClick={press} />
    {on && kinds && PUSH_KINDS.map(k => (
      <SwitchRow key={k.kind} label={k.label} on={kinds.kinds.includes(k.kind) && (!k.personal || kinds.linked)} disabled={busy} onClick={() => pressKind(k)} />
    ))}
    {sheet}
  </>;
}
