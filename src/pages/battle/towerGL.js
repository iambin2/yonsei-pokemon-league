/* 도전의 탑's tower modelled in 3D (DESIGN.md "Battle", The tower, the tenth pass; 2026-11-16, the user: the ninth pass stood "빈 공간에
   탑만 덩그러니 놓인 느낌이라, 가상의 요소처럼 느껴져서 몰입이 깨져", and its lamp's light ran from door to door). One WebGL2 context,
   shared and never on the page: each draw renders into it and copies the picture into the scene's own 2D canvas, so a scene costs
   no context of its own and a removed one leaves nothing behind.

   One place: a round tower whose terrace winds up round it, one turn a floor, a floor's five games five doors on that road (the
   fifth the gatekeeper's gate). It stands somewhere: a plaza with a low wall, the road in with its lamps, a wood, two ridges on
   the horizon, a sea of cloud at the fifth floor, and a moon that keeps its place in the world. The mesh holds the stone only;
   which doors are lit is a uniform per door (uDoor), so a lamp changing is a value going from one to the other, never a new mesh. */

export const PITCH = 0.86;             // a floor's height (one turn of the terrace) to the wall's radius
export const RW = 1;                   // the wall's radius
export const RR = 1.36;                // the terrace's outer edge
export const GY = -0.38;               // the ground
/* the road's lamps at .55 of their first height, two thirds of a door (2026-11-18, the owner's draft B: they stood taller than the doors
   and gave the tower no size) */
export const LAMP = 0.55;
export const YC = 4.75;                // the sea of cloud, between the fifth floor and the sixth
export const ND = 120;                 // doors a tower can hold (uDoor): twenty-four floors
const RAD = Math.PI / 180, SEG = 72;
// ponytail: a run past the twenty-second floor (110 wins) stands on the last floors of a 24-floor tower; window the mesh if one ever does
export const topOf = floor => Math.min(ND / 5, Math.max(10, floor + 2));
// door k (0 the first floor's first; any real number along the road) at radius r, dy over its sill
export const doorPoint = (k, r = RW, dy = 0) => { const th = (k + .5) * SEG * RAD; return [r * Math.sin(th), (k + .5) / 5 * PITCH + dy, r * Math.cos(th)]; };
// the moon's place in the world, low over the far ridges where the road comes in, so a floor's first door and its gate stand in its
// light and its third has the moon behind it; the light falls from a little higher so the terraces take some of it
const MOON = [.1384, .1045, .9848];
const LIGHT = (() => { const v = [MOON[0], MOON[1] + .16, MOON[2]], n = Math.hypot(...v); return v.map(x => x / n); })();

/* ---------- the camera ---------- */
const mul4 = (a, b) => {
  const o = new Float32Array(16);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
    let s = 0;
    for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k];
    o[c * 4 + r] = s;
  }
  return o;
};
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const unit = a => { const n = Math.hypot(...a) || 1; return a.map(x => x / n); };

/* where the camera stands for door s (a real number while it walks the road), in a box m ({ W, H }) before a tower of top floors:
   close, between games, before the door; hall, the tab, the run's floor and the ones round it; whole, the tower from its plaza to
   its lantern (the entrance's first frame); door, in the doorway (the end of going in). A view is { phi, dist, camY, tgtY, focal,
   shift }: round the axis by phi at dist, at camY, looking at the axis at tgtY, the picture shifted across by shift */
export function viewOf(kind, s, m, top) {
  const T = (s + .5) * SEG * RAD, y = (s + .5) / 5 * PITCH, half = m.W / m.H / 2;
  if (kind === "whole") { const h = top * PITCH + 2.3; return { phi: T - 1.5, dist: h * 2.05, camY: h * .5 + 2.5, tgtY: h * .5 - .35, focal: 1.75, shift: 0 }; }
  if (kind === "door") return { phi: T, dist: 1.02, camY: y + .2, tgtY: y + .2, focal: 2, shift: 0 };
  /* the tab looks up the road from the foot of the run's door (2026-11-18, the owner's draft C, "올려다보는 구도가 너무 좋은데"): the door
     low in the picture, the floors to climb going up over it into the night */
  if (kind === "hall") return { phi: T - .3, dist: 6.2 * Math.max(1, .62 / half), camY: y + .1, tgtY: y + 2.1, focal: 1.25, shift: half > .7 ? -.18 : -.08 };
  return { phi: T - .22, dist: 5.4 * Math.max(1, .62 / half), camY: y + .8, tgtY: y + .25, focal: 2, shift: 0 };
}
export const mixView = (a, b, e) => Object.fromEntries(Object.keys(a).map(k => [k, a[k] + (b[k] - a[k]) * e]));

export function cameraOf(m, v) {
  const pos = [Math.sin(v.phi) * v.dist, v.camY, Math.cos(v.phi) * v.dist];
  const f = unit([-pos[0], v.tgtY - pos[1], -pos[2]]), rt = unit(cross(f, [0, 1, 0])), up = cross(rt, f);
  const asp = m.W / m.H, F = 2 * v.focal, sx = 2 * v.shift / asp;
  const near = Math.min(.05, Math.max(.002, (v.dist - 1) * .02)), far = 4000, A = (far + near) / (far - near), B = -2 * far * near / (far - near);
  const view = [rt[0], up[0], -f[0], 0, rt[1], up[1], -f[1], 0, rt[2], up[2], -f[2], 0, -dot(rt, pos), -dot(up, pos), dot(f, pos), 1];
  const proj = [F / asp, 0, 0, 0, 0, F, 0, 0, -sx, 0, -A, -1, 0, 0, B, 0];
  const vp = mul4(proj, view);
  const project = ([x, y, z]) => {
    const X = vp[0] * x + vp[4] * y + vp[8] * z + vp[12], Y = vp[1] * x + vp[5] * y + vp[9] * z + vp[13], W = vp[3] * x + vp[7] * y + vp[11] * z + vp[15];
    return [(X / W + 1) / 2 * m.W, (1 - Y / W) / 2 * m.H];
  };
  return { vp, project, pos, f, rt, up, focal: v.focal, shift: v.shift, phi: v.phi };
}

