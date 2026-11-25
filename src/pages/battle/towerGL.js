/* 도전의 탑's tower modelled in 3D (DESIGN.md "Battle", 도전의 탑, The tower; sculptural 3D monolith pass).
   One WebGL2 context, shared and never on the page: each draw renders into it and copies the picture into the scene's own 2D canvas,
   so a scene costs no context of its own and a removed one leaves nothing behind.

   An architectural monolith set directly on the page's own ground (--ground): sculpted 3D mass with directional architectural
   lighting, soffit contact AO, deep recessed colonnade portals, minimal datum rules (no noisy wireframe outlines), smooth top
   recession into --ground, and unified WebGL2 screen-space leader lines (zero SVG). Every vertex stores semantic material IDs rather
   than baked colours, so Dark, Light, High-Contrast Dark and High-Contrast Light switch in one frame with zero mesh rebuild. */

export const PHI = 1.6180339887;
export const FLOOR_H = 1.08;
export const MAX_FLOORS = 24;
export const ND = MAX_FLOORS * 5;

export const scaleOf = f => Math.max(0.64, 1.0 - Math.max(0, f) * 0.028);

const BASE_PYLON_X0 = -2.84;
const BASE_PYLON_X1 = -1.92;
const BASE_FACADE_X0 = -1.92;
const BASE_FACADE_X1 = 2.72;
const FRONT_Z = 0.24;
const PYLON_Z = 0.36;
const TERRACE_Z = 0.62;
const BACK_Z = -2.50;

export function baySpec(i, f = 0) {
  const sc = scaleOf(f);
  if (i === 4) {
    return { cx: 2.04 * sc, w: 0.70 * sc, h: 0.88, sill: 0.09, depth: 0.90, faceZ: FRONT_Z + 0.14, gate: true };
  }
  const centers = [-1.42, -0.66, 0.10, 0.86];
  return { cx: centers[i] * sc, w: 0.38 * sc, h: 0.84, sill: 0.09, depth: 0.86, faceZ: FRONT_Z, gate: false };
}

export const topOf = floor => Math.min(MAX_FLOORS, Math.max(9, floor + 4));

export function rightEdgeOf(f) {
  const sc = scaleOf(f);
  return { x: BASE_FACADE_X1 * sc + 0.14, y: f * FLOOR_H + 0.09, z: TERRACE_Z - Math.max(0, f) * 0.012 };
}

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

/* camera views for door s (0..ND-1, real while stepping):
   - whole: opening frame of the entrance
   - hall: heroic upward 3/4 architectural view on the tab and break's next-door beat
   - close: between-games arrival view over the battle stage
   - align: battle entry beat 1, centred on the active portal
   - dive: battle entry beat 2, passing through the 3D portal jambs into --ground */
export function viewOf(kind, s, m, top) {
  const f = Math.floor(s / 5), i = s - f * 5;
  const i0 = Math.min(4, Math.max(0, Math.floor(i)));
  const i1 = Math.min(4, Math.max(0, Math.ceil(i)));
  const b0 = baySpec(i0, f), b1 = baySpec(i1, f);
  const frac = i - Math.floor(i);
  const bx = b0.cx + (b1.cx - b0.cx) * frac;
  const by = f * FLOOR_H + 0.09 + (b0.h + (b1.h - b0.h) * frac) * 0.5;
  const yFloor = f * FLOOR_H;
  const asp = m.W / Math.max(1, m.H);
  const narrow = Math.max(1, 1.54 / Math.max(0.75, asp));

  if (kind === "whole") {
    const mid = Math.min(top * 0.52, yFloor + 3.8);
    return {
      eyeX: -4.8 * narrow, eyeY: Math.max(0.5, yFloor - 0.6), eyeZ: 12.8 * narrow,
      tgtX: 0.35, tgtY: mid + 1.1, tgtZ: -0.3,
      focal: 1.32, shift: m.phone ? -0.04 : -0.09,
    };
  }
  if (kind === "align") {
    return { eyeX: bx, eyeY: by, eyeZ: b0.faceZ + 2.35, tgtX: bx, tgtY: by, tgtZ: b0.faceZ - 0.85, focal: 1.75, shift: 0 };
  }
  if (kind === "dive") {
    return { eyeX: bx, eyeY: by, eyeZ: b0.faceZ - 0.42, tgtX: bx, tgtY: by, tgtZ: b0.faceZ - 1.8, focal: 2.05, shift: 0 };
  }
  if (kind === "close") {
    return {
      eyeX: -2.4 * narrow + bx * 0.32, eyeY: Math.max(0.35, yFloor + 0.2), eyeZ: 7.4 * narrow,
      tgtX: bx * 0.45, tgtY: yFloor + 1.15, tgtZ: -0.2,
      focal: 1.5, shift: 0,
    };
  }
  const isFirst = f === 0;
  const liftY = isFirst ? (m.phone ? 1.72 : 1.88) : (m.phone ? 2.18 : 2.28);
  return {
    eyeX: -3.70 * narrow + (bx - 0.1) * 0.05,
    eyeY: isFirst ? 0.34 : yFloor - 0.08,
    eyeZ: 9.25 * narrow,
    tgtX: 0.42 + (bx - 0.1) * 0.04,
    tgtY: yFloor + liftY,
    tgtZ: -0.25,
    focal: 1.40,
    shift: m.phone ? -0.06 : -0.10,
  };
}

export const mixView = (a, b, e) => Object.fromEntries(Object.keys(a).map(k => [k, a[k] + (b[k] - a[k]) * e]));

export function cameraOf(m, v) {
  const pos = [v.eyeX, v.eyeY, v.eyeZ];
  const tgt = [v.tgtX, v.tgtY, v.tgtZ];
  const f = unit([tgt[0] - pos[0], tgt[1] - pos[1], tgt[2] - pos[2]]);
  const rt = unit(cross(f, [0, 1, 0]));
  const up = cross(rt, f);
  const asp = m.W / Math.max(1, m.H);
  const F = 2 * v.focal;
  const sx = 2 * (v.shift || 0) / asp;
  const near = 0.05, far = 200;
  const A = (far + near) / (far - near), B = -2 * far * near / (far - near);
  const view = [
    rt[0], up[0], -f[0], 0,
    rt[1], up[1], -f[1], 0,
    rt[2], up[2], -f[2], 0,
    -dot(rt, pos), -dot(up, pos), dot(f, pos), 1,
  ];
  const proj = [F / asp, 0, 0, 0, 0, F, 0, 0, -sx, 0, -A, -1, 0, 0, B, 0];
  const vp = mul4(proj, view);
  const project = ([x, y, z]) => {
    const X = vp[0] * x + vp[4] * y + vp[8] * z + vp[12];
    const Y = vp[1] * x + vp[5] * y + vp[9] * z + vp[13];
    const W = vp[3] * x + vp[7] * y + vp[11] * z + vp[15];
    return [(X / W + 1) / 2 * m.W, (1 - Y / W) / 2 * m.H, W];
  };
  return { vp, project, pos, f, rt, up, focal: v.focal, shift: v.shift || 0 };
}

