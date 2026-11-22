/* ============================== 칭호의 메달 (DESIGN.md "Titles and hall of fame") ==============================
   A medal made as the site's Pokémon pictures are: matte, round, in clear colour. A white rim, a hill of the title's colour, and on it
   the title's device as a soft white body, all under one soft light from the upper left with cool shade (no metal, no sheen, no fine work).
   The spec comes from titleLooks.js: { glyphs | device | scene | mark | champ | partner, enamel: [type id], tier }.
   A type's symbol is the games' own (public/brand/type-symbols.webp, at the owner's word 2026-11-19); a partner and 몽키매직's three are the
   silhouettes of their own pictures; the Mega emblem is the owner's image in its own colours; everything else is drawn here for the site. */

const BASE_URL = import.meta.env?.BASE_URL ?? "/";
const P = d => new Path2D(d);
const star = (n, ro, ri, cx = 50, cy = 50, rot = -Math.PI / 2) => {
  let d = "";
  for (let i = 0; i < n * 2; i++) { const r = i % 2 ? ri : ro, a = rot + i * Math.PI / n; d += (i ? "L" : "M") + (cx + r * Math.cos(a)).toFixed(2) + " " + (cy + r * Math.sin(a)).toFixed(2); }
  return d + "Z";
};
const circ = (cx, cy, r) => `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0Z`;
const fillEO = (ctx, d) => ctx.fill(P(d), "evenodd");
const cut = (c, draw) => { c.save(); c.globalCompositeOperation = "destination-out"; draw(); c.restore(); };

/* ---------- the face: everything is drawn in a 100 space (rim 47, hill 37) at 7.68 times its pixels, or at half that for a medal
   shown small (a board's medal is some 300 device pixels across; 768 of them were drawn and thrown away, 2026-11-22). One medal is
   drawn at a time, so the size in hand is S ---------- */
const BIG = 768, SMALL = 384, C = 50, HILL = 37, FIT = .72, REACH = .93;
let S = BIG, K = S / 100;
const layer = () => { const c = Object.assign(document.createElement("canvas"), { width: S, height: S }).getContext("2d"); c.scale(K, K); return c; };
/* lay one full-size canvas over another, whatever the transform of the one beneath */
const lay = (ctx, src) => { ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(src, 0, 0); ctx.restore(); };
const frame = () => new Promise(res => requestAnimationFrame(() => res()));
const images = new Map();
const loadImage = src => { if (!images.has(src)) images.set(src, new Promise(res => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; })); return images.get(src); };

/* ---------- a type's symbol: the games' own, cut from one sheet (6 by 3 cells of 384, in this order) ---------- */
const TYPES = ["normal", "fire", "water", "electric", "grass", "ice", "fighting", "poison", "ground", "flying", "psychic", "bug", "rock", "ghost", "dragon", "dark", "steel", "fairy"];
const SYMBOLS = `${BASE_URL}brand/type-symbols.webp`, CELL = 384;
/* a symbol stands in a round place of radius r as it stands in its own disc in the games (its cell is .98 of that disc) */
const drawType = (ctx, sheet, id, cx, cy, r) => { const i = Math.max(0, TYPES.indexOf(id)), h = r * .98; if (sheet) ctx.drawImage(sheet, i % 6 * CELL, (i / 6 | 0) * CELL, CELL, CELL, cx - h, cy - h, h * 2, h * 2); };
/* where two and three things stand on one hill: the circle that just fits each cell, less the wire between the cells */
const PAIR = [[C - 18.6, C, 17.2], [C + 18.6, C, 17.2]];
const TRIO = [-90, 150, 30].map(a => [C + 19.83 * Math.cos(a * Math.PI / 180), C + 19.83 * Math.sin(a * Math.PI / 180), 15.6]);