/* ---------- colour ---------- */
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
let probe = null;
// the scene's tones as the board sets them on el (custom properties of .tw), read as rgb 0..1 through a 1px canvas; the place's
// own tones (the ridges, the cloud, the wood, the road) are steps between them, never a new hue
export function paletteOf(el) {
  probe ||= document.createElement("canvas").getContext("2d", { willReadFrequently: true });
  const style = getComputedStyle(el), i = document.createElement("i");
  i.style.display = "none"; el.appendChild(i);
  const read = expr => {
    i.style.color = expr;
    probe.fillStyle = "#000"; probe.fillStyle = getComputedStyle(i).color;
    probe.fillRect(0, 0, 1, 1);
    const d = probe.getImageData(0, 0, 1, 1).data;
    return [d[0] / 255, d[1] / 255, d[2] / 255];
  };
  const v = name => read(`var(${name})`);
  const day = style.getPropertyValue("--tw-day").trim() === "1";
  // a lamp is the amber itself in both themes (the day's --signal is the deeper amber words are set in)
  const amber = v(day ? "--amber" : "--signal");
  const p = {
    stone: v("--tw-stone"), wallLit: v("--tw-b"), wallShade: v("--tw-e"), tread: v("--tw-tread"),
    pane: v("--tw-pane"), amber, sky: v("--tw-sky-top"), fog: v("--tw-sky-low"), g0: v("--tw-g0"), g1: v("--tw-g1"),
    ground: v("--ground"),
    // a won room's light: warm; in the day deepened toward the amber so a won door still reads on white stone
    warm: mix(v("--tw-warm"), amber, day ? 0.38 : 0),
    // light itself: the board's lit tone at night; in the day the words are navy, so the light is white
    lit: day ? [1, 1, 1] : v("--lit"),
    // what a door's room becomes as the camera walks in: the stage's own ground, which the next screen comes up out of
    lift: v("--ground"),
    light: day,
  };
  const deep = day ? p.wallShade : p.pane;
  Object.assign(p, {
    far: mix(p.fog, deep, day ? .34 : .42), near: mix(p.fog, deep, day ? .6 : .8),
    cloudLo: day ? mix(p.lit, p.wallShade, .3) : mix(p.ground, p.fog, .45), cloudHi: day ? p.lit : mix(p.fog, p.wallLit, .55),
    moon: day ? mix(p.lit, amber, .35) : mix(p.lit, amber, .08),
    wood: day ? mix(p.wallShade, p.pane, .12) : mix(p.pane, p.g1, .5), woodShade: day ? mix(p.wallShade, p.pane, .4) : p.pane,
    road: day ? p.lit : mix(p.g0, p.stone, .3),
  });
  i.remove();
  return p;
}

/* ---------- the mesh ---------- */
/* a vertex: position 3, normal 3, lit colour 4 (alpha), shade colour 3, x 4 (ao, courses, kind, flat), uv 2 (on the wall its arc
   length and height; in a doorway its share of the door's height), door 4 (its id or -1, its role, the hinge x z of a gate's leaf).
   Kinds: 0 stone, 1 the ground, 2 the wood, 3 a lamp's head. Roles: 1 a room's back, 2 a jamb, soffit or threshold (lit by its room),
   3 and 4 the gate's left and right leaf (they swing in as the gate is reached), 6 the seam between the leaves (gone once they open) */
const STRIDE = 23;
function mesh() {
  const M = { a: new Float32Array(STRIDE * 6 * 4096), n: 0 };
  const put = (x) => { M.a[M.n++] = x; };
  const v = (p, nn, s, uv = ZERO, d = NO) => {
    if (M.n + STRIDE > M.a.length) { const b = new Float32Array(M.a.length * 2); b.set(M.a); M.a = b; }
    put(p[0]); put(p[1]); put(p[2]); put(nn[0]); put(nn[1]); put(nn[2]);
    put(s.lit[0]); put(s.lit[1]); put(s.lit[2]); put(1); put(s.shade[0]); put(s.shade[1]); put(s.shade[2]);
    put(s.ao ?? 0); put(s.course ? 1 : 0); put(s.kind ?? 0); put(s.flat ? 1 : 0); put(uv[0]); put(uv[1]); put(d[0]); put(d[1]); put(d[2] || 0); put(d[3] || 0);
  };
  // a quad p0 p1 p2 p3 (any winding), with a normal and surface per corner (or one for all)
  M.quad = (ps, ns, ss, uvs = [], d = NO) => { for (const i of TRI) v(ps[i], ns[i] || ns[0], ss[i] || ss[0], uvs[i] || ZERO, d); };
  M.tri = (ps, ns, s) => { for (let i = 0; i < 3; i++) v(ps[i], ns[i] || ns[0], s); };
  M.done = () => M.a.slice(0, M.n);
  return M;
}
const TRI = [0, 1, 2, 0, 2, 3], ZERO = [0, 0], NO = [-1, 0];
const P = (r, th, y) => [r * Math.sin(th * RAD), y, r * Math.cos(th * RAD)];
const radial = th => [Math.sin(th * RAD), 0, Math.cos(th * RAD)];
const tangent = th => [Math.cos(th * RAD), 0, -Math.sin(th * RAD)];
const UP = [0, 1, 0];

/* a profile ([r, y, ao] points, running up the outside and in over the top, so each piece faces out of it) swept round the axis
   from a to b degrees, lifted by yOf(angle): the terrace winding up, and every ring that is turned on a lathe */
function sweep(M, prof, a, b, step, sf, yOf = () => 0) {
  for (let q = 0; q < prof.length - 1; q++) {
    const [r0, y0, ao0 = 0] = prof[q], [r1, y1, ao1 = 0] = prof[q + 1];
    const dr = r1 - r0, dy = y1 - y0, L = Math.hypot(dr, dy) || 1, nr = dy / L, ny = -dr / L;
    const s = sf(q, ny), s0 = { ...s, ao: ao0 }, s1 = { ...s, ao: ao1 };
    for (let t = a; t < b - 1e-6; t += step) {
      const u = Math.min(b, t + step), ya = yOf(t), yb = yOf(u), N = th => { const r = radial(th); return [r[0] * nr, ny, r[2] * nr]; };
      M.quad([P(r0, t, y0 + ya), P(r0, u, y0 + yb), P(r1, u, y1 + yb), P(r1, t, y1 + ya)], [N(t), N(u), N(u), N(t)], [s0, s0, s1, s1]);
    }
  }
}

// a door's opening, by the turn's sector it stands in (the fifth is the gate's): half its width, its spring, its orders of frame
const doorOf = k => (k % 5 === 4
  ? { w: .27, s: .36, depth: .26, rings: [[.27, .33, 1.018], [.33, .385, 1.042]], gate: true }
  : { w: .15, s: .30, depth: .22, rings: [[.15, .206, 1.028]], gate: false });
// an arch of half width w springing at s, as points (x, y) from the left foot round to the right
const archOf = (w, s) => {
  const pts = [[-w, 0]];
  for (let psi = 180; psi >= 0; psi -= 10) pts.push([w * Math.cos(psi * RAD), s + w * Math.sin(psi * RAD)]);
  pts.push([w, 0]);
  return pts;
};

