/* 도전의 탑's tower (DESIGN.md "Battle", 도전의 탑, The tower, the tenth pass). The tower is a place under one camera (towerGL.js): a
   round tower whose terrace winds up round it, a floor a turn, a game a door on that road, standing on its plaza among a wood
   under a sea of cloud and a moon. The camera always stands before the door of the game the run is on. This file keeps the scene
   round the model: the climbers' marks, and the scene's moves, each a move of the model's camera or a change of its doors' light,
   never a picture slid or laid over:
     0. coming to the tab: the camera comes down and round from the whole tower to the run's door while the doors won light in turn;
     1. between games the tower comes up over the stage as the camera settles before the door;
     2. a game won: its lamp goes out (the room cools to warm), the camera walks the terrace to the next door, a fifth of a turn
        round and up, and that door's lamp switches on. A lamp never moves; after a gatekeeper the next door is the next floor's first;
     3. when the game is made and read, the camera comes to stand before the amber door, then walks in through its arch into the
        room, whose dark becomes the stage's own ground;
     4. that dark outlives the screen, goes to the next screen's stage, and the next screen comes up out of it.
   At rest the cloud drifts, and the tab's tower turns under a hand and comes back. Until the camera is in, the scene is inside the stage it was called on, so it scrolls with its page.
   Reduced motion: the tower stands, then a cut (2026-11-11, the user: the going in was "너무 빨라서 뭐가 뭔지도 모르겠어", and coming
   to the tab "그냥 로딩되는 느낌"; 2026-11-16: the lamp's light running from door to door, "빛이 이동하는 경로가 전부 보여", and the
   tower alone in an empty night, "가상의 요소처럼 느껴져서 몰입이 깨져") */
import { DUR, EASE_IN, EASE_OUT, INOUT, STAGGER, reduced } from "../../components/common/motion.js";
import { sfx } from "./sfx.js";
import { ND, PITCH, RR, RW, buildModel, cameraOf, doorPoint, mixView, paletteOf, prebuildModel, render, topOf, viewOf, warmTower } from "./towerGL.js";

// the model's context and programs, and the tower's mesh in the theme's tones (a piece at a time), made in idle moments after the
// battle page loads this module, so the tab's tower comes in without waiting for them
if (typeof window !== "undefined") (window.requestIdleCallback || (f => setTimeout(f, 200)))(() => {
  warmTower();
  const host = document.querySelector(".ypl");
  if (!host) return;
  const el = Object.assign(document.createElement("div"), { className: "tw", hidden: true });
  host.appendChild(el); void prebuildModel(topOf(1), paletteOf(el)); el.remove();
}, { timeout: 2000 });

/* the battle's lengths are the phi steps 62, 100, 160, 260, 420, 680, 1100, 1780, 2880 (DESIGN.md "Battle", Time), and its curves three:
   EASE_OUT for what arrives, EASE_IN for what leaves, INOUT for what moves from place to place; linear only measures time */
const MOVE = 420, BEAT = 260, READ = 420, WALK = 1100, DIVE = 1100, ENTRANCE = 1780, ARRIVE = 1100;
const NEXT = 0.382;
// a CSS cubic-bezier as a function of time, for the moves drawn frame by frame (x solved by Newton's steps, then bisection)
const bezier = (x1, y1, x2, y2) => {
  const at = (a, b, t) => ((1 - 3 * b + 3 * a) * t + (3 * b - 6 * a)) * t * t + 3 * a * t;
  return x => {
    if (x <= 0 || x >= 1) return Math.min(1, Math.max(0, x));
    let t = x;
    for (let i = 0; i < 8; i++) {
      const d = 3 * (1 - 3 * x2 + 3 * x1) * t * t + 2 * (3 * x2 - 6 * x1) * t + 3 * x1, e = at(x1, x2, t) - x;
      if (Math.abs(e) < 1e-5) return at(y1, y2, t);
      if (Math.abs(d) < 1e-6) break;
      t -= e / d;
    }
    let lo = 0, hi = 1;
    for (t = x; hi - lo > 1e-5; t = (lo + hi) / 2) { if (at(x1, x2, t) < x) lo = t; else hi = t; }
    return at(y1, y2, t);
  };
};
const curve = css => bezier(...css.match(/[\d.]+/g).map(Number));
const inout = curve(INOUT), out3 = curve(EASE_OUT);
const linear = t => t;
const pause = n => new Promise(resolve => setTimeout(resolve, n));
const settled = anim => anim.finished.catch(() => {});
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const fade = (x, from, to, duration, o = {}) => settled(x.animate([{ opacity: from }, { opacity: to }], { duration, easing: EASE_OUT, fill: "both", ...o }));
let scene = null;           // the tower called on a stage: { el, own } (own: made for the call, not the tab's hall)
let car = null;             // the dark the camera walked into, fixed over the window: { el }
let left = [];              // the going out of the screen the camera walked out of, let go when the next one stands
const letGo = () => { left.forEach(a => a.cancel()); left = []; };
const f1 = n => n.toFixed(1);