/* ---------- a Pokémon's picture as a silhouette: its ink is measured once, and the circle round that ink is what is placed ---------- */
const inks = new Map();
const pictureInk = url => {
  if (!inks.has(url)) inks.set(url, loadImage(url).then(img => {
    if (!img) return null;
    const N = 128, c = Object.assign(document.createElement("canvas"), { width: N, height: N }).getContext("2d", { willReadFrequently: true });
    c.drawImage(img, 0, 0, N, N);
    const d = c.getImageData(0, 0, N, N).data, on = (x, y) => d[(y * N + x) * 4 + 3] > 24; let x0 = N, y0 = N, x1 = -1, y1 = -1;
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (on(x, y)) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    if (x1 < 0) return null;
    const mx = (x0 + x1 + 1) / 2, my = (y0 + y1 + 1) / 2; let far = 0;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (on(x, y)) far = Math.max(far, Math.hypot(x + .5 - mx, y + .5 - my));
    return { img, mx: mx / N, my: my / N, far: (far + 1) / N };
  }));
  return inks.get(url);
};
/* the whole of the ink inside a circle of radius r: nothing of it leaves its cell or the hill */
function drawSilhouette(ctx, ink, cx, cy, r, fill) {
  if (!ink) return;
  const size = r / ink.far, t = layer();
  t.imageSmoothingQuality = "high"; t.drawImage(ink.img, cx - ink.mx * size, cy - ink.my * size, size, size);
  t.globalCompositeOperation = "source-in"; t.fillStyle = fill; t.fillRect(0, 0, 100, 100);
  lay(ctx, t.canvas);
}
const MONKEYS = ["pansage", "pansear", "panpour"].map(slug => `${BASE_URL}sprites/pokemon/${slug}.webp`);

/* ---------- devices drawn for single titles (original, in a 100 box; bold bodies, nothing thin) ---------- */
const DEVICES = {
  /* 끝말잇기: an open book of Hangul, its letters cut into the pages, running page to page as a word chain does */
  hangul: c => {
    c.fill(P("M50 30C40 22 22 20 6 24L6 80C22 76 40 78 50 86C60 78 78 76 94 80L94 24C78 20 60 22 50 30Z"));
    cut(c, () => { c.fill(P("M48.4 32L51.6 32L51.6 84L48.4 84Z")); c.font = "700 36px Freesentation"; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText("ㄱ", 28, 53); c.fillText("ㅎ", 72, 53); });
  },
  /* 스승: a torch that hands its flame on; the flame licks to one side, so it is never read as a drop */
  torch: c => { c.fill(P("M52 2C56 16 74 26 72 42C70 54 60 58 50 58C40 58 30 54 28 42C27 33 32 26 37 22C37 29 40 33 45 33C43 22 45 11 52 2Z M24 61L76 61L69 73L31 73Z M35 76L65 76L57 98L43 98Z")); },
  /* 제자: a sprout, two leaves on a young stem */
  sprout: c => { for (const d of ["M46.5 96L46.5 50L53.5 50L53.5 96Z", "M50 54C50 34 36 22 12 22C12 44 26 56 50 54Z", "M50 48C50 26 66 12 90 12C90 36 74 50 50 48Z", "M30 96L70 96L66 88L34 88Z"]) c.fill(P(d)); },
  /* RED: 151, the first generation's number (a cup of those 151 alone), in bold round figures; not a counter */
  n151: c => { c.font = "900 46px 'Albert Sans'"; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText("151", 50, 52); },
  /* 초신성: a new star bursting, one body of eight broad rays with a star cut in its heart (a newcomer who won) */
  nova: c => fillEO(c, star(8, 48, 30) + star(5, 15, 6.5)),
  /* 슈퍼루키: a shooting star climbing, its trail behind it in three broad strokes (a rookie on the rise) */
  rookie: c => {
    c.fill(P(star(5, 27, 11.5, 68, 32, -Math.PI / 2 + .3)));
    c.lineWidth = 9; c.lineCap = "round"; c.beginPath(); for (const [x0, y0, x1, y1] of [[51, 49, 9, 91], [63, 61, 35, 89], [36, 33, 7, 62]]) { c.moveTo(x0, y0); c.lineTo(x1, y1); } c.stroke();
  },
  /* 버스 드라이버: a steering wheel (the one driver who carries the whole team) */
  bus: c => { fillEO(c, circ(50, 50, 47) + circ(50, 50, 33)); c.fill(P("M16 44L84 44L84 56L16 56Z")); c.fill(P("M44 50L56 50L56 84L44 84Z")); c.fill(P(circ(50, 50, 13))); },
  /* 청출어람: a sprout that has taken the torch's flame and burns it larger (the pupil past the teacher; 스승 is the torch, 제자 the sprout) */
  indigo: c => {
    c.save(); c.translate(50, 0); c.scale(1.02, 1.02); c.translate(-50, 0);
    c.fill(P("M52 2C56 16 74 26 72 42C70 54 60 58 50 58C40 58 30 54 28 42C27 33 32 26 37 22C37 29 40 33 45 33C43 22 45 11 52 2Z")); c.restore();
    for (const d of ["M46 98L46 56L54 56L54 98Z", "M50 84C50 70 40 62 22 62C22 78 32 86 50 84Z", "M50 80C50 66 60 58 78 58C78 74 68 82 50 80Z"]) c.fill(P(d));
  },
  /* 탑의 정상: the tower of 도전의 탑, three storeys and a spire, its door cut in (the month's first; the owner's draft A, 2026-11-22) */
  tower: c => { c.fill(P("M18 78L82 78L82 94L18 94Z M27 54L73 54L73 78L27 78Z M35 31L65 31L65 54L35 54Z M42 12L58 12L58 31L42 31Z M50 2L60 12L40 12Z")); cut(c, () => c.fill(P("M44 80C44 74 56 74 56 80L56 94L44 94Z"))); },
  /* 파트너: a paw print, the one sign of a companion */
  paw: c => { c.fill(P("M50 50C64 50 76 62 76 76C76 88 66 92 58 90C54 89 52 87 50 87C48 87 46 89 42 90C34 92 24 88 24 76C24 62 36 50 50 50Z")); for (const [x, y, rx, ry, a] of [[20, 44, 9, 12, -.4], [36, 24, 9, 13, -.15], [64, 24, 9, 13, .15], [80, 44, 9, 12, .4]]) { c.beginPath(); c.ellipse(x, y, rx, ry, a, 0, Math.PI * 2); c.fill(); } },
};
/* 전화기: 전자공학, 화학공학, 기계공학의 준말 (never a telephone). One mark for each, each in its own cell: a chip on electric (top),
   a flask on poison (lower left), a gear on steel (lower right). Each is drawn round its own centre, within 18 of it. */