// (a generator: it stops between its pieces, so the mesh can be made a piece at a time; see prebuildModel)
function* towerMesh(M, top, pal) {
  const surf = (lit, shade, x = {}) => ({ lit, shade, ...x });
  const wall = surf(pal.wallLit, pal.wallShade, { course: true });
  const stone = surf(pal.stone, mix(pal.stone, pal.wallShade, 0.55));
  const stoneDeep = surf(mix(pal.stone, pal.wallShade, 0.25), mix(pal.stone, pal.wallShade, 0.75));
  const tread = surf(pal.tread, mix(pal.tread, pal.wallShade, 0.4));
  const dark = surf(mix(pal.pane, pal.wallShade, 0.25), pal.pane);
  const yTop = top * PITCH + .78, yBase = -.5, doors = top * 5;
  const sill = k => (k + .5) / 5 * PITCH;

  /* the wall: columns up the whole tower, cut where a door's arch opens in them. A turn's sector holds one door, the same in every
     turn, so a column crosses that door once a floor */
  const cuts = new Set();
  for (let t = 0; t <= 360; t += 3) cuts.add(t);
  for (let i = 0; i < 5; i++) for (const [x] of archOf(doorOf(i).w, 0)) cuts.add(+((i + .5) * SEG + x / RW / RAD).toFixed(4));
  const T = [...cuts].sort((a, b) => a - b);
  for (let c = 0; c < T.length - 1; c++) {
    const t0 = T[c], t1 = T[c + 1], i = Math.min(4, Math.floor((t0 + t1) / 2 / SEG)), d = doorOf(i), thc = (i + .5) * SEG;
    const x0 = (t0 - thc) * RAD * RW, x1 = (t1 - thc) * RAD * RW, inside = Math.abs((x0 + x1) / 2) < d.w;
    const crown = x => d.s + Math.sqrt(Math.max(0, d.w * d.w - x * x));
    const piece = (a0, b0, a1, b1) => M.quad([P(RW, t0, a0), P(RW, t1, b0), P(RW, t1, b1), P(RW, t0, a1)], [radial(t0), radial(t1), radial(t1), radial(t0)], [wall],
      [[t0 * RAD * RW, a0], [t1 * RAD * RW, b0], [t1 * RAD * RW, b1], [t0 * RAD * RW, a1]]);
    if (c % 24 === 23) yield;
    if (!inside) { piece(yBase, yBase, yTop, yTop); continue; }
    piece(yBase, yBase, sill(i), sill(i));
    for (let n = 0; n < top; n++) {
      const y = sill(i + 5 * n), next = n + 1 < top ? sill(i + 5 * n + 5) : yTop;
      piece(y + crown(x0), y + crown(x1), next, next);
    }
  }

  /* the doors. Each is an arch cut into the wall in a frame of stone standing out of it, its jambs and soffit going back to the
     room. The gatekeeper's gate is a portal: wider and taller, its frame in two orders stepping back, a keystone over them */
  for (let k = 0; k < doors; k++) {
    if (k % 3 === 0) yield;
    const d = doorOf(k), thc = (k + .5) * SEG, y0 = sill(k), hD = d.s + d.w, face = d.rings[0][2], back = RW - d.depth;
    const at = (x, y, r) => P(r, thc + x / RW / RAD, y0 + y), id = role => [k, role];
    const inner = archOf(d.w, d.s);
    // toward the opening's middle at a point of the arch
    const inward = ([x, y]) => { const tg = tangent(thc + x / RW / RAD), u = -x / d.w, v = -Math.max(0, y - d.s) / d.w; return [tg[0] * u, v, tg[2] * u]; };
    for (let q = 0; q < inner.length - 1; q++) {
      const a = inner[q], b = inner[q + 1];
      M.quad([at(a[0], a[1], face), at(b[0], b[1], face), at(b[0], b[1], back), at(a[0], a[1], back)], [inward(a), inward(b), inward(b), inward(a)], [dark],
        [[0, a[1] / hD], [0, b[1] / hD], [0, b[1] / hD], [0, a[1] / hD]], id(2));
      if (q > 0 && q < inner.length - 2) {
        M.quad([at(a[0], 0, back), at(b[0], 0, back), at(b[0], b[1], back), at(a[0], a[1], back)], [radial(thc)],
          [surf(mix(pal.pane, pal.wallShade, 0.2), pal.pane, { flat: true })], [[0, 0], [0, 0], [0, b[1] / hD], [0, a[1] / hD]], id(1));
      }
    }
    M.quad([at(-d.w, 0, face), at(d.w, 0, face), at(d.w, 0, back), at(-d.w, 0, back)], [UP], [tread], [], id(2));
    d.rings.forEach(([w0, w1, r], o) => {
      const a0 = archOf(w0, d.s), a1 = archOf(w1, d.s), tone = o === d.rings.length - 1 ? stone : stoneDeep;
      const outward = ([x, y]) => inward([x, y]).map(v => -v);
      for (let q = 0; q < a0.length - 1; q++) {
        M.quad([at(a0[q][0], a0[q][1], r), at(a0[q + 1][0], a0[q + 1][1], r), at(a1[q + 1][0], a1[q + 1][1], r), at(a1[q][0], a1[q][1], r)], [radial(thc)], [tone]);
        // the order's side, back to the wall
        M.quad([at(a1[q][0], a1[q][1], r), at(a1[q + 1][0], a1[q + 1][1], r), at(a1[q + 1][0], a1[q + 1][1], RW), at(a1[q][0], a1[q][1], RW)],
          [outward(a1[q]), outward(a1[q + 1]), outward(a1[q + 1]), outward(a1[q])], [stoneDeep]);
      }
    });
    if (d.gate) {
      /* the gate's two leaves, arched as the opening is, a deep tone of the stone on three iron straps, hung on the jambs: they swing
         in as the gate is reached, so a gate played or beaten stands open on its lit hall; while it is the next game the seam between
         them is lit at .382 */
      const rl = face - .04, tc = mix(pal.stone, pal.pane, .72);
      const leaf = surf(mix(tc, pal.lit, .06), mix(tc, pal.ground, pal.light ? .2 : .45)), iron = surf(mix(pal.pane, pal.stone, .4), mix(pal.pane, pal.ground, .2));
      for (let q = 1; q < inner.length - 2; q++) {
        const a = inner[q], b = inner[q + 1], side = a[0] + b[0] < 0 ? -1 : 1, hinge = at(side * d.w, 0, rl), lr = [k, side < 0 ? 3 : 4, hinge[0], hinge[2]];
        M.quad([at(a[0], 0, rl), at(b[0], 0, rl), at(b[0], b[1], rl), at(a[0], a[1], rl)], [radial(thc)], [leaf], [], lr);
        for (const f of [.12, .42, .7]) {
          const s0 = hD * f - .011, s1 = hD * f + .011;
          if (s1 < Math.min(a[1], b[1]) - .01) M.quad([at(a[0], s0, rl + .006), at(b[0], s0, rl + .006), at(b[0], s1, rl + .006), at(a[0], s1, rl + .006)], [radial(thc)], [iron], [], lr);
        }
      }
      M.quad([at(-.004, 0, rl + .008), at(.004, 0, rl + .008), at(.004, hD - .004, rl + .008), at(-.004, hD - .004, rl + .008)], [radial(thc)],
        [surf(pal.pane, pal.pane, { flat: true })], [[0, .3], [0, .3], [0, .3], [0, .3]], id(6));
    }
    // a keystone at the crown: over the gate's orders always, over a small door from the fourth floor up
    if (d.gate || k >= 15) {
      const g = d.gate ? 1 : .6, c0 = hD - .012, c1 = hD + (d.gate ? .135 : .084), r0 = d.rings[d.rings.length - 1][2], rk = r0 + .022 * g, a = -.05 * g, b = .05 * g, a1 = -.07 * g, b1 = .07 * g;
      M.quad([at(a, c0, rk), at(b, c0, rk), at(b1, c1, rk), at(a1, c1, rk)], [radial(thc)], [stone]);
      M.quad([at(a1, c1, r0), at(b1, c1, r0), at(b1, c1, rk), at(a1, c1, rk)], [UP], [stone]);
      M.quad([at(a, c0, RW), at(a, c0, rk), at(a1, c1, rk), at(a1, c1, RW)], [tangent(thc).map(v => -v)], [stoneDeep]);
      M.quad([at(b, c0, RW), at(b, c0, rk), at(b1, c1, rk), at(b1, c1, RW)], [tangent(thc)], [stoneDeep]);
    }
  }

  /* the terrace: its corbel under it at the wall, its underside, the lip at its edge, the parapet, and its top, winding up from the
     base to the last door's landing */
  const road = [[RW, -.13], [RW + .07, -.13], [RW + .07, -.08], [RR, -.08], [RR, -.06], [RR + .03, -.06], [RR + .03, -.02], [RR, -.02],
    [RR, .09], [RR - .056, .09], [RR - .056, 0, .1], [RW, 0, .34]];
  const yRoad = t => t / 360 * PITCH, end = top * 360;
  // it begins under the base's top, so it comes up out of the stone and no end of it shows
  for (let t = -45; t < end; t += 180) {
    yield;
    sweep(M, road, t, Math.min(end, t + 180), 5, (q, ny) => (q >= road.length - 2 ? tread : ny < -.5 ? stoneDeep : stone), yRoad);
  }
  yield;
  for (const [t, sg] of [[end, 1]]) {
    const n = tangent(t).map(v => v * sg), y = yRoad(t);
    M.quad([P(RW, t, y - .08), P(RR, t, y - .08), P(RR, t, y), P(RW, t, y)], [n], [stoneDeep]);
    M.quad([P(RR - .056, t, y), P(RR, t, y), P(RR, t, y + .09), P(RR - .056, t, y + .09)], [n], [stoneDeep]);
  }
  /* the floors rise in rank as the road goes up, each adding what the ones under it have not: from the second a string course
     across the wall over the doors' crowns (broken by each gate's portal), from the fourth a keystone on every door (above), from
     the eighth the parapet crenellated */
  const course = [[RW, .545], [RW + .016, .545], [RW + .016, .578], [RW, .578]];
  let from = 360;
  for (let g = 324 + 360; g < end; g += 360) { sweep(M, course, from, g - 26, 5, () => stone, yRoad); from = g + 26; }
  if (from < end) sweep(M, course, from, end, 5, () => stone, yRoad);
  for (let t = 7 * 360 + 3.75; t < end; t += 7.5) {
    const y0 = yRoad(t) + .09, y1 = y0 + .036, ri = RR - .056, a = t - 1.7, b = t + 1.7;
    M.quad([P(RR, a, y0), P(RR, b, y0), P(RR, b, y1), P(RR, a, y1)], [radial(t)], [stone]);
    M.quad([P(ri, a, y1), P(ri, b, y1), P(RR, b, y1), P(RR, a, y1)], [UP], [tread]);
    M.quad([P(ri, a, y0), P(RR, a, y0), P(RR, a, y1), P(ri, a, y1)], [tangent(a).map(v => -v)], [stoneDeep]);
    M.quad([P(ri, b, y0), P(RR, b, y0), P(RR, b, y1), P(ri, b, y1)], [tangent(b)], [stoneDeep]);
    M.quad([P(ri, a, y0), P(ri, b, y0), P(ri, b, y1), P(ri, a, y1)], [radial(t).map(v => -v)], [stoneDeep]);
  }
  yield;
  /* the crown: a cornice and a parapet round the roof, the lantern on it and its cap; and under the first floor the stepped base */
  sweep(M, [[RW, yTop - .07], [RW + .16, yTop - .07], [RW + .16, yTop + .15], [RW + .06, yTop + .15], [RW + .06, yTop + .07, .2], [.5, yTop + .07, .3],
    [.5, yTop + .62], [.66, yTop + .62], [.66, yTop + .68], [0, yTop + 1.56]], 0, 360, 6, (q, ny) => (q === 4 ? tread : ny < -.5 ? stoneDeep : stone));
  sweep(M, [[1.95, GY], [1.95, -.2], [1.62, -.2, .12], [1.62, -.03], [RW, -.03, .3]], 0, 360, 4, q => (q === 1 || q === 3 ? tread : stone));
}

