import { useEffect } from "react";

/* The tab's title names where one is (2026-11-16: every notice, post and trainer read "공지 | YPL", so the back list and a shared
   link's preview could not tell them apart): the thing open, then the page. App names the page; a page names what it has open. */
let page = "", item = "";
const apply = () => { const parts = [item, page].filter(Boolean); document.title = parts.length ? `${parts.join(" | ")} | YPL` : "Yonsei Pokémon League"; };
export function setPageTitle(label) { page = label || ""; apply(); }
export function useItemTitle(name) {
  useEffect(() => {
    if (!name) return undefined;
    item = String(name);
    apply();
    return () => { if (item === String(name)) { item = ""; apply(); } };
  }, [name]);
}
