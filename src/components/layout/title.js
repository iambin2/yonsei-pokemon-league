import { useEffect } from "react";

/* The tab's title names where one is (2026-11-16: every notice, post and trainer read "공지 | YPL", so the back list and a shared
   link's preview could not tell them apart). One form since 2026-11-24 (the owner's draft A, after Apple and GitHub): what one is looking
   at, then the one brand, "칭호 – YPL"; a thing open takes the page's place, "38회 파이컵 공지 – YPL"; only home leads with the brand.
   App names the page; a page names what it has open. */
export const HOME_TITLE = "YPL – 포켓몬 센터 연세점 배틀 리그";
export const titled = (what) => `${what} – YPL`;
let page = "", item = "";
const apply = () => { const what = item || page; document.title = what ? titled(what) : HOME_TITLE; };
export function setPageTitle(label) { page = label || ""; apply(); }
export function useItemTitle(name) {
  useEffect(() => {
    if (!name) return undefined;
    item = String(name);
    apply();
    return () => { if (item === String(name)) { item = ""; apply(); } };
  }, [name]);
}
