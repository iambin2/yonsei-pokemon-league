/* 배틀 무대의 아틀라스 (gl.js): 파티클의 모양 칸들, 그 노이즈와 하이라이트, 칸마다 빛을 받는 표면. 정해진 값이라 한 번 그려 모든 무대가 쓴다.
   무대가 서기 전에 작업 스레드(paint.worker.js)가 그려 보내고, 그럴 수 없으면 페이지가 한가할 때 걸음으로 그린다(stageFx prewarm).
   페이지에도 작업 스레드에도 실리므로 DOM에 기대지 않는다(캔버스 하나만, 문서가 없으면 OffscreenCanvas). */
const lerp = (a, b, t) => a + (b - a) * t;

/* ---------------------------------------------------------------- the atlas ---------------------------------------------------------------- */
// 8 x 8 cells of 128 px. R: the shape, G: a tiling noise the shape erodes through (flames lick, smoke tears), B: a highlight (a drop's glint)
export const C = 128, GRID = 8;
const PATHS = {
  fist: "M3 9C3 5 6 3 9 3H25C28 3 30 5 30 8V19C30 24 26 27 21 27H10C6 27 3 24 3 20ZM3 15H15C17 15 18 17 17 19L14.5 22H3Z|32|28",
  foot: "M4 2H15L17 15H28C31 15 32 18 31 21L30 26H5C2 26 1 24 2 21Z|32|28",
  hand: "M4 22V9C4 7 7 7 7 9V3.5C7 1.5 10 1.5 10 3.5V2.5C10 0.5 13 0.5 13 2.5V3.5C13 1.5 16 1.5 16 3.5V11L18 8C19.5 6 22 7.5 21 9.5L16.5 20C15.5 22.5 13.5 24 11 24H6C5 24 4 23 4 22Z|22|24",
  heart: "M12 21C5 15 1 11 1 7A5.5 5.5 0 0 1 12 4A5.5 5.5 0 0 1 23 7C23 11 19 15 12 21Z|24|22",
  note: "M8 2H18V6H11V17A4 4 0 1 1 8 13.5Z|20|22",
  z: "M1 1H15V4L6 12H15V15H1V12L10 4H1Z|16|16",
  fang: "M0 0H40V3L36 14L32 3L28 11L24 3L20 13L16 3L12 11L8 3L4 14L0 3Z|40|14",
  crescent: "M0 18C8 2 32 2 40 18C30 8 10 8 0 18Z|40|20",
  eye: "M0 8C6 0 22 0 28 8C22 16 6 16 0 8ZM14 3.5A4.5 4.5 0 1 0 14 12.5A4.5 4.5 0 1 0 14 3.5Z|28|16",
  shell: "M0 12C2 4 8 0 14 0C20 0 26 4 28 12L22 9L18 12L14 8L10 12L6 9Z|28|12",
  bone: "M4 2A3 3 0 0 1 9 4L19 4A3 3 0 0 1 24 2A3 3 0 0 1 24 8A3 3 0 0 1 24 14A3 3 0 0 1 19 12L9 12A3 3 0 0 1 4 14A3 3 0 0 1 4 8A3 3 0 0 1 4 2Z|28|16",
  sword: "M2 7L30 5.5L38 8L30 10.5L2 9ZM0 3H3V13H0ZM-6 7H0V9H-6Z|44|16",
  caltrop: "M12 0 14.4 4.6 24 6 14.4 7.4 12 12 9.6 7.4 0 6 9.6 4.6Z|24|12",
  star5: "M12 0L14.9 8.2H23.4L16.5 13.3L19.1 21.6L12 16.5L4.9 21.6L7.5 13.3L.6 8.2H9.1Z|24|22",
};
// the noise tile, made once and shared by the atlas and every stage's sprites
let noiseMade = null;
const noiseOnce = () => (noiseMade ||= noiseTile());
function noiseTile(N = C) {
  // tileable value noise, four octaves
  const h = (x, y, p) => { const s = Math.sin(((x % p) + p) % p * 127.1 + ((y % p) + p) % p * 311.7) * 43758.5453; return s - Math.floor(s); };
  const sm = t => t * t * (3 - 2 * t);
  const out = new Float32Array(N * N);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    let v = 0, amp = .5;
    for (let o = 0; o < 4; o++) {
      const p = 4 << o, fx = x / N * p, fy = y / N * p, ix = Math.floor(fx), iy = Math.floor(fy), tx = sm(fx - ix), ty = sm(fy - iy);
      const a = h(ix, iy, p), b = h(ix + 1, iy, p), c = h(ix, iy + 1, p), d = h(ix + 1, iy + 1, p);
      v += amp * lerp(lerp(a, b, tx), lerp(c, d, tx), ty); amp *= .5;
    }
    out[y * N + x] = v / .9375;
  }
  return out;
}
// each cell is painted white on two canvases: the shape (R) and its highlight (B)
const CELLS = [];
const cell = (name, draw) => { CELLS.push([name, draw]); };
const rg = (g, x, y, r, stops) => { const gr = g.createRadialGradient(x, y, 0, x, y, r); stops.forEach(([o, a]) => gr.addColorStop(o, `rgba(255,255,255,${a})`)); return gr; };
const disc = (g, x, y, r, stops) => { g.fillStyle = rg(g, x, y, r, stops); g.fillRect(x - r, y - r, r * 2, r * 2); };
const pathIn = (g, name, box = .78, turn = 0) => {
  const [d, vw, vh] = PATHS[name].split("|"), w = +vw, h = +vh, k = C * box / Math.max(w, h);
  g.save(); g.translate(C / 2, C / 2); g.rotate(turn); g.scale(k, k); g.translate(-w / 2, -h / 2); g.fill(new Path2D(d), "evenodd"); g.restore();
};
const S = C / 2;
cell("glow", g => disc(g, S, S, S, [[0, 1], [.2, .62], [.45, .22], [.75, .05], [1, 0]]));
cell("dot", g => disc(g, S, S, S, [[0, 1], [.32, .95], [.55, .35], [1, 0]]));
cell("spark", g => {
  disc(g, S, S, S * .2, [[0, 1], [.5, .45], [1, 0]]);
  for (const [sx, sy] of [[1, .07], [.07, 1], [.6, .04], [.04, .6]]) { g.save(); g.translate(S, S); if (sx === .6 || sx === .04) g.rotate(Math.PI / 4); g.scale(sx, sy); disc(g, 0, 0, S, [[0, 1], [.5, .5], [1, 0]]); g.restore(); }
});
cell("streak", g => { g.save(); g.translate(S, S); g.scale(1, .1); disc(g, 0, 0, S, [[0, 1], [.5, .55], [1, 0]]); g.restore(); });
cell("flame", (g, b) => {
  // a tongue of fire, broad and hot at its root, licking up to a point
  g.save(); g.translate(S, S * 1.2); g.scale(.7, 1); disc(g, 0, 0, S * .9, [[0, 1], [.35, .85], [.7, .3], [1, 0]]); g.restore();
  g.save(); g.translate(S, S * .6); g.scale(.35, .8); disc(g, 0, 0, S * .9, [[0, .9], [.5, .45], [1, 0]]); g.restore();
  b.save(); b.translate(S, S * 1.25); b.scale(.4, .55); disc(b, 0, 0, S * .9, [[0, 1], [.5, .5], [1, 0]]); b.restore();
});
cell("smoke", g => { [[.5, .52, .42], [.34, .58, .3], [.66, .6, .3], [.48, .36, .3], [.6, .44, .26]].forEach(([x, y, r]) => disc(g, x * C, y * C, r * C, [[0, .8], [.55, .5], [1, 0]])); });
cell("ring", g => { g.strokeStyle = "#fff"; g.shadowColor = "#fff"; g.shadowBlur = 8; g.lineWidth = 5; g.beginPath(); g.arc(S, S, S * .86, 0, Math.PI * 2); g.stroke(); });
cell("wave", g => { g.fillStyle = rg(g, S, S, S, [[0, 0], [.6, 0], [.8, 1], [.92, .5], [1, 0]]); g.fillRect(0, 0, C, C); });
cell("drop", (g, b) => {
  g.fillStyle = "#fff"; g.beginPath(); g.moveTo(S, 8); g.bezierCurveTo(S + 14, 40, S + 34, 62, S + 34, 84); g.arc(S, 84, 34, 0, Math.PI); g.bezierCurveTo(S - 34, 62, S - 14, 40, S, 8); g.fill();
  b.fillStyle = "#fff"; b.beginPath(); b.ellipse(S - 12, 80, 7, 13, -.4, 0, Math.PI * 2); b.fill();
});
cell("bubble", (g, b) => {
  g.fillStyle = rg(g, S, S, S * .9, [[0, .12], [.75, .25], [.9, 1], [1, 0]]); g.fillRect(0, 0, C, C);
  b.fillStyle = "#fff"; b.beginPath(); b.ellipse(S - 22, S - 22, 12, 7, -.7, 0, Math.PI * 2); b.fill();
});
cell("leaf", (g, b) => {
  g.fillStyle = "#fff"; g.beginPath(); g.moveTo(6, S); g.bezierCurveTo(30, 18, 98, 18, 122, S); g.bezierCurveTo(98, 110, 30, 110, 6, S); g.fill();
  b.strokeStyle = "#fff"; b.lineWidth = 4; b.beginPath(); b.moveTo(10, S); b.lineTo(116, S); for (let i = 0; i < 4; i++) { b.moveTo(30 + i * 22, S); b.lineTo(42 + i * 22, S - 18); b.moveTo(30 + i * 22, S); b.lineTo(42 + i * 22, S + 18); } b.stroke();
});
cell("petal", (g, b) => {
  g.fillStyle = "#fff"; g.beginPath(); g.moveTo(S, 120); g.bezierCurveTo(10, 80, 14, 20, S - 10, 10); g.quadraticCurveTo(S, 22, S + 10, 10); g.bezierCurveTo(114, 20, 118, 80, S, 120); g.fill();
  b.fillStyle = rg(b, S, 100, 40, [[0, .8], [1, 0]]); b.fillRect(0, 0, C, C);
});
cell("shard", (g, b) => {
  g.fillStyle = "#fff"; g.beginPath(); g.moveTo(S, 4); g.lineTo(S + 22, 40); g.lineTo(S + 8, 124); g.lineTo(S - 8, 124); g.lineTo(S - 22, 40); g.closePath(); g.fill();
  b.fillStyle = "#fff"; b.globalAlpha = .9; b.beginPath(); b.moveTo(S, 4); b.lineTo(S + 22, 40); b.lineTo(S, 60); b.closePath(); b.fill(); b.globalAlpha = .45; b.beginPath(); b.moveTo(S, 60); b.lineTo(S + 22, 40); b.lineTo(S + 8, 124); b.closePath(); b.fill();
});
cell("rock", (g, b) => {
  const pts = [[20, 40], [52, 12], [96, 22], [118, 62], [100, 108], [48, 118], [12, 84]];
  g.fillStyle = "#fff"; g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.fill();
  b.fillStyle = "#fff"; b.globalAlpha = .85; b.beginPath(); b.moveTo(20, 40); b.lineTo(52, 12); b.lineTo(96, 22); b.lineTo(62, 56); b.closePath(); b.fill(); b.globalAlpha = .35; b.beginPath(); b.moveTo(96, 22); b.lineTo(118, 62); b.lineTo(62, 56); b.fill();
});
cell("flake", g => {
  g.strokeStyle = "#fff"; g.lineWidth = 7; g.lineCap = "round"; g.translate(S, S);
  for (let i = 0; i < 6; i++) { g.rotate(Math.PI / 3); g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -52); g.moveTo(0, -30); g.lineTo(-14, -42); g.moveTo(0, -30); g.lineTo(14, -42); g.stroke(); }
  g.setTransform(1, 0, 0, 1, 0, 0);
});
cell("feather", (g, b) => {
  g.fillStyle = "#fff"; g.beginPath(); g.moveTo(6, S + 6); g.bezierCurveTo(30, 26, 90, 22, 124, S - 6); g.bezierCurveTo(92, 96, 34, 100, 6, S + 6); g.fill();
  b.strokeStyle = "#fff"; b.lineWidth = 4; b.beginPath(); b.moveTo(2, S + 8); b.quadraticCurveTo(60, S + 2, 124, S - 6); b.stroke();
});
cell("star", g => pathIn(g, "star5", .86));
cell("heart", g => pathIn(g, "heart", .8));
cell("note", g => pathIn(g, "note", .8));
cell("z", g => pathIn(g, "z", .72));
cell("fist", g => pathIn(g, "fist", .8));
cell("foot", g => pathIn(g, "foot", .8));
cell("hand", g => pathIn(g, "hand", .8));
cell("crescent", (g, b) => { pathIn(g, "crescent", .92); b.globalAlpha = .6; pathIn(b, "crescent", .7); });
cell("fang", g => pathIn(g, "fang", .86));
cell("hex", g => {
  g.translate(S, S); const hx = r => { g.beginPath(); for (let i = 0; i < 6; i++) { const a = Math.PI / 3 * i + Math.PI / 6; g[i ? "lineTo" : "moveTo"](Math.cos(a) * r, Math.sin(a) * r); } g.closePath(); };
  g.fillStyle = "rgba(255,255,255,.22)"; hx(56); g.fill(); g.strokeStyle = "#fff"; g.lineWidth = 6; g.shadowColor = "#fff"; g.shadowBlur = 6; hx(56); g.stroke();
  g.setTransform(1, 0, 0, 1, 0, 0);
});
cell("hexgrid", g => {
  // a wall of hexagonal panels: the guards and screens are built of them
  g.strokeStyle = "#fff"; g.lineWidth = 2.5; g.shadowColor = "#fff"; g.shadowBlur = 4; const r = 14, w = Math.sqrt(3) * r;
  for (let row = -1; row < 7; row++) for (let col = -1; col < 6; col++) {
    const x = col * w + (row % 2 ? w / 2 : 0), y = row * r * 1.5;
    g.beginPath(); for (let i = 0; i < 6; i++) { const a = Math.PI / 3 * i + Math.PI / 6; g[i ? "lineTo" : "moveTo"](x + Math.cos(a) * r, y + Math.sin(a) * r); } g.closePath(); g.stroke();
  }
  g.globalCompositeOperation = "destination-in"; disc(g, S, S, S, [[0, 1], [.7, 1], [1, 0]]); g.globalCompositeOperation = "source-over";
});
cell("hexball", (g, b) => {
  // 2026-11-07, from Scarlet and Violet's Protect: a ball of hexagonal panes, each a pale pane in a bright frame, the panes squeezed
  // toward the ball's edge the way a sphere turns away, its rim a little deeper and a gloss up on the left
  const R = S * .95, r = .25, w = Math.sqrt(3) * r, E = 1.45;
  const warp = (x, y) => { const d = Math.hypot(x, y), k = d ? Math.sin(Math.min(d, E) / E * Math.PI / 2) / d : 1; return [S + x * k * R, S + y * k * R]; };
  for (let row = -9; row <= 9; row++) for (let col = -6; col <= 6; col++) {
    const cx = col * w + (row & 1 ? w / 2 : 0), cy = row * r * 1.5, d = Math.hypot(cx, cy);
    if (d > E + r) continue;
    const pts = Array.from({ length: 6 }, (_, i) => { const a = Math.PI / 3 * i + Math.PI / 6; return warp(cx + Math.cos(a) * r * .9, cy + Math.sin(a) * r * .9); });
    g.beginPath(); pts.forEach(([x, y], i) => g[i ? "lineTo" : "moveTo"](x, y)); g.closePath();
    g.fillStyle = `rgba(255,255,255,${.05 + .13 * Math.min(1, d / E) ** 2})`; g.fill();
    g.strokeStyle = "#fff"; g.lineWidth = 2 * (1 - .5 * Math.min(1, d / E)); g.stroke();
  }
  g.globalCompositeOperation = "destination-in"; disc(g, S, S, R, [[0, 1], [.94, 1], [1, 0]]); g.globalCompositeOperation = "source-over";
  b.fillStyle = "#fff"; b.beginPath(); b.ellipse(S - 24, S - 26, 16, 8, -.75, 0, Math.PI * 2); b.fill();
});
cell("crack", g => {
  g.strokeStyle = "#fff"; g.lineCap = "round"; g.lineJoin = "round"; let seed = 7; const r = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const branch = (x, y, a, len, w) => { if (len < 6 || w < .6) return; let px = x, py = y; g.lineWidth = w; g.beginPath(); g.moveTo(px, py); const n = 4; for (let i = 0; i < n; i++) { a += (r() - .5) * .9; px += Math.cos(a) * len / n; py += Math.sin(a) * len / n; g.lineTo(px, py); } g.stroke(); branch(px, py, a + (r() - .5) * 1.2, len * .62, w * .7); if (r() > .4) branch(px, py, a + (r() > .5 ? .9 : -.9), len * .5, w * .6); };
  for (let i = 0; i < 7; i++) branch(S, S, i / 7 * Math.PI * 2 + r() * .4, 34 + r() * 18, 5);
});
cell("scorch", g => { [[.5, .5, .48], [.36, .56, .3], [.66, .44, .32]].forEach(([x, y, rr]) => disc(g, x * C, y * C, rr * C, [[0, .9], [.6, .6], [1, 0]])); });
cell("web", g => {
  g.strokeStyle = "#fff"; g.lineWidth = 2.5; g.translate(S, S);
  for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(a) * 62, Math.sin(a) * 62); g.stroke(); }
  for (const rr of [14, 26, 38, 50, 60]) { g.beginPath(); for (let i = 0; i <= 12; i++) { const a = i / 12 * Math.PI * 2, s = rr * (i % 2 ? .93 : 1); g[i ? "lineTo" : "moveTo"](Math.cos(a) * s, Math.sin(a) * s); } g.stroke(); }
  g.setTransform(1, 0, 0, 1, 0, 0);
});
cell("caltrop", (g, b) => { pathIn(g, "caltrop", .9); b.globalAlpha = .7; b.fillStyle = "#fff"; b.beginPath(); b.moveTo(S, S - 26); b.lineTo(S + 12, S - 4); b.lineTo(S, S); b.lineTo(S - 12, S - 4); b.fill(); });
cell("spiral", g => {
  g.strokeStyle = "#fff"; g.lineCap = "round"; g.translate(S, S);
  for (let arm = 0; arm < 3; arm++) { g.beginPath(); for (let i = 0; i <= 60; i++) { const t = i / 60, a = arm * Math.PI * 2 / 3 + t * Math.PI * 2.2, rr = 6 + t * 54; g.lineWidth = 2 + t * 7; g[i ? "lineTo" : "moveTo"](Math.cos(a) * rr, Math.sin(a) * rr); } g.stroke(); }
  g.setTransform(1, 0, 0, 1, 0, 0);
});
cell("moon", (g, b) => {
  disc(g, S, S, S * .95, [[0, 1], [.82, 1], [.9, .6], [1, 0]]);
  b.fillStyle = "#fff"; [[44, 50, 9], [78, 74, 12], [60, 88, 6], [86, 42, 7]].forEach(([x, y, r]) => { b.globalAlpha = .55; b.beginPath(); b.arc(x, y, r, 0, Math.PI * 2); b.fill(); });
});
cell("sun", g => { disc(g, S, S, S * .5, [[0, 1], [.7, 1], [1, 0]]); g.translate(S, S); for (let i = 0; i < 12; i++) { g.rotate(Math.PI / 6); g.save(); g.scale(.06, 1); disc(g, 0, -S * .6, S * .45, [[0, .9], [1, 0]]); g.restore(); } g.setTransform(1, 0, 0, 1, 0, 0); });
// every puff stays inside its cell: one past the edge was cut off straight, and the cut drifted across the stage with the cloud
cell("cloud", g => { [[.5, .55, .4], [.3, .6, .26], [.7, .6, .26], [.42, .4, .3], [.6, .42, .28], [.22, .66, .18], [.78, .66, .18]].forEach(([x, y, r]) => disc(g, x * C, y * C, r * C, [[0, .9], [.6, .7], [1, 0]])); });
cell("grain", g => disc(g, S, S, S * .5, [[0, 1], [.6, 1], [1, 0]]));
cell("bolt", g => { g.fillStyle = "#fff"; g.beginPath(); [[70, 4], [30, 66], [58, 66], [44, 124], [100, 50], [70, 50], [92, 4]].forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.fill(); });
cell("bone", g => pathIn(g, "bone", .9));
cell("sword", (g, b) => { pathIn(g, "sword", .94); b.globalAlpha = .8; b.fillStyle = "#fff"; b.fillRect(36, 60, 74, 4); });
cell("shell", g => pathIn(g, "shell", .86));
cell("chevron", g => { g.fillStyle = "#fff"; g.beginPath(); g.moveTo(S, 14); g.lineTo(118, 74); g.lineTo(96, 96); g.lineTo(S, 54); g.lineTo(32, 96); g.lineTo(10, 74); g.closePath(); g.fill(); });
cell("plus", g => { g.fillStyle = "#fff"; g.fillRect(S - 14, 16, 28, 96); g.fillRect(16, S - 14, 96, 28); });
cell("eye", g => pathIn(g, "eye", .86));
cell("coin", (g, b) => { g.fillStyle = "#fff"; g.beginPath(); g.arc(S, S, 54, 0, Math.PI * 2); g.fill(); b.strokeStyle = "#fff"; b.lineWidth = 6; b.beginPath(); b.arc(S, S, 40, 0, Math.PI * 2); b.stroke(); b.globalAlpha = .7; b.beginPath(); b.ellipse(S - 18, S - 20, 12, 7, -.7, 0, Math.PI * 2); b.fill(); });
cell("orb", (g, b) => { disc(g, S, S, S, [[0, 1], [.55, .95], [.7, 1], [.8, .55], [1, 0]]); b.fillStyle = rg(b, S - 16, S - 18, 34, [[0, .9], [1, 0]]); b.fillRect(0, 0, C, C); });
cell("claws", g => {
  g.strokeStyle = "#fff"; g.lineCap = "round";
  for (let i = -1; i <= 1; i++) { g.beginPath(); for (let j = 0; j <= 20; j++) { const t = j / 20, x = 14 + t * 100, y = 24 + i * 30 + t * 70 + Math.sin(t * Math.PI) * -10; g.lineWidth = 1 + Math.sin(t * Math.PI) * 9; g[j ? "lineTo" : "moveTo"](x, y); } g.stroke(); }
});
cell("cross", g => { g.strokeStyle = "#fff"; g.lineCap = "round"; for (const s of [1, -1]) { for (let j = 0; j < 20; j++) { const t = j / 20, t2 = (j + 1) / 20; g.lineWidth = 1 + Math.sin(t * Math.PI) * 12; g.beginPath(); g.moveTo(14 + t * 100, s > 0 ? 14 + t * 100 : 114 - t * 100); g.lineTo(14 + t2 * 100, s > 0 ? 14 + t2 * 100 : 114 - t2 * 100); g.stroke(); } } });
cell("sigil", g => {
  g.strokeStyle = "#fff"; g.lineWidth = 3; g.shadowColor = "#fff"; g.shadowBlur = 5; g.translate(S, S);
  for (const r of [60, 50]) { g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.stroke(); }
  for (const s of [0, Math.PI]) { g.beginPath(); for (let i = 0; i <= 3; i++) { const a = s + i * Math.PI * 2 / 3 - Math.PI / 2; g[i ? "lineTo" : "moveTo"](Math.cos(a) * 48, Math.sin(a) * 48); } g.stroke(); }
  for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2; g.beginPath(); g.moveTo(Math.cos(a) * 50, Math.sin(a) * 50); g.lineTo(Math.cos(a) * 56, Math.sin(a) * 56); g.stroke(); }
  g.setTransform(1, 0, 0, 1, 0, 0);
});
cell("gear", g => { g.fillStyle = "#fff"; g.translate(S, S); g.beginPath(); for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2, r = i % 2 ? 46 : 58; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); } g.closePath(); g.moveTo(22, 0); g.arc(0, 0, 22, 0, Math.PI * 2, true); g.fill("evenodd"); g.setTransform(1, 0, 0, 1, 0, 0); });
cell("needle", g => { g.fillStyle = "#fff"; g.beginPath(); g.moveTo(4, S); g.lineTo(124, S - 5); g.lineTo(124, S + 5); g.closePath(); g.fill(); });
cell("scale", (g, b) => { g.fillStyle = "#fff"; g.beginPath(); g.moveTo(S, 10); g.quadraticCurveTo(112, 40, S, 120); g.quadraticCurveTo(16, 40, S, 10); g.fill(); b.globalAlpha = .7; b.fillStyle = "#fff"; b.beginPath(); b.moveTo(S, 10); b.quadraticCurveTo(112, 40, S, 120); b.lineTo(S, 10); b.fill(); });
cell("grass", g => { g.fillStyle = "#fff"; for (let i = 0; i < 5; i++) { const x = 20 + i * 22, lean = (i - 2) * 10; g.beginPath(); g.moveTo(x - 7, 124); g.quadraticCurveTo(x - 4, 60, x + lean, 10 + (i % 2) * 22); g.quadraticCurveTo(x + 2, 64, x + 7, 124); g.fill(); } });
cell("seed", (g, b) => { g.fillStyle = "#fff"; g.beginPath(); g.ellipse(S, S, 30, 44, 0, 0, Math.PI * 2); g.fill(); b.globalAlpha = .8; b.fillStyle = "#fff"; b.beginPath(); b.ellipse(S - 10, S - 14, 8, 14, -.3, 0, Math.PI * 2); b.fill(); });
cell("slashfx", g => { g.save(); g.translate(S, S); g.rotate(-.5); g.scale(1, .16); disc(g, 0, 0, S, [[0, 1], [.35, .9], [.6, .4], [1, 0]]); g.restore(); });
cell("tornado", g => { g.strokeStyle = "#fff"; g.lineCap = "round"; for (let i = 0; i < 9; i++) { const y = 10 + i * 13, rx = 8 + i * 6.5; g.lineWidth = 3 + i * .4; g.beginPath(); g.ellipse(S + Math.sin(i) * 6, 124 - y, rx, rx * .22, 0, 0, Math.PI * 2); g.stroke(); } });
cell("ball", (g, b) => { g.fillStyle = "#fff"; g.beginPath(); g.arc(S, S, 56, 0, Math.PI * 2); g.fill(); b.fillStyle = "#fff"; b.fillRect(0, S - 6, C, 12); b.beginPath(); b.arc(S, S, 16, 0, Math.PI * 2); b.fill(); });
cell("grid", g => { g.strokeStyle = "#fff"; g.lineWidth = 2; g.shadowColor = "#fff"; g.shadowBlur = 3; for (let i = 0; i <= 8; i++) { const v = 2 + i * 15.5; g.beginPath(); g.moveTo(v, 0); g.lineTo(v, C); g.moveTo(0, v); g.lineTo(C, v); g.stroke(); } });
cell("tuft", (g, b) => {
  let seed = 3; const r = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (let i = 0; i < 14; i++) {
    const x = 18 + r() * 92, h = 50 + r() * 70, lean = (r() - .5) * 46, w = 3 + r() * 3.5, base = 126;
    const tip = [x + lean, base - h], ctrl = [x + lean * .2, base - h * .55];
    g.beginPath(); g.moveTo(x - w, base); g.quadraticCurveTo(ctrl[0] - w * .4, ctrl[1], tip[0], tip[1]); g.quadraticCurveTo(ctrl[0] + w * .4, ctrl[1], x + w, base); g.closePath(); g.fill();
    b.beginPath(); b.moveTo(ctrl[0], ctrl[1]); b.quadraticCurveTo(lerp(ctrl[0], tip[0], .5) + 1, lerp(ctrl[1], tip[1], .5), tip[0], tip[1]); b.lineWidth = 1.6; b.strokeStyle = "#fff"; b.globalAlpha = .7; b.stroke(); b.globalAlpha = 1;
  }
});
cell("flower", (g, b) => { g.translate(S, S); for (let i = 0; i < 5; i++) { g.rotate(Math.PI * 2 / 5); g.beginPath(); g.ellipse(0, -26, 15, 26, 0, 0, Math.PI * 2); g.fill(); } g.setTransform(1, 0, 0, 1, 0, 0); b.beginPath(); b.arc(S, S, 14, 0, Math.PI * 2); b.fill(); });
cell("arc", g => { g.strokeStyle = "#fff"; g.lineCap = "round"; for (let j = 0; j < 24; j++) { const t = j / 24, a0 = Math.PI * (1.1 + t * .8), a1 = Math.PI * (1.1 + (t + 1 / 24) * .8); g.lineWidth = 1 + Math.sin(t * Math.PI) * 14; g.beginPath(); g.arc(S, S + 30, 70, a0, a1); g.stroke(); } });
/* 2026-11-06 remake (the games' own look, checked against 포켓몬 챔피언스): what a move throws is a lit thing, not a flat sign */
// a billow of fire or smoke: a cauliflower of round lobes, each its own dome once lit
const BILLOW = [[.5, .56, .3], [.3, .6, .2], [.7, .6, .2], [.4, .38, .21], [.62, .4, .19], [.5, .26, .15], [.24, .44, .14], [.77, .45, .13], [.38, .76, .17], [.63, .76, .17]];
cell("billow", g => { g.fillStyle = "#fff"; for (const [x, y, r] of BILLOW) { g.beginPath(); g.arc(x * C, y * C, r * C, 0, Math.PI * 2); g.fill(); } });
// a chip of stone: a small pointed shard of rock (Stealth Rock, debris)
cell("chip", g => { g.fillStyle = "#fff"; g.beginPath(); [[64, 6], [92, 46], [104, 96], [70, 122], [30, 104], [22, 58]].forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); g.fill(); });
// a chunk of ice: a hexagonal crystal standing on end
cell("crystal", g => { g.fillStyle = "#fff"; g.beginPath(); [[64, 2], [100, 30], [100, 98], [64, 126], [28, 98], [28, 30]].forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); g.fill(); });
// the splash of a blow: a jagged star, flat as the games draw it (Shadow Ball's black corona, a punch's white burst)
cell("splat", g => { g.fillStyle = "#fff"; g.beginPath(); let seed = 11; const r = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }; const n = 22; for (let i = 0; i <= n * 2; i++) { const a = i / (n * 2) * Math.PI * 2, rr = i % 2 ? 26 + r() * 10 : 44 + r() * 20; g.lineTo(S + Math.cos(a) * rr, S + Math.sin(a) * rr); } g.closePath(); g.fill(); });
// the games' glint: four long thin rays from a bright point
cell("glint", g => { disc(g, S, S, S * .16, [[0, 1], [.5, .6], [1, 0]]); for (const [sx, sy] of [[1, .045], [.045, 1]]) { g.save(); g.translate(S, S); g.scale(sx, sy); disc(g, 0, 0, S, [[0, 1], [.35, .6], [1, 0]]); g.restore(); } });
// a tile of a room's wall: a square pane, its border lit, its face faint
cell("tile", g => { g.fillStyle = "rgba(255,255,255,.34)"; g.fillRect(8, 8, 112, 112); g.strokeStyle = "#fff"; g.lineWidth = 5; g.strokeRect(8, 8, 112, 112); });
// a wisp of mist: a soft curl lying along the floor
cell("wisp", g => { g.strokeStyle = "#fff"; g.lineCap = "round"; for (let j = 0; j < 30; j++) { const t = j / 30, t2 = (j + 1) / 30, p = u => [10 + u * 108, S + Math.sin(u * Math.PI * 1.6) * 22 - u * 10]; const [x0, y0] = p(t), [x1, y1] = p(t2); g.globalAlpha = Math.sin(Math.PI * t) * .5; g.lineWidth = 10 + Math.sin(Math.PI * t) * 34; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); } g.globalAlpha = 1; });
// fine blades of grass as a texture laid on the floor (grassy terrain is a wash with a fine grain, not a lawn of tufts)
cell("blades", g => { let seed = 5; const r = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }; g.strokeStyle = "#fff"; g.lineCap = "round"; for (let i = 0; i < 70; i++) { const x = r() * C, y = 10 + r() * (C - 14), h = 8 + r() * 14, l = (r() - .5) * 6; g.globalAlpha = .4 + r() * .6; g.lineWidth = 1.4 + r() * 1.4; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + l * .3, y - h * .6, x + l, y - h); g.stroke(); } g.globalAlpha = 1; g.globalCompositeOperation = "destination-in"; disc(g, S, S, S, [[0, 1], [.6, 1], [1, 0]]); g.globalCompositeOperation = "source-over"; });

