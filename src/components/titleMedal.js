/* ============================== 칭호의 연감 인장 (DESIGN.md "Titles and hall of fame", 2026-11-26) ==============================
   Every title is a flat Almanac Seal: a crisp outer hairline ring, ground breathing room, a solid inner disc in the title's
   colour, and a razor-sharp flat device with zero shading, blur, shadow or gradient.
   The spec comes from titleLooks.js: { glyphs | device | scene | mark | champ | partner, enamel: [type id], tier }.
   A type's symbol is the games' own (public/brand/type-symbols.webp); a partner and 몽키매직's three are silhouettes of their
   own pictures; the Mega emblem is the owner's image in its own colours; everything else is drawn here for the site. */

const BASE_URL = import.meta.env?.BASE_URL ?? "/";
const P = d => new Path2D(d);
const star = (n, ro, ri, cx = 50, cy = 50, rot = -Math.PI / 2) => {
  let d = "";
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 ? ri : ro, a = rot + i * Math.PI / n;
    d += (i ? "L" : "M") + (cx + r * Math.cos(a)).toFixed(2) + " " + (cy + r * Math.sin(a)).toFixed(2);
  }
  return d + "Z";
};
const circ = (cx, cy, r) => `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0Z`;
const fillEO = (ctx, d) => ctx.fill(P(d), "evenodd");
const cut = (c, draw) => { c.save(); c.globalCompositeOperation = "destination-out"; draw(); c.restore(); };
const parts = (c, ...ds) => { for (const d of ds) c.fill(P(d)); };

/* ---------- geometry in a 100 space (outer ring 47.5, solid disc 40.5) ---------- */
const BIG = 768, SMALL = 384, C = 50, OUTER = 47.5, DISC = 40.5, FIT = .68, REACH = .88;

let S = BIG, K = S / 100;
const layer = (size = S) => {
  const c = Object.assign(document.createElement("canvas"), { width: size, height: size }).getContext("2d");
  c.scale(size / 100, size / 100);
  return c;
};
const lay = (ctx, src) => {
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(src, 0, 0);
  ctx.restore();
};
const frame = () => new Promise(res => requestAnimationFrame(() => res()));

const images = new Map();
const loadImage = src => {
  if (!images.has(src)) {
    images.set(src, new Promise(res => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = () => res(null);
      i.src = src;
    }));
  }
  return images.get(src);
};

/* ---------- a type's symbol: the games' own, cut from one sheet (6 by 3 cells of 384) ---------- */
const TYPES = ["normal", "fire", "water", "electric", "grass", "ice", "fighting", "poison", "ground", "flying", "psychic", "bug", "rock", "ghost", "dragon", "dark", "steel", "fairy"];
const SYMBOLS = `${BASE_URL}brand/type-symbols.webp`, CELL = 384;
const drawType = (ctx, sheet, id, cx, cy, r) => {
  const i = Math.max(0, TYPES.indexOf(id)), h = r * .94;
  if (sheet) {
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(sheet, i % 6 * CELL, (i / 6 | 0) * CELL, CELL, CELL, cx - h, cy - h, h * 2, h * 2);
  }
};
/* two and three cells inside the 40.5 disc, clear of the 2.6 cut lines */
const PAIR = [[C - 19.8, C, 17.5], [C + 19.8, C, 17.5]];
const TRIO = [-90, 150, 30].map(a => [
  C + 21.0 * Math.cos(a * Math.PI / 180),
  C + 21.0 * Math.sin(a * Math.PI / 180),
  16.0,
]);

/* ---------- a Pokémon's picture as a crisp silhouette: its ink is measured once ---------- */
const inks = new Map();
const pictureInk = url => {
  if (!inks.has(url)) {
    inks.set(url, loadImage(url).then(img => {
      if (!img) return null;
      const N = 128, c = Object.assign(document.createElement("canvas"), { width: N, height: N }).getContext("2d", { willReadFrequently: true });
      c.drawImage(img, 0, 0, N, N);
      const d = c.getImageData(0, 0, N, N).data, on = (x, y) => d[(y * N + x) * 4 + 3] > 24;
      let x0 = N, y0 = N, x1 = -1, y1 = -1;
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (on(x, y)) {
        if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      }
      if (x1 < 0) return null;
      const mx = (x0 + x1 + 1) / 2, my = (y0 + y1 + 1) / 2; let far = 0;
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (on(x, y)) far = Math.max(far, Math.hypot(x + .5 - mx, y + .5 - my));
      return { img, mx: mx / N, my: my / N, far: (far + 1) / N };
    }));
  }
  return inks.get(url);
};
function drawSilhouette(ctx, ink, cx, cy, r, fill) {
  if (!ink) return;
  const size = r / ink.far, t = layer();
  t.imageSmoothingQuality = "high";
  t.drawImage(ink.img, cx - ink.mx * size, cy - ink.my * size, size, size);
  t.globalCompositeOperation = "source-in";
  t.fillStyle = fill;
  t.fillRect(0, 0, 100, 100);
  lay(ctx, t.canvas);
}
const MONKEYS = ["pansage", "pansear", "panpour"].map(slug => `${BASE_URL}sprites/pokemon/${slug}.webp`);

