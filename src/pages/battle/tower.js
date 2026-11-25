/* 도전의 탑's tower (DESIGN.md "Battle", 도전의 탑, The tower; the Almanac Monolith pass, 2026-11-25).
   The tower is an architectural monolith under one camera (towerGL.js) standing directly on the page's own ground (--ground):
   each floor tapers up the vertical axis into a Wing Y crown, holding all five full-height colonnade portals in view beside
   the floor's thin Albert Sans numeral. Every move is a move of the camera, a 3-beat rule/mass draw, or a solid portal state
   change on the golden-ratio time scale, resting at 0fps once settled and switching themes in one frame with zero mesh rebuild:
     0. coming to the tab (900ms): floor datum rules and tapered silhouette draw in, monolith rises, won portals and active portal light;
     1. between games (420ms): the tower settles before the current door over the stage;
     2. a game won (840ms / 1100ms climb): the won portal solidifies to --lit, the camera steps to the next bay or elevates a floor,
        and the next portal's signal lights up;
     3. going in (700ms): surrounding floors dim, the camera aligns dead-centre (opening the gatekeeper's twin slabs) and glides
        through the 3D portal jambs as its interior becomes the stage's own --ground;
     4. that ground (.tw-veil) outlives the screen, moves by transform alone to the next screen's stage, and clears. */
import { DUR, EASE_IN, EASE_OUT, INOUT, STAGGER, reduced } from "../../components/common/motion.js";
import { sfx } from "./sfx.js";
import {
  FLOOR_H, ND, buildModel, cameraOf, mixView, modelBuilt, paletteOf, prebuildModel, refreshFontAtlas, render, rightEdgeOf, topOf, viewOf, warmTower,
} from "./towerGL.js";

if (typeof window !== "undefined") {
  (window.requestIdleCallback || (f => setTimeout(f, 200)))(() => {
    warmTower();
    void prebuildModel(topOf(1));
  }, { timeout: 2000 });
  document.fonts?.ready.then(() => {
    refreshFontAtlas();
    document.querySelectorAll(".tw").forEach(el => { if (el.tower && !el.tower.coming && !el.tower.waiting) paint(el); });
  });
}

/* golden-ratio lengths: 100, 160, 260, 420, 680 (DESIGN.md "Motion" & "Battle", Time) */
const MOVE = 420, BEAT = 160, READ = 260, STEP_SAME = 420, STEP_CLIMB = 680, ALIGN = 280, DIVE = 420, ENTRANCE = 900, ARRIVE = 420;
const NEXT = 0.382;

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
const inout = curve(INOUT), out3 = curve(EASE_OUT), in3 = curve(EASE_IN);
const linear = t => t;
const pause = n => new Promise(resolve => setTimeout(resolve, n));
const settled = anim => anim.finished.catch(() => {});
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const fade = (x, from, to, duration, o = {}) => settled(x.animate([{ opacity: from }, { opacity: to }], { duration, easing: EASE_OUT, fill: "both", ...o }));

let scene = null;
let veil = null;
let left = [];
const letGo = () => { left.forEach(a => a.cancel()); left = []; };
const f1 = n => n.toFixed(1);

/* ---------- state helpers ---------- */
const doorOf = st => Math.min(ND - 1, (st.floor - 1) * 5 + Math.min(5, Math.max(0, st.at - 1)));
function doorsOf(st) {
  const v = new Float32Array(ND), k = doorOf(st);
  v.fill(1, 0, k);
  if (st.at >= 1 && st.at <= 5 && !st.hold) v[k] = st.live ? 2 : NEXT;
  return v;
}