export const TEX = Object.fromEntries(CELLS.map(([n], i) => [n, i]));
export const ROWS = Math.ceil(CELLS.length / GRID);

/* ---------------------------------------------------------------- lit things ---------------------------------------------------------------- */
/* A thing a move throws is lit as the Pokémon's renders are (the Poké Ball's way, DESIGN.md "One style for everything drawn"): each cell
   of the atlas also has a surface, its normal baked once from its shape. A round thing is a dome over its shape (a drop, an orb, a
   lobe of fire), a stone or a crystal is cut into flat faces, a sign (a fist, a fang, a star) is a soft bevelled solid. The particle
   shader turns that normal with the particle and lights it from the upper left in front, as the ball is lit, so a tumbling rock keeps
   its light where the light is. kind: dome (the whole shape rounds), bevel (only its edge rounds), facet (cut faces), flat (a light). */
const SURF = {
  orb: ["dome"], drop: ["dome"], bubble: ["dome"], seed: ["dome"], moon: ["dome", 0, "moon"], ball: ["dome"], dot: ["dome"], grain: ["dome"], billow: ["dome"], cloud: ["dome"], smoke: ["dome"],
  rock: ["facet", 8], chip: ["facet", 6], shard: ["facet", 3], crystal: ["facet", 7], caltrop: ["facet", 4],
  fist: ["bevel", 18], foot: ["bevel", 16], hand: ["bevel", 12], heart: ["bevel", 20], star: ["bevel", 14], note: ["bevel", 8], fang: ["bevel", 7], crescent: ["bevel", 8],
  bone: ["bevel", 12], sword: ["bevel", 5], shell: ["bevel", 10], scale: ["dome"], coin: ["bevel", 6], leaf: ["bevel", 14], petal: ["dome"], feather: ["bevel", 10], gear: ["bevel", 6],
  needle: ["bevel", 5], flower: ["bevel", 10], flame: ["dome"], z: ["bevel", 6], chevron: ["bevel", 8], plus: ["bevel", 8], eye: ["bevel", 6], web: ["bevel", 2], bolt: ["bevel", 6],
};
// how a cell's surface takes the light: [gloss, sharpness of the highlight, see-through middle, rim]
const MATERIAL = {
  drop: [1, 70, .55, .75], bubble: [1, 90, .88, 1], orb: [.55, 30, 0, .85], seed: [.5, 30, 0, .3], moon: [.05, 12, 0, .35], ball: [.8, 50, 0, .3],
  rock: [.1, 10, 0, .18], chip: [.12, 12, 0, .2], shard: [.95, 55, .4, .6], crystal: [.95, 55, .45, .7], caltrop: [1, 40, 0, .35], coin: [1, 36, 0, .3], sword: [1, 48, 0, .4], gear: [1, 36, 0, .3],
  billow: [0, 8, 0, .12], cloud: [0, 8, 0, .1], smoke: [0, 8, 0, .1], flame: [0, 8, 0, .1],
  leaf: [.25, 18, 0, .25], petal: [.2, 16, .15, .35], feather: [.1, 12, 0, .3], bone: [.3, 20, 0, .2], shell: [.6, 30, 0, .3], scale: [.8, 36, 0, .4],
};
const MAT_DEFAULT = [.35, 24, 0, .3];
function chamfer(inside, n) {
  // distance to the outside in pixels (two passes of a 3-4 chamfer)
  const d = new Float32Array(n * n), BIG = 1e6;
  for (let i = 0; i < n * n; i++) d[i] = inside[i] ? BIG : 0;
  const at = (x, y) => (x < 0 || y < 0 || x >= n || y >= n ? 0 : d[y * n + x]);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { const i = y * n + x; if (!d[i]) continue; d[i] = Math.min(d[i], at(x - 1, y) + 1, at(x, y - 1) + 1, at(x - 1, y - 1) + 1.414, at(x + 1, y - 1) + 1.414); }
  for (let y = n - 1; y >= 0; y--) for (let x = n - 1; x >= 0; x--) { const i = y * n + x; if (!d[i]) continue; d[i] = Math.min(d[i], at(x + 1, y) + 1, at(x, y + 1) + 1, at(x + 1, y + 1) + 1.414, at(x - 1, y + 1) + 1.414); }
  return d;
}
/* a cell's surface, in steps of ROWS_A_STEP rows: a facet cell was one step of 260 ms at a phone's speed, a frame of 734 while a
   replay opened (2026-11-18, scripts/measure-frames.cjs); 16 rows were still steps of 40 to 53 the same day */