/* ---------- 4-mode semantic palette (direct CSS var hex parse: <0.1ms, 0 DOM reflow) ---------- */
const hexRgb = h => {
  const s = h.trim();
  if (/^#[0-9a-f]{6}$/i.test(s)) {
    const n = parseInt(s.slice(1), 16);
    return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255];
  }
  const m = s.match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/);
  if (m) return [+m[1] / 255, +m[2] / 255, +m[3] / 255];
  return null;
};

let probe = null;
function readToken(cs, name, fallback) {
  const raw = cs.getPropertyValue(name).trim();
  const parsed = raw ? hexRgb(raw) : null;
  if (parsed) return parsed;
  if (raw) {
    probe ||= document.createElement("canvas").getContext("2d", { willReadFrequently: true });
    probe.fillStyle = "#000";
    probe.fillStyle = raw;
    probe.fillRect(0, 0, 1, 1);
    const d = probe.getImageData(0, 0, 1, 1).data;
    return [d[0] / 255, d[1] / 255, d[2] / 255];
  }
  return hexRgb(fallback);
}

export function paletteOf() {
  const root = document.documentElement;
  const light = root.dataset.theme === "light";
  const hc = root.dataset.contrast === "more";
  const cs = getComputedStyle(root);
  const ground = readToken(cs, "--ground", light ? "#FFFFFF" : "#081C3D");
  const lit = readToken(cs, "--lit", light ? "#081C3D" : "#FFFFFF");
  const dim = readToken(cs, "--dim", light ? "#46536C" : "#A8B8D3");
  const mute = readToken(cs, "--mute", light ? "#56637A" : "#8196B9");
  const signal = readToken(cs, "--signal", light ? "#B36F00" : "#FFB21A");
  const act = hc ? readToken(cs, "--act", light ? "#00009F" : "#FFFF00") : lit;
  const hl = hc ? readToken(cs, "--hl", light ? "#37006E" : "#1AEBFF") : lit;

  if (hc && !light) {
    // High-contrast dark: sculpted monochrome monolith mass on pure black ground, restrained rules, crisp --act datum
    return {
      light, hc, ground,
      faceLit: hexRgb("#1B1B1B"), faceShade: hexRgb("#101010"), faceDeep: hexRgb("#070707"),
      tread: hexRgb("#323232"), recess: ground, won: lit,
      signal: act, signalCore: ground, rule: hexRgb("#686868"), ruleSub: hexRgb("#3A3A3A"), ruleLit: act,
      gateLeaf: hexRgb("#222222"), numLit: act, numMute: dim, hl,
      hairPx: 1.05, rulePx: 2.1,
    };
  }
  if (hc && light) {
    // High-contrast light: solid stone-grey monolith mass on pure white ground, clean dark rules, crisp --act datum
    return {
      light, hc, ground,
      faceLit: hexRgb("#E8E8E8"), faceShade: hexRgb("#CFCFCF"), faceDeep: hexRgb("#B0B0B0"),
      tread: hexRgb("#F5F5F5"), recess: ground, won: lit,
      signal: act, signalCore: ground, rule: hexRgb("#4A4A4A"), ruleSub: hexRgb("#888888"), ruleLit: act,
      gateLeaf: hexRgb("#DCDCDC"), numLit: act, numMute: dim, hl,
      hairPx: 1.05, rulePx: 2.1,
    };
  }
  if (light) {
    return {
      light, hc, ground,
      faceLit: hexRgb("#EBF0F7"), faceShade: hexRgb("#D2DCEB"), faceDeep: hexRgb("#B6C5DC"),
      tread: hexRgb("#F6F8FC"), recess: hexRgb("#CFD9E8"), won: lit,
      signal, signalCore: signal, rule: hexRgb("#9BB0CC"), ruleSub: hexRgb("#C6D3E3"), ruleLit: lit,
      gateLeaf: hexRgb("#DCE4F0"), numLit: lit, numMute: mute, hl: lit,
      hairPx: 1.0, rulePx: 2.0,
    };
  }
  return {
    light, hc, ground,
    faceLit: hexRgb("#132D58"), faceShade: hexRgb("#0B1F42"), faceDeep: hexRgb("#051229"),
    tread: hexRgb("#21437A"), recess: hexRgb("#040E21"), won: lit,
    signal, signalCore: signal, rule: hexRgb("#31548C"), ruleSub: hexRgb("#1C3764"), ruleLit: lit,
    gateLeaf: hexRgb("#183769"), numLit: lit, numMute: mute, hl: lit,
    hairPx: 1.0, rulePx: 2.0,
  };
}

/* ---------- Albert Sans (200) floor numeral alpha-mask atlas ---------- */
const ATLAS_COLS = 6, ATLAS_ROWS = 4, CELL_PX = 256;
let numCanvas = null;

function buildNumberAtlas() {
  const c = document.createElement("canvas");
  c.width = ATLAS_COLS * CELL_PX;
  c.height = ATLAS_ROWS * CELL_PX;
  const g = c.getContext("2d");
  g.clearRect(0, 0, c.width, c.height);
  g.fillStyle = "#ffffff";
  g.textAlign = "center";
  g.textBaseline = "middle";
  for (let n = 1; n <= MAX_FLOORS; n++) {
    const idx = n - 1, col = idx % ATLAS_COLS, row = Math.floor(idx / ATLAS_COLS);
    const label = String(n);
    const cx = (col + 0.5) * CELL_PX, cy = (row + 0.52) * CELL_PX;
    if (label.length > 1) {
      g.font = `200 132px "Albert Sans", sans-serif`;
      g.fillText(label[0], cx - 33, cy);
      g.fillText(label[1], cx + 33, cy);
    } else {
      g.font = `200 176px "Albert Sans", sans-serif`;
      g.fillText(label, cx, cy);
    }
  }
  return c;
}

/* ---------- semantic 3D mesh + restrained architectural datum line builder ---------- */
const F_STRIDE = 12;
const L_STRIDE = 12;
const TRI = [0, 1, 2, 0, 2, 3];