/* the place the tower stands in: the ground out to the horizon (its paving, road and fields are the shader's), the plaza's low wall
   open where the road comes in, the road's six lamps, and the wood */
function* placeMesh(M, pal) {
  const ground = { lit: pal.g0, shade: pal.g0, kind: 1 };
  const rings = [0, 1.9, 3, 4.5, 7, 12, 22, 40, 80, 160, 400, 1000, 3000];
  for (let i = 0; i < rings.length - 1; i++) for (let t = 0; t < 360; t += 6) {
    M.quad([P(rings[i], t, GY), P(rings[i], t + 6, GY), P(rings[i + 1], t + 6, GY), P(rings[i + 1], t, GY)], [UP], [ground]);
  }
  const stone = { lit: pal.stone, shade: mix(pal.stone, pal.wallShade, 0.55) }, deep = { lit: mix(pal.stone, pal.wallShade, 0.4), shade: pal.wallShade };
  sweep(M, [[3.06, GY], [3.06, -.22], [2.94, -.22], [2.94, GY]], 12, 348, 4, () => stone);
  for (const [t, sg] of [[12, -1], [348, 1]]) M.quad([P(2.94, t, GY), P(3.06, t, GY), P(3.06, t, -.22), P(2.94, t, -.22)], [tangent(t).map(v => v * sg)], [deep]);
  const LS = LAMP, ly = y => GY + (y - GY) * LS;
  for (const sx of [-.66, .66]) for (let j = 0; j < 3; j++) {
    const z = 2.9 + 1.4 * j, at = (a, r, y) => [sx + r * Math.sin(a * RAD), y, z + r * Math.cos(a * RAD)];
    for (let a = 0; a < 360; a += 60) {
      M.quad([at(a, .02 * LS, GY), at(a + 60, .02 * LS, GY), at(a + 60, .02 * LS, ly(.09)), at(a, .02 * LS, ly(.09))], [radial(a), radial(a + 60), radial(a + 60), radial(a)], [deep]);
      for (const sg of [-1, 1]) M.tri([at(a, .04 * LS, ly(.13)), at(a + 60, .04 * LS, ly(.13)), [sx, ly(.13) + sg * .05 * LS, z]], [UP], { lit: pal.warm, shade: pal.warm, kind: 3 });
    }
  }
  /* the wood: conifers in three tiers, by the same fixed draw each time, none on the road. It begins beyond where the camera goes
     round the first floors, so no tree ever stands between the camera and the tower */
  let seed = 11;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const wood = { lit: pal.wood, shade: pal.woodShade, kind: 2 };
  for (let n = 0; n < 520; n++) {
    if (n % 60 === 0) yield;
    const r = 11 + 26 * rnd() ** 1.5, th = 360 * rnd(), h = .8 + .9 * rnd(), c = P(r, th, 0);
    if (Math.abs(c[0]) < 1.2 && c[2] > 0) continue;
    for (const [rb, y0, y1] of [[.42, .1 * h, .52 * h], [.32, .36 * h, .78 * h], [.2, .64 * h, h]]) for (let a = 0; a < 360; a += 60) {
      const p = (ang, rr, y) => [c[0] + rr * Math.sin(ang * RAD), GY + y, c[2] + rr * Math.cos(ang * RAD)];
      const nn = ang => { const q = radial(ang); return [q[0], rb / (y1 - y0), q[2]]; };
      M.tri([p(a, rb, y0), p(a + 60, rb, y0), p(a + 30, 0, y1)], [nn(a), nn(a + 60), nn(a + 30)], wood);
    }
  }
}