/* ---------- devices drawn for single titles (original, razor-sharp in a 100 box) ---------- */
const DEVICES = {
  /* 끝말잇기: an open book of Hangul — two curved pages cleanly parted at the spine, with ㄱ and ㅎ cut in */
  hangul: c => {
    parts(c,
      "M47.6 28.5C37 20.5 21 18 6 22L6 80C21 76 37 78.5 47.6 86.5Z",
      "M52.4 28.5C63 20.5 79 18 94 22L94 80C79 76 63 78.5 52.4 86.5Z"
    );
    cut(c, () => {
      c.font = "700 35px Freesentation"; c.textAlign = "center"; c.textBaseline = "middle";
      c.fillText("ㄱ", 26.8, 52); c.fillText("ㅎ", 73.2, 52);
    });
  },
  /* 스승: a torch handing its flame on, clean continuous flame curve */
  torch: c => {
    c.fill(P("M52 4C57 17 72 27 70 42C68 53 59 58 50 58C41 58 32 53 30 42C29 34 33 27 38 22C38 29 41 33 46 33C44 23 46 13 52 4Z"));
    parts(c, "M26 62L74 62L68 72L32 72Z", "M36 75L64 75L57 96L43 96Z");
  },
  /* 제자: 대지에서 유려하게 한 몸으로 뻗어 오르는 새싹 — 매끄러운 흙 호, 이음새 없는 곡선 줄기, 비대칭 두 잎과 가늘어지는 잎맥 */
  sprout: c => {
    // Graceful crescent earth mound at base
    c.fill(P("M16 91Q50 77 84 91Q50 85 16 91Z"));
    // Organic stem flaring seamlessly from the earth and tucking cleanly into the leaf junction (zero exposed ends)
    c.fill(P("M37 88C45 84 46 72 47 51L53 51C53 72 55 84 63 88Z"));
    // Left gracefully arching leaf flowing seamlessly out of the stem
    c.fill(P("M50 53C46 35 31 23 11 26C15 47 31 58 50 53Z"));
    // Right higher unfurling leaf overlapping cleanly at the V junction
    c.fill(P("M48 51C51 27 67 13 89 15C85 39 69 52 48 51Z"));
    // Fluid tapered central leaf veins curving along each blade
    cut(c, () => {
      parts(c,
        "M43 47C35 39 27 34 18 32C26 37 33 43 40 50C42 50.5 44 48.5 43 47Z",
        "M55 44C64 34 73 27 82 22C74 30 66 38 58 46.5C56 47 54 45.5 55 44Z"
      );
    });
  },
  /* RED: bold 151 in Albert Sans */
  n151: c => {
    c.font = "700 44px 'Albert Sans'"; c.textAlign = "center"; c.textBaseline = "middle";
    c.fillText("151", 50, 52);
  },
  /* 초신성: crisp eight-rayed nova with a five-point star cut at its heart */
  nova: c => fillEO(c, star(8, 48, 29) + star(5, 15, 6.2)),
  /* 슈퍼루키: 유려하게 비상하는 별똥별 — 날렵한 5각 별과 곡선으로 가늘어지는 세 갈래 혜성 꼬리 */
  rookie: c => {
    c.fill(P(star(5, 23, 9.5, 71, 29, -Math.PI / 2 + .32)));
    // Three sweeping tapered comet trails (fluid Bézier arcs, zero flat butt-cap ends)
    parts(c,
      "M8 92C22 68 38 52 57 42C45 58 29 77 8 92Z",
      "M11 66C22 51 33 41 47 34C38 45 27 56 11 66Z",
      "M34 89C45 77 56 66 66 53C57 69 47 80 34 89Z"
    );
    // Crisp 4-point accent glint beside the rising arc
    c.fill(P(star(4, 7.2, 2.2, 28, 28, 0)));
  },
  /* 버스 드라이버: a crisp steering wheel */
  bus: c => {
    fillEO(c, circ(50, 50, 47) + circ(50, 50, 34));
    parts(c, "M15 44.5L85 44.5L85 55.5L15 55.5Z", "M44.5 50L55.5 50L55.5 85L44.5 85Z", circ(50, 50, 12.5));
  },
  /* 청출어람: a sprout bearing the torch's larger flame (pupil past the teacher) */
  indigo: c => {
    c.fill(P("M52 4C57 17 72 27 70 42C68 52 59 57 50 57C41 57 32 52 30 42C29 34 33 27 38 22C38 29 41 33 46 33C44 23 46 13 52 4Z"));
    parts(c,
      "M46.5 96L46.5 54L53.5 54L53.5 96Z",
      "M49 84C49 70 39 62 21 62C21 78 32 85 49 84Z",
      "M51 80C51 66 61 58 79 58C79 74 68 81 51 80Z"
    );
  },
  /* 탑의 정상: 도전의 탑의 모놀리스 실루엣 — 기단과 정문, 층별 기준선과 세로 창문 열, 정상을 밝히는 별빛 첨탑 */
  tower: c => {
    // Summit beacon star crowning the tower spire
    c.fill(P(star(4, 11.5, 3.2, 50, 12, 0)));
    // Stepped monument base + soaring tapered monolith body with subtle architectural setbacks
    parts(c,
      "M12 91L88 91L88 97L12 97Z",
      "M19 85L81 85L81 91L19 91Z",
      // Main monolith shaft (3 architectural setbacks rising to the summit)
      "M25 60L75 60L75 85L25 85Z",
      "M31 38L69 38L69 57L31 57Z",
      "M37 22L63 22L63 35L37 35Z",
      // Sharp summit crown pediment
      "M42 22L50 15L58 22Z"
    );
    // Clean architectural cutouts: grand gatekeeper portal + signature vertical tower windows
    cut(c, () => {
      // Grand central portal at base
      c.fillRect(44.5, 70, 11, 15);
      // Lower tier flanking tall slit windows
      c.fillRect(32, 65, 5.5, 14);
      c.fillRect(62.5, 65, 5.5, 14);
      // Mid tier 3 vertical slit windows
      for (const x of [37.5, 47.25, 57]) c.fillRect(x, 42, 5.5, 11);
      // Upper summit chamber twin slit windows
      c.fillRect(42.5, 25.5, 5, 7);
      c.fillRect(52.5, 25.5, 5, 7);
    });
  },
  /* 파트너 fallback: crisp paw print */
  paw: c => {
    c.fill(P("M50 50C64 50 76 62 76 76C76 88 66 92 58 90C54 89 52 87 50 87C48 87 46 89 42 90C34 92 24 88 24 76C24 62 36 50 50 50Z"));
    for (const [x, y, rx, ry, a] of [[20, 44, 9, 12, -.38], [36, 24, 9, 13, -.14], [64, 24, 9, 13, .14], [80, 44, 9, 12, .38]]) {
      c.beginPath(); c.ellipse(x, y, rx, ry, a, 0, Math.PI * 2); c.fill();
    }
  },
};