/* ---------- the picture ---------- */
// the door a state stands before, along the road: at 0 (none yet) and 1 the floor's first, 6 (the floor won whole) the next floor's first
const doorOf = st => Math.min(ND - 1, (st.floor - 1) * 5 + Math.min(5, Math.max(0, st.at - 1)));
/* each door's light for a state: 0 dark, .382 the next game while the run rests, 1 won, 2 gone into */
function doorsOf(st) {
  const v = new Float32Array(ND), k = doorOf(st);
  v.fill(1, 0, k);
  if (st.at >= 1 && st.at <= 5 && !st.hold) v[k] = st.live ? 2 : NEXT;
  return v;
}
const mixc = (a, b, t) => a.map((x, i) => x + (b[i] - x) * t);
// the climbers in sight of a state's door, each at the door they stand before: [{ c, k }]
const othersOf = st => (st.climbers || []).map(c => ({ c, k: Math.min(ND - 1, c.wins) })).filter(o => Math.abs(o.k - doorOf(st)) < 14).slice(0, 3);
/* the lamps: the lit rooms near the door stood before, the road's six while the camera is low enough to see them, and the other
   climbers' lanterns on the parapet where each stands. On the stone: [x, y, z, reach, r, g, b, strength]; in the air: [x, y, z,
   size, r, g, b] */
function lampsOf(tw) {
  const lights = [], glows = [], { doors, pal } = tw, k0 = Math.round(tw.s), dim = pal.light ? .5 : 1;
  for (let k = Math.min(ND - 1, k0 + 1); k >= Math.max(0, k0 - 8); k--) {
    // under zero: the amber coming on from the dark (step)
    const raw = doors[k], v = raw < 0 ? 1 - raw : raw;
    if (v <= .01) continue;
    const on = raw < 0 ? -raw : Math.max(0, v - 1), col = mixc(pal.warm, pal.amber, on), p = doorPoint(k, RW + .1, .16), gate = k % 5 === 4;
    const amount = raw < 0 ? -raw : Math.min(1, v);
    lights.push([...p, gate ? .62 : .46, ...(raw < 0 ? pal.amber : col), amount * (.5 + .35 * on)]);
    glows.push([...p, .9 + .5 * on, ...(raw < 0 ? pal.amber : col).map(x => x * amount * (.12 + .3 * on) * dim)]);
  }
  for (const o of othersOf(tw.st)) {
    const p = doorPoint(o.k, RR - .03, .14);
    lights.push([...p, .34, ...pal.warm, .6]);
    glows.push([...p, .5, ...pal.warm.map(x => x * .34 * dim)]);
  }
  if (tw.s < 16) for (const sx of [-.66, .66]) for (let j = 0; j < 3; j++) {
    const p = [sx, .13, 2.9 + 1.4 * j];
    lights.push([...p, 1.5, ...pal.warm, pal.light ? .2 : .42]);
    glows.push([...p, .45, ...pal.warm.map(x => x * .3 * dim)]);
  }
  return { lights, glows };
}

/* the picture as it stands now: the model's camera before the door stood before (s, a real number while it walks the road), or
   where a move has put it (cam) */