/* the mesh for a tower of top floors. It holds no state (doors are lit by uniforms) and no size (the camera makes it any size), so
   one is kept for each height and palette and a redraw or a resize builds nothing */
const built = new Map();
const keyOf = (top, pal) => `${top}:${JSON.stringify(pal)}`;
function* pieces(M, top, pal) { yield* towerMesh(M, top, pal); yield* placeMesh(M, pal); }
const keep = (key, top, M) => {
  const model = { top, solid: M.done() };
  if (built.size >= 3) built.delete(built.keys().next().value);
  built.set(key, model);
  return model;
};
export function buildModel(top, pal) {
  const key = keyOf(top, pal);
  if (built.has(key)) return built.get(key);
  const M = mesh();
  for (const _ of pieces(M, top, pal)) { /* all of it at once */ }
  return keep(key, top, M);
}
/* the same mesh made a piece at a time, before any tower is asked for: made at once it is one long task (a
   tenth of a second, half a second on a slow phone), in pieces none is longer than a frame or two */
export async function prebuildModel(top, pal) {
  const key = keyOf(top, pal);
  if (built.has(key)) return;
  const M = mesh();
  // a turn of the event loop between pieces lets a tap or a frame in (waiting for an idle moment each time took ten seconds in all)
  for (const _ of pieces(M, top, pal)) await new Promise(r => setTimeout(r));
  if (!built.has(key)) keep(key, top, M);
}

