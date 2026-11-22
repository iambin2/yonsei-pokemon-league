import React, { useState } from "react";
import Button from "./common/Button.jsx";
import { FormError } from "./common/Field.jsx";
import { siteConfirm } from "./common/SiteDialog.jsx";
import { deleteMyAccount, signOutVisitor, unlinkMyAccount } from "../services/visitorAuth.js";

/* the account's own keys wherever the account stands (내 기록 찾기, 더보기의 내 계정; 2026-11-22, the privacy policy's 제8조 in the
   visitor's hands): 로그아웃, then 기록 연결 해제 while a link stands and 계정 삭제, each asked once since neither is undone */
export default function AccountKeys({ link }) {
  const [note, setNote] = useState("");
  const run = async (ask, act) => {
    if (!(await siteConfirm(ask))) return;
    setNote("");
    try { await act(); } catch (error) { setNote(error?.message || "잠시 뒤 다시 시도해 주세요."); }
  };
  return <div className="stack rc-more">
    <Button variant="second" onClick={signOutVisitor}>로그아웃</Button>
    {link && <Button variant="link" onClick={() => run({ title: "기록 연결 해제", body: `${link.requested_name} 기록과 이 구글 계정의 연결을 풉니다. 대회 기록은 그대로 남고, 계정으로 다시 요청할 수 있습니다.`, confirmLabel: "연결 해제", danger: true }, unlinkMyAccount)}>기록 연결 해제</Button>}
    <Button variant="link" onClick={() => run({ title: "계정 삭제", body: "이 구글 계정과 계정에 저장한 팀, 도전의 탑 기록을 지우고 로그아웃합니다. 대회 기록은 리그 기록으로 남습니다. 되돌릴 수 없습니다.", confirmLabel: "계정 삭제", danger: true }, deleteMyAccount)}>계정 삭제</Button>
    {note && <FormError>{note}</FormError>}
  </div>;
}
