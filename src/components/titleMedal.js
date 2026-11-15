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
  fire: c => fillEO(c, "M50 6C62 26 82 38 80 62C78 82 64 94 50 94C36 94 21 82 20 62C19 47 29 38 35 27C37 41 43 46 48 46C46 31 44 20 50 6Z M50 56C57 64 62 70 61 78C60 84 55 87 50 87C45 87 40 84 40 78C40 71 46 65 50 56Z"),
  water: c => fillEO(c, "M50 6C58 26 80 44 80 64C80 81 67 94 50 94C33 94 20 81 20 64C20 44 42 26 50 6Z M33 62C33 73 40 81 49 83C42 78 38 71 38 62Z"),
  electric: c => c.fill(P("M60 4L22 54L46 54L36 96L80 40L55 40L68 4Z")),
  grass: c => fillEO(c, "M14 86C14 42 44 12 88 12C88 56 58 86 14 86Z M21 80L77 24L80 27L24 83Z"),
  ice: c => { c.lineCap = "round"; c.lineWidth = 7; for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; c.save(); c.translate(50, 50); c.rotate(a); c.beginPath(); c.moveTo(0, 0); c.lineTo(0, -40); c.moveTo(0, -24); c.lineTo(-11, -34); c.moveTo(0, -24); c.lineTo(11, -34); c.stroke(); c.restore(); } c.fill(P(poly(6, 9))); },
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
  flying: c => c.fill(P("M10 74C26 40 58 18 92 14C82 28 72 33 62 36C74 37 83 40 88 45C74 51 62 52 52 52C62 57 68 62 72 68C54 73 34 76 10 74Z")),
  psychic: c => { c.lineCap = "round"; c.lineWidth = 8; c.beginPath(); for (let t = 0; t <= 3.3 * Math.PI * 2; t += .05) { const r = 4 + t * 2.0, x = 50 + r * Math.cos(t), y = 50 + r * Math.sin(t); t ? c.lineTo(x, y) : c.moveTo(x, y); } c.stroke(); },
  /* 벌레: a beetle from above, its wing cases parted, six legs and two feelers */
  bug: c => {
    fillEO(c, "M50 34C66 34 76 50 76 66C76 84 65 94 50 94C35 94 24 84 24 66C24 50 34 34 50 34Z M48.5 40L51.5 40L51.5 94L48.5 94Z"); c.fill(P(circ(50, 25, 9)));
    c.lineWidth = 5; c.lineCap = "round"; c.beginPath();
    for (const s of [-1, 1]) for (const [x0, y0, x1, y1] of [[27, 50, 8, 40], [24, 66, 6, 66], [27, 82, 8, 94], [45, 18, 38, 6]]) { c.moveTo(50 + s * (x0 - 50), y0); c.lineTo(50 + s * (x1 - 50), y1); }
    c.stroke();
  },
  rock: c => fillEO(c, "M30 16L68 10L90 38L82 82L40 92L10 66L14 34Z M30 16L46 46L44 48L28 18Z M46 46L82 82L80 84L44 48Z M46 46L90 38L90 41L47 49Z"),
  ghost: c => fillEO(c, "M50 8C73 8 84 27 84 48L84 92L73 82L62 92L50 82L38 92L27 82L16 92L16 48C16 27 27 8 50 8Z" + circ(39, 44, 7) + circ(61, 44, 7)),
  /* 드래곤: a dragon's wing, the arm rising to the wrist and the membrane hanging in scallops between its long fingers */
  dragon: c => {
    fillEO(c, "M10 90L34 14L48 16L94 8Q78 26 88 42Q70 44 82 66Q62 62 68 86Q46 72 10 90Z");
    c.save(); c.globalCompositeOperation = "destination-out"; c.lineWidth = 5.5; c.lineCap = "round"; c.beginPath();
    c.moveTo(44, 24); c.lineTo(82, 42); c.moveTo(40, 32); c.lineTo(66, 76); c.stroke(); c.restore();
  },
  dark: c => c.fill(P("M60 8A42 42 0 1 0 92 70A33 33 0 1 1 60 8Z")),
  steel: c => fillEO(c, poly(6, 42, 50, 50, 0) + circ(50, 50, 17)),
  fairy: c => { c.fill(P("M50 4C54 36 64 46 96 50C64 54 54 64 50 96C46 64 36 54 4 50C36 46 46 36 50 4Z")); c.fill(P("M82 10C83 18 86 21 94 22C86 23 83 26 82 34C81 26 78 23 70 22C78 21 81 18 82 10Z")); },
  /* an original double helix for the Mega title */
  mega: c => { c.lineCap = "round"; c.lineWidth = 7; for (const s of [0, Math.PI]) { c.beginPath(); for (let y = 8; y <= 92; y += 1) { const x = 50 + 26 * Math.sin((y - 8) / 84 * Math.PI * 2 + s); y === 8 ? c.moveTo(x, y) : c.lineTo(x, y); } c.stroke(); } c.lineWidth = 4; for (let y = 16; y <= 86; y += 10) { const x = 26 * Math.sin((y - 8) / 84 * Math.PI * 2); c.beginPath(); c.moveTo(50 - x, y); c.lineTo(50 + x, y); c.stroke(); } },
  crown: c => c.fill(P("M12 72L18 28L36 50L50 18L64 50L82 28L88 72Z M14 78L86 78L86 90L14 90Z" + circ(18, 26, 5) + circ(50, 15, 5) + circ(82, 26, 5))),
};
const drawGlyph = (ctx, id, cx, cy, size) => { const g = GLYPHS[id] || GLYPHS.normal; ctx.save(); ctx.translate(cx - size / 2, cy - size / 2); ctx.scale(size / 100, size / 100); ctx.strokeStyle = ctx.fillStyle; g(ctx); ctx.restore(); };