/* ---------- the shaders ---------- */
const NOISE = `
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f); return mix(mix(hash(i), hash(i + vec2(1., 0.)), f.x), mix(hash(i + vec2(0., 1.)), hash(i + vec2(1., 1.)), f.x), f.y); }
float fbm(vec2 p) { return .5 * vnoise(p) + .25 * vnoise(p * 2.03 + 7.) + .125 * vnoise(p * 4.1 + 13.) + .125 * vnoise(p * 8.2 + 3.); }`;
const VS = `#version 300 es
in vec3 aP; in vec3 aN; in vec4 aL; in vec3 aS; in vec4 aX; in vec2 aU; in vec4 aD;
uniform mat4 uVP; uniform float uDoor[${ND}];
out vec3 vN, vS, vW; out vec4 vL, vX, vD; out vec2 vU; out float vV;
void main() {
  vec3 p = aP, n = aN;
  float v = aD.x >= 0. ? uDoor[int(aD.x + .5)] : 0.;
  if (aD.y > 2.5 && aD.y < 4.5) {
    // a leaf of the gate swings in about its hinge as the gate is reached
    float a = smoothstep(.55, 1., abs(v)) * 1.65 * (aD.y < 3.5 ? 1. : -1.), c = cos(a), s = sin(a);
    vec2 r = p.xz - aD.zw;
    p.xz = aD.zw + vec2(r.x * c + r.y * s, -r.x * s + r.y * c);
    n.xz = vec2(n.x * c + n.z * s, -n.x * s + n.z * c);
  }
  vW = p; vN = n; vL = aL; vS = aS; vX = aX; vU = aU; vD = aD; vV = v;
  gl_Position = uVP * vec4(p, 1.);
}`;
const FS = `#version 300 es
precision highp float;
in vec3 vN, vS, vW; in vec4 vL, vX, vD; in vec2 vU; in float vV;
uniform vec3 uLight, uEye, uRim, uFog, uWarm, uAmber, uLift, uG0, uG1, uRoad, uMistC;
uniform float uDay, uFogN, uFogD, uLiftMix, uLiftDoor, uTopY, uMist;
uniform vec4 uPL[16], uPC[16]; uniform int uNL;
out vec4 o;
${NOISE}
/* the tower's shadow along the moonlight: whether the way from p toward the light passes inside its drum (radius rs), softer and
   fainter the further it falls */
float shade(vec3 p, float rs) {
  float lv = length(uLight.xz); vec2 vh = uLight.xz / lv;
  float along = -dot(p.xz, vh);
  if (along <= 0.) return 0.;
  float dmin = abs(p.x * vh.y - p.z * vh.x), soft = .04 + .05 * along;
  return (1. - smoothstep(rs * (1. - soft), rs * (1. + soft), dmin)) * step(p.y + along * uLight.y / lv, uTopY) * (1. - smoothstep(6., 30., along));
}
void main() {
  float role = vD.y, v = vV, kind = vX.z;
  if (role > 5.5 && abs(v) > .6) discard;
  vec3 n = normalize(vN), c;
  if (kind > 2.5) c = uWarm;
  else {
    if (kind > .5 && kind < 1.5) {
      // the ground: fields a little uneven, the plaza's paving, the road in to the tower's foot
      float r = length(vW.xz), road = smoothstep(.62, .5, abs(vW.x)) * step(0., vW.z) * smoothstep(40., 8., vW.z);
      c = mix(mix(uG1, uG0, fbm(vW.xz * .35)), uRoad, max(road, smoothstep(3.02, 2.94, r)));
    } else if (vX.w > .5) c = vL.rgb;
    else {
      float d = dot(n, uLight);
      // the light turning round the drum, its terminator kept a little firm, as a painted stone is
      float t = smoothstep(-.4, .8, d);
      t = mix(t, smoothstep(.2, .8, t), .4);
      // the sky's own light on what the moon does not reach (more of it in the day)
      t = mix(t, 1., .1 + .34 * uDay);
      c = mix(vS, vL.rgb, t);
      if (vX.y > .5) {
        // courses of dressed stone: joints in the shader, faded out where they would be thinner than a pixel
        vec2 g = vU / vec2(.2, .086);
        float row = floor(g.y);
        vec2 f = vec2(fract(g.x + .5 * mod(row, 2.)), fract(g.y));
        vec2 w = fwidth(g);
        float jy = 1. - smoothstep(0., w.y * 1.4, min(f.y, 1. - f.y));
        float jx = 1. - smoothstep(0., w.x * 1.4, min(f.x, 1. - f.x));
        c *= 1. - (.1 + .06 * uDay) * max(jx, jy) * clamp(1.6 - max(w.x, w.y) * 7., 0., 1.);
        // the shade where the wall meets the terrace: under the one above (its corbel and its overhang) and at its foot on the one below
        float hb = fract(vW.y / ${PITCH} - atan(vW.x, vW.z) / 6.2831853) * ${PITCH};
        c *= 1. - .34 * smoothstep(${PITCH} - .34, ${PITCH} - .13, hb) - .24 * (1. - smoothstep(0., .07, hb));
      }
      // a rim of moonlight on the lit edge, where the stone turns away
      vec3 e = normalize(uEye - vW);
      c = mix(c, uRim, pow(1. - max(0., dot(n, e)), 4.) * smoothstep(0., .5, d) * .3);
    }
    c *= 1. - vX.x;
    // what faces up (the terraces, the base, the ground) and the wood lie in the tower's shadow away from the moon
    if (n.y > .5 || kind > .5) c *= 1. - shade(vW, kind > .5 ? 1.3 : 1.) * (uDay > .5 ? .26 : .46);
    // a doorway's light: dark, .382 for the next game, warm won, amber gone into (2); brightest at the floor
    if (role > .5 && role < 2.5 || role > 5.5) {
      float g = mix(1., .62, clamp(vU.y, 0., 1.)) * (role > 1.5 && role < 2.5 ? .78 : 1.);
      // a value under zero is the amber coming on from the dark (a lamp switching on is never warm on its way)
      vec3 glow = v < 0. ? uAmber : v <= 1. ? uWarm : mix(uWarm, uAmber, v - 1.);
      c = mix(c, glow * g, min(abs(v), 1.) * (role > 1.5 && role < 2.5 ? .7 : 1.));
    }
    // the lamps' light on what stands round them: the lit rooms, the road's lamps, the other climbers' lanterns
    for (int i = 0; i < 16; i++) {
      if (i >= uNL) break;
      vec3 d = uPL[i].xyz - vW;
      float L = length(d), a = max(0., 1. - L / uPL[i].w);
      float lam = (vX.w > .5 || kind > .5 && kind < 1.5) ? 1. : max(0., dot(n, d / max(L, 1e-5))) * .8 + .2;
      c = mix(c, uPC[i].rgb, clamp(a * a * lam * uPC[i].a, 0., 1.));
    }
  }
  // distance closes into the haze on the horizon
  c = mix(c, uFog, 1. - exp(-max(0., length(vW - uEye) - uFogN) / uFogD));
  // going in: the room gone into becomes the stage's own ground
  if (abs(vD.x - uLiftDoor) < .5 && role > .5 && role < 2.5) c = mix(c, uLift, uLiftMix);
  o = vec4(mix(c, uMistC, uMist), 1.);
}`;
// the night behind everything: the sky, its stars, the moon where the light comes from, two ridges on the horizon
const BVS = `#version 300 es
in vec2 aQ; void main() { gl_Position = vec4(aQ, 1., 1.); }`;
const BFS = `#version 300 es
precision highp float;
uniform vec2 uRes; uniform vec3 uF, uRt, uUp, uMoonD, uSkyTop, uSkyLow, uFar, uNear, uMoonC, uStar, uMistC;
uniform float uFocal, uShift, uDay, uMist;
out vec4 o;
${NOISE}
void main() {
  vec2 uv = (gl_FragCoord.xy - .5 * uRes) / uRes.y; uv.x -= uShift;
  vec3 rd = normalize(uv.x * uRt + uv.y * uUp + uFocal * uF);
  vec3 c = mix(uSkyLow, uSkyTop, smoothstep(0., .55, rd.y));
  float md = length(rd - uMoonD);
  if (uDay < .5) {
    vec2 g = vec2(atan(rd.x, rd.z), rd.y) * 90.; vec2 id = floor(g);
    c += uStar * step(.965, hash(id)) * smoothstep(.16, 0., length(fract(g) - .5)) * (.3 + .7 * hash(id + 7.)) * smoothstep(.04, .3, rd.y) * .8;
    vec3 off = normalize(cross(uMoonD, vec3(0., 1., 0.))) * .017 + vec3(0., .012, 0.);
    c = mix(c, uMoonC, smoothstep(.036, .033, md) * smoothstep(.027, .031, length(rd - uMoonD - off)));
  } else c = mix(c, uMoonC, smoothstep(.04, .036, md));
  float az = atan(rd.x, rd.z); vec2 cs = vec2(cos(az), sin(az));
  float h1 = .022 + .05 * fbm(cs * 2.6 + 3.), h2 = .008 + .04 * fbm(cs * 5.5 + 11.);
  c = mix(c, uFar, smoothstep(h1 + .0015, h1 - .0015, rd.y));
  c = mix(c, uNear, smoothstep(h2 + .0015, h2 - .0015, rd.y));
  c = mix(c, uSkyLow, smoothstep(.02, -.004, rd.y) * .75);
  o = vec4(mix(c, uMistC, uMist), 1.);
}`;
/* what is soft: the sea of cloud (two sheets of it, drifting, parting round the tower, closing into one sea far off, the moon's
   path on it) and the lamps' light in the night's air (a square turned to the camera for each) */
const SVS = `#version 300 es
in vec3 aP; in vec2 aQ; in vec4 aC;
uniform mat4 uVP; uniform vec3 uRt, uUp; uniform float uMode;
out vec3 vW, vC; out vec2 vQ;
void main() {
  vec3 p = uMode > .5 ? aP + (uRt * aQ.x + uUp * aQ.y) * aC.a : aP;
  vW = p; vQ = aQ; vC = aC.rgb;
  gl_Position = uVP * vec4(p, 1.);
}`;
const SFS = `#version 300 es
precision highp float;
in vec3 vW, vC; in vec2 vQ;
uniform vec3 uEye, uMoonD, uFog, uCloudLo, uCloudHi, uMoonC, uMistC;
uniform float uMode, uTime, uLayer, uMist, uOut;
out vec4 o;
${NOISE}
void main() {
  if (uMode > .5) { float d = dot(vQ, vQ); o = vec4(vC * max(0., .02 / (d + .02) - .0196) * uOut, 0.); return; }
  float cr = length(vW.xz), tc = length(vW - uEye);
  float nz = fbm(vW.xz * .2 + vec2(uTime * .012, uLayer * 7.3) + uLayer * 3.1), open = smoothstep(1.45, 2.5, cr);
  // a camera level with the cloud sees through what lies between it and the tower: the door it stands before is never veiled
  float level = clamp(1. - abs(uEye.y - vW.y) / 1.4, 0., 1.);
  open *= mix(1., smoothstep(5., 13., length(vW.xz - uEye.xz)), level);
  float a = max(smoothstep(.33, .6, nz), smoothstep(12., 40., tc)) * open * .92;
  bool above = uEye.y > vW.y;
  vec3 c = mix(uCloudLo, uCloudHi, smoothstep(.35, .8, nz) * (above ? 1. : .7));
  if (above) c += uMoonC * pow(max(0., dot(normalize(vW.xz - uEye.xz), normalize(uMoonD.xz))), 70.) * .2 * smoothstep(0., .5, nz);
  c = mix(c, uFog, 1. - exp(-max(0., tc - 14.) * .012));
  o = vec4(mix(c, uMistC, uMist) * a, a);
}`;

