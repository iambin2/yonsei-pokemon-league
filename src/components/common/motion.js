/* Motion helpers. Pure CSS + Web Animations, no dependency (H5). Everything here moves by transform and opacity only, so it runs on the
   compositor and keeps its frames while the main thread draws the next page.
   Nothing here touches the DOM at import time: tests load components that import this file under Node. */

export const EASE_OUT = "cubic-bezier(.22,1,.36,1)";
export const EASE_IN = "cubic-bezier(.5,0,.75,0)";
// what moves from one place to another, or breathes (DESIGN.md "Battle", Time; the site's own pages never travel)
export const INOUT = "cubic-bezier(.65,0,.35,1)";

const mq = q => typeof window !== "undefined" && window.matchMedia?.(q).matches;
export const reduced = () => mq("(prefers-reduced-motion: reduce)");
export const desktop = () => mq("(min-width: 860px)");

/* one length for each verb of the motion law, the --t-* of tokens.css: press, tone, leave, light. */
export const DUR = { press: 100, tone: 160, leave: 260, light: 420 };
/* things that arrive together arrive one step apart: row is the page's reading order (38); display is the battle's and the tower's
   slower beat for a line-up or the marks of a floor (62) */
export const STAGGER = { row: 38, display: 62 };

/* ---------- the verbs of the motion law (DESIGN.md): pages and components move through these, never through their own .animate() ---------- */
/* place: what arrives switches on where it stands; nothing flies (DESIGN.md "Motion"). step spaces out what arrives together. */
export function place(els, { delay = 0, step = 0 } = {}) {
  if (reduced()) return;
  [].concat(els).forEach((el, i) => el?.animate([{ opacity: 0 }, { opacity: 1 }],
    { duration: DUR.tone, delay: Math.min(delay + i * step, DUR.light - DUR.tone), easing: EASE_OUT, fill: "backwards" }));
}
/* tone: a state changes in place (DESIGN.md "Motion"): what changed brightens once from dim to lit. A figure that switched, a word. */
export function tone(els) {
  if (typeof document === "undefined") return;
  [].concat(els).forEach(el => el?.animate?.([{ opacity: .382 }, { opacity: 1 }], { duration: DUR.tone, easing: EASE_OUT }));
}
/* light: a page is set (DESIGN.md "Motion", the almanac, 2026-11-24). What is in view comes on in reading order, one line 38 apart (the
   stagger stops growing at 260): a section's 2px rule draws in from the start edge first, then its head, then its entries; pictures last.
   Only ink rises: an entry's hairline stands in its place while the words on it rise the last 12, so two kinds of rule never move two
   ways. Things side by side on one line (a figure and its unit, a row of keys, chips, tabs) come on as one beat. What lies above or
   below the view is already lit: nothing waits dark for the scroll (2026-11-18, Made by people). */
const RISE = [{ opacity: 0, transform: "translateY(12px)" }, { opacity: 1, transform: "none" }];
const FADE = [{ opacity: 0 }, { opacity: 1 }];
const DRAW = [{ transform: "scaleX(0)" }, { transform: "none" }];
/* one thing of a page being set, its wait inside its own keyframes: a delay with backwards fill was drawn lit by the compositor until
   the delay ran out (measured 2026-11-24: a notice's keys and body stood lit for ~100 before going out and lighting), so the wait is the
   first stretch of the animation, held at its first frame */
function beat(el, kf, delay, length, pseudoElement) {
  const total = delay + length;
  const frames = delay ? [{ ...kf[0], offset: 0 }, { ...kf[0], offset: delay / total, easing: EASE_OUT }, { ...kf[1], offset: 1 }] : kf;
  return el.animate(frames, { duration: total, easing: delay ? "linear" : EASE_OUT, pseudoElement });
}
/* what comes on as one piece though it holds parts: an entry and the parts that are one entry, a key, a section's head, a back link */
const UNIT = ".pn, .pn2, .inv, .counter, .lead, .hof-crown, .btn, .sh, .back, [data-rise]";
const SKIP = "script, style, template, noscript, [hidden], [data-wait], .sheet";
const hasText = el => [...el.childNodes].some(n => n.nodeType === 3 && n.data.trim());
// one layer of a box-shadow, split on the commas between layers (not those inside rgb())
const layersOf = s => (s && s !== "none" ? s.split(/,(?![^(]*\))/).map(x => x.trim()) : []);
// a 2px inset rule along the top or the bottom edge (a hairline is 1px, a ring is 0 0)
const RULE = /\s0px (-?)([2-9]|\d{2,})px 0px 0px inset/;
const free = (el, p) => getComputedStyle(el, p).content === "none";
/* a section's 2px rule draws in from the start edge: for the length of the draw the rule is a pseudo-element of the box (.y-draw in
   tokens.css), scaled from 0 by transform, and the box's own shadow keeps its other lines */
