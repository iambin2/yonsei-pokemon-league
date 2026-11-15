/* ============================== 칭호의 메달 (DESIGN.md "Titles and hall of fame") ==============================
   A struck medal, drawn as a height field on a canvas and lit in WebGL2 (one shared context), returned as an image URL.
   Every device on it is drawn here for the site (a type's symbol, a region's landmark, a title's own device, serif Roman numerals);
   the exceptions are the Mega Evolution emblem, the owner's image as given, and 몽키매직's three monkeys, drawn at the owner's word.
   No other Pokémon picture stands on a medal.
   The spec comes from titleLooks.js: { glyphs | device | scene | mark | champ, enamel: [type id], tier, n (a partner's number) },
   and big when it is drawn as a sheet's face (only then does the band carry the league's name). */

/* ---------- original symbols, drawn in a 100 box ---------- */
const P = d => new Path2D(d);
const star = (n, ro, ri, cx = 50, cy = 50, rot = -Math.PI / 2) => {
  let d = "";
  for (let i = 0; i < n * 2; i++) { const r = i % 2 ? ri : ro, a = rot + i * Math.PI / n; d += (i ? "L" : "M") + (cx + r * Math.cos(a)).toFixed(2) + " " + (cy + r * Math.sin(a)).toFixed(2); }
  return d + "Z";
};
const poly = (n, r, cx = 50, cy = 50, rot = -Math.PI / 2) => { let d = ""; for (let i = 0; i < n; i++) { const a = rot + i * 2 * Math.PI / n; d += (i ? "L" : "M") + (cx + r * Math.cos(a)).toFixed(2) + " " + (cy + r * Math.sin(a)).toFixed(2); } return d + "Z"; };
const circ = (cx, cy, r) => `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0Z`;

