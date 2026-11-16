/* History entries carry an index, so a back or forward move knows its direction (I3) and the scroll
   position it left (I4). Every page that pushes its own entry (an open bracket) goes through pushHistory, which keeps
   the index in step and remembers where the page it leaves was scrolled. backWith names the shared element the page
   wants to fly on the way back. */
let at = 0, hint = null;
const scrolls = {};
export const historyIndex = () => (Number.isInteger(window.history.state?.idx) ? window.history.state.idx : 0);
export function initHistory() {
  window.history.scrollRestoration = "manual";
  if (!Number.isInteger(window.history.state?.idx)) window.history.replaceState({ ...(window.history.state || {}), idx: 0 }, "");
  at = historyIndex();
}
/* A tab left open across a deploy keeps running the old build: the head script (vite.config.js) asks only when the page loads.
   So the page asks again when it comes back into view and every five minutes, and once a newer build is out, the next move
   within the site loads its address afresh instead of drawing it with the old code. window.__YPL_BUILD__ is set by the head
   script in a production build only; the dev server never asks. */
const BUILD = typeof window !== "undefined" ? window.__YPL_BUILD__ : null;
let newer = false, asked = 0;
// force: coming back into view always asks (it is rare and the answer is a few bytes); moves within the site ask once a minute
export function checkBuild(force = false) {
  if (!BUILD || newer || (!force && Date.now() - asked < 60_000)) return Promise.resolve(newer);
  asked = Date.now();
  return fetch(`${import.meta.env.BASE_URL}version.json?ts=${Date.now()}`, { cache: "no-store" })
    .then(r => (r.ok ? r.json() : null))
    .then(p => { if (typeof p?.version === "string" && p.version.trim() && p.version.trim() !== BUILD) newer = true; return newer; }, () => newer);
}
if (BUILD) {
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") void checkBuild(true); });
  setInterval(() => void checkBuild(), 5 * 60_000);
}

export function pushHistory(state, url) {
  // a newer build is out: the address is loaded afresh, on the new build
  if (newer) { window.location.assign(String(url)); return historyIndex(); }
  void checkBuild();
  scrolls[historyIndex()] = window.scrollY;
  at = historyIndex() + 1;
  /* a move made from inside a sheet takes the sheet's own entry, so going back from where it led comes back to the page the sheet
     stood on, not to a sheet already closed; the sheets standing are let go and keep no entry */
  if (window.history.state?.sheet) { open.length = 0; kept = 0; window.history.replaceState({ ...state, idx: at }, "", url); }
  else window.history.pushState({ ...state, idx: at }, "", url);
  return at;
}

/* ---------- a sheet is closed by back (2026-11-16) ----------
   On a phone back closed nothing: a sheet open over a page left the page under it. Now each sheet standing keeps one entry of
   its own on the address it opened on (state.sheet, its depth), as an app's sheet does: back closes the top one and the page
   stays. The entries are kept in step with the sheets a moment after they change, so a sheet replaced by another in one
   commit moves nothing; a sheet closed by its × or its veil takes its entry back with it. */
const open = [];      // the sheets standing, bottom first: { close }
let kept = 0;         // the entries pushed for them
let landing = null;   // while our own step back is on its way: the address the page had when it was taken
let queued = false;
function keep() {
  queued = false;
  if (landing !== null) return; // done again once the step back lands
  if (open.length > kept) {
    while (kept < open.length) { kept += 1; window.history.pushState({ ...(window.history.state || {}), sheet: kept }, ""); }
  } else if (open.length < kept) {
    landing = window.location.href;
    const n = kept - open.length;
    kept = open.length;
    window.history.go(-n);
  }
}
// a task later, not a microtask: a close asked for by back renders in React's next task, and the entry must not be pushed again first
const later = () => { if (!queued) { queued = true; setTimeout(keep, 0); } };
export function holdSheet(close) {
  const sheet = { close };
  open.push(sheet);
  later();
  return () => { const i = open.indexOf(sheet); if (i >= 0) { open.splice(i, 1); later(); } };
}
if (typeof window !== "undefined") {
  // an entry a sheet kept, reloaded: the sheet is gone, so it is the page's own again
  if (window.history.state?.sheet) { const { sheet, ...state } = window.history.state; window.history.replaceState(state, ""); }
  // capture: at the window this runs before App's own listener, which then never sees a move that only closed a sheet
  window.addEventListener("popstate", e => {
    if (landing !== null) {
      const href = landing;
      landing = null;
      e.stopImmediatePropagation();
      // the page's address as the close left it (a closed trainer's ?trainer= gone) goes down with it
      if (href !== window.location.href) window.history.replaceState(window.history.state, "", href);
      later();
      return;
    }
    const depth = window.history.state?.sheet || 0;
    if (depth < kept) {
      e.stopImmediatePropagation();
      const n = kept - depth;
      kept = depth;
      open.slice(-n).reverse().forEach(s => s.close?.());
      later(); // a sheet that would not close (a form asking first) gets its entry back
      return;
    }
    // forward onto the entry of a sheet already closed: the page's own
    if (depth > open.length) { const { sheet, ...state } = window.history.state; window.history.replaceState(state, ""); }
  }, { capture: true });
}
/* A page whose own state follows history (an open bracket) registers here instead of listening to popstate: App runs these
   inside the page transition, after the old screen is copied, so the page's change and the view land in one render. */
export const popHandlers = new Set();
export function backWith(shared) { hint = shared; window.history.back(); }
/* called once per popstate, before the page changes: where we were, where we are, where to scroll and the shared element to fly */
export function popped() {
  const from = at, to = historyIndex(), shared = hint;
  scrolls[from] = window.scrollY;
  at = to; hint = null;
  return { from, to, shared, scrollY: scrolls[to] || 0 };
}