function paint(el) {
  const tw = el.tower, canvas = el.querySelector("canvas.tw-body");
  if (!tw || !canvas) return;
  const top = topOf(tw.st.floor);
  if (tw.model?.top !== top) tw.model = buildModel(top, tw.pal);
  let v = tw.cam || viewOf(tw.kind, tw.s, tw.m, top);
  // a hand on the tab's tower turns the camera round it and lifts or lowers it (look)
  if (tw.look) v = { ...v, phi: v.phi + tw.look.dphi, camY: v.camY + tw.look.dy, tgtY: v.tgtY + tw.look.dy };
  tw.view = cameraOf(tw.m, v);
  render(canvas, tw.model, tw.view, tw.pal, { doors: tw.doors, ...lampsOf(tw), lift: tw.lift, time: performance.now() / 1000 });
}
/* the scene's moves share one frame loop: each move sets what it changes, then the picture is painted once. With no move under way
   the loop goes on at a third of the frames while the scene is in sight, since the cloud drifts */
function run(el) {
  const tw = el.tower;
  if (!tw || tw.loop) return;
  let n = 0;
  const frame = now => {
    if (el.tower !== tw || !el.isConnected) { tw.loop = 0; return; }
    for (const a of [...tw.anims]) {
      a.t0 ??= now;
      const t = Math.min(1, (now - a.t0) / a.dur);
      a.step(a.ease(t));
      if (t >= 1) { tw.anims.delete(a); a.done(); }
    }
    if (tw.anims.size || (++n % 3 === 0 && tw.seen)) paint(el);
    tw.loop = tw.anims.size || !reduced() ? requestAnimationFrame(frame) : 0;
  };
  tw.loop = requestAnimationFrame(frame);
}
function animate(el, dur, step, ease = inout) {
  const tw = el.tower;
  if (!tw) return Promise.resolve();
  return new Promise(done => { tw.anims.add({ t0: null, dur, step, ease, done }); run(el); });
}
// every move under way taken to its end at once (a game gone into while the tab's entrance still plays)
function finish(el) {
  const tw = el.tower;
  if (!tw?.anims.size) return;
  for (const a of [...tw.anims]) { a.step(a.ease(1)); tw.anims.delete(a); a.done(); }
  paint(el);
}
// the doors' light going to a state's, as light does, never a picture laid over another
function tweenTo(el, st, dur = DUR.tone) {
  const tw = el.tower;
  if (!tw) return Promise.resolve();
  const from = tw.doors.slice(), to = doorsOf({ ...tw.st, ...st });
  tw.st = { ...tw.st, ...st };
  if (reduced()) { tw.doors = to; paint(el); return Promise.resolve(); }
  return animate(el, dur, e => { for (let i = 0; i < to.length; i++) tw.doors[i] = from[i] + (to[i] - from[i]) * e; }, out3);
}

/* the other climbers of the month, marked where they stand: a hairline from each one's lantern on the terrace (from the tower's
   edge when they stand round its far side) out into the night to the right, and there in one column their name and streak, as a
   drawing is labelled, a run being played with the amber lamp by its name (2026-11-11, the user: the plaques that hung there had
   "미감이 없어"; then of a square where the line met the wall, "네모점은 없애자. 그냥 선으로만 하는 게 깔끔할 것 같아"). Only those in
   sight; labels keep apart in the column, their lines bending to them. Their floor's own are lit, the others dim */