const fillEO = (ctx, d) => ctx.fill(P(d), "evenodd");
export const GLYPHS = {
  /* 노말: an egg, the plainest beginning, with a crescent of light cut on its shoulder */
  normal: c => fillEO(c, "M50 6C72 6 84 40 84 62C84 82 69 94 50 94C31 94 16 82 16 62C16 40 28 6 50 6Z M38 24C31 33 27 43 26 54C31 45 36 37 44 30Z"),
  /* 불꽃: a campfire, three tongues of flame over two crossed logs (never the lone flame of 스승's torch) */
  fire: c => {
    const log = "M94 80L6 91L6 99L94 88Z";
    c.save(); c.translate(0, -2); fillEO(c, "M50 2C60 18 70 30 68 46C74 40 78 34 78 24C92 40 92 64 78 76L22 76C8 64 8 42 24 28C24 38 28 44 34 46C30 30 40 16 50 2Z M50 46C57 54 62 60 62 67C62 72 57 76 50 76C43 76 38 72 38 67C38 60 43 54 50 46Z"); c.restore();
    c.fill(P("M6 80L94 91L94 99L6 88Z"));
    c.save(); c.globalCompositeOperation = "destination-out"; c.lineWidth = 5; c.stroke(P(log)); c.restore();
    c.fill(P(log));
  },
  /* 물: a wave breaking, its crest curling over (never the drop of 청출어람) */
  water: c => c.fill(P("M2 96C2 50 22 10 60 10C80 10 94 22 98 40C88 30 74 28 66 36C58 44 62 56 72 58C62 68 46 64 42 52C38 66 46 82 66 86L98 86L98 96Z")),
  /* 전기: two bolts striking together, a great one and a lesser */
  electric: c => { const bolt = P("M60 4L22 54L46 54L36 96L80 40L55 40L68 4Z"); for (const [x, y, k] of [[-8, 2, .92], [54, 46, .52]]) { c.save(); c.translate(x, y); c.scale(k, k); c.fill(bolt); c.restore(); } },
  /* 풀: a tuft of grass, five blades from one root (never the leaf of 청출어람 or the two leaves of 제자) */
  grass: c => {
    c.fill(P("M43 92C43 60 46 30 50 2C54 30 57 60 57 92Z M16 90L84 90L90 99L10 99Z"));
    const side = P("M40 92C36 66 28 44 12 24C32 38 46 62 49 92Z M32 92C27 80 17 70 0 62C18 66 34 76 43 92Z");
    c.fill(side); c.translate(100, 0); c.scale(-1, 1); c.fill(side);
  },
  ice: c => { c.lineCap = "round"; c.lineWidth = 8.5; for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; c.save(); c.translate(50, 50); c.rotate(a); c.beginPath(); c.moveTo(0, 0); c.lineTo(0, -40); c.moveTo(0, -24); c.lineTo(-11, -34); c.moveTo(0, -24); c.lineTo(11, -34); c.stroke(); c.restore(); } c.fill(P(poly(6, 9))); },
  /* 격투: a clenched fist seen from the front, four knuckles and the thumb across them */
  fighting: c => {
    const thumb = "M18 50L62 50Q72 50 72 59Q72 68 62 68L18 68Q10 68 10 59Q10 50 18 50Z";
    c.fill(P("M16 24L84 24L84 78Q84 96 66 96L34 96Q16 96 16 78Z" + circ(25, 22, 9) + circ(42, 18, 9) + circ(58, 18, 9) + circ(75, 22, 9)));
    c.save(); c.globalCompositeOperation = "destination-out"; c.fill(P("M31.5 14h5v34h-5Z M47.5 12h5v36h-5Z M63.5 14h5v34h-5Z")); c.restore();
    c.save(); c.globalCompositeOperation = "destination-out"; c.lineWidth = 10; c.stroke(P(thumb)); c.restore();
    c.fill(P(thumb));
  },
  /* 독: a spotted toadstool, cap over stem */
  poison: c => { fillEO(c, "M6 54C6 26 27 8 50 8C73 8 94 26 94 54Z" + circ(30, 36, 7) + circ(56, 24, 6) + circ(74, 42, 7)); c.fill(P("M36 60L64 60L68 89Q68 94 63 94L37 94Q32 94 32 89Z")); },
  ground: c => c.fill(P("M8 86L92 86L82 68L18 68Z M22 62L78 62L68 44L32 44Z M36 38L64 38L50 14Z")),
  /* 비행: a pair of wings spread left and right */
  flying: c => { const w = P("M50 66C58 42 76 26 99 20C98 33 92 41 84 46L95 46C91 57 82 63 72 65L81 68C72 78 60 80 50 76Z"); c.fill(w); c.translate(100, 0); c.scale(-1, 1); c.fill(w); },
  psychic: c => { c.lineCap = "round"; c.lineWidth = 8; c.beginPath(); for (let t = 0; t <= 3.3 * Math.PI * 2; t += .05) { const r = 4 + t * 2.0, x = 50 + r * Math.cos(t), y = 50 + r * Math.sin(t); t ? c.lineTo(x, y) : c.moveTo(x, y); } c.stroke(); },
  /* 벌레: a beetle from above, its wing cases parted, six legs and two feelers */
  bug: c => {
    fillEO(c, "M50 34C66 34 76 50 76 66C76 84 65 94 50 94C35 94 24 84 24 66C24 50 34 34 50 34Z M48.5 40L51.5 40L51.5 94L48.5 94Z"); c.fill(P(circ(50, 25, 9)));
    c.lineWidth = 6.5; c.lineCap = "round"; c.beginPath();
    for (const s of [-1, 1]) for (const [x0, y0, x1, y1] of [[27, 50, 8, 40], [24, 66, 6, 66], [27, 82, 8, 94], [45, 18, 38, 6]]) { c.moveTo(50 + s * (x0 - 50), y0); c.lineTo(50 + s * (x1 - 50), y1); }
    c.stroke();
  },
  /* 바위: a great boulder, its faces cut, and two lesser stones before it */
  rock: c => {
    const front = "M4 96L10 68L34 58L50 74L48 96Z M52 96L58 70L80 62L96 78L92 96Z";
    c.fill(P("M30 8L64 4L88 28L84 62L20 62L12 34Z"));
    c.save(); c.globalCompositeOperation = "destination-out"; c.lineJoin = c.lineCap = "round"; c.lineWidth = 5; c.stroke(P("M30 8L48 32L88 28M48 32L46 62")); c.lineWidth = 10; c.stroke(P(front)); c.restore();
    c.fill(P(front));
  },
  /* 고스트: a ghost afloat, both arms raised and its tail trailing, two eyes and an open mouth */
  ghost: c => {
    const g = P("M50 4C70 4 82 20 82 40L82 47L95 42L94 58L82 63C81 80 72 92 58 98C62 88 58 82 50 82C34 82 19 76 18 63L6 58L5 42L18 47L18 40C18 20 30 4 50 4Z");
    for (const [x, y, rx, ry] of [[39, 36, 5.5, 8.5], [61, 36, 5.5, 8.5], [50, 60, 6.5, 8.5]]) { g.moveTo(x + rx, y); g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); }
    c.fill(g, "evenodd");
  },
  /* 드래곤: a dragon's eye, the pupil a slit, under the ridge of its brow */
  dragon: c => { fillEO(c, "M2 56Q50 14 98 56Q50 94 2 56Z" + circ(50, 56, 20)); c.fill(P("M50 37Q61 56 50 75Q39 56 50 37Z M4 32Q50 -4 96 32L91 41Q50 9 9 41Z")); },
  dark: c => c.fill(P("M60 8A42 42 0 1 0 92 70A33 33 0 1 1 60 8Z")),
  /* 강철: an anvil, horn to the left and heel to the right (the hexagon nut read as a settings icon) */
  steel: c => c.fill(P("M2 20L30 20L30 14L98 14L98 34L82 34C73 34 67 40 65 48L65 62L79 70L86 86L14 86L21 70L35 62L35 50C26 50 12 40 2 20Z")),
  fairy: c => { c.fill(P("M50 4C54 36 64 46 96 50C64 54 54 64 50 96C46 64 36 54 4 50C36 46 46 36 50 4Z")); c.fill(P("M82 10C83 18 86 21 94 22C86 23 83 26 82 34C81 26 78 23 70 22C78 21 81 18 82 10Z")); },
  /* an original double helix for the Mega title */
  mega: c => { c.lineCap = "round"; c.lineWidth = 7; for (const s of [0, Math.PI]) { c.beginPath(); for (let y = 8; y <= 92; y += 1) { const x = 50 + 26 * Math.sin((y - 8) / 84 * Math.PI * 2 + s); y === 8 ? c.moveTo(x, y) : c.lineTo(x, y); } c.stroke(); } c.lineWidth = 4; for (let y = 16; y <= 86; y += 10) { const x = 26 * Math.sin((y - 8) / 84 * Math.PI * 2); c.beginPath(); c.moveTo(50 - x, y); c.lineTo(50 + x, y); c.stroke(); } },
  crown: c => c.fill(P("M12 72L18 28L36 50L50 18L64 50L82 28L88 72Z M14 78L86 78L86 90L14 90Z" + circ(18, 26, 5) + circ(50, 15, 5) + circ(82, 26, 5))),
};
const drawGlyph = (ctx, id, cx, cy, size) => { const g = GLYPHS[id] || GLYPHS.normal; ctx.save(); ctx.translate(cx - size / 2, cy - size / 2); ctx.scale(size / 100, size / 100); ctx.strokeStyle = ctx.fillStyle; g(ctx); ctx.restore(); };