const ROWS_A_STEP = 4;
function* surfaceSteps(name, alpha, n) {
  const [kind, param = 0, extra] = SURF[name] || ["flat"], out = new Uint8Array(n * n * 4);
  for (let i = 0; i < n * n; i++) { out[i * 4] = 128; out[i * 4 + 1] = 128; out[i * 4 + 2] = 255; out[i * 4 + 3] = 255; }
  if (kind === "flat") return out;
  const inside = new Uint8Array(n * n);
  for (let i = 0; i < n * n; i++) inside[i] = alpha[i] > 90 ? 1 : 0;
  const dt = chamfer(inside, n);
  yield;
  let maxd = 0; for (let i = 0; i < n * n; i++) maxd = Math.max(maxd, dt[i]);
  if (!maxd) return out;
  const D = kind === "bevel" ? Math.min(maxd, param) : maxd;
  const h = new Float32Array(n * n);
  for (let i = 0; i < n * n; i++) { const t = Math.min(dt[i] / D, 1); h[i] = dt[i] ? D * Math.sqrt(1 - (1 - t) * (1 - t)) : 0; }
  if (extra === "moon") { let seed = 9; const r = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }; for (let k = 0; k < 9; k++) { const cx = 30 + r() * 68, cy = 30 + r() * 68, cr = 5 + r() * 11; for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { const q = Math.hypot(x - cx, y - cy) / cr; if (q < 1.15) h[y * n + x] -= (q < 1 ? (1 - q * q) * cr * .35 : 0) - (q > .9 ? (1.15 - q) * cr * .5 : 0); } } }
  // smooth the field once, so its ridges turn rather than crease
  const s = new Float32Array(n * n);
  for (let y = 0; y < n; y++) { if (y % ROWS_A_STEP === 0) yield; for (let x = 0; x < n; x++) { let v = 0, w = 0; for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) { const xx = x + i, yy = y + j; if (xx < 0 || yy < 0 || xx >= n || yy >= n) continue; v += h[yy * n + xx]; w++; } s[y * n + x] = v / w; } }
  // a cut thing: its pixels belong to the nearest of a few points scattered in it, and each such face leans away from the middle
  let faces = null;
  if (kind === "facet") {
    let seed = 7 + name.length * 13; const r = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    let cx = 0, cy = 0, cnt = 0; for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (inside[y * n + x]) { cx += x; cy += y; cnt++; }
    cx /= cnt; cy /= cnt;
    const pts = [];
    while (pts.length < param) { const x = r() * n, y = r() * n; if (inside[Math.floor(y) * n + Math.floor(x)]) pts.push([x, y]); }
    pts.push([cx, cy]);
    const rad = Math.sqrt(cnt / Math.PI);
    faces = pts.map(([x, y], k) => { const ox = (x - cx) / rad, oy = (y - cy) / rad, v = [ox * 1.25 + (r() - .5) * .35, oy * 1.25 + (r() - .5) * .35, k === pts.length - 1 ? 1.6 : 1]; const l = Math.hypot(...v); return { x, y, nrm: v.map(c => c / l) }; });
  }
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    if (x === 0 && y % ROWS_A_STEP === 0) yield;
    const i = y * n + x;
    if (!inside[i]) continue;
    const g = (xx, yy) => s[Math.min(n - 1, Math.max(0, yy)) * n + Math.min(n - 1, Math.max(0, xx))];
    let nx = -(g(x + 1, y) - g(x - 1, y)) / 2, ny = -(g(x, y + 1) - g(x, y - 1)) / 2, nzz = 1;
    let l = Math.hypot(nx, ny, nzz); nx /= l; ny /= l; nzz /= l;
    if (faces) {
      let best = faces[0], bd = Infinity; for (const f of faces) { const d = (f.x - x) ** 2 + (f.y - y) ** 2; if (d < bd) { bd = d; best = f; } }
      // the silhouette still rounds a little where the faces meet the edge
      const edge = Math.min(1, dt[i] / 6);
      nx = lerp(nx, best.nrm[0], edge); ny = lerp(ny, best.nrm[1], edge); nzz = lerp(nzz, best.nrm[2], edge);
      l = Math.hypot(nx, ny, nzz); nx /= l; ny /= l; nzz /= l;
    }
    out[i * 4] = (nx * .5 + .5) * 255; out[i * 4 + 1] = (ny * .5 + .5) * 255; out[i * 4 + 2] = Math.min(1, s[i] / Math.max(1, D)) * 255;
  }
  return out;
}
export const MATERIALS = CELLS.map(([n]) => MATERIAL[n] || MAT_DEFAULT);