/* ---------- the height field ---------- */
/* drawn in a 512 space at 1.5 times its pixels, so every edge and every line of the turning is finer than a screen pixel */
const BASE = 512, S = 768, K = S / BASE, C = BASE / 2, R = 250;
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
    c.fillStyle = fill.low; c.font = "700 30px Freesentation"; c.textAlign = "center"; c.textBaseline = "middle";
    c.fillText("ㄱ", 28, 52); c.fillText("ㅎ", 72, 52);
    c.fillStyle = fill.high; c.fill(P("M38 8L42 8L42 16L38 16Z M58 8L62 8L62 16L58 16Z M44 12L56 12L56 14L44 14Z"));
  },
  /* 스승: a torch that hands its flame on */
  torch: c => { c.fill(P("M50 4C58 16 66 24 64 36C62 46 56 50 50 50C44 50 38 46 36 36C34 24 42 16 50 4Z M34 52L66 52L62 62L38 62Z M40 64L60 64L54 96L46 96Z")); },
  /* 제자: a sprout, two leaves on a young stem */
  sprout: c => { c.fill(P("M48 96L48 52L52 52L52 96Z M50 54C50 34 36 22 12 22C12 44 26 56 50 54Z M50 48C50 26 66 12 90 12C90 36 74 50 50 48Z M30 96L70 96L66 88L34 88Z")); },
  /* RED: 151, the first generation's number (a cup of those 151 alone), in serif figures over a rule; not a counter */
  n151: c => {
    const one = "M22 14L36 4L42 4L42 88Q43 93 52 94L52 100L14 100L14 94Q23 93 25 88L25 20Q19 23 11 23L11 19Q18 18 22 14Z";
    const five = "M14 4L54 4L52 18L23 18L20 41Q28 36 36 36Q57 38 58 66Q56 97 29 99Q11 99 5 88Q5 80 12 80Q19 81 19 88Q21 93 29 93Q41 91 41 67Q40 46 30 46Q22 46 16 52L10 50Z";
    const k = .5, ws = [54, 62, 54], gap = 4, total = (ws.reduce((x, y) => x + y, 0) + gap * 2) * k;
    let x = 50 - total / 2;
    [one, five, one].forEach((d, i) => { c.save(); c.translate(x, 22); c.scale(k, k); c.fill(P(d)); c.restore(); x += (ws[i] + gap) * k; });
    c.fill(P("M20 82L80 82L80 85L20 85Z")); c.fill(P(star(5, 4.5, 1.9, 13, 83.5) + star(5, 4.5, 1.9, 87, 83.5)));
  },


  /* 초신성: a new star bursting into light, long rays and short (a newcomer who won) */
  nova: c => {
    let d = "";
    for (let i = 0; i < 16; i++) { const a = -Math.PI / 2 + i * Math.PI / 8, long = i % 2 === 0, r1 = long ? (i % 4 === 0 ? 46 : 36) : 26, w = long ? .09 : .07;
      d += `M${50 + 14 * Math.cos(a - w * 2)} ${54 + 14 * Math.sin(a - w * 2)}L${50 + r1 * Math.cos(a)} ${54 + r1 * Math.sin(a)}L${50 + 14 * Math.cos(a + w * 2)} ${54 + 14 * Math.sin(a + w * 2)}Z`; }
    c.fill(P(d)); c.fill(P(circ(50, 54, 15)));
    c.save(); c.globalCompositeOperation = "destination-out"; c.fill(P(circ(50, 54, 9))); c.restore();
    c.fill(P(star(5, 7, 3, 50, 54)));
  },
  /* 슈퍼루키: a shooting star climbing, its trail behind it (a rookie on the rise) */
  rookie: c => {
    c.fill(P(star(5, 20, 8.5, 70, 30, -Math.PI / 2 + .3)));
    c.fill(P("M58 42L8 92L4 88L54 38Z M62 50L26 90L22 88L58 46Z M48 36L14 70L12 66L44 32Z"));
  },
  /* 버스 드라이버: the front of a bus, windscreen and lamps (one driver who carries the whole team) */
  bus: c => {
    c.fill(P("M18 14Q18 6 26 6L74 6Q82 6 82 14L82 82L18 82Z M22 82L34 82L34 94L22 94Z M66 82L78 82L78 94L66 94Z"));
    c.save(); c.globalCompositeOperation = "destination-out";
    c.fill(P("M28 22L72 22L72 46L28 46Z" + circ(31, 64, 4.6) + circ(69, 64, 4.6) + "M42 62L58 62L58 65L42 65Z M42 70L58 70L58 73L42 73Z"));
    c.restore();
  },
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
      if (kind === "baoppu") { c.lineWidth = 2; c.lineCap = "round"; c.beginPath(); c.moveTo(-4, -4); c.bezierCurveTo(-3, -10, 5, -11, 5.5, -5.5); c.bezierCurveTo(5.5, -2.5, 1.5, -2.5, 1.5, -5); c.stroke(); }
      /* the face: a pale mask over the muzzle rising in two rounds round the eyes */
      const mask = new Path2D(); mask.ellipse(0, 8, 8.4, 5.6, 0, 0, Math.PI * 2); mask.arc(-3.7, 2.8, 4.3, 0, Math.PI * 2); mask.arc(3.7, 2.8, 4.3, 0, Math.PI * 2);
      c.fill(mask);
      c.save(); c.globalCompositeOperation = "destination-out";
      if (kind === "atchappu") { c.lineWidth = 1.7; c.lineCap = "round"; c.beginPath(); for (const x of [-3.6, 3.6]) { c.moveTo(x - 2.2, 3.4); c.quadraticCurveTo(x, .4, x + 2.2, 3.4); } c.stroke(); }
      else for (const x of [-3.6, 3.6]) c.fill(oval(x, 2.6, 2.2, 3));
      c.lineWidth = 1.5; c.lineCap = "round"; c.beginPath(); c.moveTo(-2.6, 9.2); c.quadraticCurveTo(0, 11.2, 2.6, 9.2); c.stroke();
      c.restore();
    };
    for (const [kind, x, y] of [["yanappu", 50, 18], ["baoppu", 15, 77], ["atchappu", 85, 77]]) { c.save(); c.translate(x, y); c.scale(1.45, 1.45); monkey(kind); c.restore(); }
  },
  /* 파트너: a paw print, the one sign of a companion */
  paw: c => { c.fill(P("M50 50C64 50 76 62 76 76C76 88 66 92 58 90C54 89 52 87 50 87C48 87 46 89 42 90C34 92 24 88 24 76C24 62 36 50 50 50Z")); for (const [x, y, rx, ry, a] of [[20, 44, 9, 12, -.4], [36, 24, 9, 13, -.15], [64, 24, 9, 13, .15], [80, 44, 9, 12, .4]]) { c.beginPath(); c.ellipse(x, y, rx, ry, a, 0, Math.PI * 2); c.fill(); } },
};
/* ---------- a partner's footprint after its kind: a bird's three toes and spur, a webbed foot; any other a paw ---------- */
const FEET = {
  bird: c => { c.lineWidth = 11; c.lineCap = "round"; c.beginPath(); for (const [x, y] of [[50, 10], [20, 26], [80, 26], [50, 94]]) { c.moveTo(50, 62); c.lineTo(x, y); } c.stroke(); c.fill(P(circ(50, 62, 11))); },
  webbed: c => { c.fill(P("M50 96Q42 70 10 30Q20 26 30 32Q40 22 50 4Q60 22 70 32Q80 26 90 30Q58 70 50 96Z")); c.save(); c.globalCompositeOperation = "destination-out"; c.lineWidth = 4; c.lineCap = "round"; c.beginPath(); c.moveTo(48, 78); c.lineTo(26, 40); c.moveTo(50, 76); c.lineTo(50, 24); c.moveTo(52, 78); c.lineTo(74, 40); c.stroke(); c.restore(); },
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
  칼로스: c => { c.fill(P("M47 4L53 4L54 18L46 18Z M44 18L56 18L60 40L40 40Z M36 42L64 42L64 46L36 46Z M38 46L62 46L76 92L60 92Q50 70 40 92L24 92Z")); },
  알로라: c => { for (let i = 0; i < 5; i++) { c.save(); c.translate(50, 52); c.rotate(i * Math.PI * 2 / 5); c.beginPath(); c.ellipse(0, -24, 15, 22, 0, 0, Math.PI * 2); c.fill(); c.restore(); } c.save(); c.globalCompositeOperation = "destination-out"; c.fill(P(circ(50, 52, 10))); c.restore(); c.fill(P(circ(50, 52, 5))); c.lineWidth = 3; c.beginPath(); c.moveTo(50, 52); c.lineTo(58, 26); c.stroke(); },
  가라르: c => { c.fill(P("M40 20L50 0L60 20Z M34 20L66 20L66 50L34 50Z M37 52L63 52L63 90L37 90Z M28 90L72 90L72 98L28 98Z")); c.save(); c.globalCompositeOperation = "destination-out"; c.fill(P(circ(50, 35, 11))); c.fill(P("M43 58h4v26h-4Z M53 58h4v26h-4Z")); c.restore(); c.fill(P(circ(50, 35, 3.2) + "M48.5 35L51.5 35L51.5 26L48.5 26Z M49 33.5L58 36L57 39L48 36.5Z")); },
  히스이: c => { c.fill(P("M66 8A20 20 0 1 0 84 36A16 16 0 1 1 66 8Z")); c.fill(P("M10 34L90 34L86 42L14 42Z M18 46L82 46L82 52L18 52Z M24 42L32 42L32 94L24 94Z M68 42L76 42L76 94L68 94Z M46 46L54 46L54 52L46 52Z")); },
  팔데아: c => { fillEO(c, "M38 96L43 46L57 46L62 96Z M46 96L46 84Q50 78 54 84L54 96Z"); c.fill(P("M38 46Q50 32 62 46Z")); for (let i = 0; i < 4; i++) { c.save(); c.translate(50, 40); c.rotate(Math.PI / 4 + i * Math.PI / 2); c.fill(P("M-6 -44L6 -44L6 -8L-6 -8Z")); c.restore(); } c.fill(P(circ(50, 40, 6))); },
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
      box(GLYPHS.crown, 48 * DK * 1.3, -58 * DK);
      ctx.fillStyle = ink; drawRoman(ctx, spec.champ.gen, C, cy + 20 * DK, 92 * DK * .9, 1.36 * ER);
      return;
    }
    if (spec.mark) { drawMark(ctx, mark, C, cy, 140 * DK, ink); return; }
    if (spec.scene) { box(SCENES[spec.scene], 136 * DK * 1.12, 2 * DK); return; }
    /* a partner: its kind's footprint (a bird's, a webbed foot, or a paw) and its Pokémon's national number under it, so no two partners share a medal */
    if (spec.device === "paw" && spec.n) {
      box(c => { c.save(); c.translate(26, -2); c.scale(.48, .48); (FEET[spec.foot] || DEVICES.paw)(c); c.restore(); c.font = `800 34px ${lat}`; c.textAlign = "center"; c.textBaseline = "alphabetic"; c.fillText(String(spec.n), 50, 90); }, 130 * DK, 2 * DK);
      return;
    }
    if (spec.device) { box(DEVICES[spec.device], 130 * DK, 2 * DK); return; }
    const ids = spec.glyphs || [], m = ids.length;
    const places = m === 1 ? [[0, 0, 132]] : m === 2 ? [[-44, 0, 78], [44, 0, 78]] : [[0, -40, 66], [-46, 34, 66], [46, 34, 66]];
    ctx.fillStyle = ink; ids.forEach((id, i) => { const [x, y, s] = places[i]; drawGlyph(ctx, id, C + x * DK, cy + y * DK, s * DK); });
  };
  /* the device is struck on a layer of its own: what is cut out of it (a bus's windows, a ring's middle) lies on the enamel, never through the medal */
  const relief = layer(); device(relief, grey(246)); lay(h, relief.canvas);
  const cut = layer(); device(cut, "#000"); lay(e, cut.canvas, "destination-out");
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
    vec3 ec = e.rgb / max(e.a, .001) * (.62 + .38 * diff) * ao;
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
const frame = () => new Promise(res => requestAnimationFrame(() => res()));
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
    const f = await heightField(drawn), fin = finish(spec.tier, off, tok, dark);
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