/* the context in two halves: begun (the programs handed to the driver to compile and link) and finished (their links checked, their
   uniforms looked up, the buffers bound). Checking a link waits for it, so the warm-up begins them and finishes only once the driver
   says they are done (KHR_parallel_shader_compile): begun and finished at once, the three programs held the page 150 to 220 ms at a
   phone's speed, on a replay that shows no tower (2026-11-18, scripts/measure-frames.cjs) */
let ctx = null, begun = null;
const UNIFORMS = {
  main: ["uVP", "uDoor", "uLight", "uEye", "uRim", "uFog", "uWarm", "uAmber", "uLift", "uG0", "uG1", "uRoad", "uMistC", "uDay", "uFogN", "uFogD",
    "uLiftMix", "uLiftDoor", "uTopY", "uMist", "uPL", "uPC", "uNL"],
  back: ["uRes", "uF", "uRt", "uUp", "uMoonD", "uSkyTop", "uSkyLow", "uFar", "uNear", "uMoonC", "uStar", "uMistC", "uFocal", "uShift", "uDay", "uMist"],
  soft: ["uVP", "uRt", "uUp", "uMode", "uEye", "uMoonD", "uFog", "uCloudLo", "uCloudHi", "uMoonC", "uMistC", "uTime", "uLayer", "uMist", "uOut"],
};
function begin() {
  const canvas = document.createElement("canvas");
  const gl = canvas.getContext("webgl2", { antialias: true, alpha: false, preserveDrawingBuffer: true });
  if (!gl) return null;
  const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; };
  const link = (vs, fs) => { const p = gl.createProgram(); gl.attachShader(p, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p); return p; };
  return { canvas, gl, parallel: gl.getExtension("KHR_parallel_shader_compile"), progs: { main: link(VS, FS), back: link(BVS, BFS), soft: link(SVS, SFS) } };
}
// whether the driver has finished the begun programs (always, without the extension: finishing then waits as it always did)
const compiled = b => !b.parallel || Object.values(b.progs).every(p => b.gl.getProgramParameter(p, b.parallel.COMPLETION_STATUS_KHR));
function finish(b) {
  const { gl, canvas } = b;
  const program = name => {
    const p = b.progs[name];
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) { console.warn(gl.getProgramInfoLog(p)); return null; }
    return { p, u: Object.fromEntries(UNIFORMS[name].map(n => [n, gl.getUniformLocation(p, n)])) };
  };
  const main = program("main"), back = program("back"), soft = program("soft");
  if (!main || !back || !soft) return null;
  const bind = (prog, buf, stride, attrs) => {
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    attrs.forEach(([n, size, off]) => {
      const l = gl.getAttribLocation(prog.p, n);
      if (l < 0) return;
      gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, size, gl.FLOAT, false, stride * 4, off * 4);
    });
    return vao;
  };
  const buf = gl.createBuffer(), quad = gl.createBuffer(), sbuf = gl.createBuffer();
  const vao = bind(main, buf, STRIDE, [["aP", 3, 0], ["aN", 3, 3], ["aL", 4, 6], ["aS", 3, 10], ["aX", 4, 13], ["aU", 2, 17], ["aD", 4, 19]]);
  const bvao = bind(back, quad, 2, [["aQ", 2, 0]]);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const svao = bind(soft, sbuf, 9, [["aP", 3, 0], ["aQ", 2, 3], ["aC", 4, 5]]);
  return { canvas, gl, main, back, soft, vao, bvao, svao, buf, sbuf, key: null, solid: 0 };
}
function context() {
  if (ctx && !ctx.gl.isContextLost()) return ctx;
  if (!begun || begun.gl.isContextLost()) begun = begin();
  ctx = begun ? finish(begun) : null;
  begun = null;
  return ctx;
}
/* the context made and the programs compiled and drawn once in idle moments before any tower is asked for (the battle page loads
   this module), so the first tower drawn pays only for its mesh. The driver compiles while the page goes on (begin above) */
export function warmTower() {
  if (ctx || begun) return;
  begun = begin();
  if (!begun) return;
  const wait = () => {
    if (ctx) return;
    if (begun && !compiled(begun)) { requestAnimationFrame(wait); return; }
    const c = context();
    if (!c) return;
    const { gl } = c;
    gl.useProgram(c.main.p); gl.bindVertexArray(c.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, c.buf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(STRIDE * 3), gl.STATIC_DRAW);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    c.key = null;
  };
  requestAnimationFrame(wait);
}

/* the picture without WebGL2: the drum and its doors, flat in their tones, from the same camera */
function flat(out, model, cam, pal, view) {
  const g = out.getContext("2d"), w = out.width, h = out.height, k = w / (out.clientWidth || w);
  const css = c => `rgb(${c.map(x => Math.round(x * 255)).join(",")})`, deg = cam.phi / RAD;
  g.fillStyle = css(pal.fog); g.fillRect(0, 0, w, h);
  g.save(); g.scale(k, k);
  const poly = [];
  for (const y of [GY, model.top * PITCH + .78]) for (const sg of y === GY ? [-90, 90] : [90, -90]) poly.push(cam.project(P(RW, deg + sg, y)));
  g.fillStyle = css(pal.wallLit);
  g.beginPath(); poly.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.fill();
  for (let i = 0; i < model.top * 5; i++) {
    const d = doorOf(i), th = (i + .5) * SEG, v = view.doors[i], y = (i + .5) / 5 * PITCH;
    if (Math.cos(th * RAD - cam.phi) < .15) continue;
    const [x0, y0] = cam.project(P(RW, th - d.w / RAD, y)), [x1, y1] = cam.project(P(RW, th + d.w / RAD, y + d.s + d.w));
    g.fillStyle = css(v < 0 ? mix(pal.pane, pal.amber, -v) : v <= 1 ? mix(pal.pane, pal.warm, v) : mix(pal.warm, pal.amber, v - 1));
    g.fillRect(Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0), Math.abs(y1 - y0));
  }
  g.restore();
}