/* the atlas is painted pixel by pixel (about 0.7 s on a desktop, far more on a phone), so it is painted in steps: prepareAtlas runs
   them in the browser's idle time while the battle page waits for its data, and a stage that comes first finishes them at once
   (2026-11-07: painted all at once as the stage came up, it froze the arena before a replay's opening) */
let atlasData = null, atlasJob = null, away = false;
const atlasSteps = () => (atlasJob ||= paintAtlas());
/* one step of it; true while more are left (stageFx prewarm runs them). While the worker paints it (paint.worker.js, stageFx prewarm)
   the page takes no step and only waits for it (takeAtlas) */
export const atlasStep = () => !away && !atlasData && !atlasSteps().next().done;
export const atlasPainted = () => Boolean(atlasData);
export const atlasNow = () => atlasData;
export const paintAway = on => { away = on; };
export const takeAtlas = data => { atlasData ||= data; away = false; };
// the whole of it at once, in the worker
export const paintAtlasNow = () => { for (const _ of atlasSteps()) { /* every step */ } return atlasData; };
function* paintAtlas() {
  // the noise first, a step of its own: a stage that stands before the atlas is painted takes it at once (setup)
  noiseOnce();
  yield;
  const N = C * GRID, NH = C * ROWS;
  // in the worker a canvas of no page, drawn and read back the same way
  const mk = () => { if (typeof document === "undefined") return new OffscreenCanvas(N, NH); const c = document.createElement("canvas"); c.width = N; c.height = NH; return c; };
  const shape = mk(), high = mk(), gs = shape.getContext("2d", { willReadFrequently: true }), gb = high.getContext("2d", { willReadFrequently: true });
  // the cells drawn a few a step (2026-11-18: all at once they were one step of 94 ms at a phone's speed, in the lobby's first frames)
  for (const [i, [, draw]] of CELLS.entries()) {
    if (i && i % 4 === 0) yield;
    const x = (i % GRID) * C, y = Math.floor(i / GRID) * C;
    for (const g of [gs, gb]) { g.save(); g.beginPath(); g.rect(x, y, C, C); g.clip(); g.translate(x, y); g.fillStyle = "#fff"; g.strokeStyle = "#fff"; }
    draw(gs, gb);
    gs.restore(); gb.restore();
  }
  /* both sheets are read back from memory (the second was read back from the GPU), and each reading is a step of its own: the first
     step, everything up to the cells' surfaces, was one stop of 155 on the first visit to the battle page (2026-11-10, measured) */
  yield;
  const a = gs.getImageData(0, 0, N, NH).data;
  yield;
  const b = gb.getImageData(0, 0, N, NH).data, nz = noiseOnce();
  yield;
  const out = new Uint8Array(N * NH * 4), nrm = new Uint8Array(N * NH * 4);
  for (let y = 0; y < NH; y++) for (let x = 0; x < N; x++) {
    if (x === 0 && y && y % (ROWS_A_STEP * 4) === 0) yield;
    const i = (y * N + x) * 4, cellI = Math.floor(y / C) * GRID + Math.floor(x / C);
    out[i] = a[i + 3]; out[i + 1] = nz[((y + cellI * 37) % C) * C + ((x + cellI * 53) % C)] * 255; out[i + 2] = b[i + 3]; out[i + 3] = 255;
  }
  yield;
  for (const [ci, [name]] of CELLS.entries()) {
    yield;
    const x0 = (ci % GRID) * C, y0 = Math.floor(ci / GRID) * C, al = new Uint8Array(C * C);
    for (let y = 0; y < C; y++) for (let x = 0; x < C; x++) al[y * C + x] = a[((y0 + y) * N + x0 + x) * 4 + 3];
    const sf = yield* surfaceSteps(name, al, C);
    for (let y = 0; y < C; y++) nrm.set(sf.subarray(y * C * 4, (y + 1) * C * 4), ((y0 + y) * N + x0) * 4);
  }
  atlasData = { N, NH, out, nrm, noise: nz };
}