function createBuilder() {
  const F = { a: new Float32Array(F_STRIDE * 6 * 2048), n: 0 };
  const L = { a: new Float32Array(L_STRIDE * 6 * 512), n: 0 };
  const grow = (B, need) => {
    if (B.n + need <= B.a.length) return;
    let sz = B.a.length * 2;
    while (sz < B.n + need) sz *= 2;
    const next = new Float32Array(sz);
    next.set(B.a);
    B.a = next;
  };
  const fv = (p, n, meta, uv) => {
    grow(F, F_STRIDE);
    F.a[F.n++] = p[0]; F.a[F.n++] = p[1]; F.a[F.n++] = p[2];
    F.a[F.n++] = n[0]; F.a[F.n++] = n[1]; F.a[F.n++] = n[2];
    F.a[F.n++] = meta[0]; F.a[F.n++] = meta[1]; F.a[F.n++] = meta[2]; F.a[F.n++] = meta[3];
    F.a[F.n++] = uv[0]; F.a[F.n++] = uv[1];
  };
  const quad = (ps, n, meta, uvs = [[0, 0], [1, 0], [1, 1], [0, 1]]) => {
    for (const idx of TRI) fv(ps[idx], n, meta, uvs[idx]);
  };
  const box = (x0, y0, z0, x1, y1, z1, fIdx, mats = {}, doorId = -1, extra = 0) => {
    const mFront = mats.front ?? 1, mSide = mats.side ?? 2, mTop = mats.top ?? 4, mBot = mats.bot ?? 3, mBack = mats.back ?? 3;
    if (mFront >= 0) quad([[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], [0, 0, 1], [mFront, fIdx, doorId, extra]);
    if (mBack >= 0) quad([[x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0]], [0, 0, -1], [mBack, fIdx, doorId, extra]);
    if (mSide >= 0) {
      quad([[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]], [-1, 0, 0], [mSide, fIdx, doorId, extra]);
      quad([[x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1]], [1, 0, 0], [mSide, fIdx, doorId, extra]);
    }
    if (mTop >= 0) quad([[x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0]], [0, 1, 0], [mTop, fIdx, doorId, extra]);
    if (mBot >= 0) quad([[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]], [0, -1, 0], [mBot, fIdx, doorId, extra]);
  };
  const lv = (p0, p1, end, dir, meta) => {
    grow(L, L_STRIDE);
    L.a[L.n++] = p0[0]; L.a[L.n++] = p0[1]; L.a[L.n++] = p0[2];
    L.a[L.n++] = p1[0]; L.a[L.n++] = p1[1]; L.a[L.n++] = p1[2];
    L.a[L.n++] = end; L.a[L.n++] = dir;
    L.a[L.n++] = meta[0]; L.a[L.n++] = meta[1]; L.a[L.n++] = meta[2]; L.a[L.n++] = meta[3];
  };
  const line = (p0, p1, kind, fIdx, doorId = -1, drawOrder = 0) => {
    const meta = [kind, fIdx, doorId, drawOrder];
    const pts = [[0, -1], [1, -1], [1, 1], [0, 1]];
    for (const idx of TRI) lv(p0, p1, pts[idx][0], pts[idx][1], meta);
  };
  return { quad, box, line, done: () => ({ faces: F.a.slice(0, F.n), lines: L.a.slice(0, L.n) }) };
}

function* monolithPieces(B, top) {
  // 3-step sculptural golden-ratio plinth — shaded 3D treads & risers, only one quiet ground baseline
  const plinths = [
    [-3.48, -0.36, -2.65, 3.22, -0.24, 1.26],
    [-3.24, -0.24, -2.58, 3.00, -0.12, 0.98],
    [-3.02, -0.12, -2.52, 2.82, 0.00, 0.74],
  ];
  plinths.forEach(([x0, y0, z0, x1, y1, z1], idx) => {
    B.box(x0, y0, z0, x1, y1, z1, -1, { front: 1, side: 2, top: 4, bot: -1, back: -1 });
    // single quiet architectural baseline on bottom plinth front edge
    if (idx === 0) {
      B.line([x0, y0, z1], [x1, y0, z1], 3, -1, -1, 0.0);
    }
  });

  for (let f = 0; f < top; f++) {
    if (f > 0 && f % 3 === 0) yield;
    const sc = scaleOf(f);
    const y0 = f * FLOOR_H, y1 = y0 + FLOOR_H, slabH = 0.09, wallY0 = y0 + slabH, wallY1 = y1;
    const ordPrimary = 0.02 + (f / Math.max(1, top)) * 0.36;

    const px0 = BASE_PYLON_X0 * sc, px1 = BASE_PYLON_X1 * sc;
    const fx0 = BASE_FACADE_X0 * sc, fx1 = BASE_FACADE_X1 * sc;
    const tz = TERRACE_Z - f * 0.012, bz = BACK_Z + f * 0.045;

    // Projecting floor terrace slab (overhangs piers slightly, creating crisp 3D shadow soffit)
    B.box(px0 - 0.14, y0, bz, fx1 + 0.14, wallY0, tz, f, { front: 1, side: 2, top: 4, bot: 3, back: -1 });

    // SINGLE crisp datum rule along the terrace upper front & left edge (kind 4.0 = corner at start, 4.2 = corner at end)
    // No vertical silhouette lines: 3D directional face shading forms clean vertical corners without ever intruding on horizontal rules.
    B.line([px0 - 0.14, wallY0, tz], [fx1 + 0.14, wallY0, tz], 4.0, f, -1, ordPrimary);
    B.line([px0 - 0.14, wallY0, bz], [px0 - 0.14, wallY0, tz], 4.2, f, -1, ordPrimary + 0.01);

    // Left numeral pylon + deep architectural reveal separating pylon from colonnade
    B.box(px0, wallY0, bz, px1 - 0.06, wallY1, PYLON_Z, f, { front: 1, side: 2, top: -1, bot: -1, back: -1 });
    B.box(px1 - 0.06, wallY0, bz, fx0, wallY1, FRONT_Z - 0.18, f, { front: 3, side: 3, top: -1, bot: -1, back: -1 });

    // Floor numeral carved on pylon face
    const col = f % ATLAS_COLS, row = Math.floor(f / ATLAS_COLS);
    const u0 = col / ATLAS_COLS, u1 = (col + 1) / ATLAS_COLS, v0 = row / ATLAS_ROWS, v1 = (row + 1) / ATLAS_ROWS;
    const numCx = (px0 + px1 - 0.06) * 0.5, numHalfW = Math.min(0.38 * sc, (px1 - 0.06 - px0) * 0.46);
    const numY0 = wallY0 + 0.10, numY1 = wallY1 - 0.10;
    B.quad(
      [[numCx - numHalfW, numY0, PYLON_Z + 0.005], [numCx + numHalfW, numY0, PYLON_Z + 0.005], [numCx + numHalfW, numY1, PYLON_Z + 0.005], [numCx - numHalfW, numY1, PYLON_Z + 0.005]],
      [0, 0, 1], [9, f, -1, 0], [[u0, v1], [u1, v1], [u1, v0], [u0, v0]]
    );

    // Solid core backing behind colonnade
    B.box(fx0, wallY0, bz, fx1, wallY1, FRONT_Z - 0.92, f, { front: -1, side: 2, top: -1, bot: -1, back: 3 });

    let curX = fx0;
    for (let i = 0; i < 5; i++) {
      const k = f * 5 + i, b = baySpec(i, f);
      const bx0 = b.cx - b.w * 0.5, bx1 = b.cx + b.w * 0.5, by0 = y0 + b.sill, by1 = by0 + b.h, backZ = b.faceZ - b.depth;

      // Colonnade piers between portals and lintel above portal
      if (bx0 > curX + 0.001) B.box(curX, wallY0, FRONT_Z - 0.92, bx0, wallY1, FRONT_Z, f, { front: 1, side: 2, top: -1, bot: -1, back: -1 });
      if (wallY1 > by1 + 0.001) B.box(bx0, by1, backZ, bx1, wallY1, b.faceZ, f, { front: 1, side: 2, top: -1, bot: 3, back: -1 });

      // 5th bay: sculpted 3D gatekeeper sanctuary (projecting pilasters + deep stepped pediment lintel, no wireframe clutter)
      if (b.gate) {
        const fw = 0.09 * sc;
        B.box(bx0 - fw, wallY0, FRONT_Z, bx0, wallY1, b.faceZ, f, { front: 1, side: 2, top: -1, bot: -1, back: -1 });
        B.box(bx1, wallY0, FRONT_Z, bx1 + fw, wallY1, b.faceZ, f, { front: 1, side: 2, top: -1, bot: -1, back: -1 });
        B.box(bx0 - fw - 0.02 * sc, by1, FRONT_Z, bx1 + fw + 0.02 * sc, wallY1, b.faceZ + 0.04, f, { front: 1, side: 2, top: 4, bot: 3, back: -1 });
      }

      // Deep 3D portal jambs, soffit, and threshold sill (reads purely by 3D face shading & depth AO)
      B.quad([[bx0, by0, b.faceZ], [bx0, by0, backZ], [bx0, by1, backZ], [bx0, by1, b.faceZ]], [1, 0, 0], [6, f, k, 0], [[0, 0], [1, 0], [1, 1], [0, 1]]);
      B.quad([[bx1, by0, backZ], [bx1, by0, b.faceZ], [bx1, by1, b.faceZ], [bx1, by1, backZ]], [-1, 0, 0], [6, f, k, 0], [[1, 0], [0, 0], [0, 1], [1, 1]]);
      B.quad([[bx0, by1, b.faceZ], [bx1, by1, b.faceZ], [bx1, by1, backZ], [bx0, by1, backZ]], [0, -1, 0], [6, f, k, 0], [[0, 0], [0, 0], [1, 0], [1, 0]]);
      B.quad([[bx0, by0, backZ], [bx1, by0, backZ], [bx1, by0, b.faceZ], [bx0, by0, b.faceZ]], [0, 1, 0], [6, f, k, 1], [[1, 0], [1, 0], [0, 0], [0, 0]]);

      // Recessed portal interior plane (shows locked void, won monolith, or illuminated active threshold)
      const planeZ = b.gate ? backZ + 0.08 : b.faceZ - 0.24;
      B.quad([[bx0, by0, planeZ], [bx1, by0, planeZ], [bx1, by1, planeZ], [bx0, by1, planeZ]], [0, 0, 1], [5, f, k, b.gate ? 1 : 0], [[0, 0], [1, 0], [1, 1], [0, 1]]);

      // Twin sliding monolith slabs for the gatekeeper sanctuary
      if (b.gate) {
        const lz = b.faceZ - 0.14, gap = 0.016 * sc;
        B.quad([[bx0, by0, lz], [b.cx - gap, by0, lz], [b.cx - gap, by1, lz], [bx0, by1, lz]], [0, 0, 1], [7, f, k, -1], [[0, 0], [1, 0], [1, 1], [0, 1]]);
        B.quad([[b.cx + gap, by0, lz], [bx1, by0, lz], [bx1, by1, lz], [b.cx + gap, by1, lz]], [0, 0, 1], [7, f, k, 1], [[0, 0], [1, 0], [1, 1], [0, 1]]);
        B.quad([[b.cx - gap, by0, lz + 0.002], [b.cx + gap, by0, lz + 0.002], [b.cx + gap, by1, lz + 0.002], [b.cx - gap, by1, lz + 0.002]], [0, 0, 1], [8, f, k, 0], [[0, 0], [1, 0], [1, 1], [0, 1]]);
      }

      curX = bx1;
    }
    if (fx1 > curX + 0.001) B.box(curX, wallY0, FRONT_Z - 0.92, fx1, wallY1, FRONT_Z, f, { front: 1, side: 2, top: -1, bot: -1, back: -1 });
  }

  yield;
  const yTop = top * FLOOR_H, scTop = scaleOf(top - 1);
  const tx0 = BASE_PYLON_X0 * scTop - 0.14, tx1 = BASE_FACADE_X1 * scTop + 0.14;
  const bzTop = BACK_Z + (top - 1) * 0.045, tzTop = TERRACE_Z - (top - 1) * 0.012;
  B.box(tx0, yTop, bzTop, tx1, yTop + 0.14, tzTop, top, { front: 1, side: 2, top: 4, bot: 3, back: -1 });
  B.line([tx0, yTop + 0.14, tzTop], [tx1, yTop + 0.14, tzTop], 5, top, -1, 0.84);

  // Split Wing Y architectural crown
  const cxCrown = (tx0 + tx1) * 0.5, yC0 = yTop + 0.14;
  for (const sg of [-1, 1]) {
    const innerX = cxCrown + sg * 0.20 * scTop, outerX = cxCrown + sg * 1.75 * scTop;
    const xA = Math.min(innerX, outerX), xB = Math.max(innerX, outerX);
    const yL = sg < 0 ? yC0 + 1.48 : yC0 + 0.52, yR = sg < 0 ? yC0 + 0.52 : yC0 + 1.48;
    const zF = 0.18, zB = -1.10;
    B.quad([[xA, yC0, zF], [xB, yC0, zF], [xB, yR, zF], [xA, yL, zF]], [0, 0, 1], [10, top, -1, 0]);
    B.quad([[xB, yC0, zB], [xA, yC0, zB], [xA, yL, zB], [xB, yR, zB]], [0, 0, -1], [3, top, -1, 0]);
    const ny = (xB - xA), nx = -(yR - yL), nl = Math.hypot(nx, ny) || 1;
    B.quad([[xA, yL, zF], [xB, yR, zF], [xB, yR, zB], [xA, yL, zB]], [nx / nl, ny / nl, 0], [4, top, -1, 0]);
    B.quad([[xA, yC0, zB], [xA, yC0, zF], [xA, yL, zF], [xA, yL, zB]], [-1, 0, 0], [2, top, -1, 0]);
    B.quad([[xB, yC0, zF], [xB, yC0, zB], [xB, yR, zB], [xB, yR, zF]], [1, 0, 0], [2, top, -1, 0]);
  }
}

const built = new Map();
const building = new Map();
const keep = (top, B) => {
  const model = { top, ...B.done() };
  if (built.size >= 4) built.delete(built.keys().next().value);
  built.set(top, model);
  return model;
};

export function buildModel(top) {
  if (built.has(top)) return built.get(top);
  const B = createBuilder();
  for (const _ of monolithPieces(B, top)) { /* synchronous */ }
  return keep(top, B);
}

export function prebuildModel(top) {
  if (built.has(top)) return Promise.resolve();
  if (!building.has(top)) building.set(top, (async () => {
    const B = createBuilder();
    for (const _ of monolithPieces(B, top)) await new Promise(r => setTimeout(r));
    if (!built.has(top)) keep(top, B);
    building.delete(top);
  })());
  return building.get(top);
}

export const modelBuilt = top => built.has(top);

/* ---------- WebGL2 shaders ---------- */
const FVS = `#version 300 es
in vec3 aP; in vec3 aN; in vec4 aM; in vec2 aU;
uniform mat4 uVP;
uniform float uDoor[${ND}];
uniform float uReveal;
uniform float uTop;
out vec3 vP; out vec3 vN; out vec4 vM; out vec2 vU; out float vV; out float vVis;
void main() {
  vec3 p = aP;
  int dId = int(aM.z + 0.5);
  float v = aM.z >= -0.5 ? uDoor[dId] : 0.0;
  if (aM.x > 6.5 && aM.x < 7.5) {
    float open = smoothstep(0.45, 1.0, abs(v));
    p.x += aM.w * open * 0.34;
  }
  float ord = clamp((aM.y + 1.0) / max(1.0, uTop + 1.0), 0.0, 1.0);
  float start = 0.20 + ord * 0.34;
  float vis = smoothstep(start, start + 0.24, uReveal);
  p.y -= (1.0 - vis) * 0.14;
  vP = p; vN = aN; vM = aM; vU = aU; vV = v; vVis = vis;
  gl_Position = uVP * vec4(p, 1.0);
}`;

const FFS = `#version 300 es
precision highp float;
in vec3 vP; in vec3 vN; in vec4 vM; in vec2 vU; in float vV; in float vVis;
uniform vec3 uGround, uFaceLit, uFaceShade, uFaceDeep, uTread, uRecess;
uniform vec3 uWon, uSignal, uSignalCore, uGateLeaf, uNumLit, uNumMute;
uniform vec2 uRes;
uniform float uCurFloor, uLiftDoor, uLiftMix, uDiveDim, uHC, uLight, uTopFade;
uniform sampler2D uNumTex;
out vec4 o;

const float FLOOR_H = 1.08;

void main() {
  if (vVis < 0.01) discard;
  float mat = vM.x, fIdx = vM.y, v = vV;
  bool isCurFloor = abs(fIdx - uCurFloor) < 0.5;
  bool isLiftBay = abs(vM.z - uLiftDoor) < 0.5;

  // Crisp architectural directional lighting + overhang soffit contact AO
  vec3 n = normalize(vN);
  vec3 keyDir = normalize(vec3(0.38, 0.68, 0.62));
  float ndl = clamp(dot(n, keyDir), 0.0, 1.0);
  float localY = fract(max(0.0, vP.y) / FLOOR_H);
  float soffitAO = (fIdx >= -0.5) ? (1.0 - smoothstep(0.76, 0.99, localY) * (uHC > 0.5 ? 0.32 : 0.24)) : 1.0;
  float baseAO = (fIdx >= -0.5) ? (1.0 - (1.0 - smoothstep(0.08, 0.18, localY)) * 0.10) : 1.0;
  float ao = soffitAO * baseAO;

  // Smooth vertical fade at top edge of viewport so upper stories recede intentionally into --ground
  float topMask = uTopFade > 0.5 ? smoothstep(0.995, 0.78, gl_FragCoord.y / max(1.0, uRes.y)) : 1.0;

  vec3 c = uFaceLit;

  if (mat < 0.5) {
    c = uGround;
  } else if (mat < 1.5) {
    // Front architectural facade: subtle directional lift + soffit contact shadow under slab above
    vec3 litFace = mix(uFaceShade, uFaceLit, 0.78 + 0.22 * ndl);
    c = mix(uFaceDeep, litFace, ao);
    if (isCurFloor && uHC < 0.5) c = mix(c, uTread, 0.14);
  } else if (mat < 2.5) {
    // Side walls & left pylon flanks: distinct shadow plane
    c = mix(uFaceDeep, uFaceShade, (0.68 + 0.32 * ndl) * ao);
  } else if (mat < 3.5) {
    // Deep reveals & soffits
    c = uFaceDeep;
  } else if (mat < 4.5) {
    // Horizontal terrace & plinth treads: bright upper plane catching sky/key light
    float edgeHighlight = smoothstep(0.65, 1.0, ndl);
    c = mix(uFaceLit, uTread, 0.72 + 0.28 * edgeHighlight);
  } else if (mat < 5.5) {
    // Recessed portal interior plane: locked void, won monolith, or sculpted active doorway
    float isLive = v < -0.01 ? clamp(-v, 0.0, 1.0) : smoothstep(1.05, 1.95, v);
    float isNext = (v > 0.1 && v < 0.8) ? smoothstep(0.05, 0.38, v) : 0.0;
    float isWon = smoothstep(0.75, 1.0, v) * (1.0 - isLive);
    c = mix(uRecess, uWon, isWon);

    float activeAmt = max(isLive, isNext);
    if (activeAmt > 0.01) {
      // Crisp recessed illuminated doorway slab (never a skinny vertical stick!)
      float padX = isLive > 0.5 ? 0.04 : 0.11;
      float padY = isLive > 0.5 ? 0.02 : 0.06;
      float aaX = max(0.015, fwidth(vU.x) * 1.25);
      float aaY = max(0.015, fwidth(vU.y) * 1.25);
      float inX = smoothstep(padX - aaX, padX + aaX, vU.x) * (1.0 - smoothstep(1.0 - padX - aaX, 1.0 - padX + aaX, vU.x));
      float inY = smoothstep(padY - aaY, padY + aaY, vU.y) * (1.0 - smoothstep(1.0 - padY - aaY, 1.0 - padY + aaY, vU.y));
      float insetMask = inX * inY;
      // Subtle vertical architectural light gradient inside the illuminated doorway (brighter toward threshold)
      vec3 portalCol = mix(uSignal, mix(uSignal, uWon, 0.18), (1.0 - vU.y) * (uHC > 0.5 ? 0.0 : 0.65));
      if (isLive > 0.05) {
        c = mix(c, portalCol, isLive * mix(0.85, 1.0, insetMask));
      } else {
        // Resting active door: clean inset illuminated monolith inside the recessed cavity
        c = mix(c, portalCol, insetMask * isNext);
      }
    }
  } else if (mat < 6.5) {
    // Deep 3D portal jambs, ceiling soffit, and threshold sill
    float isLive = v < -0.01 ? clamp(-v, 0.0, 1.0) : smoothstep(1.05, 1.95, v);
    float isNext = (v > 0.1 && v < 0.8) ? smoothstep(0.05, 0.38, v) : 0.0;
    float isWon = smoothstep(0.75, 1.0, v) * (1.0 - isLive);
    float isSill = vM.w;
    float depth = clamp(vU.x, 0.0, 1.0);
    // Right-facing inner jamb catches directional key light; left-facing jamb sits in deeper shadow
    float jambLight = 0.55 + 0.45 * ndl;
    vec3 baseJamb = isSill > 0.5
      ? mix(uTread, uFaceDeep, depth * 0.72)
      : mix(mix(uFaceShade, uFaceLit, jambLight * 0.45), uFaceDeep, depth * 0.88);
    c = baseJamb;
    // Architectural bounce light from won or active doorway onto inner sill and jambs
    float bounce = 1.0 - depth * 0.55;
    if (uHC < 0.5) {
      c = mix(c, uWon, isWon * (isSill > 0.5 ? 0.42 : 0.18) * bounce);
      c = mix(c, uSignal, max(isLive, isNext * 0.65) * (isSill > 0.5 ? 0.52 : 0.22) * bounce);
    } else if (isSill > 0.5) {
      c = mix(c, uSignal, max(isLive, isNext * 0.85) * 0.65 * bounce);
    }
  } else if (mat < 7.5) {
    // Gatekeeper twin sliding monolith doors
    c = mix(uFaceDeep, uGateLeaf, (0.76 + 0.24 * ndl) * ao);
    if (smoothstep(0.45, 1.0, abs(v)) > 0.96) discard;
  } else if (mat < 8.5) {
    // Gatekeeper central parting seam
    if (abs(v) > 0.5) discard;
    c = mix(uFaceDeep, uSignal, smoothstep(0.05, 0.38, v));
  } else if (mat < 9.5) {
    // Thin Albert Sans floor numerals on pylon
    float a = texture(uNumTex, vU).r;
    if (a < 0.04) discard;
    vec3 ink = isCurFloor ? uNumLit : uNumMute;
    float alpha = a * (isCurFloor ? 1.0 : (uHC > 0.5 ? 0.82 : 0.68)) * vVis * topMask * (1.0 - uDiveDim * 0.85);
    o = vec4(ink, alpha);
    return;
  } else {
    c = mix(uFaceShade, uFaceLit, 0.75 + 0.25 * ndl);
  }

  if (isLiftBay && mat > 4.5 && mat < 5.5) c = mix(c, uGround, uLiftMix);
  if (isLiftBay && mat > 5.5 && mat < 6.5) c = mix(c, uGround, smoothstep(0.55, 1.0, uLiftMix));
  if (!isLiftBay && uDiveDim > 0.001) c = mix(c, uGround, uDiveDim * 0.76);
  o = vec4(mix(uGround, c, vVis * topMask), 1.0);
}`;

/* 3D architectural datum lines */
const LVS = `#version 300 es
in vec3 aP0; in vec3 aP1; in vec2 aSide; in vec4 aMeta;
uniform mat4 uVP;
uniform vec2 uRes;
uniform float uDpr, uHairPx, uRulePx, uCurFloor, uActiveDoor, uReveal, uLinePass;
out vec4 vMeta; out float vEdge; out float vAlpha;
void main() {
  float kind = aMeta.x, fIdx = aMeta.y, dId = aMeta.z, ord = aMeta.w;
  bool isCurFloor = abs(fIdx - uCurFloor) < 0.5;
  bool isHeroRule = (kind > 3.5 && kind < 4.5 && isCurFloor);
  // Two-pass order guarantee: secondary lines in pass 0, active floor datum rule in pass 1 so nothing ever overlaps it
  if ((uLinePass < 0.5 && isHeroRule) || (uLinePass > 0.5 && !isHeroRule)) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    vMeta = vec4(0.0); vEdge = 0.0; vAlpha = 0.0;
    return;
  }
  bool isActiveDoor = dId >= -0.5 && abs(dId - uActiveDoor) < 0.5;
  float span = ord < 0.44 ? 0.26 : 0.22;
  float draw = clamp((uReveal - ord) / span, 0.0, 1.0);
  draw = draw * draw * (3.0 - 2.0 * draw);
  vec3 p0 = aP0, p1 = ord < 0.44 ? mix(aP0, aP1, draw) : aP1;

  vec4 c0 = uVP * vec4(p0, 1.0), c1 = uVP * vec4(p1, 1.0);
  vec2 s0 = c0.xy / max(0.0001, c0.w) * uRes * 0.5;
  vec2 s1 = c1.xy / max(0.0001, c1.w) * uRes * 0.5;
  vec2 d = s1 - s0;
  float len = length(d);
  vec2 dir = len > 0.001 ? d / len : vec2(1.0, 0.0);
  vec2 nrm = vec2(-dir.y, dir.x);

  float px = (isHeroRule ? uRulePx : uHairPx) * uDpr;
  float halfW = px * 0.5 + 0.85;
  // Extend cap ONLY at the shared front-left terrace corner (kind 4.0 start, kind 4.2 end); free ends terminate dead-flush
  float cap = 0.0;
  if (kind > 3.9 && kind < 4.1 && aSide.x < 0.5) cap = -px * 0.35;
  else if (kind > 4.1 && kind < 4.3 && aSide.x > 0.5) cap = px * 0.35;

  vec4 base = aSide.x < 0.5 ? c0 : c1;
  vec2 offPx = nrm * aSide.y * halfW + dir * cap;
  base.xy += offPx / (uRes * 0.5) * base.w;
  base.z -= 0.00012 * base.w;

  vMeta = vec4(kind, isCurFloor ? 1.0 : 0.0, isActiveDoor ? 1.0 : 0.0, px);
  vEdge = aSide.y * halfW;
  vAlpha = ord < 0.44 ? step(0.005, draw) : draw;
  gl_Position = base;
}`;

const LFS = `#version 300 es
precision highp float;
in vec4 vMeta; in float vEdge; in float vAlpha;
uniform vec2 uRes;
uniform vec3 uRule, uRuleSub, uRuleLit, uSignal, uHL;
uniform float uHC, uHeld, uDiveDim, uTopFade;
out vec4 o;
void main() {
  if (vAlpha < 0.02) discard;
  float kind = vMeta.x;
  bool isCurFloor = vMeta.y > 0.5;
  bool isActiveDoor = vMeta.z > 0.5;
  float halfCore = vMeta.w * 0.5;
  float cov = (1.0 - smoothstep(halfCore - 0.55, halfCore + 0.55, abs(vEdge))) * vAlpha;
  if (cov < 0.02) discard;

  float topMask = uTopFade > 0.5 ? smoothstep(0.995, 0.78, gl_FragCoord.y / max(1.0, uRes.y)) : 1.0;

  vec3 col = uRule;
  float weightAlpha = 1.0;
  if (kind > 3.5 && kind < 4.5) {
    col = isCurFloor ? uRuleLit : uRule;
    weightAlpha = isCurFloor ? 1.0 : 0.62;
  } else if (kind > 6.5) {
    // Outer vertical silhouette: quiet structural anchor
    col = uRuleSub;
    weightAlpha = 0.72;
  } else if (kind > 2.5 && kind < 3.5) {
    col = uRuleSub;
    weightAlpha = 0.65;
  }

  if (uHC > 0.5 && uHeld > 0.5 && kind > 3.5 && kind < 4.5 && isCurFloor) col = uHL;
  if (!isActiveDoor && uDiveDim > 0.001) cov *= (1.0 - uDiveDim * 0.88);
  o = vec4(col, cov * weightAlpha * topMask);
}`;

/* Unified 2D screen-space climber leader lines (replaces SVG .tw-leads with identical WebGL AA & palette) */
const SVS = `#version 300 es
in vec2 aP0; in vec2 aP1; in vec2 aSide; in float aOn;
uniform vec2 uRes;
uniform float uDpr, uHairPx, uRulePx;
out float vEdge; out float vPx; out float vOn;
void main() {
  vec2 s0 = aP0 * uDpr;
  vec2 s1 = aP1 * uDpr;
  vec2 d = s1 - s0;
  float len = length(d);
  vec2 dir = len > 0.001 ? d / len : vec2(1.0, 0.0);
  vec2 nrm = vec2(-dir.y, dir.x);
  float px = (aOn > 0.5 ? uRulePx : uHairPx) * uDpr;
  float halfW = px * 0.5 + 0.85;
  vec2 p = (aSide.x < 0.5 ? s0 : s1) + nrm * aSide.y * halfW;
  vec2 ndc = vec2(p.x / uRes.x * 2.0 - 1.0, 1.0 - p.y / uRes.y * 2.0);
  vEdge = aSide.y * halfW;
  vPx = px;
  vOn = aOn;
  gl_Position = vec4(ndc, 0.0, 1.0);
}`;

const SFS = `#version 300 es
precision highp float;
in float vEdge; in float vPx; in float vOn;
uniform vec3 uRule, uRuleLit;
uniform float uLeadAlpha;
out vec4 o;
void main() {
  float halfCore = vPx * 0.5;
  float cov = 1.0 - smoothstep(halfCore - 0.55, halfCore + 0.55, abs(vEdge));
  if (cov < 0.02) discard;
  vec3 col = vOn > 0.5 ? uRuleLit : uRule;
  float a = cov * (vOn > 0.5 ? 1.0 : 0.72) * uLeadAlpha;
  o = vec4(col, a);
}`;

/* ---------- shared WebGL2 context with parallel shader compile warm-up ---------- */
let ctx = null, begun = null;
const S_STRIDE = 7;
const UNIFORMS = {
  face: [
    "uVP", "uDoor", "uReveal", "uTop", "uRes",
    "uGround", "uFaceLit", "uFaceShade", "uFaceDeep", "uTread", "uRecess",
    "uWon", "uSignal", "uSignalCore", "uGateLeaf", "uNumLit", "uNumMute",
    "uCurFloor", "uLiftDoor", "uLiftMix", "uDiveDim", "uHC", "uLight", "uTopFade", "uNumTex",
  ],
  line: [
    "uVP", "uRes", "uDpr", "uHairPx", "uRulePx", "uCurFloor", "uActiveDoor", "uReveal", "uLinePass",
    "uRule", "uRuleSub", "uRuleLit", "uSignal", "uHL", "uHC", "uHeld", "uDiveDim", "uTopFade",
  ],
  lead: [
    "uRes", "uDpr", "uHairPx", "uRulePx", "uRule", "uRuleLit", "uLeadAlpha",
  ],
};

function begin() {
  const canvas = document.createElement("canvas");
  const gl = canvas.getContext("webgl2", { antialias: true, alpha: false, preserveDrawingBuffer: true });
  if (!gl) return null;
  const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; };
  const link = (vs, fs) => { const p = gl.createProgram(); gl.attachShader(p, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p); return p; };
  return {
    canvas, gl,
    parallel: gl.getExtension("KHR_parallel_shader_compile"),
    progs: { face: link(FVS, FFS), line: link(LVS, LFS), lead: link(SVS, SFS) },
  };
}
const compiled = b => !b.parallel || Object.values(b.progs).every(p => b.gl.getProgramParameter(p, b.parallel.COMPLETION_STATUS_KHR));