/* ---------- rendering & 0fps-at-rest frame loop ---------- */
function paint(el, draw = true) {
  const tw = el.tower, canvas = el.querySelector("canvas.tw-body");
  if (!tw || !canvas) return;
  const top = topOf(tw.st.floor);
  if (tw.model?.top !== top) {
    if (!modelBuilt(top)) {
      tw.waiting ||= prebuildModel(top).then(() => {
        tw.waiting = null;
        if (el.tower === tw) { paint(el, !tw.coming); if (!tw.coming) mark(el, false); }
      });
      return;
    }
    tw.model = buildModel(top);
  }
  if (!draw) return;
  tw.coming = false;
  let v = tw.cam || viewOf(tw.kind, tw.s, tw.m, top);
  if (tw.look && !tw.cam) {
    const yaw = tw.look.yaw || 0, dy = tw.look.dy || 0;
    const dx = v.eyeX - v.tgtX, dz = v.eyeZ - v.tgtZ, c = Math.cos(yaw), sn = Math.sin(yaw);
    v = { ...v, eyeX: v.tgtX + dx * c + dz * sn, eyeZ: v.tgtZ - dx * sn + dz * c, eyeY: v.eyeY + dy, tgtY: v.tgtY + dy };
  }
  tw.view = cameraOf(tw.m, v);
  const showLeads = tw.m.hall && !el.twIn && tw.leadAlpha > 0.01;
  const cm = showLeads ? computeClimbers(tw) : null;
  render(canvas, tw.model, tw.view, tw.pal, {
    doors: tw.doors,
    reveal: tw.reveal,
    curFloor: tw.curFloor,
    activeDoor: tw.activeDoor,
    lift: tw.lift,
    diveDim: tw.diveDim,
    held: tw.held,
    topFade: tw.m.hall && tw.diveDim < 0.01 && !tw.lift,
    leads: cm ? cm.leads : null,
    leadAlpha: tw.leadAlpha,
  }, tw.m);
}

/* 0fps at rest: the loop runs only while an animation is active and stops the frame it finishes */
function run(el) {
  const tw = el.tower;
  if (!tw || tw.loop) return;
  const frame = now => {
    if (el.tower !== tw || !el.isConnected) { tw.loop = 0; return; }
    for (const a of [...tw.anims]) {
      a.t0 ??= now;
      const t = Math.min(1, (now - a.t0) / a.dur);
      a.step(a.ease(t));
      if (t >= 1) { tw.anims.delete(a); a.done(); }
    }
    paint(el);
    tw.loop = tw.anims.size ? requestAnimationFrame(frame) : 0;
  };
  tw.loop = requestAnimationFrame(frame);
}

function animate(el, dur, step, ease = inout) {
  const tw = el.tower;
  if (!tw) return Promise.resolve();
  return new Promise(done => { tw.anims.add({ t0: null, dur, step, ease, done }); run(el); });
}

function finish(el) {
  const tw = el.tower;
  if (!tw?.anims.size) return;
  for (const a of [...tw.anims]) { a.step(a.ease(1)); tw.anims.delete(a); a.done(); }
  paint(el);
}

function tweenTo(el, st, dur = DUR.tone) {
  const tw = el.tower;
  if (!tw) return Promise.resolve();
  const from = tw.doors.slice(), to = doorsOf({ ...tw.st, ...st });
  tw.st = { ...tw.st, ...st };
  tw.curFloor = tw.st.floor - 1;
  tw.activeDoor = doorOf(tw.st);
  if (reduced()) { tw.doors = to; paint(el); return Promise.resolve(); }
  return animate(el, dur, e => { for (let i = 0; i < to.length; i++) tw.doors[i] = from[i] + (to[i] - from[i]) * e; }, out3);
}

