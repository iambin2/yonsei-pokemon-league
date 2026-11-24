/* 도전의 탑's tower (DESIGN.md "Battle", 도전의 탑, The tower, the tenth pass). The tower is a place under one camera (towerGL.js): a
   round tower whose terrace winds up round it, a floor a turn, a game a door on that road, standing on its plaza among a wood
   under a sea of cloud and a moon. The camera always stands before the door of the game the run is on. This file keeps the scene
   round the model: the climbers' marks, and the scene's moves, each a move of the model's camera or a change of its doors' light,
   never a picture slid or laid over:
     0. coming to the tab: the camera comes down and round from the whole tower to the run's door while the doors won light in turn;
     1. between games the tower comes up over the stage as the camera settles before the door;
     2. a game won: its lamp goes out (the room cools to warm), the camera walks the terrace to the next door, a fifth of a turn
        round and up, and that door's lamp comes on. A lamp never moves; after a gatekeeper the next door is the next floor's first;
     3. when the game is made and read, the camera comes to stand before the amber door, then walks in through its arch into the
        room, whose dark becomes the stage's own ground;
     4. that dark outlives the screen, goes to the next screen's stage, and the next screen comes up out of it.
   At rest the cloud drifts, and the tab's tower turns under a hand and comes back. Until the camera is in, the scene is inside the stage it was called on, so it scrolls with its page.
   Reduced motion: the tower stands, then a cut (2026-11-11, the user: the going in was "너무 빨라서 뭐가 뭔지도 모르겠어", and coming
   to the tab "그냥 로딩되는 느낌"; 2026-11-16: the lamp's light running from door to door, "빛이 이동하는 경로가 전부 보여", and the
   tower alone in an empty night, "가상의 요소처럼 느껴져서 몰입이 깨져") */
import { DUR, EASE_IN, EASE_OUT, INOUT, STAGGER, reduced } from "../../components/common/motion.js";
import { sfx } from "./sfx.js";
import { GY, LAMP, ND, PITCH, RR, RW, buildModel, cameraOf, doorPoint, mixView, modelBuilt, paletteOf, prebuildModel, render, topOf, viewOf, warmTower } from "./towerGL.js";

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
let veil = null;            // the dark the camera walked into, fixed over the window: { el }
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
/* the other climbers, by the door they stand before, in sight of a state's door, nearest first: [{ k, n, cs }]. A door holds one lantern
   however many stand there, brighter the more they are, so a crowd at one streak reads as one light, never a heap of names (2026-11-19,
   the user: "이용자가 엄청나게 늘어나고 비슷한 점수대에 사람이 몰리면 엄청나게 보기 어려워질 것 같아") */
function othersOf(st, at = doorOf(st)) {
  const by = new Map();
  for (const c of st.climbers || []) {
    const k = Math.min(ND - 1, c.wins);
    if (Math.abs(k - at) >= 14) continue;
    if (!by.has(k)) by.set(k, { k, n: 0, cs: [] });
    const d = by.get(k); d.n++; d.cs.push(c);
  }
  return [...by.values()].sort((a, b) => Math.abs(a.k - at) - Math.abs(b.k - at) || b.k - a.k);
}
// a lantern's light by how many stand at it: one .6, rising to 1 at eight and more
const crowd = n => Math.min(1, .6 + .4 * Math.log2(n) / 3);
// the door the camera looks at: the run's, or as far up or down the tower as a hand has lifted the camera
const lookDoor = tw => Math.round(tw.s + (tw.look?.dy || 0) / PITCH * 5);
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
  // the stone holds sixteen lights in all, so only the nearest lanterns light it; every lantern in sight glows in the air
  for (const o of othersOf(tw.st, lookDoor(tw))) {
    const p = doorPoint(o.k, RR - .03, .14), a = crowd(o.n);
    if (lights.length < 10) lights.push([...p, .34, ...pal.warm, a]);
    glows.push([...p, .42 + .16 * a, ...pal.warm.map(x => x * .34 * a / .6 * dim)]);
  }
  if (tw.s < 16) for (const sx of [-.66, .66]) for (let j = 0; j < 3; j++) {
    const p = [sx, GY + .51 * LAMP, 2.9 + 1.4 * j];
    lights.push([...p, 1.5, ...pal.warm, pal.light ? .2 : .42]);
    glows.push([...p, .45, ...pal.warm.map(x => x * .3 * dim)]);
  }
  return { lights, glows };
}