const drawing = el => ({ pseudo: free(el, "::before") ? "::before" : free(el, "::after") ? "::after" : "", still: getComputedStyle(el).position === "static" });
function draw(el, layers, i, delay, { pseudo, still }) {
  if (!pseudo) return;
  const was = { boxShadow: el.style.boxShadow, position: el.style.position };
  el.style.boxShadow = layers.filter((_, k) => k !== i).join(", ") || "none";
  if (still) el.style.position = "relative";
  el.classList.add("y-draw");
  if (RULE.exec(layers[i])[1]) el.classList.add("end");
  if (pseudo === "::after") el.classList.add("aft");
  const a = beat(el, DRAW, delay, DUR.light, pseudo);
  a.finished.catch(() => {}).finally(() => { el.classList.remove("y-draw", "end", "aft"); Object.assign(el.style, was); });
}
/* root: an element or a list of them, lit as one page in their order. still: what a control left standing ([data-still], a dock, the
   main action) stays as it is. kept: the places stood while the content was read (a ranking, the last event), so their rules do not
   draw again and what stood in them ([data-kept], a table's head) stays; only what came into them lights. A number in place of the options is an older call's length and is not read. */
export function light(root, { still = false, kept = false } = {}) {
  const roots = [].concat(root).filter(el => el && typeof el.animate === "function");
  if (!roots.length || reduced()) return;
  /* what stands in a row the browser is skipping (content-visibility: auto, a long list's rows below the view) is not seen, and asking
     where it stands would lay each skipped row out for the answer (2026-11-10: the calculator's speed tab stood frozen 430 while its
     350 pictures were asked one by one) */
  const skipped = el => typeof el.checkVisibility === "function" && !el.checkVisibility({ contentVisibilityAuto: true });
  const height = innerHeight;
  /* every place is read before anything is written: a read after a write lays the whole new page out again, and the page was laid out
     four times over as it lit (2026-11-10, measured: a notice opening held one frame 57). Reading walks the page in its order: a part
     out of view is not entered, a unit stops the walk, a leaf (no element under it, or words of its own) is a unit of one */
  const items = [], pictures = [];
  const visit = el => {
    if (el.matches(SKIP) || (still && el.matches(STILL)) || (kept && el.hasAttribute("data-kept"))) return;
    // a box of display: contents is not visible by itself, though what it holds is
    if (skipped(el) && getComputedStyle(el).display !== "contents") return;
    const r = el.getBoundingClientRect();
    const box = r.width || r.height;
    if (box && (r.top >= height || r.bottom <= 0)) return;
    if (el.tagName === "IMG") { if (box && el.dataset.late == null) pictures.push(el); return; }
    const unit = el.matches(UNIT) || !el.firstElementChild || el instanceof SVGElement || hasText(el);
    const layers = layersOf(getComputedStyle(el).boxShadow);
    const rule = kept || el.matches(".inv") ? -1 : layers.findIndex(l => RULE.test(l));
    const how = rule >= 0 ? drawing(el) : null;
    if (box && (unit || rule >= 0)) items.push({ el, r, layers, rule, how, unit });
    if (!unit) for (const c of el.children) visit(c);
    else for (const img of el.getElementsByTagName("img")) visit(img);
  };
  roots.forEach(visit);
  // the beats: a new line of the page takes the next one; what stands beside the last thing on the same line takes its beat
  let line = -1, prev = null;
  for (const it of items) {
    const beside = prev?.unit && it.unit && (it.r.left >= prev.r.right - 1 || it.r.right <= prev.r.left + 1) && it.r.top < prev.r.bottom && it.r.bottom > prev.r.top;
    if (!beside) line++;
    it.delay = Math.min(line * STAGGER.row, DUR.leave);
    prev = it;
  }
  for (const { el, layers, rule, how, unit, delay } of items) {
    if (rule >= 0) draw(el, layers, rule, delay, how);
    if (!unit) continue;
    // a key is one piece, its outline and its fill with it; an entry keeps its line in place and only its ink rises
    if (el.matches(".btn") || !layers.length) beat(el, RISE, delay, DUR.light);
    else if (hasText(el) || !el.firstElementChild) beat(el, FADE, delay, DUR.light);
    else for (const c of el.children) if (c.tagName !== "IMG") beat(c, RISE, delay, DUR.light);
  }
  const last = Math.min((line + 1) * STAGGER.row, DUR.leave);
  pictures.forEach(img => beat(img, FADE, last, DUR.tone));
}