/* ---------- climbers' architectural dimension lines (rendered in WebGL, labels in DOM — zero SVG) ---------- */
const escapeHTML = s => String(s).replace(/[&<>"]/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[ch]);
function computeClimbers(tw) {
  const { m, st, view } = tw;
  if (!view || !st.climbers?.length) return null;
  const floors = new Map(), top = topOf(st.floor);
  for (const c of st.climbers) {
    const k = Math.min(ND - 1, c.wins), f = Math.floor(k / 5) + 1;
    if (f > top) continue;
    if (!floors.has(f)) floors.set(f, { f, n: 0, live: false });
    const x = floors.get(f);
    x.n++; x.live ||= Boolean(c.live);
  }
  const items = [...floors.values()].sort((a, b) => b.f - a.f);
  if (!items.length) return null;

  const col = Math.min(m.W - (m.phone ? 74 : 112), m.W * (m.phone ? 0.80 : 0.82));
  const marks = [];
  for (const it of items) {
    const edge = rightEdgeOf(it.f - 1);
    const [x, y, w] = view.project([edge.x, edge.y, edge.z]);
    if (w <= 0 || y < 26 || y > m.H - 22 || x > col - 18) continue;
    marks.push({ it, on: it.f === st.floor, x, y });
  }
  if (!marks.length) return null;

  let last = -Infinity;
  const gap = m.phone ? 26 : 34;
  for (const k of marks) { k.ly = Math.max(k.y, last + gap); last = k.ly; }
  const kept = marks.filter(k => k.ly < m.H - 18);
  if (!kept.length) return null;

  // Clean 6px architectural breathing gap from 3D edge so horizontal WebGL rules never kink awkwardly against perspective lines
  const leads = [];
  for (const k of kept) {
    const sx = k.x + 6;
    const ex = col - 8;
    if (ex <= sx + 4) continue;
    if (Math.abs(k.ly - k.y) < 1.5) {
      leads.push({ x0: sx, y0: k.ly, x1: ex, y1: k.ly, on: k.on });
    } else {
      const mid = Math.min(ex - 10, sx + 12);
      const knee = ex - 8;
      leads.push({ x0: sx, y0: k.y, x1: mid, y1: k.y, on: k.on });
      leads.push({ x0: mid, y0: k.y, x1: knee, y1: k.ly, on: k.on });
      leads.push({ x0: knee, y0: k.ly, x1: ex, y1: k.ly, on: k.on });
    }
  }
  const html = kept.map(k =>
    `<span class="tw-tag${k.on ? " on" : ""}" style="left:${f1(col)}px;top:${f1(k.ly)}px">`
    + `<b>${k.it.live ? `<i class="lamp sig" aria-hidden="true"></i>` : ""}${escapeHTML(`${k.it.f}층`)}</b>`
    + `<span>${k.it.n}<small>명</small></span></span>`
  ).join("");
  return { leads, html };
}

const themeOf = () => `${document.documentElement.dataset.theme || ""}${document.documentElement.dataset.contrast || ""}`;
const marksOf = el => [...el.querySelectorAll(".tw-tag")];

function mark(el, show = true) {
  const tw = el.tower;
  marksOf(el).forEach(x => x.remove());
  if (!tw?.m.hall || el.twIn) {
    if (tw) { tw.leadAlpha = 0; paint(el); }
    return;
  }
  const cm = computeClimbers(tw);
  if (!cm) { tw.leadAlpha = 0; paint(el); return; }
  el.querySelector(".tw-cam")?.insertAdjacentHTML("beforeend", cm.html);
  if (show && !reduced()) {
    marksOf(el).forEach((x, i) => void fade(x, 0, 1, DUR.tone, { delay: i * STAGGER.row }));
    void animate(el, DUR.tone, e => { tw.leadAlpha = e; }, out3);
  } else {
    tw.leadAlpha = 1;
    paint(el);
  }
}

/* ---------- hand interaction: vertical elevation scrub + ±18° architectural parallax ---------- */
const SLOP = 6, MAX_YAW = 18 * Math.PI / 180, GLIDE_DECAY = 280, REST = 840, HOME = 420;
function hand(el) {
  if (el.twHand) return;
  el.twHand = true;
  let g = null, raf = 0;
  const stop = () => { cancelAnimationFrame(raf); raf = 0; };
  const clampLook = (tw, dy, yaw) => {
    const top = topOf(tw.st.floor), baseY = tw.curFloor * FLOOR_H;
    return {
      dy: Math.max(-baseY - 0.2, Math.min((top - 1) * FLOOR_H - baseY + 0.6, dy)),
      yaw: Math.max(-MAX_YAW, Math.min(MAX_YAW, yaw)),
    };
  };
  const lookAt = (tw, dy, yaw) => {
    tw.look = clampLook(tw, dy, yaw);
    paint(el);
    mark(el, false);
  };
  const glide = (tw, vy, vyaw) => {
    let last = performance.now(), still = null, home = null;
    const frame = now => {
      if (el.tower !== tw || !el.isConnected || !tw.look) { raf = 0; return; }
      const dt = Math.min(48, now - last);
      last = now;
      if (Math.hypot(vy, vyaw) > 1e-4) {
        const dec = Math.exp(-dt / GLIDE_DECAY);
        vy *= dec; vyaw *= dec;
        lookAt(tw, tw.look.dy + vy * dt, tw.look.yaw + vyaw * dt);
      } else if ((still ??= now) + REST > now) { /* resting without repainting */ }
      else {
        home ??= { t0: now, from: { ...tw.look } };
        const e = out3(Math.min(1, (now - home.t0) / HOME));
        if (e >= 1) { tw.look = null; paint(el); raf = 0; mark(el, false); return; }
        tw.look = { dy: home.from.dy * (1 - e), yaw: home.from.yaw * (1 - e) };
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
    stop();
    g = { id: e.pointerId, x: e.clientX, y: e.clientY, touch: e.pointerType === "touch", on: false, base: tw.look ? { ...tw.look } : { dy: 0, yaw: 0 }, trail: [] };
  });
  el.addEventListener("pointermove", e => {
    const tw = el.tower;
    if (!g || e.pointerId !== g.id || !tw) return;
    if (!g.on) {
      const dx = e.clientX - g.x, dy = e.clientY - g.y;
      if (Math.hypot(dx, dy) < SLOP) return;
      // on a phone, vertical touch stays the page's scroll; horizontal touch gives ±18° parallax
      if (g.touch && Math.abs(dy) >= Math.abs(dx)) { g = null; if (tw.look) glide(tw, 0, 0); return; }
      Object.assign(g, { on: true, x: e.clientX, y: e.clientY });
      tw.held = true;
      el.setPointerCapture?.(e.pointerId);
      el.classList.add("held");
    }
    g.trail.push([e.timeStamp, e.clientX, e.clientY]);
    while (g.trail.length > 2 && e.timeStamp - g.trail[0][0] > 80) g.trail.shift();
    const nextDy = g.touch ? g.base.dy : g.base.dy + (e.clientY - g.y) / Math.max(120, tw.m.H) * 5.2;
    const nextYaw = g.base.yaw - (e.clientX - g.x) / Math.max(180, tw.m.W) * 0.65;
    lookAt(tw, nextDy, nextYaw);
  });
  const end = e => {
    const tw = el.tower, was = g;
    if (!was || e.pointerId !== was.id) return;
    g = null;
    el.classList.remove("held");
    if (!tw) return;
    tw.held = false;
    if (!was.on) { if (tw.look) glide(tw, 0, 0); return; }
    const a = was.trail[0], b = was.trail.at(-1);
    const moving = e.type === "pointerup" && a && b && b[0] > a[0] && e.timeStamp - b[0] < 60;
    const vy = moving && !was.touch ? (b[2] - a[2]) / (b[0] - a[0]) / Math.max(120, tw.m.H) * 5.2 : 0;
    const vyaw = moving ? -(b[1] - a[1]) / (b[0] - a[0]) / Math.max(180, tw.m.W) * 0.65 : 0;
    paint(el);
    glide(tw, Math.max(-0.012, Math.min(0.012, vy)), Math.max(-0.002, Math.min(0.002, vyaw)));
  };
  el.addEventListener("pointerup", end);
  el.addEventListener("pointercancel", end);
}

/* ---------- public mounting & theme sync ---------- */
export function drawTower(el, st, coming = false) {
  const W = el.clientWidth, H = el.clientHeight;
  if (!W || !H) return false;
  el.tower?.anims.forEach(a => a.done());
  const hall = el.classList.contains("tw-hall");
  el.innerHTML = `<div class="tw-cam"><canvas class="tw-body" aria-hidden="true"></canvas></div>`;
  const k = doorOf(st);
  el.tower = {
    m: { W, H, hall, phone: W < 520 },
    st: { ...st },
    theme: themeOf(),
    pal: paletteOf(),
    model: null,
    doors: doorsOf(st),
    kind: hall ? "hall" : "close",
    s: k,
    curFloor: st.floor - 1,
    activeDoor: k,
    reveal: coming ? 0 : 1,
    cam: null,
    look: null,
    view: null,
    lift: null,
    diveDim: 0,
    leadAlpha: coming ? 0 : 1,
    held: false,
    anims: new Set(),
    loop: 0,
    coming,
  };
  if (hall) hand(el);
  paint(el, !coming);
  if (!coming) mark(el, false);
  return true;
}

const sameState = (a, b) => a.floor === b.floor && a.at === b.at && a.live === b.live && !a.hold === !b.hold
  && JSON.stringify(a.climbers || []) === JSON.stringify(b.climbers || []);

export function standTower(el, st) {
  const was = el.tower;
  if (!was) { if (drawTower(el, st, !reduced())) el.tower.queue = entrance(el); return; }
  // 0ms uniform theme swap — never tears down DOM or rebuilds mesh
  if (was.theme !== themeOf()) {
    was.theme = themeOf();
    was.pal = paletteOf();
    if (!was.coming && !was.waiting) paint(el);
  }
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
  const from = tw.s, to = doorOf(st), walks = from !== to, climbing = st.floor !== tw.st.floor;
  if (walks) {
    marksOf(el).forEach(x => void fade(x, 1, 0, DUR.tone, { easing: EASE_IN }));
    void animate(el, DUR.tone, e => { tw.leadAlpha = 1 - e; }, in3);
  }
  const moveDur = climbing ? STEP_CLIMB : STEP_SAME;
  await Promise.all([
    tweenTo(el, st, DUR.light),
    walks ? animate(el, moveDur, e => { tw.s = from + (to - from) * e; }, inout) : null,
  ]);
  if (el.tower === tw) mark(el);
}

/* theme or high-contrast switched: update uniform palette in <1ms with zero mesh rebuild */
if (typeof MutationObserver !== "undefined" && typeof document !== "undefined") {
  new MutationObserver(() => {
    const next = themeOf();
    document.querySelectorAll(".tw").forEach(el => {
      if (!el.tower || el.tower.theme === next) return;
      el.tower.theme = next;
      el.tower.pal = paletteOf();
      if (!el.tower.coming && !el.tower.waiting) paint(el);
    });
  }).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "data-contrast"] });
}