const ENGINEERING = [
  c => { let d = "M-12 -12L12 -12L12 12L-12 12Z M-5 -5L-5 5L5 5L5 -5Z"; for (const o of [-7, 0, 7]) d += `M${o - 2.2} -18h4.4v6h-4.4Z M${o - 2.2} 12h4.4v6h-4.4Z M-18 ${o - 2.2}h6v4.4h-6Z M12 ${o - 2.2}h6v4.4h-6Z`; fillEO(c, d); },
  c => fillEO(c, "M-7 -17L7 -17L7 -14L5 -14L5 -5L15 11Q17 15 12 15L-12 15Q-17 15 -15 11L-5 -5L-5 -14L-7 -14Z M-8 2L8 2L9.5 5L-9.5 5Z"),
  c => { let d = ""; for (let i = 0; i < 32; i++) { const a = (i - .5) * Math.PI / 16, r = i % 4 < 2 ? 17 : 12; d += (i ? "L" : "M") + (r * Math.cos(a)).toFixed(2) + " " + (r * Math.sin(a)).toFixed(2); } fillEO(c, d + "Z" + circ(0, 0, 5.5)); },
];
/* ---------- each region's landmark, engraved as a small scene (original, generic) ---------- */
const parts = (c, ...ds) => { for (const d of ds) c.fill(P(d)); };
const SCENES = {
  관동: c => { c.fill(P(circ(70, 32, 12))); c.fill(P("M4 86L38 36Q50 26 62 36L96 86Z")); c.save(); c.globalCompositeOperation = "destination-out"; c.fill(P("M38 36Q50 26 62 36L70 48L62 44L56 50L50 42L44 50L38 44L30 48Z")); c.restore(); },
  /* 성도: a pagoda of three broad roofs, each wider than the storey under it */
  성도: c => parts(c, "M46 2L54 2L54 18L46 18Z", "M26 30L36 17L64 17L74 30Z", "M38 29L62 29L62 41L38 41Z", "M18 53L30 40L70 40L82 53Z", "M34 52L66 52L66 64L34 64Z", "M10 77L24 63L76 63L90 77Z", "M28 76L72 76L72 97L28 97Z"),
  호연: c => {
    c.fill(P("M8 84Q50 58 92 84Z"));
    c.lineWidth = 8; c.lineCap = "round"; c.beginPath(); c.moveTo(56, 78); c.quadraticCurveTo(58, 52, 46, 30); c.stroke();
    for (const a of [-2.6, -1.9, -1.2, -.5, .2]) { c.save(); c.translate(46, 30); c.rotate(a); c.beginPath(); c.ellipse(19, 0, 20, 7, 0, 0, Math.PI * 2); c.fill(); c.restore(); }
    c.lineWidth = 6.5; c.beginPath(); for (let x = 5; x <= 95; x += 2) { const y = 93 + 3 * Math.sin(x / 6); x === 5 ? c.moveTo(x, y) : c.lineTo(x, y); } c.stroke();
  },
  신오: c => { fillEO(c, "M8 32L50 8L92 32Z M34 28L50 19L66 28Z"); c.fill(P("M10 35L90 35L90 43L10 43Z M16 46L30 46L30 82L16 82Z M43 46L57 46L57 82L43 82Z M70 46L84 46L84 82L70 82Z M8 85L92 85L92 91L8 91Z M2 93L98 93L98 99L2 99Z")); },
  하나: c => { parts(c, "M21 14L31 14L31 92L21 92Z", "M69 14L79 14L79 92L69 92Z", "M0 65L100 65L100 75L0 75Z"); c.lineWidth = 7; c.lineCap = "round"; c.beginPath(); c.moveTo(3, 34); c.quadraticCurveTo(14, 26, 26, 16); c.quadraticCurveTo(50, 70, 74, 16); c.quadraticCurveTo(86, 26, 97, 34); c.stroke(); for (const x of [38, 50, 62]) c.fillRect(x - 2.5, x === 50 ? 42 : 34, 5, x === 50 ? 24 : 32); },
  /* 칼로스: a lattice tower on wide legs, one broad deck across them and a window cut above it */
  칼로스: c => { parts(c, "M44 2L56 2L58 26L66 26L66 36L60 36C63 58 72 78 92 98L66 98C61 87 56 80 50 80C44 80 39 87 34 98L8 98C28 78 37 58 40 36L34 36L34 26L42 26Z", "M25 54L75 54L75 65L25 65Z"); c.save(); c.globalCompositeOperation = "destination-out"; c.fill(P("M50 38L55 45.5L50 53L45 45.5Z")); c.restore(); },
  알로라: c => { for (let i = 0; i < 5; i++) { c.save(); c.translate(50, 52); c.rotate(i * Math.PI * 2 / 5); c.beginPath(); c.ellipse(0, -24, 15, 22, 0, 0, Math.PI * 2); c.fill(); c.restore(); } c.save(); c.globalCompositeOperation = "destination-out"; c.fill(P(circ(50, 52, 11))); c.restore(); c.fill(P(circ(50, 52, 6))); c.lineWidth = 5; c.lineCap = "round"; c.beginPath(); c.moveTo(50, 52); c.lineTo(58, 28); c.stroke(); },
  /* 가라르: a clock tower, its face cut through with two broad hands, two long windows below */
  가라르: c => {
    parts(c, "M36 22L50 2L64 22Z", "M28 21L72 21L72 57L28 57Z", "M33 56L67 56L67 91L33 91Z", "M24 90L76 90L76 98L24 98Z");
    c.save(); c.globalCompositeOperation = "destination-out"; c.fill(P(circ(50, 39, 13))); c.fill(P("M40 63h7v21h-7Z M53 63h7v21h-7Z")); c.restore();
    parts(c, circ(50, 39, 4.5), "M47 40L53 40L53 28L47 28Z", "M50 36L61 36L61 42L50 42Z");
  },
  히스이: c => parts(c, "M6 13Q50 24 94 13L97 26Q50 37 3 26Z", "M15 45L85 45L85 56L15 56Z", "M22 30L34 30L32 96L20 96Z", "M66 30L78 30L80 96L68 96Z", "M45 30L55 30L55 46L45 46Z", circ(50, 77, 13)),
  팔데아: c => {
    const cutout = draw => { c.save(); c.globalCompositeOperation = "destination-out"; draw(); c.restore(); };
    const sail = P("M-3.5 -6L3.5 -6L11 -48L-11 -48Z");
    c.fill(P("M33 98L42 46L58 46L67 98Z M36 46L50 31L64 46Z M12 94L88 94L88 100L12 100Z"));
    /* four sails widening to their ends, each parted from the tower by a cut of 3 (so the mill is never a figure with crossed arms) */
    for (let i = 0; i < 4; i++) { c.save(); c.translate(50, 38); c.rotate(Math.PI / 4 + i * Math.PI / 2); cutout(() => { c.lineWidth = 6; c.lineJoin = "round"; c.stroke(sail); }); c.fill(sail); c.restore(); }
    cutout(() => c.fill(P(circ(50, 38, 11)))); c.fill(P(circ(50, 38, 7)));
    cutout(() => c.fill(P("M45 70L55 70L55 82L45 82Z")));
  },
};