/* the home's cover on the first open of the site, its one scene of its own (DESIGN.md "Motion", The cover; the owner's draft A,
   2026-11-24): the masthead lights, the three rules draw in from the start edge three beats apart, the three words rise from the ninth
   beat, then the facts and keys light at the ends of their lines, and the Wing Y comes last. All on the 38 beat, by transform and opacity.
   A return to the home is an ordinary page change (light). */
export function coverOpen(root) {
  if (!root || reduced()) return;
  const BEAT = STAGGER.row;
  const q = sel => [...root.querySelectorAll(sel)];
  q(":scope > :not(.ho-name)").forEach(el => beat(el, FADE, BEAT, DUR.light));
  q(".ho-entry").forEach((el, i) => beat(el, DRAW, i * BEAT * 3, DUR.light * 2, "::after"));
  q(".ho-fig > span").forEach((el, i) => beat(el, RISE, BEAT * 9 + i * BEAT * 3, DUR.light));
  q(".ho-fact").forEach((el, i) => beat(el, FADE, BEAT * 21 + i * BEAT * 3, DUR.light));
  q(".ho-wing").forEach(el => beat(el, FADE, BEAT * 25, DUR.light * 2));
}

/* the line under the chosen word of a row of words (the top bar's pages, page tabs) belongs to the word: it is the word's own ::before,
   exactly the word's width wherever fonts, zoom or the window take it. A change of word only animates it: the new word's line starts
   where the old one stood and settles into place by transform. Nothing is measured once and kept.
   A row is remembered by its name, so a page that draws its tabs afresh on a change of tab (the board, the brackets) still slides its
   line; a row that leaves forgets its line, so coming back to the page places it without moving. Returns whether the word changed. */
const lastLine = new Map();
// a row that never redraws for a change of word and may share its name with another on the page (a Segmented choice) keeps itself as its key
const lineKey = row => (row.hasAttribute("data-own-line") ? row : row.getAttribute("aria-label") || row);
export function slideLine(row) {
  const cur = row?.querySelector(':scope > :is([aria-current="page"], [data-current], [aria-selected="true"])');
  if (!cur) return false;
  // measured from the line itself (its ::before), wherever the stylesheet places it inside the word's room
  const line = getComputedStyle(cur, "::before");
  const now = { left: cur.offsetLeft + (parseFloat(line.left) || 0), width: parseFloat(line.width) || cur.offsetWidth, row };
  const was = lastLine.get(lineKey(row));
  lastLine.set(lineKey(row), now);
  const moved = Boolean(was && now.width && (was.left !== now.left || was.width !== now.width));
  if (!moved || reduced() || typeof cur.animate !== "function") return moved;
  try {
    cur.animate([{ transform: `translateX(${was.left - now.left}px) scaleX(${was.width / now.width})` }, { transform: "none" }],
      { duration: DUR.light, easing: EASE_OUT, pseudoElement: "::before" });
  } catch { /* a browser without pseudo-element animation shows the line in place */ }
  return moved;
}
/* the chosen one's rule among chips, choices, option rows and steps (its ::before, board.css) draws in from the start edge in a tone
   when the choice changes, while its words tone with it; the first placing stands */
