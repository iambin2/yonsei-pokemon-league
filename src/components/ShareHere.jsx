import React, { useState } from "react";
import Button from "./common/Button.jsx";
import { shareLink } from "../services/communityStore.js";

/* 링크 공유 (2026-11-22): the sheet that is open now, as its own address (a trainer, a Pokémon, a title: each sheet writes its key into
   the address as it opens). A phone gets the share sheet, a computer the clipboard, and the button says so for a moment. */
export default function ShareHere({ title = "", className = "" }) {
  const [copied, setCopied] = useState(false);
  const share = async () => {
    const how = await shareLink(Object.fromEntries(new URLSearchParams(window.location.search)), title);
    if (how === "copied") { setCopied(true); setTimeout(() => setCopied(false), 2000); }
  };
  // className: the sheet's own space above a closing button (rc-more, tl-sheet-sec)
  return <div className={"share-here" + (className ? " " + className : "")}><Button variant="second" onClick={share}>{copied ? "복사 완료" : "링크 공유"}</Button></div>;
}