function uploadNumberAtlas(c) {
  if (!numCanvas) numCanvas = buildNumberAtlas();
  const { gl, tex } = c;
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, numCanvas);
  gl.generateMipmap(gl.TEXTURE_2D);
}

export function refreshFontAtlas() {
  numCanvas = buildNumberAtlas();
  if (ctx && !ctx.gl.isContextLost()) uploadNumberAtlas(ctx);
}

function finish(b) {
  const { gl, canvas } = b;
  const program = name => {
    const p = b.progs[name];
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) { console.warn(gl.getProgramInfoLog(p)); return null; }
    return { p, u: Object.fromEntries(UNIFORMS[name].map(n => [n, gl.getUniformLocation(p, n)])) };
  };
  const face = program("face"), line = program("line"), lead = program("lead");
  if (!face || !line || !lead) return null;
  const bind = (prog, buf, stride, attrs) => {
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    for (const [n, size, off] of attrs) {
      const l = gl.getAttribLocation(prog.p, n);
      if (l < 0) continue;
      gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, size, gl.FLOAT, false, stride * 4, off * 4);
    }
    return vao;
  };
  const fBuf = gl.createBuffer(), lBuf = gl.createBuffer(), sBuf = gl.createBuffer();
  const fVao = bind(face, fBuf, F_STRIDE, [["aP", 3, 0], ["aN", 3, 3], ["aM", 4, 6], ["aU", 2, 10]]);
  const lVao = bind(line, lBuf, L_STRIDE, [["aP0", 3, 0], ["aP1", 3, 3], ["aSide", 2, 6], ["aMeta", 4, 8]]);
  const sVao = bind(lead, sBuf, S_STRIDE, [["aP0", 2, 0], ["aP1", 2, 2], ["aSide", 2, 4], ["aOn", 1, 6]]);
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  const aniso = gl.getExtension("EXT_texture_filter_anisotropic");
  if (aniso) gl.texParameterf(gl.TEXTURE_2D, aniso.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(8, gl.getParameter(aniso.MAX_TEXTURE_MAX_ANISOTROPY_EXT)));
  const c = { canvas, gl, face, line, lead, fBuf, lBuf, sBuf, fVao, lVao, sVao, tex, key: null, fCount: 0, lCount: 0 };
  uploadNumberAtlas(c);
  return c;
}