export function drawRule(el) {
  if (!el?.animate || reduced()) return;
  try { el.animate(DRAW, { duration: DUR.tone, easing: EASE_OUT, pseudoElement: "::before" }); } catch { /* the rule stands in place */ }
}
/* a row that unmounts forgets its line a beat later, unless the line was placed again meanwhile: by a row of the same name in the same
   commit, or by the same row mounting again (StrictMode's trial unmount) */
export function forgetLine(row) {
  if (!row) return;
  const key = lineKey(row), placed = lastLine.get(key);
  setTimeout(() => { if (placed?.row === row && lastLine.get(key) === placed) lastLine.delete(key); });
}

/* sampled at 120 a second so a 120Hz screen gets a real frame each refresh, not a straight line between two */
const FPS = 120;
/* a damped spring that starts with the velocity the finger left it with (H5) */
export function springTo(from, to, v0, response = 0.42, zeta = 0.86) {
  const w0 = (2 * Math.PI) / response, wd = w0 * Math.sqrt(1 - zeta * zeta), A = from - to, B = (v0 + zeta * w0 * A) / wd, amp = Math.hypot(A, B), out = [];
  for (let t = 0; t < 2; t += 1 / FPS) {
    const e = Math.exp(-zeta * w0 * t);
    out.push(to + e * (A * Math.cos(wd * t) + B * Math.sin(wd * t)));
    if (t > 0.05 && e * amp < 0.4) break;
  }
  out.push(to);
  return { values: out, duration: ((out.length - 1) * 1000) / FPS };
}

/* ---------- page change (DESIGN.md "Motion"): the old content goes at once; the new page is set in reading order as on first open.
   Going back sets the page it returns to the same way, where it was left (2026-11-06: a back that only swapped the page read as a cut,
   so in and out are one motion). The bars never move. ---------- */
const main = () => document.getElementById("ypl-main");
/* mutate() must render the next page synchronously (flushSync). scrollY is where the new page starts. Callers still pass dir and
   shared; neither is read. */
export function transition(mutate, { scrollY: nextY = 0 } = {}) {
  mutate();
  window.scrollTo(0, nextY);
  light(main());
}

/* ---------- theme change: the page turns in one frame and a light wash of the old ground (.382) leaves it over a tone, so the change
   reads as the page turning without dwelling in the muddy middle of navy over white. Nothing is restyled frame by frame. The theme
   button's sun and moon turn in. Reduced motion turns in one frame. ---------- */
let themeTimer = 0;
export function themeTurn(commit) {
  const root = document.documentElement;
  if (reduced()) {
    root.classList.add("theme-turn");
    commit();
    requestAnimationFrame(() => root.classList.remove("theme-turn"));
    return;
  }
  // the page turns in one frame; a wash of the old ground lies over it and clears (opacity only, one layer, on the compositor)
  const old = getComputedStyle(root).getPropertyValue("--ground").trim();
  clearTimeout(themeTimer);
  root.classList.add("theme-fade");
  commit();
  const wash = document.createElement("div");
  wash.className = "theme-wash";
  wash.style.background = old;
  document.body.appendChild(wash);
  wash.animate([{ opacity: .382 }, { opacity: 0 }], { duration: DUR.tone, easing: EASE_OUT, fill: "forwards" }).finished.finally(() => wash.remove());
  themeTimer = setTimeout(() => root.classList.remove("theme-fade"), DUR.light);
}

/* what follows a control that swaps the content under it (page tabs, filter chips) is set again, as a page is: everything after it in
   the page, at every level up to the page itself, in one reading order. Only what changed comes on (2026-11-23 audit, F-04): the search
   field and the main action under the tabs or chips stay as they stand ([data-still], a dock, a main action). */
const STILL = "[data-still], .dock, .btn--main";
export function lightAfter(el) {
  const after = [];
  for (let at = el; at && at.id !== "ypl-main" && !at.matches(".modal"); at = at.parentElement)
    for (let n = at.nextElementSibling; n; n = n.nextElementSibling) after.push(n);
  light(after, { still: true });
}