/* ---------- the scenes ---------- */
/* 0. coming to the tab (900ms, 3-beat coverOpen grammar) */
async function entrance(el) {
  const tw = el.tower;
  if (!tw || reduced()) return;
  if (tw.waiting) { await tw.waiting; if (el.tower !== tw) return; }
  const top = topOf(tw.st.floor), target = doorsOf(tw.st), k = doorOf(tw.st);
  marksOf(el).forEach(x => { x.style.opacity = "0"; });
  await new Promise(resolve => requestAnimationFrame(resolve));
  if (el.tower !== tw) return;
  tw.doors.fill(0);
  tw.reveal = 0;
  tw.leadAlpha = 0;
  await animate(el, ENTRANCE, e => {
    tw.reveal = Math.min(1, e / 0.74);
    tw.cam = e >= 1 ? null : mixView(viewOf("whole", tw.s, tw.m, top), viewOf("hall", tw.s, tw.m, top), out3(e));
    for (let i = 0; i < ND; i++) {
      if (!target[i]) continue;
      const start = i >= k ? 0.74 : 0.28 + 0.40 * (i / Math.max(1, k));
      tw.doors[i] = target[i] * smooth(start, start + 0.16, e);
    }
  }, linear);
  if (el.tower !== tw) return;
  tw.doors = target;
  tw.reveal = 1;
  tw.cam = null;
  paint(el);
  mark(el);
}