/* the picture as it stands now: the model's camera before the door stood before (s, a real number while it walks the road), or
   where a move has put it (cam) */
function paint(el, draw = true) {
  const tw = el.tower, canvas = el.querySelector("canvas.tw-body");
  if (!tw || !canvas) return;
  const top = topOf(tw.st.floor);
  /* a mesh not made yet is made in pieces (prebuildModel) and the scene is painted once it is there; the scenes wait for it
     (meshReady) before they move */
  if (tw.model?.top !== top) {
    if (!modelBuilt(top, tw.pal)) { tw.waiting ||= prebuildModel(top, tw.pal).then(() => { tw.waiting = null; if (el.tower === tw) { paint(el, !tw.coming); if (!tw.coming) mark(el, false); } }); return; }
    tw.model = buildModel(top, tw.pal);
  }
  if (!draw) return;
  tw.coming = false;
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

/* the other climbers of the month, counted by floor: a hairline from the floor's lantern nearest the run's door (from the tower's edge
   when it stands round the far side) out into the night to the right, and there in one column the floor and how many stand on it, a
   floor with a run being played marked with the amber lamp. One label a floor in sight, never one a climber: names belong to the board
   beside the scene, and a crowd at one streak stays one line (2026-11-19, the owner's draft B; before, up to four names, chosen by
   chance once many stood alike). The run's own floor is lit, the others dim */
function climbersHTML(tw) {
  const { m, st, view } = tw;
  if (!view) return "";
  /* a floor's count is everyone on it, every floor of the tower that is in sight, so a hand lifting the camera up or down the tower
     reads each floor it passes (2026-11-19, the user: "위 아래로 움직이면서 몇층에 몇명이 있는지 확인할 수 있게"); its line starts at
     its lantern that faces the camera most */
  const floors = new Map(), top = topOf(st.floor), face = k => Math.cos((k + .5) * 72 * Math.PI / 180 - view.phi);
  for (const c of st.climbers || []) {
    const k = Math.min(ND - 1, c.wins), f = Math.floor(k / 5) + 1;
    if (f > top) continue;
    if (!floors.has(f)) floors.set(f, { k, n: 0, live: false, f });
    const x = floors.get(f);
    x.n++; x.live ||= Boolean(c.live);
    if (face(k) > face(x.k)) x.k = k;
  }
  const items = [...floors.values()].map(x => ({ k: x.k, top: `${x.f}층`, num: x.n, unit: "명", live: x.live }));
  if (!items.length) return "";
  // the column stands clear of the tower's right edge at the door's height
  const edge = view.project([RR * Math.sin(view.phi + 1.45), (lookDoor(tw) + .5) / 5 * PITCH, RR * Math.cos(view.phi + 1.45)])[0];
  const col = Math.min(m.W - (m.phone ? 104 : 150), edge + (m.phone ? 24 : 56)), marks = [];
  for (const it of items.sort((a, b) => b.k - a.k)) {
    const k = it.k, th = (k + .5) * 72 * Math.PI / 180, y0 = (k + .5) / 5 * PITCH + .1;
    // round the far side the mark starts at the tower's right edge, at their height
    const a = Math.cos(th - view.phi) > .25 && Math.sin(th - view.phi) > -.5 ? th : view.phi + 1.35;
    const [x, y] = view.project([RR * Math.sin(a), y0, RR * Math.cos(a)]);
    if (y < m.H * .12 || y > m.H - 16 || x > col - 16) continue;
    marks.push({ it, on: Math.floor(k / 5) + 1 === st.floor, x, y });
  }
  if (!marks.length) return "";
  marks.sort((a, b) => b.it.k - a.it.k || a.y - b.y);
  let last = -Infinity;
  for (const k of marks) { k.ly = Math.max(k.y, last + 40); last = k.ly; }
  const kept = marks.filter(k => k.ly < m.H - 24);
  if (!kept.length) return "";
  const lines = kept.map(k => `<path class="${k.on ? "on" : ""}" d="M${f1(k.x)} ${f1(k.y)}H${f1(k.x + 14)}L${f1(col - 14)} ${f1(k.ly)}H${f1(col - 4)}"/>`).join("");
  const labels = kept.map(k => `<span class="tw-tag${k.on ? " on" : ""}" style="left:${f1(col)}px;top:${f1(k.ly)}px">`
    + `<b>${k.it.live ? `<i class="lamp sig" aria-hidden="true"></i>` : ""}${escapeHTML(k.it.top)}</b><span>${k.it.num}<small>${k.it.unit}</small></span></span>`).join("");
  return `<svg class="tw-leads" width="${m.W}" height="${m.H}" viewBox="0 0 ${m.W} ${m.H}" aria-hidden="true">${lines}</svg>${labels}`;
}
const escapeHTML = s => String(s).replace(/[&<>"]/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[ch]);
// the theme and 고대비 together: a change of either draws the tower again in its tones
const themeOf = () => `${document.documentElement.dataset.theme || ""}${document.documentElement.dataset.contrast || ""}`;
const marksOf = el => [...el.querySelectorAll(".tw-tag, .tw-leads")];
// the marks laid again for where the camera now stands (the tab's hall only)
function mark(el, show = true) {
  const tw = el.tower;
  marksOf(el).forEach(x => x.remove());
  /* once a game is gone into, the hall lays no marks again until the scene is let go (towerDrop): the board's next state or a redraw
     laid them back over the walk through the door (2026-11-19, the user: "탑 들어가는 모션에서 몇층 몇명 보임") */
  if (!tw?.m.hall || el.twIn) return;
  el.querySelector(".tw-cam")?.insertAdjacentHTML("beforeend", climbersHTML(tw));
  if (show && !reduced()) marksOf(el).forEach((x, i) => void fade(x, 0, 1, DUR.light, { delay: i * STAGGER.display }));
}
/* the tab's tower answers a hand: held and dragged, the camera goes round the tower with it and, under a mouse, up and down it (a
   finger's way up and down is the page's scroll); let go, it comes back to the door the run stands before, where it belongs. The
   floors' marks go with the camera, each floor in sight laid where it now stands (2026-11-19: they stood aside while it was away, and
   moving the tower showed nothing). Nothing is held while a move plays.
   2026-11-18 (the user: "도전의 탑 3D 모델의 터치 상호작용이 부자연스러워"): a touch is taken only once it has moved 6 px and more across
   than up or down, so a tap or a scroll no longer hides the marks for a moment; the tower turns under the finger one to one (its face
   moves as far as the finger, by the tower's radius on the screen); let go, it glides on with the hand's speed and slows as a heavy
   thing does (decay 325 ms), rests a moment where it stopped (REST) and only then turns home; and a hand may catch it again anywhere
   on that way. The glide and the way home run on their own frames, not as a move, so they never hold the hand off */
const SLOP = 6, GLIDE_DECAY = 325, REST = 1200, HOME = 680;
function hand(el) {
  if (el.twHand) return;
  el.twHand = true;
  let g = null, raf = 0;
  const stop = () => { cancelAnimationFrame(raf); raf = 0; };
  // the tower's radius on the screen at the door's height, so the face under a finger moves with it
  const radius = tw => {
    const v = tw.view, y = (tw.s + .5) / 5 * PITCH;
    if (!v) return tw.m.W / 3.4;
    const c = v.project([0, y, 0])[0], r = v.project([RR * Math.sin(v.phi + Math.PI / 2), y, RR * Math.cos(v.phi + Math.PI / 2)])[0];
    return Math.max(tw.m.W / 8, Math.abs(r - c));
  };
  const lookAt = (tw, dphi, dy) => {
    const top = topOf(tw.st.floor), base = viewOf(tw.kind, tw.s, tw.m, top).camY;
    tw.look = { dphi, dy: Math.min(top * PITCH + 1.6 - base, Math.max(.9 - base, dy)) };
    paint(el);
    mark(el, false);
  };
  // after a release: glide on at v (radians a millisecond), rest, then turn home; each frame checks the scene is still this one
  const glide = (tw, v) => {
    let last = performance.now(), still = null, home = null;
    const frame = now => {
      if (el.tower !== tw || !el.isConnected || !tw.look) { raf = 0; return; }
      const dt = Math.min(48, now - last);
      last = now;
      if (Math.abs(v) > 1e-4) {
        v *= Math.exp(-dt / GLIDE_DECAY);
        lookAt(tw, tw.look.dphi + v * dt, tw.look.dy);
      } else if ((still ??= now) + REST > now) { /* resting where it stopped */ }
      else {
        home ??= { t0: now, from: { ...tw.look } };
        const e = out3(Math.min(1, (now - home.t0) / HOME));
        if (e >= 1) { tw.look = null; paint(el); raf = 0; mark(el, false); return; }
        tw.look = { dphi: home.from.dphi * (1 - e), dy: home.from.dy * (1 - e) };
        paint(el);
        mark(el, false);
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
  };
  el.addEventListener("pointerdown", e => {
    const tw = el.tower;
    if (!tw?.m.hall || tw.anims.size || scene || reduced() || e.button || g) return;
    // a tower still gliding or turning home is caught where it is
    stop();
    g = { id: e.pointerId, x: e.clientX, y: e.clientY, touch: e.pointerType === "touch", on: false, base: tw.look || { dphi: 0, dy: 0 }, trail: [] };
  });
  el.addEventListener("pointermove", e => {
    const tw = el.tower;
    if (!g || e.pointerId !== g.id || !tw) return;
    if (!g.on) {
      const dx = e.clientX - g.x, dy = e.clientY - g.y;
      if (Math.hypot(dx, dy) < SLOP) return;
      // more up or down than across: the page's scroll, and the tower stays as it was
      if (g.touch && Math.abs(dy) >= Math.abs(dx)) { g = null; if (tw.look) glide(tw, 0); return; }
      Object.assign(g, { on: true, x: e.clientX, y: e.clientY, r: radius(tw) });
      el.setPointerCapture?.(e.pointerId);
      el.classList.add("held");
    }
    g.trail.push([e.timeStamp, e.clientX]);
    while (g.trail.length > 2 && e.timeStamp - g.trail[0][0] > 80) g.trail.shift();
    lookAt(tw, g.base.dphi - (e.clientX - g.x) / g.r, g.base.dy + (g.touch ? 0 : (e.clientY - g.y) / tw.m.H * 5));
  });
  const end = e => {
    const tw = el.tower, was = g;
    if (!was || e.pointerId !== was.id) return;
    g = null;
    el.classList.remove("held");
    if (!tw) return;
    if (!was.on) { if (tw.look) glide(tw, 0); return; }
    // the hand's speed over its last 80 ms; none when it was held still before letting go or the browser took the touch away
    const [a, b] = [was.trail[0], was.trail.at(-1)];
    const moving = e.type === "pointerup" && a && b && b[0] > a[0] && e.timeStamp - b[0] < 50;
    const v = moving ? -(b[1] - a[1]) / (b[0] - a[0]) / was.r : 0;
    glide(tw, Math.max(-.006, Math.min(.006, v)));
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
/* coming (standTower: the entrance fades it in from nothing), its first picture is not painted here but in the entrance's first frame:
   painted here, it went into the frame the tab's whole screen was put up in, 33 to 85 ms more of it at a phone's speed, and at an
   opacity of 0 (2026-11-18, a profile of the tab's click) */
export function drawTower(el, st, coming = false) {
  const W = el.clientWidth, H = el.clientHeight;
  if (!W || !H) return false;
  el.tower?.anims.forEach(a => a.done());
  const hall = el.classList.contains("tw-hall");
  el.innerHTML = `<div class="tw-cam"><canvas class="tw-body" aria-hidden="true"></canvas></div>`;
  el.tower = { m: { W, H, hall, phone: W < 520 }, st: { ...st }, theme: themeOf(), pal: paletteOf(el), model: null, doors: doorsOf(st), kind: hall ? "hall" : "close",
    s: doorOf(st), cam: null, look: null, view: null, lift: null, seen: true, anims: new Set(), loop: 0, coming };
  seen?.observe(el);
  if (hall) hand(el);
  paint(el, !coming);
  /* coming, the marks are laid by the entrance at its end, once: laid here, or when the mesh was made, they stood over the empty
     night while the mesh was made and came again after the entrance (2026-11-19, the user: "애니메이션 반복 현상을 또 반복하지 말고") */
  if (!coming) mark(el, false);
  run(el);
  return true;
}
const sameState = (a, b) => a.floor === b.floor && a.at === b.at && a.live === b.live && !a.hold === !b.hold
  && JSON.stringify(a.climbers || []) === JSON.stringify(b.climbers || []);
/* the tab's hall draws itself and comes in with its entrance the first time; a resize or the other theme draws it again where it
   stands. A new state never draws it again (2026-11-18, the user: the tower flashed on 이번 달 and 오늘의 탑, and came in abruptly):
   the month's board arriving a moment after the tab redrew the hall and cut its entrance short. Now the camera walks to the new door
   (the same floor), or the night dims and the new floor's tower draws in as between games (another floor), after any move under way */
export function standTower(el, st) {
  const was = el.tower;
  if (!was) { if (drawTower(el, st, !reduced())) el.tower.queue = entrance(el); return; }
  if (was.theme !== themeOf()) { drawTower(el, st); return; }
  /* a new size keeps the scene and any move under way: the camera is fitted to the box at the next frame (drawn again, the entrance
     was cut where it stood, 2026-11-19) */
  const W = el.clientWidth, H = el.clientHeight;
  if (W && H && (was.m.W !== W || was.m.H !== H)) {
    was.m = { ...was.m, W, H, phone: W < 520 };
    if (!was.anims.size && !was.coming && !was.waiting) { paint(el); mark(el, false); }
  }
  if (sameState(was.st, st)) return;
  const next = { ...st };
  was.want = next;
  was.queue = (was.queue || Promise.resolve()).then(() => (el.tower === was && was.want === next ? moveTo(el, next) : null));
}
async function moveTo(el, st) {
  const tw = el.tower;
  if (reduced()) { drawTower(el, st); return; }
  if (st.floor !== tw.st.floor) {
    await fade(el.querySelector(".tw-body"), 1, 0, DUR.leave, { easing: EASE_IN });
    if (el.tower !== tw || !drawTower(el, st, true)) return;
    const now = el.tower;
    marksOf(el).forEach(x => { x.style.opacity = "0"; });
    await arrive(el);
    if (el.tower === now) mark(el);
    return;
  }
  const from = tw.s, to = doorOf(st), walks = from !== to;
  if (walks) marksOf(el).forEach(x => void fade(x, 1, 0, DUR.tone, { easing: EASE_IN }));
  await Promise.all([tweenTo(el, st, DUR.light), walks ? animate(el, WALK, e => { tw.s = from + (to - from) * e; }) : null]);
  if (el.tower === tw) mark(el);
}
// the theme turned: every tower standing is painted again in the other one's tones (only when it did turn: a write of the same
// theme redrew it and cut its entrance short)
if (typeof MutationObserver !== "undefined" && typeof document !== "undefined") {
  new MutationObserver(() => document.querySelectorAll(".tw").forEach(el => el.tower && el.tower.theme !== themeOf() && drawTower(el, el.tower.st)))
    .observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "data-contrast"] });
}

/* ---------- the scene ---------- */
/* 0. coming to the tab: the night comes up over the whole tower, from its plaza to its lantern, and the camera comes down and
   round to the run's door, while the doors won light one after another up the road as it comes, the run's own door last; then the
   climbers' marks */
async function entrance(el) {
  const tw = el.tower;
  if (!tw || reduced()) return;
  if (tw.waiting) { await tw.waiting; if (el.tower !== tw) return; }
  const top = topOf(tw.st.floor), target = tw.doors.slice(), k = doorOf(tw.st);
  marksOf(el).forEach(x => { x.style.opacity = "0"; });
  // a frame of its own first: the screen goes up in one, the tower's first picture in the next (drawTower coming); unpainted, the canvas
  // shows nothing, as it showed nothing at the fade's start
  await new Promise(resolve => requestAnimationFrame(resolve));
  if (el.tower !== tw) return;
  void fade(el.querySelector(".tw-body"), 0, 1, DUR.light);
  tw.doors.fill(0);
  /* the two views are taken from the box as it is at each frame: the hall coming back from a battle is drawn at the battle's width and
     the page's own margins come back a frame later, and views fixed at the start jumped to the new box as the entrance ended
     (2026-11-24, recorded at 1385 of going back from a run's end) */
  await animate(el, ENTRANCE, e => {
    tw.cam = e >= 1 ? null : mixView(viewOf("whole", tw.s, tw.m, top), viewOf("hall", tw.s, tw.m, top), inout(e));
    for (let i = 0; i < ND; i++) {
      if (!target[i]) continue;
      const at = i >= k ? .8 : .14 + .56 * i / Math.max(1, k);
      tw.doors[i] = target[i] * smooth(at, at + .14, e);
    }
  }, linear);
  if (el.tower === tw) mark(el);
}
/* 1. between games: the tower comes up over the stage as the camera settles before the door, drawing in from a little round the tower */
async function arrive(el) {
  if (el.tower?.waiting) await el.tower.waiting;
  void fade(el.querySelector(".tw-body"), 0, 1, DUR.leave);
  const tw = el.tower;
  if (!tw) return;
  // the views from the box as it is at each frame, as the entrance's
  return animate(el, ARRIVE, e => {
    const b = viewOf(tw.kind, tw.s, tw.m, topOf(tw.st.floor)), a = { ...b, phi: b.phi - .3, dist: b.dist * 1.3, camY: b.camY + .4 };
    tw.cam = e >= 1 ? null : mixView(a, b, e);
  }, out3);
}
/* 2. a game won: its lamp goes out where it stands (the amber room cools to the warm of a game won), the camera walks the terrace
   to the next door, and that door's lamp comes on. A lamp never moves: no light crosses the terrace between the two (2026-11-16,
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

/* the break's last beat, the next door (2026-11-18, Task 9): the tower stands in the stage's place as the tab sees it (el is a .tw-hall),
   comes up from the game just played and walks to the next door, whose lamp is amber, the game the key goes into. Going in is then
   towerShow on this same hall. climbing and again as towerShow's */
export async function towerBreak(el, { floor, at: game, climbing = false, again = false }) {
  const now = { floor, at: game, live: true, climbers: null };
  const before = again ? now : climbing ? { floor: floor - 1, at: 5, live: true, climbers: null } : game > 1 ? { floor, at: game - 1, live: true, climbers: null } : now;
  if (!drawTower(el, reduced() ? now : before) || reduced()) return;
  await arrive(el);
  if (el.tower?.st && doorOf(before) !== doorOf(now)) await step(el, now);
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
    el.twIn = true;
    for (const x of marksOf(el)) void fade(x, Number(getComputedStyle(x).opacity), 0, DUR.light, { easing: EASE_IN }).then(() => x.remove());
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
  veil = { el: dark };
}

// where a stage stands, cut to the window; a team preview is still drawing its cards when the dark arrives and runs past the foot
// once drawn, so its box goes down to the window's foot, less the page's own bottom space
const boxOf = el => {
  const r = el.getBoundingClientRect(), top = Math.max(0, r.top);
  const foot = parseFloat(getComputedStyle(el.closest(".page") || document.body).paddingBottom) || 0;
  return { left: r.left, top, width: r.width, height: Math.max(0, innerHeight - foot - top) };
};
// the next screen comes up out of the dark as it fades (680), as the battle's own stage does
const clearVeil = el => fade(el, 1, 0, 680).then(() => el.remove());

/* 4. the next screen has mounted; the dark goes to its stage (target) and the screen comes up out of it. The dark never moves by
   layout: it is set at once on the new box and moved there from the old one by transform alone (translate and scale, origin at its
   top left), so it is a picture moving on the compositor. Returns the time until it starts to clear, so that screen's arrival can
   wait for it, or null when no dark waits. (The name is kept: BattlePage.jsx calls it) */
export function liftArrive(target) {
  letGo();
  if (!veil || !target) return null;
  const { el } = veil;
  veil = null;
  if (reduced()) { el.remove(); return 0; }
  const was = el.getBoundingClientRect(), to = boxOf(target);
  const moved = Math.abs(to.left - was.left) + Math.abs(to.top - was.top) + Math.abs(to.width - was.width) + Math.abs(to.height - was.height) > 4;
  (async () => {
    if (moved && to.width > 0 && to.height > 0) {
      Object.assign(el.style, { left: `${to.left}px`, top: `${to.top}px`, width: `${to.width}px`, height: `${to.height}px` });
      const from = `translate(${f1(was.left - to.left)}px, ${f1(was.top - to.top)}px) scale(${(was.width / to.width).toFixed(4)}, ${(was.height / to.height).toFixed(4)})`;
      await settled(el.animate([{ transform: from }, { transform: "none" }], { duration: MOVE, easing: INOUT, fill: "backwards" }));
    } else await pause(BEAT);
    sfx("turn");
    await clearVeil(el);
  })();
  return moved ? MOVE : BEAT;
}

// a refusal (the game could not be made): the scene goes, or the dark clears where it stands, and the screen stands again
export function towerDrop(now = false) {
  const s = scene, c = veil;
  scene = null; veil = null;
  letGo();
  // the dive lets go of its scene before it walks, so every hall is freed here, not only the scene's
  document.querySelectorAll(".tw-hall").forEach(x => { x.twIn = false; });
  if (s?.own) {
    if (now || reduced()) s.el.remove();
    else void fade(s.el, 1, 0, DUR.leave).then(() => s.el.remove());
  }
  if (s && !s.own && s.el.tower) drawTower(s.el, { ...s.el.tower.st, live: false });
  if (c) { if (now || reduced()) c.el.remove(); else void clearVeil(c.el); }
}