/* ---------- a champion: a broad crown over the generation in bold round Roman strokes ---------- */
const crown = c => {
  const body = P("M28 45L25 24L38 34L50 18L62 34L75 24L72 45Z");
  c.lineJoin = "round"; c.lineWidth = 4; c.fill(body); c.stroke(body);
  c.fill(P(circ(24.5, 21, 4.4) + circ(50, 14.5, 4.8) + circ(75.5, 21, 4.4)));
  c.beginPath(); c.roundRect(25, 51, 50, 8, 4); c.fill();
};
function roman(n) { const t = [[10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"]]; let s = ""; for (const [v, r] of t) while (n >= v) { s += r; n -= v; } return s; }
function drawRoman(c, n, cx, cy, h, maxWidth, lw) {
  const s = roman(n), W = { I: 0, V: h * .66, X: h * .66 }, gap = lw * 1.75, raw = [...s].reduce((a, ch) => a + W[ch] + gap, -gap), k = Math.min(1, (maxWidth - lw) / Math.max(raw, 1));
  c.save(); c.translate(cx, cy); c.scale(k, k); c.lineWidth = lw / Math.sqrt(k); c.lineCap = c.lineJoin = "round"; c.beginPath();
  let x = -raw / 2;
  for (const ch of s) {
    const w = W[ch];
    if (ch === "I") { c.moveTo(x, -h / 2); c.lineTo(x, h / 2); }
    if (ch === "V") { c.moveTo(x, -h / 2); c.lineTo(x + w / 2, h / 2); c.lineTo(x + w, -h / 2); }
    if (ch === "X") { c.moveTo(x, -h / 2); c.lineTo(x + w, h / 2); c.moveTo(x + w, -h / 2); c.lineTo(x, h / 2); }
    x += w + gap;
  }
  c.stroke(); c.restore();
}

const fits = new Map();
const MARKS = { mega: `${BASE_URL}brand/mega-evolution.png` };

/* the two pictures a medal is lit from: the hill's colours (cells parted by a wire where there are two or three) and the device in its ink */
async function faces(spec, ink) {
  const e = layer(), dev = layer();
  const cols = spec.enamel || [], n = cols.length, rad = a => a * Math.PI / 180;
  const cells = n === 2 ? [[90, 270], [-90, 90]] : n === 3 ? [[-150, -30], [90, 210], [-30, 90]] : [[0, 360]];
  cols.forEach((col, i) => { const [a0, a1] = cells[i]; e.fillStyle = col; e.beginPath(); e.moveTo(C, C); e.arc(C, C, HILL, rad(a0), rad(a1)); e.closePath(); e.fill(); });
  if (n > 1) cut(e, () => { e.lineWidth = 2.2; e.beginPath(); for (const a of n === 2 ? [90, 270] : [-30, 90, 210]) { e.moveTo(C, C); e.lineTo(C + 40 * Math.cos(rad(a)), C + 40 * Math.sin(rad(a))); } e.stroke(); });

  const ids = spec.glyphs || [];
  if (spec.device === "n151" || spec.device === "hangul") await Promise.all([document.fonts.load("900 46px 'Albert Sans'", "151"), document.fonts.load("700 36px Freesentation", "ㄱㅎ")]).catch(() => {});
  const sheet = ids.length ? await loadImage(SYMBOLS) : null;
  const pictures = spec.device === "monkey" ? await Promise.all(MONKEYS.map(pictureInk)) : spec.partner ? [await pictureInk(spec.partner)] : [];
  const mark = spec.mark ? await loadImage(MARKS[spec.mark]) : null;

  /* the device in the 100 space; a lone drawn one is then sized by its ink (below) */
  const device = c => {
    c.fillStyle = c.strokeStyle = ink;
    if (spec.champ) { c.save(); c.translate(C, C); c.scale(.74, .74); c.translate(-50, -47); crown(c); drawRoman(c, spec.champ.gen, 50, 76, 16, 50, 6.5); c.restore(); return; }
    if (spec.device === "monkey") { TRIO.forEach(([x, y, r], i) => drawSilhouette(c, pictures[i], x, y, r, ink)); return; }
    if (spec.device === "engineering") { TRIO.forEach(([x, y, r], i) => { c.save(); c.translate(x, y); c.scale(r * .9 / 18, r * .9 / 18); ENGINEERING[i](c); c.restore(); }); return; }
    if (spec.scene) { SCENES[spec.scene]?.(c); return; }
    if (spec.device || spec.partner) { (DEVICES[spec.device] || DEVICES.paw)(c); return; }
    const places = ids.length === 1 ? [[C, C, HILL]] : ids.length === 2 ? PAIR : TRIO;
    ids.forEach((id, i) => drawType(c, sheet, id, ...places[i]));
  };
  /* a partner is its Pokémon's silhouette, the whole of it inside the hill; without a picture, the paw */
  if (spec.partner && pictures[0]) drawSilhouette(dev, pictures[0], C, C, 33, ink);
  /* the Mega emblem in its own colours, as the owner gave it (an unheld one in the blank's tone) */
  else if (mark) {
    const iw = mark.naturalWidth, ih = mark.naturalHeight, k = 50 / Math.max(iw, ih), t = layer();
    t.imageSmoothingQuality = "high"; t.drawImage(mark, C - iw * k / 2, C - ih * k / 2, iw * k, ih * k);
    if (spec.blank) { t.globalCompositeOperation = "source-in"; t.fillStyle = ink; t.fillRect(0, 0, 100, 100); }
    lay(dev, t.canvas);
  } else {
    /* a lone drawn device is sized by its ink, not its box: the ink's longer side FIT of the hill's width, its corners inside REACH of it,
       centred on its ink (measured on a quarter-size probe). A champion, a type's symbol and what stands in cells keep their places. */
    const lone = (spec.scene || spec.device || spec.partner) && !["monkey", "engineering"].includes(spec.device);
    const fitKey = JSON.stringify([spec.device, spec.scene]);
    let tf = null;
    if (lone && fits.has(fitKey)) tf = fits.get(fitKey);
    else if (lone) {
      const N = BIG / 4, probe = Object.assign(document.createElement("canvas"), { width: N, height: N }).getContext("2d", { willReadFrequently: true });
      probe.scale(N / 100, N / 100); device(probe);
      const d = probe.getImageData(0, 0, N, N).data; let x0 = N, y0 = N, x1 = 0, y1 = 0;
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (d[(y * N + x) * 4 + 3] > 40) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      const u = 100 / N, w = (x1 - x0 + 1) * u, t = (y1 - y0 + 1) * u;
      if (x1 >= x0) tf = { s: Math.min(FIT * 2 * HILL / Math.max(w, t), REACH * 2 * HILL / Math.hypot(w, t)), x: (x0 + x1 + 1) / 2 * u, y: (y0 + y1 + 1) / 2 * u };
      fits.set(fitKey, tf);
      await frame();
    }
    if (tf) { dev.translate(C, C); dev.scale(tf.s, tf.s); dev.translate(-tf.x, -tf.y); }
    device(dev);
    /* whatever was laid in (a type's symbol comes white) takes the medal's ink */
    dev.setTransform(1, 0, 0, 1, 0, 0); dev.globalCompositeOperation = "source-in"; dev.fillStyle = ink; dev.fillRect(0, 0, S, S);
  }
  return { enamel: e.canvas, device: dev.canvas };
}

/* ---------- the light: one soft key from the upper left, cool shade, no reflection ---------- */
const VS = `#version 300 es
in vec2 p; out vec2 vUv; void main(){ vUv = p * .5 + .5; gl_Position = vec4(p, 0., 1.); }`;
/* the device's ink, blurred one way at a time: its slope is what rounds it */
const BLUR = `#version 300 es
precision highp float;
uniform sampler2D uT; uniform vec2 uStep; in vec2 vUv; out vec4 o;
void main() {
  float sum = 0., all = 0.;
  for (int i = -20; i <= 20; i++) { float x = float(i) / 20. * 2.6, w = exp(-.5 * x * x); sum += texture(uT, vUv + uStep * x).a * w; all += w; }
  o = vec4(sum / all);
}`;
const FS = `#version 300 es
precision highp float;
uniform sampler2D uE, uD, uB; uniform float uS, uLift, uHill;
uniform vec3 uRim, uCool, uPale;
in vec2 vUv; out vec4 o;
const vec3 KEY = vec3(-.46, .56, .69);
float bell(float x, float s) { return exp(-.5 * x * x / (s * s)) / (s * 2.5066); }
/* a body's colour under the key: its own colour, a lighter face toward the light, and shade that cools (a pale body's shade is a blue grey) */
vec3 tone(vec3 b, vec3 n, float lo) {
  float lit = dot(normalize(n), KEY), spread = max(b.r, max(b.g, b.b)) - min(b.r, min(b.g, b.b));
  vec3 shade = spread < .157 ? mix(b, uPale, .5) : mix(b, uCool, .34);
  float g = clamp((lit - .8) / .16, 0., 1.);
  return mix(shade, b, smoothstep(lo, .72, lit)) + (mix(b, vec3(1.), .22) - b) * g * g;
}
void main() {
  vec2 q = (vUv - .5) * 100.; float d = length(q), px = 1. / uS; vec2 dir = q / max(d, .001);
  /* the rim: a disc of 47, its edge rounded over */
  vec3 col = tone(uRim, vec3(dir * 31.2 * bell(d - 47., 6.5), 1.), .38);
  /* the hill casts on the rim, down and to the right */
  vec2 fall = vec2(1.5, -2.);
  col = mix(col, uCool, uHill * .3 * (1. - smoothstep(34.8, 39.2, length(q - fall))));
  /* the hill: a disc of 37 swelling to its middle, in the title's colours */
  vec4 e = texture(uE, vUv);
  if (e.a > 0.) col = mix(col, tone(e.rgb / e.a, vec3(dir * 54. * bell(d - 37., 13.5), 1.), .2), e.a);
  /* the device: a soft body on the hill, casting on it */
  col = mix(col, uCool, .3 * texture(uB, vUv - fall / 100.).a);
  vec4 dv = texture(uD, vUv);
  float gx = texture(uB, vUv + vec2(1.5 * px, 0.)).a - texture(uB, vUv - vec2(1.5 * px, 0.)).a;
  float gy = texture(uB, vUv + vec2(0., 1.5 * px)).a - texture(uB, vUv - vec2(0., 1.5 * px)).a;
  if (dv.a > 0.) col = mix(col, tone(dv.rgb / dv.a, vec3(-vec2(gx, gy) * uLift * uS / 300., 1.), .38), dv.a);
  float a = 1. - smoothstep(47. - 150. * px, 47., d);
  o = vec4(col * a, a);
}`;

let gl = null, prog = null, blur = null, targets = null;
function tex(unit, src) {
  const t = gl.createTexture(); gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t);
  if (src) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src); else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, S, S, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return t;
}
function context() {
  if (gl) {
    /* the other size: the canvas and the two pictures blurred into take it */
    if (gl.canvas.width !== S) { gl.canvas.width = gl.canvas.height = S; gl.activeTexture(gl.TEXTURE3); for (const { t } of targets) { gl.bindTexture(gl.TEXTURE_2D, t); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, S, S, 0, gl.RGBA, gl.UNSIGNED_BYTE, null); } }
    return gl;
  }
  const cv = Object.assign(document.createElement("canvas"), { width: S, height: S });
  gl = cv.getContext("webgl2", { premultipliedAlpha: true, preserveDrawingBuffer: true });
  const sh = (t, s) => { const x = gl.createShader(t); gl.shaderSource(x, s); gl.compileShader(x); if (!gl.getShaderParameter(x, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(x)); return x; };
  const make = fs => { const pr = gl.createProgram(); gl.attachShader(pr, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, fs)); gl.bindAttribLocation(pr, 0, "p"); gl.linkProgram(pr); return pr; };
  prog = make(FS); blur = make(BLUR);
  const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
  /* two pictures to blur into, one way then the other */
  targets = [0, 1].map(() => { const t = tex(3, null), f = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, f); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0); return { t, f }; });
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  return gl;
}
const rgb = hex => { const m = String(hex).trim().match(/^#?([0-9a-f]{6})$/i); const n = m ? parseInt(m[1], 16) : 0x808080; return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]; };
const hex = c => "#" + c.map(x => Math.round(Math.min(1, x) * 255).toString(16).padStart(2, "0")).join("");

const cache = new Map(), done = new Map();
/* medals wait in a line to be drawn; one a board is showing goes to its head, past those drawn ahead for a board not yet opened */
const line = [], soon = new Set();
let busy = false;
async function pump() { if (busy) return; busy = true; while (line.length) await line.shift().run(); busy = false; }
const keyOf = (spec, off, ground, big) => JSON.stringify([spec, off, ground, big ? BIG : SMALL]);
/* a medal drawn once is kept on the device for as long as this build is out (2026-11-22: every visit drew every medal again); a new
   build may draw it differently, so it keeps its own. Not in dev, where a medal is being changed */
const BUILD = typeof window !== "undefined" && typeof caches !== "undefined" && window.__YPL_BUILD__ ? "ypl-medals:" + window.__YPL_BUILD__ : "";
const shelf = BUILD ? caches.open(BUILD).catch(() => null) : null;
if (BUILD) caches.keys().then(names => names.forEach(name => name.startsWith("ypl-medals:") && name !== BUILD && caches.delete(name)), () => {});
const kept = key => "/medal/" + encodeURIComponent(key);
/* a medal already drawn, at once (a board seen before switches on with every medal in place) */
export function medalDrawn(spec, off = false, big = false) { return done.get(keyOf(spec, off, getComputedStyle(document.documentElement).getPropertyValue("--ground").trim(), big)) || ""; }
/* one medal as an image URL. Medals are drawn one after another, a frame apart, so a board of them never holds the page.
   ahead: drawn before it is shown (another tab's medal), behind whatever is on screen */
export function medalUrl(spec, off = false, big = false, ahead = false) {
  const css = getComputedStyle(document.documentElement), v = name => rgb(css.getPropertyValue(name));
  const ground = v("--ground"), dark = ground[0] + ground[1] + ground[2] < 1.5;
  const key = keyOf(spec, off, css.getPropertyValue("--ground").trim(), big);
  if (!ahead) { soon.add(key); const i = line.findIndex(w => w.key === key); if (i > 0) line.unshift(...line.splice(i, 1)); }
  if (cache.has(key)) return cache.get(key);
  /* an unheld medal is the housing of a lamp that is off: the panel's own tone all through (a step up from the board in dark, a step down in light),
     no colour on its hill, its device pressed in and not raised; never brighter than a held one */
  const blank = hex(v("--panel-2").map(x => dark ? x * 1.06 + .012 : x * .92));
  const body = off ? blank : hex(v(spec.tier === "gold" ? "--medal-gold" : "--medal-white"));
  const enamel = off ? [] : spec.champ ? [hex(v("--medal-enamel"))] : spec.mark ? [hex(v("--medal-white"))] : (spec.enamel || []).map(id => hex(v(`--type-${id}`)));
  const shade = v("--medal-shade"), pale = v("--medal-shade-pale");
  const draw = async store => {
    await document.fonts.ready; await frame();
    S = big ? BIG : SMALL; K = S / 100;
    const t0 = performance.now(), f = await faces({ ...spec, enamel, blank: off }, body);
    /* a medal whose faces took long is lit a frame later, so drawing and lighting never make one long task */
    if (performance.now() - t0 > 20) await frame();
    const g = context(), ts = [tex(0, f.enamel), tex(1, f.device)];
    g.viewport(0, 0, S, S);
    /* the device's ink blurred across, then down */
    const sigma = (off ? 1.4 : 2.2) / 100;
    g.useProgram(blur); g.uniform1i(g.getUniformLocation(blur, "uT"), 3);
    [[ts[1], [sigma, 0]], [targets[0].t, [0, sigma]]].forEach(([from, step], i) => {
      g.bindFramebuffer(g.FRAMEBUFFER, targets[i].f); g.activeTexture(g.TEXTURE3); g.bindTexture(g.TEXTURE_2D, from);
      g.uniform2f(g.getUniformLocation(blur, "uStep"), ...step); g.drawArrays(g.TRIANGLE_STRIP, 0, 4);
    });
    g.bindFramebuffer(g.FRAMEBUFFER, null); g.clearColor(0, 0, 0, 0); g.clear(g.COLOR_BUFFER_BIT); g.useProgram(prog);
    g.activeTexture(g.TEXTURE0); g.bindTexture(g.TEXTURE_2D, ts[0]); g.activeTexture(g.TEXTURE1); g.bindTexture(g.TEXTURE_2D, ts[1]); g.activeTexture(g.TEXTURE2); g.bindTexture(g.TEXTURE_2D, targets[1].t);
    const u = (n, ...x) => g[`uniform${x.length === 1 ? "1f" : "3f"}`](g.getUniformLocation(prog, n), ...x);
    g.uniform1i(g.getUniformLocation(prog, "uE"), 0); g.uniform1i(g.getUniformLocation(prog, "uD"), 1); g.uniform1i(g.getUniformLocation(prog, "uB"), 2);
    u("uS", S); u("uLift", off ? -8 : 14.9); u("uHill", enamel.length ? 1 : 0);
    u("uRim", ...rgb(body)); u("uCool", ...shade); u("uPale", ...pale);
    g.drawArrays(g.TRIANGLE_STRIP, 0, 4);
    ts.forEach(t => g.deleteTexture(t));
    const blob = await new Promise(res => g.canvas.toBlob(res, "image/png"));
    if (blob && store) store.put(kept(key), new Response(blob)).catch(() => {});
    return blob ? URL.createObjectURL(blob) : "";
  };
  const job = (async () => {
    const store = await shelf, hit = store && await store.match(kept(key)).catch(() => null);
    const url = hit ? URL.createObjectURL(await hit.blob()) : await new Promise(res => {
      line[soon.has(key) ? "unshift" : "push"]({ key, run: () => draw(store).catch(err => { console.error("medal", err); return ""; }).then(res) });
      pump();
    });
    done.set(key, url);
    return url;
  })();
  cache.set(key, job);
  return job;
}