/* 1. between games: crisp arrival over the stage (420ms) */
async function arrive(el) {
  if (el.tower?.waiting) await el.tower.waiting;
  void fade(el.querySelector(".tw-body"), 0, 1, DUR.leave);
  const tw = el.tower;
  if (!tw) return;
  tw.reveal = 1;
  return animate(el, ARRIVE, e => {
    const b = viewOf(tw.kind, tw.s, tw.m, topOf(tw.st.floor));
    const a = { ...b, eyeX: b.eyeX - 0.6, eyeY: b.eyeY + 0.35, eyeZ: b.eyeZ * 1.16 };
    tw.cam = e >= 1 ? null : mixView(a, b, e);
  }, out3);
}

/* 2. a game won: previous portal solidifies to --lit, camera steps or climbs, next portal lights */
async function step(el, st) {
  const tw = el.tower, from = tw.s, to = doorOf(st), climbing = st.floor > tw.st.floor;
  sfx("select");
  marksOf(el).forEach(x => void fade(x, 1, 0, DUR.tone, { easing: EASE_IN }));
  tw.leadAlpha = 0;
  await tweenTo(el, { ...tw.st, hold: true }, DUR.tone);
  sfx("swoosh", { sec: 0.6 });
  const moveDur = climbing ? STEP_CLIMB : STEP_SAME;
  await animate(el, moveDur, e => {
    tw.s = from + (to - from) * e;
    if (climbing && e > 0.45) tw.curFloor = st.floor - 1;
  }, inout);
  if (el.tower !== tw) return;
  tw.st = { ...tw.st, ...st, hold: false };
  tw.curFloor = tw.st.floor - 1;
  tw.activeDoor = to;
  mark(el);
  sfx("turn");
  await animate(el, DUR.leave, e => { tw.doors[to] = -e; }, out3);
  if (el.tower !== tw) return;
  tw.doors = doorsOf(tw.st);
  paint(el);
}

