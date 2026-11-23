import React, { useState } from "react";
import { Row } from "./common/Board.jsx";
import Icon from "./common/Icon.jsx";
import { FormError } from "./common/Field.jsx";
import { siteConfirm } from "./common/SiteDialog.jsx";
import { GoogleMark } from "./layout/SiteHeader.jsx";
import { deleteMyAccount, signOutVisitor, unlinkMyAccount } from "../services/visitorAuth.js";

const LINKED = { approved: "기록 연결됨", pending: "연결 확인 중" };

/* the account's own keys wherever the account stands (내 기록 찾기, a trainer's sheet, 더보기의 내 계정; 2026-11-22, the privacy
   policy's 제8조 in the visitor's hands). The owner's draft B (2026-11-23: three underlined words "덩그러니"): the Google account as an
   inverted card (its G, its address, what it holds) beside three rows, each its act, what it means and its mark at the end: 로그아웃,
   기록 연결 해제 while a link stands, 계정 삭제 dim, the last two asked once since neither is undone. bare: the rows only, where the
   account already stands as a row above them (더보기). */
export default function AccountKeys({ link, bare = false }) {
  const [note, setNote] = useState("");
  const run = async (ask, act) => {
    if (!(await siteConfirm(ask))) return;
    setNote("");
    try { await act(); } catch (error) { setNote(error?.message || "잠시 뒤 다시 시도해 주세요."); }
  };
  const rows = <div className="stack acct-rows">
    <Row title="로그아웃" line="이 기기에서만" value={<Icon n="logout" size={20} />} onClick={signOutVisitor} />
    {link && <Row title="기록 연결 해제" line="대회 기록은 남습니다." value={<Icon n="link" size={20} />}
      onClick={() => run({ title: "기록 연결 해제", body: `${link.requested_name} 기록과 이 구글 계정의 연결을 풉니다. 대회 기록은 그대로 남고, 계정으로 다시 요청할 수 있습니다.`, confirmLabel: "연결 해제", danger: true }, unlinkMyAccount)} />}
    <Row className="acct-delete" title="계정 삭제" line="되돌릴 수 없습니다." value={<Icon n="trash" size={20} />}
      onClick={() => run({ title: "계정 삭제", body: "이 구글 계정과 계정에 저장한 팀, 도전의 탑 기록을 지우고 로그아웃합니다. 대회 기록은 리그 기록으로 남습니다. 되돌릴 수 없습니다.", confirmLabel: "계정 삭제", danger: true }, deleteMyAccount)} />
  </div>;
  return <div className={"acct-keys" + (bare ? " bare" : "")}>
    {!bare && <div className="inv acct-card">
      <span className="acct-card-g"><GoogleMark /><span className="t12">구글 계정</span></span>
      <span className="acct-card-who">
        <b className="t15">{link?.email || "로그인됨"}</b>
        {link && <span className="t12">{link.requested_name} {LINKED[link.status] || ""}</span>}
      </span>
    </div>}
    {rows}
    {note && <FormError>{note}</FormError>}
  </div>;
}