function context() {
  if (ctx && !ctx.gl.isContextLost()) return ctx;
  if (!begun || begun.gl.isContextLost()) begun = begin();
  ctx = begun ? finish(begun) : null;
  begun = null;
  return ctx;
}

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
    gl.useProgram(c.face.p); gl.bindVertexArray(c.fVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, c.fBuf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(F_STRIDE * 3), gl.STATIC_DRAW);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    c.key = null;
  };
  requestAnimationFrame(wait);
}

/* Pack 2D screen-space leader segments into vertex array for unified WebGL pass */
function packLeads(leads) {
  if (!leads?.length) return null;
  const arr = new Float32Array(leads.length * 6 * S_STRIDE);
  let n = 0;
  const pts = [[0, -1], [1, -1], [1, 1], [0, 1]];
  for (const s of leads) {
    const on = s.on ? 1 : 0;
    for (const idx of TRI) {
      arr[n++] = s.x0; arr[n++] = s.y0;
      arr[n++] = s.x1; arr[n++] = s.y1;
      arr[n++] = pts[idx][0]; arr[n++] = pts[idx][1];
      arr[n++] = on;
    }
  }
  return arr;
}

/* 2D fallback without WebGL2: architectural elevation in the same semantic tokens */
function flat(out, model, cam, pal, state) {
  const g = out.getContext("2d"), w = out.width, h = out.height;
  const dpr = Math.min(3, window.devicePixelRatio || 1);
  const css = c => `rgb(${c.map(x => Math.round(x * 255)).join(",")})`;
  g.fillStyle = css(pal.ground); g.fillRect(0, 0, w, h);
  g.save(); g.scale(dpr, dpr);
  for (let f = 0; f < model.top; f++) {
    const sc = scaleOf(f), y0 = f * FLOOR_H, y1 = y0 + FLOOR_H;
    const a = cam.project([BASE_PYLON_X0 * sc, y0, FRONT_Z]), b = cam.project([BASE_FACADE_X1 * sc, y1, FRONT_Z]);
    g.fillStyle = css(pal.faceLit);
    g.fillRect(Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]));
    g.strokeStyle = css(f === state.curFloor ? pal.ruleLit : pal.rule);
    g.lineWidth = f === state.curFloor ? pal.rulePx : pal.hairPx;
    g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], a[1]); g.stroke();
    for (let i = 0; i < 5; i++) {
      const k = f * 5 + i, v = state.doors[k], spec = baySpec(i, f);
      const p0 = cam.project([spec.cx - spec.w * 0.5, y0 + spec.sill, spec.faceZ]);
      const p1 = cam.project([spec.cx + spec.w * 0.5, y0 + spec.sill + spec.h, spec.faceZ]);
      g.fillStyle = css(v < 0 || v > 1.05 ? pal.signal : v >= 0.8 ? pal.won : pal.recess);
      g.fillRect(Math.min(p0[0], p1[0]), Math.min(p0[1], p1[1]), Math.abs(p1[0] - p0[0]), Math.abs(p1[1] - p0[1]));
    }
  }
  if (state.leads?.length && (state.leadAlpha ?? 1) > 0.01) {
    g.globalAlpha = state.leadAlpha ?? 1;
    for (const s of state.leads) {
      g.strokeStyle = css(s.on ? pal.ruleLit : pal.rule);
      g.lineWidth = s.on ? pal.rulePx : pal.hairPx;
      g.beginPath(); g.moveTo(s.x0, s.y0); g.lineTo(s.x1, s.y1); g.stroke();
    }
  }
  g.restore();
}