/* 전화기: 전자공학(chip), 화학공학(flask), 기계공학(gear), each centred in its own cell */
const ENGINEERING = [
  c => {
    let d = "M-11.5 -11.5L11.5 -11.5L11.5 11.5L-11.5 11.5Z M-5 -5L-5 5L5 5L5 -5Z";
    for (const o of [-7, 0, 7]) {
      d += `M${o - 2} -17.5h4v6h-4Z M${o - 2} 11.5h4v6h-4Z M-17.5 ${o - 2}h6v4h-6Z M11.5 ${o - 2}h6v4h-6Z`;
    }
    fillEO(c, d);
  },
  c => fillEO(c, "M-7 -17L7 -17L7 -13.5L5 -13.5L5 -5L15 11.5Q17 15.5 12 15.5L-12 15.5Q-17 15.5 -15 11.5L-5 -5L-5 -13.5L-7 -13.5Z M-8.5 2.5L8.5 2.5L10 5.5L-10 5.5Z"),
  c => {
    let d = "";
    for (let i = 0; i < 32; i++) {
      const a = (i - .5) * Math.PI / 16, r = i % 4 < 2 ? 17 : 12.2;
      d += (i ? "L" : "M") + (r * Math.cos(a)).toFixed(2) + " " + (r * Math.sin(a)).toFixed(2);
    }
    fillEO(c, d + "Z" + circ(0, 0, 5.5));
  },
];