/* ---------- the height field ---------- */
/* drawn in a 512 space at 1.5 times its pixels, so every edge and every line of the turning is finer than a screen pixel */
const BASE = 512, S = 768, K = S / BASE, C = BASE / 2, R = 250, FIT = .72, REACH = .93;
const layer = () => { const c = Object.assign(document.createElement("canvas"), { width: S, height: S }).getContext("2d"); c.scale(K, K); return c; };
/* lay one full-size canvas over another, whatever the transform of the one beneath */
const lay = (ctx, src, op = "source-over", alpha = 1) => { ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = op; ctx.globalAlpha = alpha; ctx.drawImage(src, 0, 0); ctx.restore(); };
const grey = v => `rgb(${v},${v},${v})`;
const disc = (ctx, r, v) => { ctx.fillStyle = grey(v); ctx.beginPath(); ctx.arc(C, C, r, 0, Math.PI * 2); ctx.fill(); };
function arcText(ctx, text, r, top, px, family) {
  ctx.font = `700 ${px}px ${family}`;
  const chars = [...text], track = px * .18, widths = chars.map(ch => ctx.measureText(ch).width + track);
  const total = widths.reduce((a, b) => a + b, 0) - track;
  let a = (top ? -Math.PI / 2 : Math.PI / 2) + (top ? -1 : 1) * total / r / 2;
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  chars.forEach((ch, i) => {
    const mid = a + (top ? 1 : -1) * (widths[i] - track) / r / 2;
    ctx.save(); ctx.translate(C + r * Math.cos(mid), C + r * Math.sin(mid)); ctx.rotate(mid + (top ? Math.PI / 2 : -Math.PI / 2)); ctx.fillText(ch, 0, 0); ctx.restore();
    a += (top ? 1 : -1) * widths[i] / r;
  });
}
/* ---------- devices drawn for single titles (original, in a 100 box) ---------- */
const DEVICES = {
  /* 끝말잇기: an open book of Hangul, its letters running page to page as a word chain does */
  hangul: (c, fill) => {
    c.fill(P("M50 30C40 22 22 20 6 24L6 80C22 76 40 78 50 86C60 78 78 76 94 80L94 24C78 20 60 22 50 30Z"));
    c.save(); c.globalCompositeOperation = "destination-out"; c.fill(P("M48.6 32L51.4 32L51.4 84L48.6 84Z")); c.restore();
    c.fillStyle = fill.low; c.font = "700 36px Freesentation"; c.textAlign = "center"; c.textBaseline = "middle";
    c.fillText("ㄱ", 28, 53); c.fillText("ㅎ", 72, 53);
  },
  /* 스승: a torch that hands its flame on */
  torch: c => { c.fill(P("M50 2C62 16 73 28 71 42C69 54 60 58 50 58C40 58 31 54 29 42C27 28 38 16 50 2Z M24 61L76 61L69 73L31 73Z M35 76L65 76L57 98L43 98Z")); },
  /* 제자: a sprout, two leaves on a young stem */
  sprout: c => { c.fill(P("M46.5 96L46.5 50L53.5 50L53.5 96Z M50 54C50 34 36 22 12 22C12 44 26 56 50 54Z M50 48C50 26 66 12 90 12C90 36 74 50 50 48Z M30 96L70 96L66 88L34 88Z")); },
  /* RED: 151, the first generation's number (a cup of those 151 alone), in serif figures over a rule; not a counter */
  n151: c => {
    const one = "M22 14L36 4L42 4L42 88Q43 93 52 94L52 100L14 100L14 94Q23 93 25 88L25 20Q19 23 11 23L11 19Q18 18 22 14Z";
    const five = "M14 4L54 4L52 18L23 18L20 41Q28 36 36 36Q57 38 58 66Q56 97 29 99Q11 99 5 88Q5 80 12 80Q19 81 19 88Q21 93 29 93Q41 91 41 67Q40 46 30 46Q22 46 16 52L10 50Z";
    const k = .5, ws = [54, 62, 54], gap = 4, total = (ws.reduce((x, y) => x + y, 0) + gap * 2) * k;
    let x = 50 - total / 2;
    [one, five, one].forEach((d, i) => { c.save(); c.translate(x, 22); c.scale(k, k); c.fill(P(d)); c.restore(); x += (ws[i] + gap) * k; });
    c.fill(P("M22 82L78 82L78 87L22 87Z")); c.fill(P(star(5, 6.5, 2.8, 12, 84.5) + star(5, 6.5, 2.8, 88, 84.5)));
  },


  /* 초신성: a new star bursting, one body of twelve rays with a star cut in its heart (a newcomer who won) */
  nova: c => fillEO(c, star(12, 48, 28) + star(5, 16, 7)),
  /* 슈퍼루키: a shooting star climbing, its trail behind it (a rookie on the rise) */
  rookie: c => {
    c.fill(P(star(5, 27, 11.5, 68, 32, -Math.PI / 2 + .3)));
    c.fill(P("M56 50L10 96L3 89L49 43Z M67 62L35 94L30 89L62 57Z M39 34L7 66L2 61L34 29Z"));
  },
  /* 버스 드라이버: a steering wheel (the one driver who carries the whole team) */
  bus: c => { fillEO(c, circ(50, 50, 47) + circ(50, 50, 33)); c.fill(P(circ(50, 50, 13) + "M16 44L84 44L84 56L16 56Z M44 50L56 50L56 84L44 84Z")); },
  /* 청출어람: the indigo leaf and the drop of blue that comes out of it, deeper than the leaf */
  indigo: c => {
    c.fill(P("M12 50C12 24 32 8 62 8C62 34 44 52 12 50Z"));
    c.save(); c.globalCompositeOperation = "destination-out"; c.fill(P("M16 46L56 12L58 14L18 48Z")); c.restore();
    c.fill(P("M66 34C72 50 88 62 88 76C88 88 78 96 66 96C54 96 44 88 44 76C44 62 60 50 66 34Z"));
    c.save(); c.globalCompositeOperation = "destination-out"; c.fill(P("M52 76C52 84 57 89 63 90C58 86 56 82 56 76Z")); c.restore();
  },
  /* 전화기: 전자공학, 화학공학, 기계공학의 준말 (never a telephone). One mark for each, each standing in its own cell of enamel:
     a chip on electric (top), a flask on poison (lower left), a gear on steel (lower right) */
  engineering: c => {
    /* each mark drawn round its own centre in a 40 box, then set large in the middle of its cell */
    const chip = () => {
      let d = "M-12 -12L12 -12L12 12L-12 12Z M-5 -5L-5 5L5 5L5 -5Z";
      for (const o of [-7, 0, 7]) d += `M${o - 1.75} -18h3.5v6h-3.5Z M${o - 1.75} 12h3.5v6h-3.5Z M-18 ${o - 1.75}h6v3.5h-6Z M12 ${o - 1.75}h6v3.5h-6Z`;
      fillEO(c, d);
    };
    const flask = () => fillEO(c, "M-7 -17L7 -17L7 -14L5 -14L5 -5L15 11Q17 15 12 15L-12 15Q-17 15 -15 11L-5 -5L-5 -14L-7 -14Z M-8 2L8 2L9.5 5L-9.5 5Z");
    const gear = () => { let d = ""; for (let i = 0; i < 32; i++) { const a = (i - .5) * Math.PI / 16, r = i % 4 < 2 ? 16 : 12; d += (i ? "L" : "M") + (r * Math.cos(a)).toFixed(2) + " " + (r * Math.sin(a)).toFixed(2); } fillEO(c, d + "Z" + circ(0, 0, 5.5)); };
    for (const [mark, x, y] of [[chip, 50, 10], [flask, 14, 72], [gear, 86, 72]]) { c.save(); c.translate(x, y); c.scale(1.4, 1.4); mark(); c.restore(); }
  },
  /* 몽키매직: the three monkeys as the owner asked (2026-11-15), each in the cell of its own colour: 야나프 on grass at the top,
     바오프 on fire at the lower left, 앗차프 on water at the lower right. Drawn as cloisonné: a metal outline round the head, its ears
     and its crest with the cell's enamel inside it (the coloured head), the face mask and the inner ears in metal (the pale face),
     the eyes cut through to the enamel. What tells them apart is the crest: a broccoli bush on a stalk, a flame curling to a point,
     a splash of bubbles rising to the right. */
  monkey: c => {
    const disc = (x, y, r) => { const q = new Path2D(); q.arc(x, y, r, 0, Math.PI * 2); return q; };
    const oval = (x, y, rx, ry, a = 0) => { const q = new Path2D(); q.ellipse(x, y, rx, ry, a, 0, Math.PI * 2); return q; };
    const CRESTS = {
      yanappu: () => [P("M-1.8 -10.5L1.8 -10.5L1.8 -5L-1.8 -5Z"), disc(-6, -14, 4.6), disc(0, -16.5, 5.2), disc(6, -14, 4.6), disc(-3, -11.5, 3.6), disc(3, -11.5, 3.6)],
      baoppu: () => [P("M-10 1C-11.5 -8 -6.5 -13.5 -0.5 -14.5C1.5 -17 3 -20 6.5 -24C7.5 -18.5 11.5 -14 11.5 -7.5C11.5 -2 10.5 1 10 1Z")],
      atchappu: () => [disc(-5, -9.5, 4.6), disc(0.5, -12.5, 5), disc(6, -15.5, 4.2), disc(9.5, -11, 3.6), disc(4.5, -8.5, 3.6)],
    };
    const monkey = kind => {
      const shapes = [disc(0, 4, 10.5), oval(-14, 3, 6.5, 8, -.25), oval(14, 3, 6.5, 8, .25), ...CRESTS[kind]()];
      c.lineWidth = 5.4; c.lineJoin = "round"; for (const q of shapes) c.stroke(q);
      c.save(); c.globalCompositeOperation = "destination-out"; for (const q of shapes) c.fill(q); c.restore();
      c.fill(oval(-14.5, 3.5, 3.4, 5, -.25)); c.fill(oval(14.5, 3.5, 3.4, 5, .25));
      if (kind === "baoppu") { c.lineWidth = 2.4; c.lineCap = "round"; c.beginPath(); c.moveTo(-4, -4); c.bezierCurveTo(-3, -10, 5, -11, 5.5, -5.5); c.bezierCurveTo(5.5, -2.5, 1.5, -2.5, 1.5, -5); c.stroke(); }
      /* the face: a pale mask over the muzzle rising in two rounds round the eyes */
      const mask = new Path2D(); mask.ellipse(0, 8, 8.4, 5.6, 0, 0, Math.PI * 2); mask.arc(-3.7, 2.8, 4.3, 0, Math.PI * 2); mask.arc(3.7, 2.8, 4.3, 0, Math.PI * 2);
      c.fill(mask);
      c.save(); c.globalCompositeOperation = "destination-out";
      if (kind === "atchappu") { c.lineWidth = 2.2; c.lineCap = "round"; c.beginPath(); for (const x of [-3.8, 3.8]) { c.moveTo(x - 2.4, 3.6); c.quadraticCurveTo(x, 0, x + 2.4, 3.6); } c.stroke(); }
      else for (const x of [-3.8, 3.8]) c.fill(oval(x, 2.6, 2.7, 3.5));
      c.lineWidth = 2.2; c.lineCap = "round"; c.beginPath(); c.moveTo(-3, 9.2); c.quadraticCurveTo(0, 11.6, 3, 9.2); c.stroke();
      c.restore();
    };
    for (const [kind, x, y] of [["yanappu", 50, 14], ["baoppu", 11, 79], ["atchappu", 89, 79]]) { c.save(); c.translate(x, y); c.scale(1.55, 1.55); monkey(kind); c.restore(); }
  },
  /* 파트너: a paw print, the one sign of a companion */
  paw: c => { c.fill(P("M50 50C64 50 76 62 76 76C76 88 66 92 58 90C54 89 52 87 50 87C48 87 46 89 42 90C34 92 24 88 24 76C24 62 36 50 50 50Z")); for (const [x, y, rx, ry, a] of [[20, 44, 9, 12, -.4], [36, 24, 9, 13, -.15], [64, 24, 9, 13, .15], [80, 44, 9, 12, .4]]) { c.beginPath(); c.ellipse(x, y, rx, ry, a, 0, Math.PI * 2); c.fill(); } },
};
/* ---------- a partner's footprint after its kind: a bird's three clawed toes and hind claw, a webbed foot of three toes; any other a paw ---------- */
const FEET = {
  bird: c => { for (const a of [-.66, 0, .66]) { c.save(); c.translate(50, 62); c.rotate(a); c.fill(P("M-7 0L-6 -34L0 -54L6 -34L7 0Z")); c.restore(); } c.fill(P("M43 62L45 84L50 96L55 84L57 62Z" + circ(50, 62, 11))); },
  webbed: c => c.fill(P("M45 93L4 26Q4 12 16 14Q30 58 43 12Q50 -2 57 12Q70 58 84 14Q96 12 96 26L55 93Q50 99 45 93Z")),
};
/* ---------- each region's landmark, engraved as a small scene (original, generic) ---------- */
const SCENES = {
  관동: c => { c.fill(P(circ(70, 32, 12))); c.fill(P("M4 86L38 36Q50 26 62 36L96 86Z")); c.save(); c.globalCompositeOperation = "destination-out"; c.fill(P("M38 36Q50 26 62 36L70 48L62 44L56 50L50 42L44 50L38 44L30 48Z")); c.restore(); },
  성도: c => { c.fill(P("M48 4L52 4L52 16L48 16Z M30 26Q50 14 70 26L64 28L36 28Z M38 28L62 28L62 40L38 40Z M24 48Q50 34 76 48L68 50L32 50Z M34 50L66 50L66 64L34 64Z M16 72Q50 56 84 72L74 74L26 74Z M30 74L70 74L70 92L30 92Z")); },
  호연: c => {
    c.fill(P("M8 84Q50 60 92 84Z"));
    c.lineWidth = 6; c.lineCap = "round"; c.beginPath(); c.moveTo(56, 78); c.quadraticCurveTo(58, 52, 46, 30); c.stroke();
    for (const a of [-2.6, -1.9, -1.2, -.5, .2]) { c.save(); c.translate(46, 30); c.rotate(a); c.beginPath(); c.ellipse(19, 0, 20, 6, 0, 0, Math.PI * 2); c.fill(); c.restore(); }
    c.lineWidth = 4.5; c.beginPath(); for (let x = 4; x <= 96; x += 2) { const y = 93 + 3 * Math.sin(x / 6); x === 4 ? c.moveTo(x, y) : c.lineTo(x, y); } c.stroke();
  },
  신오: c => { fillEO(c, "M8 32L50 8L92 32Z M34 28L50 19L66 28Z"); c.fill(P("M10 35L90 35L90 43L10 43Z M16 46L30 46L30 82L16 82Z M43 46L57 46L57 82L43 82Z M70 46L84 46L84 82L70 82Z M8 85L92 85L92 91L8 91Z M2 93L98 93L98 99L2 99Z")); },
  하나: c => { c.fill(P("M22 14L30 14L30 92L22 92Z M70 14L78 14L78 92L70 92Z M0 66L100 66L100 74L0 74Z")); c.lineWidth = 5; c.lineCap = "round"; c.beginPath(); c.moveTo(2, 34); c.quadraticCurveTo(14, 26, 26, 16); c.quadraticCurveTo(50, 70, 74, 16); c.quadraticCurveTo(86, 26, 98, 34); c.stroke(); for (const x of [38, 50, 62]) c.fillRect(x - 1.5, x === 50 ? 42 : 34, 3, x === 50 ? 24 : 32); },
  칼로스: c => { c.fill(P("M46 2L54 2L57 28L65 28L65 36L59 36C62 60 72 80 92 98L68 98C62 86 56 78 50 78C44 78 38 86 32 98L8 98C28 80 38 60 41 36L35 36L35 28L43 28Z M28 56L72 56L72 64L28 64Z")); c.save(); c.globalCompositeOperation = "destination-out"; c.fill(P("M50 40L55 48L50 54L45 48Z")); c.restore(); },
  알로라: c => { for (let i = 0; i < 5; i++) { c.save(); c.translate(50, 52); c.rotate(i * Math.PI * 2 / 5); c.beginPath(); c.ellipse(0, -24, 15, 22, 0, 0, Math.PI * 2); c.fill(); c.restore(); } c.save(); c.globalCompositeOperation = "destination-out"; c.fill(P(circ(50, 52, 10))); c.restore(); c.fill(P(circ(50, 52, 5))); c.lineWidth = 3; c.beginPath(); c.moveTo(50, 52); c.lineTo(58, 26); c.stroke(); },
  가라르: c => { c.fill(P("M40 20L50 0L60 20Z M34 20L66 20L66 50L34 50Z M37 52L63 52L63 90L37 90Z M28 90L72 90L72 98L28 98Z")); c.save(); c.globalCompositeOperation = "destination-out"; c.fill(P(circ(50, 35, 11))); c.fill(P("M43 58h4v26h-4Z M53 58h4v26h-4Z")); c.restore(); c.fill(P(circ(50, 35, 3.2) + "M48.5 35L51.5 35L51.5 26L48.5 26Z M49 33.5L58 36L57 39L48 36.5Z")); },
  히스이: c => c.fill(P("M6 14Q50 24.8 94 14L97 25.9Q50 36.7 3 25.9Z M16 46.4L84 46.4L84 55L16 55Z M23 31.3L33 31.3L31 96L21 96Z M67 31.3L77 31.3L79 96L69 96Z M46 31.3L54 31.3L54 46.4L46 46.4Z" + circ(50, 76, 13))),
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

/* ---------- serif Roman numerals: bracketed serifs, thick and thin strokes ---------- */
const LETTERS = {
  I: [40, "M0 0H40V5Q30 7 28 14V86Q30 93 40 95V100H0V95Q10 93 12 86V14Q10 7 0 5Z"],
  V: [72, "M0 0H34V5Q27 6 27 10L41 76L56 10Q55 6 48 5V0H72V5Q65 6 63 11L39 100H35L10 11Q8 6 0 5Z"],
  X: [74, "M0 0H32V5Q25 6 26 9L38 36L50 9Q50 6 44 5V0H70V5Q63 6 59 12L42 44L64 90Q67 94 74 95V100H40V95Q47 94 46 91L34 64L22 91Q22 94 28 95V100H2V95Q9 94 13 88L30 54L12 11Q10 6 0 5Z"],
};
function roman(n) { const t = [[10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"]]; let s = ""; for (const [v, r] of t) while (n >= v) { s += r; n -= v; } return s; }
function drawRoman(ctx, n, cx, cy, height, maxWidth = Infinity) {
  const s = roman(n), raw = [...s].reduce((a, ch) => a + LETTERS[ch][0] + 6, -6), k = Math.min(height / 100, maxWidth / raw), gap = 6, w = raw * k;
  height = 100 * k;
  let x = cx - w / 2;
  for (const ch of s) { const [lw, d] = LETTERS[ch]; ctx.save(); ctx.translate(x, cy - height / 2); ctx.scale(k, k); ctx.fill(P(d)); ctx.restore(); x += (lw + gap) * k; }
}

const fits = new Map();
const frame = () => new Promise(res => requestAnimationFrame(() => res()));
const images = new Map();
const loadImage = src => { if (!images.has(src)) images.set(src, new Promise(res => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; })); return images.get(src); };
/* a supplied mark (the Mega emblem, the YPL wing) used as it is: its ink becomes the relief */
function drawMark(ctx, img, cx, cy, size, fill) {
  if (!img) return;
  const t = layer();
  const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height, k = size / Math.max(iw, ih);
  t.imageSmoothingQuality = "high"; t.drawImage(img, cx - iw * k / 2, cy - ih * k / 2, iw * k, ih * k);
  t.globalCompositeOperation = "source-in"; t.fillStyle = fill; t.fillRect(0, 0, BASE, BASE);
  lay(ctx, t.canvas);
}

async function heightField(spec) {
  const h = layer(), e = layer();
  const lat = "'Albert Sans'";
  const mark = spec.mark ? await loadImage(spec.mark) : null;
  h.fillStyle = "#000"; h.fillRect(0, 0, BASE, BASE);
  /* rim: a rounded edge with a milled outer band */
  const g = h.createRadialGradient(C, C, .84 * R, C, C, R);
  g.addColorStop(0, grey(196)); g.addColorStop(.55, grey(214)); g.addColorStop(.86, grey(200)); g.addColorStop(1, grey(120));
  h.fillStyle = g; h.beginPath(); h.arc(C, C, R, 0, Math.PI * 2); h.fill();
  h.strokeStyle = grey(176); h.lineWidth = 1.1;
  for (let i = 0; i < 260; i++) { const t = i / 260 * Math.PI * 2; h.beginPath(); h.moveTo(C + .955 * R * Math.cos(t), C + .955 * R * Math.sin(t)); h.lineTo(C + R * Math.cos(t), C + R * Math.sin(t)); h.stroke(); }
  /* the band: beads, and the league's name below only on a medal drawn large (a sheet's face); on a board it is noise */
  disc(h, .87 * R, 168);
  h.fillStyle = grey(206);
  for (let i = 0; i < 132; i++) { const t = i / 132 * Math.PI * 2; h.beginPath(); h.arc(C + .846 * R * Math.cos(t), C + .846 * R * Math.sin(t), 1.9, 0, Math.PI * 2); h.fill(); }
  h.fillStyle = grey(222);
  if (spec.big) arcText(h, "YONSEI POKÉMON LEAGUE", .755 * R, false, 17, lat);
  /* the field: a recessed mirror, polished flat */
  h.strokeStyle = grey(218); h.lineWidth = 4; h.beginPath(); h.arc(C, C, .69 * R, 0, Math.PI * 2); h.stroke();
  disc(h, .675 * R, 132);
  /* the cartouche: a raised ring round a large field of enamel, the title's meaning; DK is how much larger a device stands on it than on the first medal */
  const cr = .64 * R, cy = C, ER = cr - 3.5, DK = 1.42;
  h.strokeStyle = grey(224); h.lineWidth = 7; h.beginPath(); h.arc(C, cy, cr, 0, Math.PI * 2); h.stroke();
  h.fillStyle = grey(150); h.beginPath(); h.arc(C, cy, ER, 0, Math.PI * 2); h.fill();
  /* cloisonné: two or three colours are solid cells parted by a raised wire (two left and right, three a cell at the top and two below), never melted */
  const cols = spec.enamel || [], n = cols.length, rad = a => a * Math.PI / 180;
  const cells = n === 2 ? [[90, 270], [-90, 90]] : n === 3 ? [[-150, -30], [90, 210], [-30, 90]] : [[0, 360]];
  cols.forEach((col, i) => { const [a0, a1] = cells[i]; e.fillStyle = col; e.beginPath(); e.moveTo(C, cy); e.arc(C, cy, ER, rad(a0), rad(a1)); e.closePath(); e.fill(); });
  const wire = (ctx, ink, width, draw) => { ctx.save(); if (ink === "#000") ctx.globalCompositeOperation = "destination-out"; ctx.strokeStyle = ink; ctx.lineWidth = width; ctx.beginPath(); draw(ctx); ctx.stroke(); ctx.restore(); };
  for (const [ctx, ink] of [[h, grey(226)], [e, "#000"]]) {
    if (n === 2) wire(ctx, ink, 4.5, c => { c.moveTo(C, cy - ER); c.lineTo(C, cy + ER); });
    if (n === 3) wire(ctx, ink, 4.5, c => { for (const a of [-30, 90, 210]) { c.moveTo(C, cy); c.lineTo(C + ER * Math.cos(rad(a)), cy + ER * Math.sin(rad(a))); } });
    /* a champion's navy gets a fine inner ring, so it never reads as the board showing through */
    if (spec.champ) wire(ctx, ink, 3, c => c.arc(C, cy, ER * .9, 0, Math.PI * 2));
  }
  /* the device, raised in metal out of the enamel */
  const device = (ctx, ink) => {
    const box = (fn, size, dy = 0) => { ctx.save(); ctx.translate(C - size / 2, cy + dy - size / 2); ctx.scale(size / 100, size / 100); ctx.fillStyle = ink; ctx.strokeStyle = ink; fn(ctx, { high: ink, low: ink === "#000" ? "#000" : grey(170) }); ctx.restore(); };
    /* a champion: the crown over the generation's numeral, every season alike */
    if (spec.champ) {
      box(GLYPHS.crown, 48 * DK * 1.4, -62 * DK);
      ctx.fillStyle = ink; drawRoman(ctx, spec.champ.gen, C, cy + 20 * DK, 92 * DK * .9, 1.36 * ER);
      return;
    }
    if (spec.mark) { drawMark(ctx, mark, C, cy, 140 * DK, ink); return; }
    if (spec.scene) { box(SCENES[spec.scene], 136 * DK * 1.12, 2 * DK); return; }
    /* a partner: its kind's footprint (a bird's, a webbed foot, or a paw) and its Pokémon's national number under it, so no two partners share a medal */
    if (spec.device === "paw" && spec.n) {
      box(c => { c.save(); c.translate(20, -8); c.scale(.6, .6); (FEET[spec.foot] || DEVICES.paw)(c); c.restore(); c.font = `800 29px ${lat}`; c.textAlign = "center"; c.textBaseline = "alphabetic"; c.fillText(String(spec.n), 50, 90); }, 130 * DK, 2 * DK);
      return;
    }
    if (spec.device) { box(DEVICES[spec.device], 130 * DK, 2 * DK); return; }
    const ids = spec.glyphs || [], m = ids.length;
    const places = m === 1 ? [[0, 0, 132]] : m === 2 ? [[-44, 0, 78], [44, 0, 78]] : [[0, -40, 66], [-46, 34, 66], [46, 34, 66]];
    ctx.fillStyle = ink; ids.forEach((id, i) => { const [x, y, s] = places[i]; drawGlyph(ctx, id, C + x * DK, cy + y * DK, s * DK); });
  };
  /* the device is struck on a layer of its own: what is cut out of it (a bus's windows, a ring's middle) lies on the enamel, never through the medal */
  /* a lone device is sized by its ink, not its box (2026-11-15): the ink's longer side FIT of the enamel's width, its corners inside REACH of it,
     centred on its ink. Measured on a quarter-size probe. A champion, the Mega emblem and what stands in cells (two or three symbols, 전화기, 몽키매직) keep their places. */
  let tf = null;
  const lone = !spec.champ && !spec.mark && !["monkey", "engineering"].includes(spec.device) && (spec.glyphs || [0]).length === 1;
  const fitKey = JSON.stringify([spec.glyphs, spec.device, spec.scene, spec.foot, spec.n]);
  if (lone && fits.has(fitKey)) tf = fits.get(fitKey);
  else if (lone) {
    const N = BASE / 4, probe = Object.assign(document.createElement("canvas"), { width: N, height: N }).getContext("2d", { willReadFrequently: true });
    probe.scale(.25, .25); device(probe, "#fff");
    const d = probe.getImageData(0, 0, N, N).data; let x0 = N, y0 = N, x1 = 0, y1 = 0;
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (d[(y * N + x) * 4 + 3] > 40) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    const w = (x1 - x0 + 1) * 4, t = (y1 - y0 + 1) * 4;
    if (x1 >= x0) tf = { s: Math.min(FIT * 2 * ER / Math.max(w, t), REACH * 2 * ER / Math.hypot(w, t)), x: (x0 + x1 + 1) * 2, y: (y0 + y1 + 1) * 2 };
    fits.set(fitKey, tf);
    await frame();
  }
  const struck = ink => { const l = layer(); if (tf) { l.translate(C, cy); l.scale(tf.s, tf.s); l.translate(-tf.x, -tf.y); } device(l, ink); return l.canvas; };
  lay(h, struck(grey(246)));
  lay(e, struck("#000"), "destination-out");
  /* every edge rounded as a die rounds it: a fine bevel, and a broader shoulder under it */
  const soft = layer(); soft.filter = `blur(${1.1 * K}px)`; lay(soft, h.canvas);
  const shoulder = layer(); shoulder.filter = `blur(${3.2 * K}px)`; lay(shoulder, h.canvas);
  lay(soft, shoulder.canvas, "source-over", .38);
  const wide = layer(); wide.filter = `blur(${7 * K}px)`; lay(wide, h.canvas);
  return { height: soft.canvas, wide: wide.canvas, enamel: e.canvas };
}

/* ---------- the light ---------- */
const VS = `#version 300 es
in vec2 p; out vec2 vUv; void main(){ vUv = p * .5 + .5; gl_Position = vec4(p, 0., 1.); }`;
const FS = `#version 300 es
precision highp float;
uniform sampler2D uH, uB, uE; uniform float uS, uDepth, uAO, uThr, uShinF, uShinR, uEnamel, uAmb;
uniform vec3 uF0F, uF0R, uSky, uFloor, uKey;
in vec2 vUv; out vec4 o;
const vec3 KEY = normalize(vec3(-.5, .58, .64));
vec3 env(vec3 r, float shin) {
  vec3 base = mix(uFloor, uSky, smoothstep(-.35, .45, r.y - r.x * .35));
  float k1 = pow(max(dot(r, KEY), 0.), shin);
  float k2 = pow(max(dot(r, normalize(vec3(.6, .3, .74))), 0.), shin * .5) * .35;
  float k3 = pow(max(dot(r, normalize(vec3(.05, -.8, .6))), 0.), shin * .7) * .16;
  float strip = smoothstep(.12, 0., abs(r.x + r.y * .55 + .06)) * .22;
  return base + uKey * (k1 * 1.5 + k2 + k3 + strip);
}
void main() {
  float d = 1. / uS;
  float h = texture(uH, vUv).r;
  #define T(x, y) texture(uH, vUv + vec2(x, y) * d).r
  float hx = (T(1., -1.) + 2. * T(1., 0.) + T(1., 1.) - T(-1., -1.) - 2. * T(-1., 0.) - T(-1., 1.)) * .25;
  float hy = (T(-1., 1.) + 2. * T(0., 1.) + T(1., 1.) - T(-1., -1.) - 2. * T(0., -1.) - T(1., -1.)) * .25;
  vec3 n = normalize(vec3(-hx * uDepth, -hy * uDepth, 1.));
  vec2 q = vUv * 2. - 1.; float rad = length(q);
  float a = 1. - smoothstep(.977 - 2.5 * d, .977, rad);
  vec3 v = normalize(vec3(-q * .3, 1.));
  vec3 rf = reflect(-v, n);
  float relief = smoothstep(uThr - .03, uThr + .03, h);
  vec3 F0 = mix(uF0F, uF0R, relief); float shin = mix(uShinF, uShinR, relief);
  float diff = max(dot(n, KEY), 0.);
  vec3 col = F0 * env(rf, shin) + F0 * diff * .22 * relief + F0 * uAmb * (.6 + .4 * diff);
  float ao = clamp(1. - max(texture(uB, vUv).r - h, 0.) * uAO, .3, 1.);
  col *= ao;
  vec4 e = texture(uE, vUv);
  if (e.a > 0.) {
    vec3 ec = e.rgb / max(e.a, .001) * (.62 + .38 * diff) * pow(ao, 2.2);
    ec += vec3(pow(max(dot(rf, KEY), 0.), 220.) * .9) + (env(rf, 6.) - uFloor) * .06;
    col = mix(col, ec, e.a * uEnamel);
  }
  col = col / (1. + col * .18);
  o = vec4(col * a, a);
}`;

let gl = null, prog = null;
function context() {
  if (gl) return gl;
  const cv = Object.assign(document.createElement("canvas"), { width: S, height: S });
  gl = cv.getContext("webgl2", { premultipliedAlpha: true, preserveDrawingBuffer: true });
  const sh = (t, s) => { const x = gl.createShader(t); gl.shaderSource(x, s); gl.compileShader(x); if (!gl.getShaderParameter(x, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(x)); return x; };
  prog = gl.createProgram(); gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(prog);
  const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, "p"); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  return gl;
}
const tex = (unit, src) => { const t = gl.createTexture(); gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); return t; };
const rgb = hex => { const m = String(hex).trim().match(/^#?([0-9a-f]{6})$/i); const n = m ? parseInt(m[1], 16) : 0x808080; return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]; };

/* ---------- the metal: a mirror field and frosted relief, silver for every title and gold for the champions; an unheld medal a blank ---------- */
function finish(tier, off, tok, dark) {
  /* a blank is the housing of a lamp that is off: the panel's own tone (a step up from the board in dark, a step down in light),
     lit by an even room with no key, so its relief shows and nothing shines; never brighter than a struck medal */
  if (off) { const t = tok.panel2.map(x => dark ? Math.min(1, x * 1.06 + .012) : x * .92); return { F0F: t, F0R: t.map(x => Math.min(1, x * 1.05)), shinF: 4, shinR: 4, ao: 1.6, enamel: 0, amb: 0, flat: true }; }
  return tier === "gold"
    ? { F0F: tok.gold, F0R: tok.goldFrost, shinF: 34, shinR: 10, ao: 2.4, enamel: 1, amb: .34 }
    : { F0F: tok.silver, F0R: tok.silverFrost, shinF: 420, shinR: 10, ao: 2.4, enamel: 1, amb: 0 };
}
/* enamel as fired: each type's colour taken a little toward the board's navy */
const deepen = (c, navy) => c.map((x, i) => x * .82 + navy[i] * .18);
const hex = c => "#" + c.map(x => Math.round(x * 255).toString(16).padStart(2, "0")).join("");
const MARKS = { mega: "/brand/mega-evolution.png" };

const cache = new Map(), done = new Map();
let queue = Promise.resolve();
const keyOf = (spec, off, ground) => JSON.stringify([spec, off, ground]);
/* a medal already drawn, at once (a board seen before switches on with every medal in place) */
export function medalDrawn(spec, off = false) { return done.get(keyOf(spec, off, getComputedStyle(document.documentElement).getPropertyValue("--ground").trim())) || ""; }
/* one medal as an image URL. Medals are drawn one after another, a frame apart, so a board of them never holds the page. */
export function medalUrl(spec, off = false) {
  const css = getComputedStyle(document.documentElement), v = name => rgb(css.getPropertyValue(name));
  const tok = { ground: v("--ground"), panel2: v("--panel-2"), navy: v("--navy"), silver: v("--medal-silver"), silverFrost: v("--medal-silver-frost"), gold: v("--medal-gold"), goldFrost: v("--medal-gold-frost"), enamel: v("--medal-enamel") };
  const dark = tok.ground[0] + tok.ground[1] + tok.ground[2] < 1.5;
  const key = keyOf(spec, off, css.getPropertyValue("--ground").trim());
  if (cache.has(key)) return cache.get(key);
  const enamel = spec.champ ? [hex(tok.enamel)] : spec.mark === "mega" ? ["--mega-1", "--mega-3", "--mega-5"].map(n => hex(v(n)))
    : (spec.enamel || []).map(id => hex(deepen(v(`--type-${id}`), tok.navy)));
  const drawn = { ...spec, enamel: off ? [] : enamel, mark: MARKS[spec.mark] };
  const job = queue = queue.then(async () => {
    await document.fonts.ready; await frame();
    const t0 = performance.now(), f = await heightField(drawn), fin = finish(spec.tier, off, tok, dark);
    /* a medal whose heights took long is lit a frame later, so striking and lighting never make one long task */
    if (performance.now() - t0 > 20) await frame();
    const g = context();
    g.viewport(0, 0, S, S); g.clearColor(0, 0, 0, 0); g.clear(g.COLOR_BUFFER_BIT); g.useProgram(prog);
    const ts = [tex(0, f.height), tex(1, f.wide), tex(2, f.enamel)];
    const u = (n, ...x) => g[`uniform${x.length === 1 ? "1f" : "3f"}`](g.getUniformLocation(prog, n), ...x);
    g.uniform1i(g.getUniformLocation(prog, "uH"), 0); g.uniform1i(g.getUniformLocation(prog, "uB"), 1); g.uniform1i(g.getUniformLocation(prog, "uE"), 2);
    u("uS", S); u("uDepth", 11 * K); u("uAO", fin.ao); u("uThr", .63); u("uShinF", fin.shinF); u("uShinR", fin.shinR); u("uEnamel", fin.enamel); u("uAmb", fin.amb);
    u("uF0F", ...fin.F0F); u("uF0R", ...fin.F0R);
    /* the room the metal reflects: the board's own navy in dark, paper in light; a blank sees an even grey room and no key */
    if (fin.flat) { u("uSky", .96, .96, .96); u("uFloor", .9, .9, .9); u("uKey", .1, .1, .1); }
    /* gold in light sees a dimmer room than silver, or white paper washes it to butter */
    else { const lg = spec.tier === "gold" ? .55 : 1; u("uSky", ...(dark ? tok.ground.map(x => x * .55 + .3) : [lg, lg, lg])); u("uFloor", ...(dark ? tok.ground.map(x => x * .9) : tok.panel2.map(x => x * .86 * lg))); u("uKey", 1, .98, .94); }
    g.drawArrays(g.TRIANGLE_STRIP, 0, 4);
    ts.forEach(t => g.deleteTexture(t));
    const blob = await new Promise(res => g.canvas.toBlob(res, "image/png"));
    const url = blob ? URL.createObjectURL(blob) : "";
    done.set(key, url);
    return url;
  }).catch(() => "");
  cache.set(key, job);
  return job;
}