export async function towerBreak(el, { floor, at: game, climbing = false, again = false }) {
  const now = { floor, at: game, live: true, climbers: null };
  const before = again ? now : climbing ? { floor: floor - 1, at: 5, live: true, climbers: null } : game > 1 ? { floor, at: game - 1, live: true, climbers: null } : now;
  if (!drawTower(el, reduced() ? now : before) || reduced()) return;
  await arrive(el);
  if (el.tower?.st && doorOf(before) !== doorOf(now)) await step(el, now);
}

export async function towerShow(target, { floor, at: game, climbing = false, again = false }) {
  towerDrop(true);
  if (!target) return;
  const hall = target.classList.contains("tw-hall");
  const el = hall ? target : Object.assign(document.createElement("div"), { className: "tw over" });
  if (!hall) { el.setAttribute("aria-hidden", "true"); target.appendChild(el); }
  scene = { el, own: !hall };
  const keep = hall ? { climbers: el.tower?.st.climbers } : {};
  const now = { ...keep, floor, at: game, live: true };
  const before = hall || again ? now : climbing ? { floor: floor - 1, at: 5, live: true } : game > 1 ? { floor, at: game - 1, live: true } : now;
  if (reduced()) { drawTower(el, now); await pause(420); return; }
  if (hall) {
    el.twIn = true;
    for (const x of marksOf(el)) void fade(x, Number(getComputedStyle(x).opacity), 0, DUR.tone, { easing: EASE_IN }).then(() => x.remove());
    finish(el);
    if (el.tower) el.tower.look = null;
    const was = el.tower?.st;
    if (was && was.floor === floor && was.at === game) void tweenTo(el, { ...was, live: true }, DUR.tone);
    else drawTower(el, now);
    sfx("turn");
  } else {
    drawTower(el, before);
    void fade(el, 0, 1, DUR.leave);
    await arrive(el);
  }
  const mine = () => scene?.el === el;
  if (mine() && doorOf(before) !== doorOf(now)) await step(el, now);
  if (mine()) await pause(READ);
}