function climbersHTML(tw) {
  const { m, st, view } = tw;
  if (!view) return "";
  // the column stands clear of the tower's right edge at the door's height
  const edge = view.project([RR * Math.sin(view.phi + 1.45), (tw.s + .5) / 5 * PITCH, RR * Math.cos(view.phi + 1.45)])[0];
  const col = Math.min(m.W - (m.phone ? 104 : 150), edge + (m.phone ? 24 : 56)), marks = [];
  for (const c of (st.climbers || []).slice().sort((a, b) => b.wins - a.wins)) {
    const k = Math.min(ND - 1, c.wins), th = (k + .5) * 72 * Math.PI / 180, y0 = (k + .5) / 5 * PITCH + .1;
    // round the far side the mark starts at the tower's right edge, at their height
    const a = Math.cos(th - view.phi) > .25 && Math.sin(th - view.phi) > -.5 ? th : view.phi + 1.35;
    const [x, y] = view.project([RR * Math.sin(a), y0, RR * Math.cos(a)]);
    if (y < m.H * .12 || y > m.H - 16 || x > col - 16) continue;
    marks.push({ c, on: Math.floor(k / 5) + 1 === st.floor, x, y });
    if (marks.length >= 4) break;
  }
  if (!marks.length) return "";
  marks.sort((a, b) => a.y - b.y);
  let last = -Infinity;
  for (const k of marks) { k.ly = Math.max(k.y, last + 28); last = k.ly; }
  const lines = marks.map(k => `<path class="${k.on ? "on" : ""}" d="M${f1(k.x)} ${f1(k.y)}H${f1(k.x + 14)}L${f1(col - 14)} ${f1(k.ly)}H${f1(col - 4)}"/>`).join("");
  const labels = marks.map(k => `<span class="tw-tag${k.on ? " on" : ""}" style="left:${f1(col)}px;top:${f1(k.ly)}px">`
    + `<b>${k.c.live ? `<i class="lamp sig" aria-hidden="true"></i>` : ""}${escapeHTML(k.c.name)}</b><span>${k.c.wins}<small>연승</small></span></span>`).join("");
  return `<svg class="tw-leads" width="${m.W}" height="${m.H}" viewBox="0 0 ${m.W} ${m.H}" aria-hidden="true">${lines}</svg>${labels}`;
}
const escapeHTML = s => String(s).replace(/[&<>"]/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[ch]);
const themeOf = () => document.documentElement.dataset.theme || "";
const marksOf = el => [...el.querySelectorAll(".tw-tag, .tw-leads")];
// the marks laid again for where the camera now stands (the tab's hall only)
function mark(el, show = true) {
  const tw = el.tower;
  marksOf(el).forEach(x => x.remove());
  if (!tw?.m.hall) return;
  el.querySelector(".tw-cam")?.insertAdjacentHTML("beforeend", climbersHTML(tw));
  if (show && !reduced()) marksOf(el).forEach((x, i) => void fade(x, 0, 1, DUR.light, { delay: i * STAGGER.display }));
}
/* the tab's tower answers a hand: held and dragged, the camera goes round the tower with it and, under a mouse, up and down it (a
   finger's way up and down is the page's scroll); let go, it comes back to the door the run stands before, where it belongs. The
   marks stand aside while it is away. Nothing is held while a move plays */
function hand(el) {
  if (el.twHand) return;
  el.twHand = true;
  let from = null;
  el.addEventListener("pointerdown", e => {
    const tw = el.tower;
    if (!tw?.m.hall || tw.anims.size || scene || reduced() || e.button) return;
    from = { x: e.clientX, y: e.clientY };
    el.setPointerCapture?.(e.pointerId);
    el.classList.add("held");
    // (their coming in still holds their opacity, so they are hidden outright)
    marksOf(el).forEach(x => { x.style.visibility = "hidden"; });
  });
  el.addEventListener("pointermove", e => {
    const tw = el.tower;
    if (!from || !tw) return;
    const top = topOf(tw.st.floor), base = viewOf(tw.kind, tw.s, tw.m, top).camY;
    const dy = e.pointerType === "touch" ? 0 : (e.clientY - from.y) / tw.m.H * 5;
    tw.look = { dphi: -(e.clientX - from.x) / tw.m.W * 3.4, dy: Math.min(top * PITCH + 1.6 - base, Math.max(.9 - base, dy)) };
    paint(el);
  });
  const end = () => {
    const tw = el.tower;
    if (!from) return;
    from = null;
    el.classList.remove("held");
    const was = tw?.look;
    if (!was) { marksOf(el).forEach(x => { x.style.visibility = ""; }); return; }
    void animate(el, 680, t => { tw.look = t >= 1 ? null : { dphi: was.dphi * (1 - t), dy: was.dy * (1 - t) }; }, out3).then(() => { if (el.tower === tw) mark(el); });
  };
  el.addEventListener("pointerup", end);
  el.addEventListener("pointercancel", end);
}
// a scene is painted at rest only while it is in sight
const seen = typeof IntersectionObserver === "undefined" ? null
  : new IntersectionObserver(all => all.forEach(e => { if (e.target.tower) e.target.tower.seen = e.isIntersecting; }));

/* the tower drawn in el (the tab's hall, or the scene laid over a stage). floor: the floor stood on; at: its game (1 to 5, 6 the floor
   won whole, 0 none yet); live: a game is gone into or played (its door amber), else the run rests (its door at .382); hold: the
   game at stands unlit. The tab adds climbers ({ name, wins, live }) */
export function drawTower(el, st) {
  const W = el.clientWidth, H = el.clientHeight;
  if (!W || !H) return false;
  el.tower?.anims.forEach(a => a.done());
  const hall = el.classList.contains("tw-hall");
  el.innerHTML = `<div class="tw-cam"><canvas class="tw-body" aria-hidden="true"></canvas></div>`;
  el.tower = { m: { W, H, hall, phone: W < 520 }, st: { ...st }, theme: themeOf(), pal: paletteOf(el), model: null, doors: doorsOf(st), kind: hall ? "hall" : "close",
    s: doorOf(st), cam: null, look: null, view: null, lift: null, seen: true, anims: new Set(), loop: 0 };
  seen?.observe(el);
  if (hall) hand(el);
  paint(el);
  mark(el, false);
  run(el);
  return true;
}
const sameState = (a, b) => a.floor === b.floor && a.at === b.at && a.live === b.live && !a.hold === !b.hold
  && JSON.stringify(a.climbers || []) === JSON.stringify(b.climbers || []);
// the tab's hall draws itself and comes in with its entrance the first time; a resize, a new state or the other theme draws it again
// where it stands
export function standTower(el, st) {
  const was = el.tower;
  if (was && was.m.W === el.clientWidth && was.m.H === el.clientHeight && was.theme === themeOf() && sameState(was.st, st)) return;
  if (drawTower(el, st) && !was) void entrance(el);
}
// the theme turned: every tower standing is painted again in the other one's tones
if (typeof MutationObserver !== "undefined" && typeof document !== "undefined") {
  new MutationObserver(() => document.querySelectorAll(".tw").forEach(el => el.tower && drawTower(el, el.tower.st)))
    .observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
}

/* ---------- the scene ---------- */
/* 0. coming to the tab: the night switches on over the whole tower, from its plaza to its lantern, and the camera comes down and
   round to the run's door, while the doors won light one after another up the road as it comes, the run's own door last; then the
   climbers' marks */
async function entrance(el) {
  const tw = el.tower;
  if (!tw || reduced()) return;
  const top = topOf(tw.st.floor), a = viewOf("whole", tw.s, tw.m, top), b = viewOf("hall", tw.s, tw.m, top), target = tw.doors.slice(), k = doorOf(tw.st);
  marksOf(el).forEach(x => { x.style.opacity = "0"; });
  void fade(el.querySelector(".tw-body"), 0, 1, DUR.light);
  tw.doors.fill(0);
  await animate(el, ENTRANCE, e => {
    tw.cam = e >= 1 ? null : mixView(a, b, inout(e));
    for (let i = 0; i < ND; i++) {
      if (!target[i]) continue;
      const at = i >= k ? .8 : .14 + .56 * i / Math.max(1, k);
      tw.doors[i] = target[i] * smooth(at, at + .14, e);
    }
  }, linear);
  if (el.tower === tw) mark(el);
}
/* 1. between games: the tower comes up over the stage as the camera settles before the door, drawing in from a little round the tower */
function arrive(el) {
  void fade(el.querySelector(".tw-body"), 0, 1, DUR.leave);
  const tw = el.tower, b = viewOf(tw.kind, tw.s, tw.m, topOf(tw.st.floor)), a = { ...b, phi: b.phi - .3, dist: b.dist * 1.3, camY: b.camY + .4 };
  return animate(el, ARRIVE, e => { tw.cam = e >= 1 ? null : mixView(a, b, e); }, out3);
}
/* 2. a game won: its lamp goes out where it stands (the amber room cools to the warm of a game won), the camera walks the terrace
   to the next door, and that door's lamp switches on. A lamp never moves: no light crosses the terrace between the two (2026-11-16,
   the user: "클리어한 층의 빛이 꺼지고 다른 층의 빛이 켜지는 식이 아니라, 빛이 이동하는 경로가 전부 보여"). After a gatekeeper the next door
   is the next floor's first, a fifth of a turn on like any other */
async function step(el, st) {
  const tw = el.tower, from = tw.s, to = doorOf(st);
  sfx("select");
  marksOf(el).forEach(x => void fade(x, 1, 0, DUR.leave, { easing: EASE_IN }));
  await tweenTo(el, { ...st, hold: true }, DUR.leave);
  sfx("swoosh", { sec: .7 });
  await animate(el, WALK, e => { tw.s = from + (to - from) * e; });
  if (el.tower !== tw) return;
  mark(el);
  sfx("turn");
  // the lamp comes on amber from the dark, never through a won room's warm
  tw.st = { ...tw.st, ...st, hold: false };
  await animate(el, DUR.light, e => { tw.doors[to] = -e; }, out3);
  tw.doors = doorsOf(tw.st); paint(el);
}

/* 1 and 2: the tower is shown on target for the game gone into (floor, at). hall: the tab's hall, where it already stands; otherwise
   it comes up over the stage. climbing: the floor's first game after a gatekeeper. again: a lost game gone into again, where no
   lamp was won and the amber lamp stands where it stood. Resolves once it has been read */
export async function towerShow(target, { floor, at: game, climbing = false, again = false }) {
  towerDrop(true);
  if (!target) return;
  const hall = target.classList.contains("tw-hall");
  const el = hall ? target : Object.assign(document.createElement("div"), { className: "tw over" });
  if (!hall) { el.setAttribute("aria-hidden", "true"); target.appendChild(el); }
  scene = { el, own: !hall };
  const keep = hall ? { climbers: el.tower?.st.climbers } : {};
  const now = { ...keep, floor, at: game, live: true };
  // the picture before the step the scene plays: the game just won still the lamp's, or the floor left with its gate still the lamp's
  const before = hall || again ? now : climbing ? { floor: floor - 1, at: 5, live: true } : game > 1 ? { floor, at: game - 1, live: true } : now;
  if (reduced()) { drawTower(el, now); await pause(680); return; }
  if (hall) {
    // the hall already stands on the game gone into, at the run's rest (its entrance, if it still plays, taken to its end): its door
    // turns amber where it stands
    finish(el);
    if (el.tower) el.tower.look = null;
    const was = el.tower?.st;
    if (was && was.floor === floor && was.at === game) void tweenTo(el, { ...was, live: true }, DUR.light);
    else drawTower(el, now);
    sfx("turn");
  } else {
    drawTower(el, before);
    await arrive(el);
  }
  const mine = () => scene?.el === el;
  if (mine() && doorOf(before) !== doorOf(now)) await step(el, now);
  if (mine()) await pause(READ);
}

/* 3. going in, as the camera walks it (DIVE, in two beats: it comes to stand before the amber door, level with it and facing it,
   then walks in through the arch), while the rest of the screen goes out; the room's dark becomes the stage's own ground as the
   arch passes the stage's edges, and that ground is left fixed over the window, to outlive the screen. Resolves with it standing */
export async function towerDive() {
  if (!scene) return;
  const { el, own } = scene;
  scene = null;
  if (!reduced()) {
    // everything of the page that does not hold the scene
    const main = document.getElementById("ypl-main"), rest = [];
    for (let x = el; x && x !== main && x.parentElement; x = x.parentElement) rest.push(...[...x.parentElement.children].filter(y => y !== x && !y.classList.contains("tw")));
    left = rest.map(x => x.animate([{ opacity: getComputedStyle(x).opacity }, { opacity: 0 }], { duration: DUR.light, delay: DIVE * .5, easing: EASE_IN, fill: "both" }));
  }
  const tw = el.tower, box = el.getBoundingClientRect();
  if (tw?.model && !reduced()) {
    finish(el);
    const top = topOf(tw.st.floor), door = doorOf(tw.st), a = tw.cam || viewOf(tw.kind, tw.s, tw.m, top), c = viewOf("door", door, tw.m, top);
    const b = { ...c, dist: 2.5 };
    sfx("swoosh", { sec: .6 });
    for (const x of marksOf(el)) void fade(x, 1, 0, DUR.light, { easing: EASE_IN });
    let stepped = false;
    await animate(el, DIVE, e => {
      tw.cam = mixView(mixView(a, b, smooth(0, .52, e)), c, smooth(.46, 1, e) ** 2);
      // the room's lamp goes down as the camera comes through the arch, so the room it walks into is already the stage's dark and
      // the screen is never one sheet of amber
      tw.lift = { door, mix: smooth(.6, .9, e) };
      if (!stepped && e > .5) { stepped = true; sfx("swoosh", { sec: .5 }); }
    }, linear);
  }
  // the dark stands where the stage stood, fixed over the window and cut to it
  const dark = Object.assign(document.createElement("div"), { className: "tw-veil" });
  dark.setAttribute("aria-hidden", "true");
  const top = Math.max(0, box.top), bottom = Math.min(innerHeight, box.bottom);
  Object.assign(dark.style, { left: `${box.left}px`, top: `${top}px`, width: `${box.width}px`, height: `${Math.max(0, bottom - top)}px` });
  (document.querySelector(".ypl") || document.body).appendChild(dark);
  if (own) el.remove();
  car = { el: dark };
}

// where a stage stands, cut to the window; a team preview is still drawing its cards when the dark arrives and runs past the foot
// once drawn, so its box goes down to the window's foot, less the page's own bottom space
const boxOf = el => {
  const r = el.getBoundingClientRect(), top = Math.max(0, r.top);
  const foot = parseFloat(getComputedStyle(el.closest(".page") || document.body).paddingBottom) || 0;
  return { left: r.left, top, width: r.width, height: Math.max(0, innerHeight - foot - top) };
};
// the next screen comes up out of the dark, as the battle's own stage does
const lift = el => fade(el, 1, 0, 680).then(() => el.remove());

/* 4. the next screen has mounted; the dark goes to its stage (target) and the screen comes up out of it. Returns the time until it
   starts to lift, so that screen's arrival can wait for it, or null when no dark waits */
export function liftArrive(target) {
  letGo();
  if (!car || !target) return null;
  const { el } = car;
  car = null;
  if (reduced()) { el.remove(); return 0; }
  const was = el.getBoundingClientRect(), to = boxOf(target);
  const moved = Math.abs(to.left - was.left) + Math.abs(to.top - was.top) + Math.abs(to.width - was.width) + Math.abs(to.height - was.height) > 4;
  const px = b => ({ left: `${b.left}px`, top: `${b.top}px`, width: `${b.width}px`, height: `${b.height}px` });
  (async () => {
    if (moved) {
      await settled(el.animate([px(was), px(to)], { duration: MOVE, easing: INOUT, fill: "forwards" }));
      Object.assign(el.style, px(to));
    } else await pause(BEAT);
    sfx("turn");
    await lift(el);
  })();
  return moved ? MOVE : BEAT;
}

// a refusal (the game could not be made): the scene goes, or the dark lifts where it stands, and the screen stands again
export function towerDrop(now = false) {
  const s = scene, c = car;
  scene = null; car = null;
  letGo();
  if (s?.own) {
    if (now || reduced()) s.el.remove();
    else void fade(s.el, 1, 0, DUR.leave).then(() => s.el.remove());
  }
  if (s && !s.own && s.el.tower) drawTower(s.el, { ...s.el.tower.st, live: false });
  if (c) { if (now || reduced()) c.el.remove(); else void lift(c.el); }
}