/* ---------- 10 region landmarks: redrawn from scratch for League Almanac (2026-11-26) ---------- */
const SCENES = {
  /* 관동: 달맞이산 — 거대한 초승달과 별빛을 등진 매끄러운 달맞이산 봉우리와 동굴 아치 */
  관동: c => {
    // Bold crescent moon rising high on the upper left
    c.fill(P(circ(26, 25, 19)));
    cut(c, () => c.fill(P(circ(34, 19, 16))));
    // Crisp 4-point star (달의돌 빛)
    c.fill(P(star(4, 9, 2.8, 76, 24, 0)));
    // Clean, stately Mt. Moon silhouette: main peak + right shoulder, separated by a crisp diagonal ridge cut
    c.fill(P("M6 92L45 38Q48 34 51 38L90 92Z"));
    c.fill(P("M56 92L74 58Q76 54 78 58L96 92Z"));
    cut(c, () => {
      // Clean snowline cap cut
      c.fill(P("M45 38Q48 34 51 38L58 48L52 45L48 50L44 45L38 48Z"));
      // Clean diagonal valley line separating the right shoulder
      c.lineWidth = 3.2; c.lineCap = "round"; c.beginPath();
      c.moveTo(57, 56); c.lineTo(72, 82); c.stroke();
      // Crisp arched cavern entrance at the foot of the main peak
      c.fill(P("M39 92L39 77C39 69 57 69 57 77L57 92Z"));
    });
  },

  /* 성도: 방울탑 (Bell Tower) — 교토 오층탑 양식의 유려하게 치솟은 4단 처마와 상륜, 정문 아치 */
  성도: c => {
    // Tall finial spire (상륜) with rings
    parts(c, "M48 4L52 4L52 20L48 20Z", "M44 10L56 10L56 12.5L44 12.5Z", "M45.5 15L54.5 15L54.5 17.5L45.5 17.5Z");
    // 4 tapering pagoda tiers with sweeping upturned eaves (처마)
    const tiers = [
      [20, 29, 20, 13],  // top roof: yTop, yBot, halfRoof, halfWall
      [35, 44, 27, 17],
      [51, 61, 35, 22],
      [68, 79, 44, 28],
    ];
    for (const [yt, yb, hr, hw] of tiers) {
      // Sweeping upturned roof curve
      c.fill(P(`M${50 - hw * 0.85} ${yt}L${50 + hw * 0.85} ${yt}Q${50 + hr * 0.72} ${yb - 1} ${50 + hr} ${yb - 4}L${50 + hr - 2.5} ${yb}L${50 - hr + 2.5} ${yb}L${50 - hr} ${yb - 4}Q${50 - hr * 0.72} ${yb - 1} ${50 - hw * 0.85} ${yt}Z`));
      // Wall storey under roof
      if (yb < 75) c.fillRect(50 - hw, yb, hw * 2, 7.5);
    }
    // Stone base hall & foundation
    c.fillRect(22, 79, 56, 13);
    c.fillRect(14, 92, 72, 5);
    // Clean central sanctuary gateway cutout
    cut(c, () => c.fill(P("M43 92L43 83C43 79.5 57 79.5 57 83L57 92Z")));
  },

  /* 호연: 루비·사파이어·에메랄드의 세공 보석 문장 (Hoenn Faceted Gem Crest) — 정교한 패싯 컷과 광채 별빛 */
  호연: c => {
    // Classic brilliant-cut gemstone silhouette (crown + pavilion)
    c.fill(P("M27 20L73 20L91 41L50 88L9 41Z"));
    // Crisp negative-space geometric facet cuts (table, crown facets, pavilion ribs)
    cut(c, () => {
      c.lineWidth = 3.2; c.lineCap = "round"; c.lineJoin = "round";
      c.beginPath();
      // Horizontal girdle line
      c.moveTo(9, 41); c.lineTo(91, 41);
      // Inner crown table facets
      c.moveTo(27, 20); c.lineTo(35, 41); c.lineTo(50, 88);
      c.moveTo(73, 20); c.lineTo(65, 41); c.lineTo(50, 88);
      c.moveTo(50, 20); c.lineTo(35, 41);
      c.moveTo(50, 20); c.lineTo(65, 41);
      c.stroke();
    });
    // Crisp glint star above-right of the gem crown
    c.fill(P(star(4, 9.5, 2.6, 82, 19, 0)));
  },

  /* 신오: 창기둥 (Spear Pillar) — 주두와 기단을 갖춘 고대 신전 기둥, 부러진 외곽 기둥, 중앙 시공의 별빛 */
  신오: c => {
    // Two-tier stepped ancient temple dais
    parts(c, "M4 92L96 92L96 98L4 98Z", "M11 84L89 84L89 90L11 90Z");
    // Broken entablature / lintel crowning the two central pillars
    c.fill(P("M26 14L72 14L75 20L69 24L26 24Z"));
    // Two tall central pillars with capitals & bases
    for (const x of [31, 59]) {
      parts(c,
        `M${x - 2} 24L${x + 12} 24L${x + 10} 29L${x} 29Z`,     // capital
        `M${x + 1} 29L${x + 9} 29L${x + 9} 79L${x + 1} 79Z`,    // shaft
        `M${x - 2} 79L${x + 12} 79L${x + 12} 84L${x - 2} 84Z`   // base
      );
    }
    // Two jaggedly snapped outer columns
    parts(c,
      "M14 84L14 44L18 39L21 44L24 40L24 84Z",
      "M12 79L26 79L26 84L12 84Z",
      "M76 84L76 56L80 51L83 56L86 52L86 84Z",
      "M74 79L88 79L88 84L74 84Z"
    );
    // Sacred 4-point cosmic star suspended between the central pillars
    c.fill(P(star(4, 10.5, 2.8, 50, 50, 0)));
  },

  /* 하나: 블랙·화이트 진실과 이상의 태극 문장 (Unova Yin-Yang Crest) — 라이트스톤·다크스톤의 조화와 유려한 음양 나선 */
  하나: c => {
    c.save();
    c.translate(50, 50);
    c.rotate(-Math.PI / 6);
    // Crisp uniform outer ring (r=39..45)
    fillEO(c, circ(0, 0, 45) + circ(0, 0, 39));
    // Solid Yang half (화이트 / 진실) seamlessly tangent to inner ring
    c.fill(P("M0 -39A39 39 0 0 0 0 39A19.5 19.5 0 0 0 0 0A19.5 19.5 0 0 1 0 -39Z"));
    // Dark Stone eye cut cleanly into the solid lower Yang lobe
    cut(c, () => c.fill(P(circ(0, 19.5, 7.2))));
    // Light Stone eye glowing solid in the hollow upper Yin lobe
    c.fill(P(circ(0, -19.5, 7.2)));
    c.restore();
  },

  /* 칼로스: 프리즘 타워 (Prism Tower) — 에펠탑 비율의 유려한 곡선 다리, 아치, 2단 전망대, 피뢰침 첨탑 */
  칼로스: c => {
    // Needle lightning-rod spire
    c.fill(P("M48.2 3L51.8 3L53 20L47 20Z"));
    // Main sweeping hyperbolic tower body
    c.fill(P("M46 19L54 19C56 44 66 72 88 96L67 96C62 84 57 77 50 77C43 77 38 84 33 96L12 96C34 72 44 44 46 19Z"));
    // Upper & lower observation decks
    parts(c, "M37 31L63 31L63 37L37 37Z", "M26 57L74 57L74 64L26 64Z");
    // Crisp negative-space lattice cutouts inside the tower
    cut(c, () => {
      // Upper diamond window
      c.fill(P("M50 39L55.5 47L50 55L44.5 47Z"));
      // Lower arch window between deck and base legs
      c.fill(P("M43 74L43 69C43 66 57 66 57 69L57 74Z"));
    });
  },

  /* 알로라: 썬·문 천체 문장 (Sol & Luna Crest) — 거대한 초승달이 감싸 안는 유려한 8광채 태양 */
  알로라: c => {
    // 1. Grand Crescent Moon drawn first (so its hollow cut never erases the Sun!)
    c.fill(P(circ(44, 52, 34)));
    cut(c, () => c.fill(P(circ(57, 43, 28))));
    // 2. Sculpted 8-rayed Alolan Sun shining cleanly inside the crescent's embrace
    c.save(); c.translate(61, 44);
    c.fill(P(circ(0, 0, 12.5)));
    for (let i = 0; i < 8; i++) {
      c.save(); c.rotate(i * Math.PI / 4);
      const len = i % 2 === 0 ? 25.5 : 19.5;
      const w = i % 2 === 0 ? 4.8 : 3.5;
      c.fill(P(`M${-w} -10.5Q0 ${-len * .72} 0 ${-len}Q${w * .55} ${-len * .62} ${w} -10.5Z`));
      c.restore();
    }
    c.restore();
    // 3. Crisp inner sun core circle cutout for editorial precision
    cut(c, () => c.fill(P(circ(61, 44, 5.6))));
  },

  /* 가라르: 소드·실드 기사 문장 (Heavy Shield & Greatsword) — 이중 테두리 중장 방패 위로 대각선으로 교차하는 묵직한 장검 */
  가라르: c => {
    // 1. Heavy Heraldic Heater Shield with crisp angled shoulders & armored inner rim
    const shieldOuter = "M20 22Q50 18 80 22L80 51C80 71 67 83 50 92C33 83 20 71 20 51Z";
    const shieldInner = "M28 29Q50 26 72 29L72 50C72 65 62 75 50 82C38 75 28 65 28 50Z";
    const shieldCore  = "M33 34Q50 32 67 34L67 49C67 61 59 69 50 75C41 69 33 61 33 49Z";
    c.fill(P(shieldOuter));
    cut(c, () => c.fill(P(shieldInner)));
    c.fill(P(shieldCore));

    // 2. Heavy Broadsword slashing diagonally across the shield (upper-right hilt to lower-left tip)
    // First cut a clean separation halo around the sword so both Sword & Shield read unmistakably as heavy steel
    const drawSword = (ctx, pad = 0) => {
      ctx.save(); ctx.translate(50, 52); ctx.rotate(Math.PI / 4);
      // Pommel
      ctx.fill(P(circ(0, -45, 5.5 + pad)));
      // Heavy grip
      ctx.fillRect(-3.4 - pad, -42 - pad, (3.4 + pad) * 2, 16 + pad * 2);
      // Wide, heavy knight's crossguard
      ctx.fill(P(`M${-18 - pad} ${-28 - pad}L${18 + pad} ${-28 - pad}L${15 + pad} ${-21 + pad}L${-15 - pad} ${-21 + pad}Z`));
      // Broad tapered double-edged blade
      ctx.fill(P(`M${-6.8 - pad} ${-22 - pad}L${6.8 + pad} ${-22 - pad}L${5.6 + pad} ${32 + pad}L0 ${45 + pad * 1.4}L${-5.6 - pad} ${32 + pad}Z`));
      ctx.restore();
    };
    cut(c, () => drawSword(c, 3.6));
    drawSword(c, 0);
    // Crisp central fuller groove down the steel blade
    cut(c, () => {
      c.save(); c.translate(50, 52); c.rotate(Math.PI / 4);
      c.fillRect(-1.3, -17, 2.6, 44);
      c.restore();
    });
  },

  /* 히스이: 히스이 고대 도리이 (Hisui Shrine Torii Gate) — 치솟은 가사기 보, 가쿠즈카, 쌍기둥과 중앙의 신화 십자별 */
  히스이: c => {
    // Sweeping upturned upper lintel (가사기 / Kasagi)
    c.fill(P("M6 16Q50 26 94 16L90 27Q50 35 10 27Z"));
    // Secondary tie beam (누키 / Nuki) extending past pillars
    c.fillRect(14, 38, 72, 7.5);
    // Central nameplate strut (가쿠즈카 / Gakuzuka) between kasagi and nuki
    c.fillRect(45.5, 29, 9, 10);
    // Twin slightly battered traditional shrine pillars + stone bases (네마키)
    parts(c,
      "M25 28L34 28L31.5 88L22 88Z",
      "M66 28L75 28L78 88L68.5 88Z",
      "M18 88L35 88L35 94L18 94Z",
      "M65 88L82 88L82 94L65 94Z"
    );
    // Sacred 4-point celestial cross-star (천계의 빛) framed inside the Torii gate
    c.fill(P(star(4, 14, 3.6, 50, 67, 0)));
  },

  /* 팔데아: 테이블시티 아카데미 (Gaudí / Mesagoza Crest) — 유려한 포물선 3연 첨탑, 장미창과 카탈루냐 아치, 부채꼴 대계단 */
  팔데아: c => {
    // Organic Gaudí-style parabolic 3-spire cathedral silhouette (zero rectangular boxes or flat triangles)
    c.fill(P(
      "M14 73" +
      "C14 52 17 34 25 22C31 32 34 42 36 48" +
      "C38 30 43 13 50 4C57 13 62 30 64 48" +
      "C66 42 69 32 75 22C83 34 86 52 86 73Z"
    ));
    // Sculpted curving grand fan staircase sweeping down below the academy
    c.fill(P("M14 77Q50 72 86 77L94 94Q50 88 6 94Z"));
    cut(c, () => {
      // Iconic circular academy rose window with 4-point compass core
      c.fill(P(circ(50, 34, 7.2)));
      // Soaring Catalan parabolic grand entrance arch
      c.fill(P("M42 73C42 57 45 50 50 48C55 50 58 57 58 73Z"));
      // Twin slender curved lancet arches in the side turrets
      c.fill(P("M22 65C22 55 23.5 51 26 49C28.5 51 30 55 30 65Z"));
      c.fill(P("M70 65C70 55 71.5 51 74 49C76.5 51 78 55 78 65Z"));
      // Curved perspective fan stair grooves
      c.lineWidth = 2.6; c.beginPath();
      c.moveTo(11, 83); c.quadraticCurveTo(50, 78, 89, 83);
      c.moveTo(8, 89); c.quadraticCurveTo(50, 84, 92, 89);
      c.stroke();
    });
    // Crisp 4-point emblem star inside the rose window
    c.fill(P(star(4, 5.2, 1.6, 50, 34, 0)));
  },
};