/* ---------- verbs that return a promise settling when the verb is over, so a scene can run one beat at a time ---------- */
// A hidden page (another app on the phone, a background tab) stops the animation clock, and a turn must not wait on it forever:
// past its own length a verb is over, and it is put at its end.
function settled(anim) {
  if (!anim?.finished) return Promise.resolve();
  const length = anim.effect?.getComputedTiming?.().endTime || DUR.light;
  let timer;
  const late = new Promise(resolve => { timer = setTimeout(resolve, length + DUR.press); });
  return Promise.race([anim.finished, late]).then(() => {}, () => {}).finally(() => {
    clearTimeout(timer);
    try { if (anim.playState !== "finished") anim.finish(); } catch { /* cancelled already */ }
  });
}
/* fall: a Pokémon faints, it sinks 12 as it goes dark, the reverse of light */
export function fall(mon) {
  if (!mon?.animate || reduced()) return Promise.resolve();
  return settled(mon.animate([{ opacity: 1, transform: "none" }, { opacity: 0, transform: "translateY(12px)" }], { duration: DUR.leave, easing: EASE_IN, fill: "forwards" }));
}
/* the screen being left goes all the way out, from wherever its dimming stands, the moment before the next one takes its place (the
   battle's going in and going back, 2026-11-09): returns the animations, so the next screen can let them go as it lights */
export function goOut(els) {
  if (reduced()) return [];
  return [].concat(els).filter(Boolean).map(el => el.animate([{ opacity: getComputedStyle(el).opacity }, { opacity: 0 }], { duration: DUR.leave, easing: EASE_IN, fill: "forwards" }));
}
/* one set of keys hands its place to another (the moves to the target picker and back, 2026-11-09): what is left dims to the locked
   keys' light (press length), and what comes up starts from that light, so the swap is never lit keys vanishing in one frame */
export function handOff(els) {
  if (reduced()) return Promise.resolve();
  return Promise.all([].concat(els).filter(Boolean).map(el => settled(el.animate([{ opacity: getComputedStyle(el).opacity }, { opacity: .382 }], { duration: DUR.press, easing: EASE_IN, fill: "forwards" }))));
}
/* the team preview arrives as a scene of its own (DESIGN.md "Battle", Going in): the other side's six switch on one after another,
   62 apart, as a board announces a line-up, then a beat, then ours rise into their places the same way. first, then: the elements in
   the order they light (a place may be empty: what is drawn a moment later takes its turn with elapsed, the time since the scene began).
   still: one of them that lights without rising (the last part of a column that scrolls: 12 under its place it reaches out of the
   column and draws its scrollbar). Reduced motion: they stand at once. */
export function lineup(first, then, elapsed = 0, still = null) {
  if (reduced()) return;
  [...first, ...then].forEach((el, i) => el?.animate?.(el === still ? [{ opacity: 0 }, { opacity: 1 }] : RISE, { duration: DUR.light, delay: Math.max(0, i * STAGGER.display + (i >= first.length ? DUR.tone : 0) - elapsed), easing: EASE_OUT, fill: "backwards" }));
}
/* a 도전의 탑 run climbs (Streak.jsx): once the streak's figure has switched (light), the game just won draws its 2px rule in from the
   left over its hairline (the rule is the game's ::after, 420), and then the next game's rule tones to dim (160). A game is a track
   bar's step (tower-play.css .streak-track-bar); a browser that cannot animate a pseudo-element moves the step itself */
export function climb(won, next) {
  if (reduced()) return;
  const on = (el, keys, o) => {
    if (!el?.animate) return;
    try { el.animate(keys, { ...o, pseudoElement: "::after" }); } catch { el.animate(keys, o); }
  };
  [].concat(won).forEach(el => on(el, [{ transform: "scaleX(0)" }, { transform: "none" }], { duration: DUR.light, delay: DUR.light, easing: EASE_OUT, fill: "backwards" }));
  [].concat(next).forEach(el => on(el, [{ opacity: 0 }, { opacity: 1 }], { duration: DUR.tone, delay: DUR.light * 2, easing: EASE_OUT, fill: "backwards" }));
}

/* into a sheet: the pressed row stays where it is, and the sheet's title lights a beat after the sheet starts to rise */
export function settleTitle(target) {
  if (!target || reduced() || typeof target.animate !== "function") return;
  target.animate([{ opacity: 0 }, { opacity: 1 }], { duration: DUR.tone, delay: DUR.press, easing: EASE_OUT, fill: "backwards" });
}