/* render the model into out (a 2D canvas the scene shows) with the camera cam. view: { doors (the lit value of each door), lights
   ([x, y, z, reach, r, g, b, strength], on the stone), glows ([x, y, z, size, r, g, b], in the air), lift ({ door, mix }), time
   (seconds, the cloud's drift) } */
export function render(out, model, cam, pal, view) {
  const dpr = Math.min(2, window.devicePixelRatio || 1), w = Math.round(out.clientWidth * dpr) || out.width, h = Math.round(out.clientHeight * dpr) || out.height;
  if (out.width !== w || out.height !== h) { out.width = w; out.height = h; }
  const c = context();
  if (!c) { flat(out, model, cam, pal, view); return false; }
  const { gl, canvas, main, back, soft } = c;
  if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
  if (c.key !== model) {
    gl.bindBuffer(gl.ARRAY_BUFFER, c.buf); gl.bufferData(gl.ARRAY_BUFFER, model.solid, gl.STATIC_DRAW);
    c.key = model; c.solid = model.solid.length / STRIDE;
  }
  const lift = view.lift || { door: -9, mix: 0 }, day = pal.light ? 1 : 0;
  // a camera passing through the cloud is in its mist
  const mistC = mix(pal.cloudLo, pal.cloudHi, .5), mist = Math.max(0, 1 - Math.abs(cam.pos[1] - YC) / .42) ** 2 * .3 * (1 - lift.mix);
  gl.viewport(0, 0, w, h);
  gl.disable(gl.BLEND); gl.disable(gl.CULL_FACE);

  gl.disable(gl.DEPTH_TEST); gl.depthMask(false);
  gl.useProgram(back.p); gl.bindVertexArray(c.bvao);
  let u = back.u;
  gl.uniform2f(u.uRes, w, h); gl.uniform3fv(u.uF, cam.f); gl.uniform3fv(u.uRt, cam.rt); gl.uniform3fv(u.uUp, cam.up); gl.uniform3fv(u.uMoonD, MOON);
  gl.uniform3fv(u.uSkyTop, pal.sky); gl.uniform3fv(u.uSkyLow, pal.fog); gl.uniform3fv(u.uFar, pal.far); gl.uniform3fv(u.uNear, pal.near);
  gl.uniform3fv(u.uMoonC, pal.moon); gl.uniform3fv(u.uStar, pal.lit); gl.uniform3fv(u.uMistC, mistC);
  gl.uniform1f(u.uFocal, cam.focal); gl.uniform1f(u.uShift, cam.shift); gl.uniform1f(u.uDay, day); gl.uniform1f(u.uMist, mist);
  gl.drawArrays(gl.TRIANGLES, 0, 3);

  gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.depthMask(true); gl.clear(gl.DEPTH_BUFFER_BIT);
  gl.useProgram(main.p); gl.bindVertexArray(c.vao);
  u = main.u;
  gl.uniformMatrix4fv(u.uVP, false, cam.vp);
  gl.uniform1fv(u.uDoor, view.doors);
  gl.uniform3fv(u.uLight, LIGHT); gl.uniform3fv(u.uEye, cam.pos); gl.uniform3fv(u.uRim, pal.lit); gl.uniform3fv(u.uFog, pal.fog);
  gl.uniform3fv(u.uWarm, pal.warm); gl.uniform3fv(u.uAmber, pal.amber); gl.uniform3fv(u.uLift, pal.lift);
  gl.uniform3fv(u.uG0, pal.g0); gl.uniform3fv(u.uG1, pal.g1); gl.uniform3fv(u.uRoad, pal.road); gl.uniform3fv(u.uMistC, mistC);
  gl.uniform1f(u.uDay, day); gl.uniform1f(u.uFogN, 9); gl.uniform1f(u.uFogD, pal.light ? 60 : 46);
  gl.uniform1f(u.uLiftMix, lift.mix); gl.uniform1f(u.uLiftDoor, lift.door); gl.uniform1f(u.uTopY, model.top * PITCH + 2.3); gl.uniform1f(u.uMist, mist);
  const lights = (view.lights || []).slice(0, 16), PL = new Float32Array(64), PC = new Float32Array(64);
  lights.forEach((l, i) => { PL.set(l.slice(0, 4), i * 4); PC.set(l.slice(4, 8), i * 4); });
  gl.uniform4fv(u.uPL, PL); gl.uniform4fv(u.uPC, PC); gl.uniform1i(u.uNL, lights.length);
  gl.drawArrays(gl.TRIANGLES, 0, c.solid);

  /* the soft things over the stone: the cloud's two sheets, the further from the camera first, then the lamps' light in the air */
  const glows = view.glows || [], S = new Float32Array((12 + glows.length * 6) * 9), far = 900;
  let n = 0;
  const put = (p, q, col) => { S.set(p, n); S.set(q, n + 3); S.set(col, n + 5); n += 9; };
  for (const y of cam.pos[1] > YC ? [YC - .1, YC + .1] : [YC + .1, YC - .1]) {
    for (const [x, z] of [[-1, -1], [1, -1], [1, 1], [-1, -1], [1, 1], [-1, 1]]) put([x * far, y, z * far], [0, 0], [0, 0, 0, 0]);
  }
  for (const gl0 of glows) for (const q of [[-1, -1], [1, -1], [1, 1], [-1, -1], [1, 1], [-1, 1]]) put(gl0.slice(0, 3), q, [gl0[4], gl0[5], gl0[6], gl0[3]]);
  gl.useProgram(soft.p); gl.bindVertexArray(c.svao);
  gl.bindBuffer(gl.ARRAY_BUFFER, c.sbuf); gl.bufferData(gl.ARRAY_BUFFER, S, gl.DYNAMIC_DRAW);
  u = soft.u;
  gl.uniformMatrix4fv(u.uVP, false, cam.vp); gl.uniform3fv(u.uRt, cam.rt); gl.uniform3fv(u.uUp, cam.up); gl.uniform3fv(u.uEye, cam.pos);
  gl.uniform3fv(u.uMoonD, MOON); gl.uniform3fv(u.uFog, pal.fog); gl.uniform3fv(u.uCloudLo, pal.cloudLo); gl.uniform3fv(u.uCloudHi, pal.cloudHi);
  gl.uniform3fv(u.uMoonC, pal.moon); gl.uniform3fv(u.uMistC, mistC); gl.uniform1f(u.uTime, view.time || 0); gl.uniform1f(u.uMist, mist);
  gl.uniform1f(u.uOut, (1 - lift.mix) * (pal.light ? .45 : 1));
  gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false);
  gl.uniform1f(u.uMode, 0);
  for (let i = 0; i < 2; i++) { gl.uniform1f(u.uLayer, i); gl.drawArrays(gl.TRIANGLES, i * 6, 6); }
  if (glows.length) { gl.uniform1f(u.uMode, 1); gl.drawArrays(gl.TRIANGLES, 12, glows.length * 6); }
  gl.depthMask(true);

  const g = out.getContext("2d");
  g.drawImage(canvas, 0, 0);
  return true;
}