/* 3. going in (700ms): align dead-centre + dim surrounding floors (280ms), then push through 3D portal jambs into --ground (420ms) */
export async function towerDive() {
  if (!scene) return;
  const { el, own } = scene;
  scene = null;
  if (!reduced()) {
    const main = document.getElementById("ypl-main"), rest = [];
    for (let x = el; x && x !== main && x.parentElement; x = x.parentElement) {
      rest.push(...[...x.parentElement.children].filter(y => y !== x && !y.classList.contains("tw")));
    }
    left = rest.map(x => x.animate([{ opacity: getComputedStyle(x).opacity }, { opacity: 0 }], { duration: DUR.leave, delay: ALIGN * 0.6, easing: EASE_IN, fill: "both" }));
  }
  const tw = el.tower, box = el.getBoundingClientRect();
  if (tw?.model && !reduced()) {
    finish(el);
    const top = topOf(tw.st.floor), door = doorOf(tw.st);
    const startV = tw.cam || viewOf(tw.kind, tw.s, tw.m, top);
    const alignV = viewOf("align", door, tw.m, top);
    const diveV = viewOf("dive", door, tw.m, top);
    const d0 = tw.doors[door];
    for (const x of marksOf(el)) void fade(x, 1, 0, DUR.tone, { easing: EASE_IN });
    tw.leadAlpha = 0;
    sfx("swoosh", { sec: 0.45 });
    await animate(el, ALIGN, e => {
      tw.cam = mixView(startV, alignV, out3(e));
      tw.doors[door] = d0 + (2 - d0) * e;
      tw.diveDim = smooth(0.1, 1.0, e);
    }, linear);
    sfx("swoosh", { sec: 0.4 });
    await animate(el, DIVE, e => {
      tw.cam = mixView(alignV, diveV, in3(e));
      tw.lift = { door, mix: smooth(0.05, 0.55, e) };
      tw.diveDim = 1;
    }, linear);
  }
  const dark = Object.assign(document.createElement("div"), { className: "tw-veil" });
  dark.setAttribute("aria-hidden", "true");
  const top = Math.max(0, box.top), bottom = Math.min(innerHeight, box.bottom);
  Object.assign(dark.style, { left: `${box.left}px`, top: `${top}px`, width: `${box.width}px`, height: `${Math.max(0, bottom - top)}px` });
  (document.querySelector(".ypl") || document.body).appendChild(dark);
  if (own) el.remove();
  veil = { el: dark };
}

const boxOf = el => {
  const r = el.getBoundingClientRect(), top = Math.max(0, r.top);
  const foot = parseFloat(getComputedStyle(el.closest(".page") || document.body).paddingBottom) || 0;
  return { left: r.left, top, width: r.width, height: Math.max(0, innerHeight - foot - top) };
};
const clearVeil = el => fade(el, 1, 0, DUR.light).then(() => el.remove());

/* 4. handoff to the next screen's stage by compositor transform alone */
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

export function towerDrop(now = false) {
  const s = scene, c = veil;
  scene = null; veil = null;
  letGo();
  document.querySelectorAll(".tw-hall").forEach(x => { x.twIn = false; });
  if (s?.own) {
    if (now || reduced()) s.el.remove();
    else void fade(s.el, 1, 0, DUR.leave).then(() => s.el.remove());
  }
  if (s && !s.own && s.el.tower) drawTower(s.el, { ...s.el.tower.st, live: false });
  if (c) { if (now || reduced()) c.el.remove(); else void clearVeil(c.el); }
}