export function render(out, model, cam, pal, state, m) {
  const dpr = Math.min(3, window.devicePixelRatio || 1);
  const w = Math.round((m?.W || out.clientWidth) * dpr) || out.width;
  const h = Math.round((m?.H || out.clientHeight) * dpr) || out.height;
  if (!w || !h) return false;
  if (out.width !== w || out.height !== h) { out.width = w; out.height = h; }

  const c = context();
  if (!c) { flat(out, model, cam, pal, state); return false; }
  const { gl, canvas, face, line, lead } = c;
  if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
  if (c.key !== model) {
    gl.bindBuffer(gl.ARRAY_BUFFER, c.fBuf); gl.bufferData(gl.ARRAY_BUFFER, model.faces, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, c.lBuf); gl.bufferData(gl.ARRAY_BUFFER, model.lines, gl.STATIC_DRAW);
    c.key = model; c.fCount = model.faces.length / F_STRIDE; c.lCount = model.lines.length / L_STRIDE;
  }

  const lift = state.lift || { door: -9, mix: 0 };
  const reveal = state.reveal ?? 1;
  const curFloor = state.curFloor ?? 0;
  const activeDoor = state.activeDoor ?? -1;
  const held = state.held ? 1 : 0;
  const diveDim = state.diveDim ?? 0;
  const topFade = state.topFade ? 1 : 0;

  gl.viewport(0, 0, w, h);
  gl.clearColor(pal.ground[0], pal.ground[1], pal.ground[2], 1);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.depthMask(true);
  gl.disable(gl.CULL_FACE);
  gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  // Real slope-scaled polygon offset so architectural datum lines never Z-fight faces at oblique angles
  gl.enable(gl.POLYGON_OFFSET_FILL);
  gl.polygonOffset(1.0, 1.0);

  gl.useProgram(face.p); gl.bindVertexArray(c.fVao);
  gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, c.tex);
  let u = face.u;
  gl.uniformMatrix4fv(u.uVP, false, cam.vp);
  gl.uniform1fv(u.uDoor, state.doors);
  gl.uniform1f(u.uReveal, reveal); gl.uniform1f(u.uTop, model.top);
  gl.uniform2f(u.uRes, w, h);
  gl.uniform3fv(u.uGround, pal.ground); gl.uniform3fv(u.uFaceLit, pal.faceLit);
  gl.uniform3fv(u.uFaceShade, pal.faceShade); gl.uniform3fv(u.uFaceDeep, pal.faceDeep);
  gl.uniform3fv(u.uTread, pal.tread); gl.uniform3fv(u.uRecess, pal.recess);
  gl.uniform3fv(u.uWon, pal.won); gl.uniform3fv(u.uSignal, pal.signal);
  gl.uniform3fv(u.uSignalCore, pal.signalCore); gl.uniform3fv(u.uGateLeaf, pal.gateLeaf);
  gl.uniform3fv(u.uNumLit, pal.numLit); gl.uniform3fv(u.uNumMute, pal.numMute);
  gl.uniform1f(u.uCurFloor, curFloor); gl.uniform1f(u.uLiftDoor, lift.door);
  gl.uniform1f(u.uLiftMix, lift.mix); gl.uniform1f(u.uDiveDim, diveDim);
  gl.uniform1f(u.uHC, pal.hc ? 1 : 0); gl.uniform1f(u.uLight, pal.light ? 1 : 0);
  gl.uniform1f(u.uTopFade, topFade); gl.uniform1i(u.uNumTex, 0);
  gl.drawArrays(gl.TRIANGLES, 0, c.fCount);

  gl.disable(gl.POLYGON_OFFSET_FILL);
  gl.depthMask(false);
  gl.useProgram(line.p); gl.bindVertexArray(c.lVao);
  u = line.u;
  gl.uniformMatrix4fv(u.uVP, false, cam.vp);
  gl.uniform2f(u.uRes, w, h); gl.uniform1f(u.uDpr, dpr);
  gl.uniform1f(u.uHairPx, pal.hairPx); gl.uniform1f(u.uRulePx, pal.rulePx);
  gl.uniform1f(u.uCurFloor, curFloor); gl.uniform1f(u.uActiveDoor, activeDoor);
  gl.uniform1f(u.uReveal, reveal);
  gl.uniform3fv(u.uRule, pal.rule); gl.uniform3fv(u.uRuleSub, pal.ruleSub);
  gl.uniform3fv(u.uRuleLit, pal.ruleLit); gl.uniform3fv(u.uSignal, pal.signal);
  gl.uniform3fv(u.uHL, pal.hl); gl.uniform1f(u.uHC, pal.hc ? 1 : 0);
  gl.uniform1f(u.uHeld, held); gl.uniform1f(u.uDiveDim, diveDim);
  gl.uniform1f(u.uTopFade, topFade);
  // Pass 0: secondary rules; Pass 1: active floor datum rule on top (zero intrusion possible)
  gl.uniform1f(u.uLinePass, 0);
  gl.drawArrays(gl.TRIANGLES, 0, c.lCount);
  gl.uniform1f(u.uLinePass, 1);
  gl.drawArrays(gl.TRIANGLES, 0, c.lCount);

  // Unified WebGL2 climber leader lines (zero SVG; identical AA & palette)
  const leadAlpha = state.leadAlpha ?? 1;
  if (state.leads?.length && leadAlpha > 0.01) {
    const packed = packLeads(state.leads);
    if (packed) {
      gl.disable(gl.DEPTH_TEST);
      gl.useProgram(lead.p); gl.bindVertexArray(c.sVao);
      gl.bindBuffer(gl.ARRAY_BUFFER, c.sBuf);
      gl.bufferData(gl.ARRAY_BUFFER, packed, gl.DYNAMIC_DRAW);
      u = lead.u;
      gl.uniform2f(u.uRes, w, h); gl.uniform1f(u.uDpr, dpr);
      gl.uniform1f(u.uHairPx, pal.hairPx); gl.uniform1f(u.uRulePx, pal.rulePx);
      gl.uniform3fv(u.uRule, pal.rule); gl.uniform3fv(u.uRuleLit, pal.ruleLit);
      gl.uniform1f(u.uLeadAlpha, leadAlpha * (1 - diveDim));
      gl.drawArrays(gl.TRIANGLES, 0, packed.length / S_STRIDE);
      gl.enable(gl.DEPTH_TEST);
    }
  }

  gl.depthMask(true);

  const g = out.getContext("2d");
  g.drawImage(canvas, 0, 0);
  return true;
}
