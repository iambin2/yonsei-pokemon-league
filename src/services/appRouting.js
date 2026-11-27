export const APP_VIEWS = new Set(["home", "about", "news", "board", "records", "bracket", "builder", "titles", "champions", "calc", "more", "battle", "privacy", "alerts", "admin",
  // dev-only tools: BattleLabPage.jsx and DevKitPage.jsx exist on the dev server only
  ...(import.meta.env?.DEV ? ["lab", "dev-kit"] : [])]);

/* 사이트는 base 경로 하나뿐이다. base 밖(개발 서버 외의 환경)은 판단하지 않는다. */
export function isUnknownPath(pathname, base) {
  return pathname.startsWith(base) && !["", "index.html"].includes(pathname.slice(base.length));
}

/* ?view= 에 없는 화면 이름(옛 링크, 잘못 친 주소)은 홈으로 조용히 바꾸지 않고 404 를 보인다. view 가 없으면 홈이다. */
export function isUnknownView(search = "") {
  const requested = new URLSearchParams(search).get("view");
  return requested != null && !APP_VIEWS.has(requested);
}

export function readInitialAppView(search = "") {
  const requested = new URLSearchParams(search).get("view");
  return APP_VIEWS.has(requested) ? requested : "home";
}

export function builderRouteSearch(eventId, search = "") {
  const params = new URLSearchParams(search);
  params.set("view", "builder");
  if (eventId) params.set("eventId", eventId);
  else params.delete("eventId");
  return `?${params.toString()}`;
}

export function bracketRouteSearch(eventId, search = "") {
  const params = new URLSearchParams(search);
  params.set("view", "bracket");
  if (eventId) params.set("eventId", eventId);
  else params.delete("eventId");
  return `?${params.toString()}`;
}

export const VIEW_RESET_PARAMS = ["eventId", "notice", "trainer", "pokemon", "title", "gen", "m", "tab", "format", "post", "pb", "id", "event", "match", "team", "me"];
export const BUILDER_ONLY_PARAMS = ["reg", "cup", "type"];
export const BATTLE_ONLY_PARAMS = ["id", "event", "match", "team"];

/* Single source of truth for query-string serialization shared by App.jsx go() and viewHref(). */
export function buildViewSearch(v, o = {}, currentSearch = "") {
  if ((v === "builder" || v === "bracket") && o.eventId) {
    if (v === "builder") {
      const p = new URLSearchParams();
      p.set("view", "builder");
      p.set("eventId", o.eventId);
      return `?${p.toString()}`;
    }
    const p = new URLSearchParams(currentSearch);
    BATTLE_ONLY_PARAMS.forEach(key => p.delete(key));
    p.set("view", "bracket");
    p.set("eventId", o.eventId);
    if (o.m) p.set("m", o.m);
    else p.delete("m");
    return `?${p.toString()}`;
  }
  const p = new URLSearchParams(currentSearch);
  VIEW_RESET_PARAMS.forEach(key => p.delete(key));
  if (v !== "builder") BUILDER_ONLY_PARAMS.forEach(key => p.delete(key));
  if (v === "home") p.delete("view");
  else p.set("view", v);
  if (v === "news" && o.notice) p.set("notice", o.notice);
  if (v === "battle" && o.battle) p.set("id", o.battle);
  if (v === "records" && o.trainer) p.set("trainer", o.trainer);
  if (v === "records" && o.me) p.set("me", "1");
  if (["records", "board", "bracket", "battle"].includes(v) && o.tab) p.set("tab", o.tab);
  if (v === "board" && o.post) p.set("post", o.post);
  if (v === "board" && o.format === "double") p.set("format", "double");
  if (v === "bracket" && o.pb) p.set("pb", o.pb);
  const q = p.toString();
  return q ? `?${q}` : "";
}

/* The address a door leads to, as App's go() writes it (2026-11-16: every door was a button with no address, so it could not be
   opened in a new tab, copied by a long press or found by a search engine). A door is a link with this href; a plain click is
   still App's own move (follow, Board.jsx), so nothing about how the site moves changes. */
export function viewHref(v, o = {}) {
  const base = import.meta.env?.BASE_URL || "/";
  const search = buildViewSearch(v, o, "");
  return search ? `${base}${search}` : base;
}