/* ---------- champion: sharp geometric crown over Albert Sans Roman numeral ---------- */
const sharpCrown = c => {
  c.fill(P("M24 44L20 21L36 33L50 15L64 33L80 21L76 44Z"));
  c.fillRect(24, 49, 52, 5.2);
};
function roman(n) {
  const t = [[10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"]];
  let s = ""; for (const [v, r] of t) while (n >= v) { s += r; n -= v; } return s;
}
function drawChampionRoman(c, n, cx, cy, maxWidth) {
  const text = roman(n);
  c.save();
  c.font = "700 26px 'Albert Sans'";
  c.textAlign = "center";
  c.textBaseline = "middle";
  const w = c.measureText(text).width;
  const k = Math.min(1, maxWidth / Math.max(w, 1));
  c.translate(cx, cy);
  c.scale(k, k);
  c.fillText(text, 0, 0);
  c.restore();
}

const fits = new Map();
const MARKS = { mega: `${BASE_URL}brand/mega-evolution.png` };

function readTheme() {
  const css = getComputedStyle(document.documentElement);
  const g = name => css.getPropertyValue(name).trim();
  const isLight = document.documentElement.dataset.theme === "light";
  const hc = document.documentElement.dataset.contrast === "more";
  return {
    isLight, hc,
    ground: g("--ground") || (isLight ? "#FFFFFF" : "#081C3D"),
    lit: g("--lit") || (isLight ? "#081C3D" : "#FFFFFF"),
    dim: g("--dim") || (isLight ? "#46536C" : "#A8B8D3"),
    mute: g("--mute") || (isLight ? "#56637A" : "#8196B9"),
    rule: g("--rule") || (isLight ? "#CED5E0" : "#1D365F"),
    tint: g("--tint") || (isLight ? "#E8ECF2" : "#0E2449"),
    gold: g("--gold") || (isLight ? "#7A5C12" : "#D9B45A"),
    act: g("--act") || g("--lit") || (isLight ? "#081C3D" : "#FFFFFF"),
    navy: g("--navy") || "#081C3D",
    onLight: g("--on-type-light") || "#FFFFFF",
    type: id => g(`--type-${id}`) || "#9FA19F",
  };
}

function inkForSpec(spec, th, off) {
  if (off) return th.hc ? th.mute : (th.isLight ? "#AEB8C8" : "#27416E");
  if (spec.champ) return th.hc ? th.act : (th.isLight ? "#E6C770" : th.gold);
  return th.onLight;
}

function fillCells(ctx, cols, shapePath, cutColor, innerGap = 0) {
  ctx.save();
  ctx.clip(shapePath);
  const n = cols.length, rad = a => a * Math.PI / 180;
  const cells = n === 2 ? [[90, 270], [-90, 90]] : n === 3 ? [[-150, -30], [90, 210], [-30, 90]] : [[0, 360]];
  cols.forEach((col, i) => {
    const [a0, a1] = cells[i];
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.moveTo(C, C); ctx.arc(C, C, 60, rad(a0), rad(a1)); ctx.closePath(); ctx.fill();
  });
  if (n > 1) {
    ctx.strokeStyle = cutColor; ctx.lineWidth = 2.6; ctx.lineCap = "butt";
    ctx.beginPath();
    for (const a of n === 2 ? [90, 270] : [-30, 90, 210]) {
      ctx.moveTo(C + innerGap * Math.cos(rad(a)), C + innerGap * Math.sin(rad(a)));
      ctx.lineTo(C + 55 * Math.cos(rad(a)), C + 55 * Math.sin(rad(a)));
    }
    ctx.stroke();
  }
  ctx.restore();
}

async function drawSeal(spec, off, th) {
  const c = layer();

  if (off) {
    // Quiet empty slot on the page's ground
    c.strokeStyle = th.rule; c.lineWidth = 1.6;
    c.beginPath(); c.arc(C, C, OUTER, 0, Math.PI * 2); c.stroke();

    c.strokeStyle = th.rule; c.lineWidth = 1.0; c.setLineDash([2.5, 3.0]);
    c.beginPath(); c.arc(C, C, DISC, 0, Math.PI * 2); c.stroke();
    c.setLineDash([]);
  } else {
    // Crisp outer ring
    c.strokeStyle = spec.champ ? (th.hc ? th.act : th.gold) : th.lit;
    c.lineWidth = spec.champ ? 2.2 : 1.6;
    c.beginPath(); c.arc(C, C, OUTER, 0, Math.PI * 2); c.stroke();

    // Solid inner disc
    const discPath = P(circ(C, C, DISC));
    if (spec.champ) {
      c.fillStyle = th.hc ? (th.isLight ? "#000000" : "#000000") : th.navy;
      c.fill(discPath);
      c.strokeStyle = th.hc ? th.act : (th.isLight ? "#E6C770" : th.gold);
      c.lineWidth = 1.1;
      c.beginPath(); c.arc(C, C, DISC - 3.6, 0, Math.PI * 2); c.stroke();
    } else if (spec.mark) {
      c.fillStyle = th.isLight ? th.tint : (th.hc ? "#1A1A1A" : "#0E2449");
      c.fill(discPath);
      c.strokeStyle = th.rule; c.lineWidth = 1.1;
      c.stroke(discPath);
    } else {
      const cols = (spec.enamel || ["normal"]).map(th.type);
      fillCells(c, cols, discPath, th.ground, spec.device === "nova" ? 14 : 0);
    }
  }

  // Load any external assets needed for the device
  const ids = spec.glyphs || [];
  if (spec.champ || spec.device === "n151" || spec.device === "hangul") {
    await Promise.all([
      document.fonts.load("700 26px 'Albert Sans'", "IVX"),
      document.fonts.load("700 44px 'Albert Sans'", "151"),
      document.fonts.load("700 35px Freesentation", "ㄱㅎ"),
    ]).catch(() => {});
  }
  const sheet = ids.length ? await loadImage(SYMBOLS) : null;
  const pictures = spec.device === "monkey" ? await Promise.all(MONKEYS.map(pictureInk)) : spec.partner ? [await pictureInk(spec.partner)] : [];
  const mark = spec.mark ? await loadImage(MARKS[spec.mark]) : null;

  const dev = layer();
  const baseInk = inkForSpec(spec, th, off);
  const enamelIds = spec.enamel || [];

  if (spec.partner && pictures[0]) {
    drawSilhouette(dev, pictures[0], C, C, DISC * .82, baseInk);
  } else if (mark) {
    const iw = mark.naturalWidth, ih = mark.naturalHeight, k = (DISC * 1.34) / Math.max(iw, ih), t = layer();
    t.imageSmoothingQuality = "high";
    t.drawImage(mark, C - iw * k / 2, C - ih * k / 2, iw * k, ih * k);
    if (off) { t.globalCompositeOperation = "source-in"; t.fillStyle = baseInk; t.fillRect(0, 0, 100, 100); }
    lay(dev, t.canvas);
  } else if (spec.device === "monkey") {
    TRIO.forEach(([x, y, r], i) => drawSilhouette(dev, pictures[i], x, y, r, baseInk));
  } else if (spec.device === "engineering") {
    TRIO.forEach(([x, y, r], i) => {
      dev.save(); dev.fillStyle = dev.strokeStyle = baseInk;
      dev.translate(x, y); dev.scale(r * .86 / 18, r * .86 / 18);
      ENGINEERING[i](dev);
      dev.restore();
    });
  } else if (ids.length > 1) {
    const places = ids.length === 2 ? PAIR : TRIO;
    ids.forEach((id, i) => {
      const t = layer();
      drawType(t, sheet, id, ...places[i]);
      t.setTransform(1, 0, 0, 1, 0, 0); t.globalCompositeOperation = "source-in";
      t.fillStyle = baseInk; t.fillRect(0, 0, S, S);
      lay(dev, t.canvas);
    });
  } else {
    const drawOne = ctx => {
      ctx.fillStyle = ctx.strokeStyle = baseInk;
      if (spec.champ) {
        ctx.save(); ctx.translate(C, C); ctx.scale(.72, .72); ctx.translate(-50, -49);
        sharpCrown(ctx);
        drawChampionRoman(ctx, spec.champ.gen, 50, 74, 52);
        ctx.restore();
        return;
      }
      if (spec.scene) { SCENES[spec.scene]?.(ctx); return; }
      if (spec.device || spec.partner) { (DEVICES[spec.device] || DEVICES.paw)(ctx); return; }
      if (ids.length === 1) drawType(ctx, sheet, ids[0], C, C, DISC * .88);
    };

    const lone = (spec.scene || spec.device || spec.partner) && !["monkey", "engineering"].includes(spec.device);
    const fitKey = JSON.stringify([spec.device, spec.scene]);
    let tf = null;
    if (lone && fits.has(fitKey)) tf = fits.get(fitKey);
    else if (lone) {
      const N = BIG / 4, probe = Object.assign(document.createElement("canvas"), { width: N, height: N }).getContext("2d", { willReadFrequently: true });
      probe.scale(N / 100, N / 100); drawOne(probe);
      const d = probe.getImageData(0, 0, N, N).data; let x0 = N, y0 = N, x1 = 0, y1 = 0;
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (d[(y * N + x) * 4 + 3] > 40) {
        if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      }
      const u = 100 / N, w = (x1 - x0 + 1) * u, t = (y1 - y0 + 1) * u;
      if (x1 >= x0) tf = { s: Math.min(FIT * 2 * DISC / Math.max(w, t), REACH * 2 * DISC / Math.hypot(w, t)), x: (x0 + x1 + 1) / 2 * u, y: (y0 + y1 + 1) / 2 * u };
      fits.set(fitKey, tf);
    }
    if (tf) { dev.translate(C, C); dev.scale(tf.s, tf.s); dev.translate(-tf.x, -tf.y); }
    drawOne(dev);
    dev.setTransform(1, 0, 0, 1, 0, 0);
    dev.globalCompositeOperation = "source-in";
    dev.fillStyle = baseInk;
    dev.fillRect(0, 0, S, S);
  }

  lay(c, dev.canvas);
  return c.canvas;
}

const cache = new Map(), done = new Map();
const line = [], soon = new Set();
let busy = false;
async function pump() { if (busy) return; busy = true; while (line.length) await line.shift().run(); busy = false; }

const themeSig = () => {
  if (typeof document === "undefined") return "";
  const el = document.documentElement;
  return `${getComputedStyle(el).getPropertyValue("--ground").trim()}:${el.dataset.theme || ""}:${el.dataset.contrast || ""}`;
};
const keyOf = (spec, off, sig, big) => JSON.stringify([spec, off, sig, big ? BIG : SMALL]);

const BUILD = typeof window !== "undefined" && typeof caches !== "undefined" && window.__YPL_BUILD__ ? "ypl-medals:" + window.__YPL_BUILD__ : "";
const shelf = BUILD ? caches.open(BUILD).catch(() => null) : null;
if (BUILD) caches.keys().then(names => names.forEach(name => name.startsWith("ypl-medals:") && name !== BUILD && caches.delete(name)), () => {});
const kept = key => "/medal/" + encodeURIComponent(key);

export function medalDrawn(spec, off = false, big = false) {
  return done.get(keyOf(spec, off, themeSig(), big)) || "";
}

export function medalUrl(spec, off = false, big = false, ahead = false) {
  const sig = themeSig();
  const key = keyOf(spec, off, sig, big);
  if (!ahead) { soon.add(key); const i = line.findIndex(w => w.key === key); if (i > 0) line.unshift(...line.splice(i, 1)); }
  if (cache.has(key)) return cache.get(key);

  const th = readTheme();
  const draw = async store => {
    await document.fonts.ready; await frame();
    S = big ? BIG : SMALL; K = S / 100;
    const canvas = await drawSeal(spec, off, th);
    const blob = await new Promise(res => canvas.toBlob(res, "image/png"));
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
