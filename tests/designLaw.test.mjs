// The YPL League Almanac design law (DESIGN.md) as a test. Every CSS declaration in src/styles and every inline style={{}} in src is checked
// against the rules below. A deliberate exception is listed in EXCEPT under its reason; an exception that no longer occurs fails too, so
// the list only shrinks.
//
// The build has landed: every file is held to the strict rules, only scoreboard tokens and only lengths on the series.
import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname.replace(/^\/(\w:)/, "$1");
const STYLES = join(ROOT, "src/styles");
const read = f => readFileSync(f, "utf8");
const src = p => read(join(ROOT, p)).replace(/\r\n/g, "\n");
const walk = dir => readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]);
const rel = f => relative(ROOT, f).replaceAll("\\", "/");
const PHI = (1 + Math.sqrt(5)) / 2;

// ---------- the scales (DESIGN.md "The golden law") ----------
const TOKENS = src("src/styles/tokens.css");
const BRIDGE_BLOCK = /\/\* ---------- bridge:[\s\S]*?\n:root \{([\s\S]*?)\n\}/.exec(TOKENS)?.[1] || "";
const BRIDGE = new Set([...BRIDGE_BLOCK.matchAll(/(--[\w-]+):/g)].map(m => m[1]));
const SPACE = new Set([0, ...[...TOKENS.matchAll(/--(?:s\d+|seam):\s*(\d+)px/g)].map(m => +m[1])]);
const WEIGHTS = new Set(["400", "600", "700"]);
// a length is a step of space, a line, an icon (16, 20, 24), a height (32, 44, 52, 64, 84), a bar (40, 56), a segment cell or a width of the layout
const LENGTHS = new Set([...SPACE, 1, 2, 3, 16, 20, 24, 32, 36, 40, 44, 52, 56, 64, 84, 120, 132, 204, 216, 240, 439, 576, 709, 1200]);

// every file is built to the scoreboard: the strict rules (only its own tokens, lengths on the series) hold everywhere

// ---------- declarations ----------
const BLOCKS = [];
function cssDecls(file) {
  const text = read(file).replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, " "));
  const out = [], stack = []; let buf = "";
  const flush = () => {
    const t = buf.trim(), i = t.indexOf(":");
    if (i > 0 && stack.length) out.push({ file: rel(file), sel: stack.at(-1).sel, blk: stack.at(-1).blk, prop: t.slice(0, i).trim(), value: t.slice(i + 1).trim() });
    buf = "";
  };
  for (const ch of text) {
    if (ch === "{") { stack.push({ sel: buf.trim().replace(/\s+/g, " "), blk: BLOCKS.push({}) - 1 }); buf = ""; }
    else if (ch === "}") { flush(); stack.pop(); }
    else if (ch === ";") flush();
    else buf += ch;
  }
  return out;
}
// React adds px to bare numbers on length properties
const unit = (prop, v) => /margin|padding|gap|size|radius|width|height/.test(prop) ? v.replace(/(^|[?:\s])(-?\d*\.?\d+)(?=$|[?:\s])/g, "$1$2px") : v;
const kebab = k => k.replace(/[A-Z]/g, c => "-" + c.toLowerCase());
function inlineDecls(file) {
  const out = [];
  for (const [, body] of read(file).matchAll(/style=\{\{([^{}]*)\}\}/g))
    for (const [, k, v] of body.matchAll(/(\w+)\s*:\s*((?:"[^"]*"|'[^']*'|[^,"'])+)/g))
      out.push({ file: rel(file), sel: "style", prop: kebab(k), value: unit(kebab(k), v.trim().replace(/^["']|["']$/g, "")) });
  return out;
}
const SRC = walk(join(ROOT, "src")).filter(f => /\.(jsx?|mjs)$/.test(f) && !rel(f).startsWith("src/data/") && !rel(f).startsWith("src/pages/battle/"));
// The battle screen is a game (DESIGN.md "Battle"): its stage, effects and HUD keep the site's colours and taste but not every strict number of this law;
// since 2026-11-18 a 도전의 탑 run's play (tower-play.css: the draft, the doors, the break, the trades) is part of that game.
// Popups over it and every screen outside it are held to every rule here.
const STAGE = ["battle-stage.css", "battle.css", "tower-play.css"];
const CSS = readdirSync(STYLES).filter(f => f.endsWith(".css") && !STAGE.includes(f));
const DECLS = [...CSS.flatMap(f => cssDecls(join(STYLES, f))), ...SRC.flatMap(inlineDecls)];
for (const d of DECLS) if (d.blk !== undefined) BLOCKS[d.blk][d.prop] = d.value;
const keyOf = d => `${d.file} | ${d.sel} | ${d.prop}: ${d.value}`;
const decl = (sel, prop) => DECLS.filter(d => d.sel === sel && d.prop === prop).map(d => d.value);

// ---------- helpers ----------
const noVars = v => v.replace(/var\([^()]*(\([^()]*\))?[^()]*\)/g, "");
const pxs = v => [...noVars(v).matchAll(/(-?\d*\.?\d+)px/g)].map(m => Math.abs(+m[1]));
const fontFace = d => d.sel.startsWith("@font-face");
const strict = () => true;
// the comma-separated layers of a value, commas inside var() and calc() kept
const layers = v => { const out = [""]; let depth = 0; for (const ch of v) { depth += ch === "(" ? 1 : ch === ")" ? -1 : 0; if (ch === "," && !depth) out.push(""); else out[out.length - 1] += ch; } return out.map(p => p.trim()); };
const COLOR = /#[0-9a-f]{3,8}\b|\b(rgba?|hsla?|hwb|lab|lch|oklab|oklch)\(|\b(white|black|red|green|blue|gray|grey)\b/i;
const SIZE_TOKENS = /^(inherit|var\(--t(12|15|20|32)\))$/;
// a figure (Fig.jsx, DESIGN.md "Figures") is sized by its digits' height over .72; the page's name stands at 52 or 84 (.page-title)
const S = "var\\(--(s(1|2|3|5|8|13|21)|seam)\\)";
const FIG_SIZE = new RegExp(`^calc\\(\\(?(${S}|var\\(--fig-h\\))( [-+*] (${S}|\\d+))*\\)? \\/ \\.72\\)$`);
const FIG_LINE = new RegExp(`^(${S}|var\\(--fig-h\\)|calc\\((${S}|\\d*\\.?\\d+)( [+*] (${S}|\\d*\\.?\\d+))*\\)|\\.\\d+)$`);
const SIZE_BRIDGE = /^var\(--(fs-\w+|title|display|hero|fig-[sml])\)$/;
const LINE_TOKENS = /^(1|inherit|var\(--l(12|15|20|32|-read)\))$/;
const LINE_BRIDGE = /^(1\.236em|var\(--lh-\w+\))$/;

// ---------- the law: each rule names its DESIGN.md section ----------
const RULES = {
  "colour: literals live only in tokens.css (Colour and light)": d => d.file !== "src/styles/tokens.css" && !/mask/.test(d.prop) && COLOR.test(d.value),
  "colour: components read semantic tokens, never primitives (Colour and light)": d => d.file !== "src/styles/tokens.css" && /var\(--(navy(-[123])?|white|mist|haze|amber(-deep)?|paper-[123]|slate(-2)?)\)/.test(d.value),
  "colour: solid only, no gradient (Colour and light)": d => /gradient\(/.test(d.value),
  "space: margin, padding and gap sit on the golden scale (Space)": d => /^(margin|padding|gap|row-gap|column-gap)(-|$)/.test(d.prop) && pxs(d.value).some(n => !SPACE.has(n)),
  "type: a size is one of the four tokens, a figure's, or the page's name (Type, Figures)": d => d.prop === "font-size" && !SIZE_TOKENS.test(d.value) && !FIG_SIZE.test(d.value) && !(/page-title|-pod/.test(d.sel) && /^var\(--s(13|21)\)$/.test(d.value)),
  "type: a line is on the 4 grid, from its token or its figure (Type, Figures)": d => d.prop === "line-height" && !LINE_TOKENS.test(d.value) && !FIG_LINE.test(d.value),
  "type: weights 400 600 700, and a figure's 200 and 300 (Type, Figures)": d => d.prop === "font-weight" && !fontFace(d) && !WEIGHTS.has(d.value) && !(/^(200|300)$/.test(d.value) && /fig|rank|\.num|count|when|board/.test(d.sel)) && !/^(inherit|var\()/.test(d.value),
  "type: tracking is a token (Type)": d => d.prop === "letter-spacing" && !/^(0|inherit|var\(--ls(20|32|-fig|-[a-z0-9]+)\))$/.test(d.value),
  "type: one font stack, Albert Sans first for a figure (Type, Figures)": d => d.prop === "font-family" && !fontFace(d) && !/^(inherit|var\(--font(-fig)?\))$/.test(d.value),
  "type: no uppercase label (Voice and tone)": d => d.prop === "text-transform" && d.value === "uppercase",
  "type: a line runs to its column; nothing carries a narrower measure (Type)": d => /^max-(width|inline-size)$/.test(d.prop) && (/\d(ch|r?em)\b/.test(d.value) || /var\(--read\)/.test(d.value)),
  "entries: nothing is round (Entries and rules)": d => /radius/.test(d.prop) && !d.prop.startsWith("--") && !/^0(px)?$/.test(d.value),
  "entries: no shadow; a box-shadow only draws an inset hairline, rule or ring (Entries and rules)": d => d.prop === "box-shadow" && !/^(none|var\(--shadow-[12]\))$/.test(d.value) && layers(d.value).some(p => !/^inset\s/.test(p)),
  // 2026-11-24, the owner: "외곽선이 있는 네모칸이 전부 너무너무 어색해": no control, key, menu or square is ringed, at rest, under a pointer,
  // in focus or chosen. A ring is a keyboard's :focus-visible on a key or a link, and nothing else (a 100px inset is autofill's fill, not a ring)
  "entries: no outlined square; a ring is only a keyboard's focus on a key (Entries and rules, Controls)": d => d.prop === "box-shadow" && !/:focus-visible/.test(d.sel)
    && layers(d.value).some(p => /^inset\s+0(px)?\s+0(px)?\s+0(px)?\s+(?!100px)\S/.test(p)),
  "entries: an outline is only a keyboard's focus ring (Controls)": d => /^outline(-style|-width)?$/.test(d.prop) && !/^(none|0(px)?)$/.test(d.value) && !/:focus-visible/.test(d.sel),
  "entries: no border; a line is an inset hairline or rule (Entries and rules)": d => strict(d) && /^border(-(top|right|bottom|left))?$/.test(d.prop) && !/^(0|none)$/.test(d.value),
  "light: nothing blurs what is behind it (Don't)": d => /backdrop-filter$/.test(d.prop),
  "light: nothing blurs or glows (Don't)": d => /^(-webkit-)?filter$/.test(d.prop) && /blur\(|drop-shadow\(/.test(d.value),
  "eye: every length stands on the series (The golden law)": d => strict(d) && /^((min-|max-)?(width|height)|top|right|bottom|left|inset|flex-basis)$/.test(d.prop) && !d.sel.startsWith("@") && pxs(d.value).some(n => !LENGTHS.has(n)),
  "eye: an underline stands 4px under its word (Controls)": d => d.prop === "text-underline-offset" && d.value !== "4px",
  "motion: a press scales to .976 and nothing grows (Motion)": d => (d.prop === "scale" || d.prop === "transform") && [...d.value.matchAll(/scale[XY]?\((\d*\.?\d+)\)/g), ...(d.prop === "scale" ? [[0, d.value]] : [])].some(m => /^\d*\.?\d+$/.test(m[1]) && ![".976", "1"].includes(m[1])) && !/^(from|to|[\d.]+%)/.test(d.sel) && !/^(\.bk-|\.tb-|\.calc-|\.rc-|\.hm-|\.case|\.hof|\.sc-)/.test(d.sel),
  "motion: a shadow, filter, clip, mask or background never moves (Motion)": d => /^transition(-property)?$/.test(d.prop) && /box-shadow|\bfilter\b|clip|mask|background-(position|image|size)/.test(d.value),
  "motion: a transition or an animation reads a --move token (Motion)": d => /^(transition|animation)(-duration|-timing-function)?$/.test(d.prop)
    && (/cubic-bezier|\blinear\(|steps\(|\bease(-in|-out|-in-out)?\b|\d(ms|s)\b/.test(noVars(d.value)) || /var\(--(ease|spring)/.test(d.value)),
  "motion: a duration is a token (Motion)": d => /^(transition|animation)/.test(d.prop) && /(?<![\w.-])\d*\.?\d+m?s\b/.test(noVars(d.value)),
  "opacity: 0, 1, a token, or a faint mark (Colour and light)": d => d.prop === "opacity" && !/^(0|1|var\(--opacity-[a-z]+\)|var\(--off\))$/.test(d.value),
  "depth: a z-index is a named step": d => d.prop === "z-index" && !/^(auto|calc\(var\(--z-sticky\) \+ 1\)|var\(--z-[a-z]+\))$/.test(d.value),
  "set: a Korean word never breaks inside itself; a spaceless run breaks by overflow-wrap (Typesetting)": d => d.prop === "word-break" && !/^(keep-all|normal|inherit)$/.test(d.value),
  "set: upright only, nothing slants (Typesetting)": d => d.prop === "font-style" && !/^(normal|inherit)$/.test(d.value),
  "set: ragged at the end, never justified or hyphenated (Typesetting)": d => (/^text-align(-last)?$/.test(d.prop) && /justify/.test(d.value)) || (/^(-webkit-)?hyphens$/.test(d.prop) && !/^(none|manual)$/.test(d.value)),
  "set: a paragraph is never centred (Typesetting)": d => /^text-align$/.test(d.prop) && /center/.test(d.value) && d.sel.split(",").some(s => /(^|[\s>])(p|\.prose|\.read|\.nw-body|\.bd-body)\b/.test(s.trim())),
  "set: nothing is faked or turned off in the faces (Typesetting)": d => (d.prop === "font-synthesis" && d.value !== "none") || (d.prop === "font-variant-numeric" && !/^(tabular-nums|inherit)$/.test(d.value)) || (d.prop === "font-kerning" && d.value === "none"),
  "text: wrap is pretty for paragraphs, balanced for headlines (Type)": d => d.prop === "text-wrap" && !((/pretty/.test(d.value) && d.sel === "p") || (/balance/.test(d.value) && /^(h1, h2, h3, h4|\.display|\.title|\.hof-plate)$/.test(d.sel))),
  "bridge: a rebuilt file reads no YPL Navy name": d => strict(d) && [...d.value.matchAll(/var\((--[\w-]+)/g)].some(m => BRIDGE.has(m[1])),
};

// ---------- deliberate exceptions, by rule and reason ----------
const C = "src/styles/components.css", P = "src/styles/pages.css", T = "src/styles/tokens.css";
const B = "src/styles/bracket.css", R = "src/styles/records.css";
const EXCEPT = {
  "depth: a z-index is a named step": {
    "a stack orders itself: toasts by their place": ["src/components/common/Toaster.jsx | style | z-index: 10 - index"],
  },
  "opacity: 0, 1, a token, or a faint mark (Colour and light)": {
  },
  "colour: literals live only in tokens.css (Colour and light)": {
    "a video letterbox is black in both themes": ["src/styles/posts.css | .bd-yt | background: #000"],
    "a QR code is navy on white in both themes: a phone camera reads dark squares on a light ground, and the light theme's inverted panel is the reverse":
      ["src/styles/brackets.css | .bk-qr | background: var(--white)"],
  },
  "colour: components read semantic tokens, never primitives (Colour and light)": {
    "a QR code is navy on white in both themes (see the colour rule above)":
      ["src/styles/brackets.css | .bk-qr | background: var(--white)", "src/styles/brackets.css | .bk-qr path | fill: var(--navy)"],
  },
  "space: margin, padding and gap sit on the golden scale (Space)": {
    "a hairline: the screen-reader clip": [`${T} | .sr-only | margin: -1px`],
    "the bar ends on the page's edge by the icon's ink: half of 44 less 24": ["src/styles/shell.css | .iconbtn:last-child | margin-right: calc((var(--h-control) - 24px) / -2)"],
  },
};

test("a second action stands on its own line, never floating (Controls)", () => {
  assert.deepEqual(decl(".btn.btn--second", "box-shadow"), ["inset 0 -1px 0 var(--rule)"]);
});
test("a door keeps room inside its own lit face, never a band past it (Entries and rules)", () => {
  assert.ok(/--band: var\(--s3\)/.test(TOKENS) && /--band: var\(--s5\)/.test(TOKENS), "--band is 12 on a phone and 20 from 860");
  assert.ok(DECLS.some(d => /\.row/.test(d.sel) && /\.opt-row/.test(d.sel) && d.prop === "padding-inline" && d.value === "var(--band)"), "row-like doors keep --band inside");
  assert.deepEqual(DECLS.filter(d => d.prop === "inset" && /var\(--band\) \* -1/.test(d.value)).map(keyOf), [], "the lit face never grows past the door");
});
test("a field, a check and a select never ring, by click or by key (Controls)", () => {
  assert.deepEqual(decl(":is(input, textarea, select):focus-visible", "outline"), ["none"]);
});
for (const [rule, broken] of Object.entries(RULES)) {
  test(rule, () => {
    const allowed = new Set(Object.values(EXCEPT[rule] || {}).flat());
    const hits = new Set(DECLS.filter(broken).map(keyOf));
    const fresh = [...hits].filter(k => !allowed.has(k));
    const stale = [...allowed].filter(k => !hits.has(k));
    assert.deepEqual(fresh, [], `breaks the design law; fix it, or add it to EXCEPT with its reason:\n  ${fresh.join("\n  ")}`);
    assert.deepEqual(stale, [], `listed in EXCEPT but no longer occurs; remove it:\n  ${stale.join("\n  ")}`);
  });
}

// ---------- a line breaks where its column ends or its sentence ends, never by hand (Type) ----------
test("no hand-placed line break in the site's own copy (Type)", () => {
  const hits = SRC.filter(f => /\.jsx$/.test(f) && !rel(f).startsWith("src/admin/"))
    .flatMap(f => [...read(f).matchAll(/<br\s*\/?>/g)].map(() => rel(f)));
  assert.deepEqual(hits, [], "let the line run to its column, or end the sentence");
});

// ---------- the numbers, written once in DESIGN.md and once in tokens.css ----------
const DESIGN = src("DESIGN.md");
const hex = (theme, name) => {
  const prim = n => new RegExp(`--${n}:\\s*(#[0-9A-F]{6})`, "i").exec(TOKENS)?.[1];
  const block = theme === "dark" ? /:root \{\n  color-scheme: dark;([\s\S]*?)\n\}/.exec(TOKENS)[1] : /:root\[data-theme="light"\] \{([\s\S]*?)\n\}/.exec(TOKENS)[1];
  const v = new RegExp(`--${name}:\\s*([^;]+);`).exec(block)?.[1].trim();
  return /^var\(--([\w-]+)\)$/.test(v) ? prim(/^var\(--([\w-]+)\)$/.exec(v)[1]).toUpperCase() : v;
};
test("the colour table in DESIGN.md is tokens.css (Colour and light)", () => {
  const rows = [...DESIGN.matchAll(/^\| `--([\w-]+)` \| [^|]+ \| `?([#.\w]+)`? \| `?([#.\w]+)`? \|$/gm)];
  assert.ok(rows.length >= 9, "the table is still found");
  for (const [, name, dark, light] of rows) {
    assert.equal(hex("dark", name), dark.toUpperCase().replace(/^\.$/, ""), `--${name} dark`);
    assert.equal(hex("light", name), light.toUpperCase(), `--${name} light`);
  }
});
test("every word is AA on every surface, the lamp 3 or more, in both themes (Accessibility)", () => {
  const lum = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255).map(c => c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4).reduce((s, c, i) => s + c * [.2126, .7152, .0722][i], 0);
  const cr = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + .05) / (y + .05); };
  for (const theme of ["dark", "light"])
    for (const bg of ["ground", "panel", "panel-2"]) {
      for (const fg of ["lit", "dim", "mute"]) assert.ok(cr(hex(theme, fg), hex(theme, bg)) >= 4.5, `${theme} ${fg} on ${bg}`);
      assert.ok(cr(hex(theme, "signal"), hex(theme, bg)) >= 3, `${theme} lamp on ${bg}`);
    }
});
test("space and time step by the golden ratio (The golden law)", () => {
  const steps = pattern => [...TOKENS.matchAll(pattern)].map(m => +m[1]);
  const space = steps(/--s\d+:\s*(\d+)px/g), time = steps(/--t-[a-z]+:\s*(\d+)ms/g);
  assert.deepEqual(space, [4, 8, 12, 20, 32, 52, 84]);
  assert.deepEqual(time, [100, 160, 260, 420]);
  for (const scale of [space.slice(2), time]) scale.slice(1).forEach((v, i) => assert.ok(Math.abs(v / scale[i] - PHI) < .08, `${scale[i]} to ${v}`));
  assert.match(TOKENS, /--seam: 2px;/);
});
test("four type sizes, each line on the 4 grid (Type)", () => {
  const rem = n => +new RegExp(`--t${n}:\\s*([\\d.]+)rem`).exec(TOKENS)[1] * 16;
  assert.deepEqual([12, 15, 20, 32].map(rem), [12, 15, 20, 32]);
  const line = n => +new RegExp(`--l${n}:\\s*(\\d+)px`).exec(TOKENS)[1];
  for (const [n, l] of [[12, 16], [15, 20], [20, 28], [32, 40], ["-read", 24]]) { assert.equal(line(n), l); assert.equal(l % 4, 0); }
});
test("the heights: a strip, the touch floor, a row, a two-line row, a counter (The golden law)", () => {
  assert.match(TOKENS, /--h-strip: 32px; --h-control: 44px; --h-row: 52px; --h-row2: 64px; --h-counter: 84px;/);
  assert.match(TOKENS, /--nav-height: 56px; --tab-height: 64px; --admin-height: 40px;/);
});

// ---------- figures (the almanac, 2026-11-24: the seven-segment display is gone) ----------
test("a figure is Albert Sans, the larger the thinner, a leading zero dropped (Figures)", () => {
  const fig = src("src/components/common/Fig.jsx");
  assert.match(fig, /h >= 84 \? 200 : h >= 40 \? 300 : 400/, "200 from 84, 300 from 40, 400 under");
  assert.match(fig, /replace\(\/\^\(-\?\)0\+\(\?=\\d\)\/, "\$1"\)/, "a leading zero is dropped");
  assert.match(fig, /includes\(":"\)/, "except in a clock");
  assert.match(TOKENS, /\.fig \{[^}]*font-size: calc\(var\(--fig-h\) \/ \.72\);[^}]*font-family: var\(--font-fig\);/, "its size is its digits' height over .72, in Albert Sans");
  assert.ok(!existsSync(join(ROOT, "src/components/common/Seg.jsx")) && !existsSync(join(ROOT, "src/components/common/seg.js")), "no segment display is left");
  assert.deepEqual(SRC.filter(f => /<Seg\b/.test(read(f))).map(rel), []);
});
test("a figure is never under 32 (Figures)", () => {
  // a Counter draws its value as a Fig, so its h is held too, a ternary's every branch included
  const hs = tag => [...tag.matchAll(/\bh=\{([^}]*)\}/g)].flatMap(m => m[1].match(/\b\d+\b(?![.\]])/g) || []);
  const hits = SRC.flatMap(f => [...read(f).matchAll(/<(?:Fig|Counter)\b[^>]*?>/g)].flatMap(m => hs(m[0])).filter(h => +h < 32).map(h => `${rel(f)}: ${h}`));
  assert.deepEqual(hits, []);
});

// ---------- lamps, bars ----------
test("a lamp is an 8px square that never blinks or moves (Lamps)", () => {
  assert.match(TOKENS, /--lamp: 8px;/);
  const lamp = DECLS.filter(d => /(^|[\s,])\.(lamp|live-dot|ypl-ping)\b/.test(d.sel));
  assert.ok(lamp.length > 0);
  assert.deepEqual(lamp.filter(d => /^(animation|transition|border-radius)/.test(d.prop)).map(keyOf), []);
});
test("the bars stand still: nothing moves the top bar or the tab bar (Bars and navigation)", () => {
  const bars = DECLS.filter(d => /^\.(topbar|tabbar)\b/.test(d.sel));
  assert.ok(bars.length > 0);
  assert.deepEqual(bars.filter(d => /^(transition|animation|translate|transform)$/.test(d.prop)).map(keyOf), []);
  assert.doesNotMatch(src("src/components/layout/Navigation.jsx"), /pill|animate/, "the chosen tab's line switches on in place");
});
test("dark is the first visit; a chosen theme is stored and set before the first paint (Colour and light)", () => {
  assert.match(src("index.html"), /localStorage\.getItem\("ypl-theme"\)[\s\S]*?t==="light"/);
  // anything but a stored "light" or "system" opens dark; "system" follows the device, before the first paint too (고대비 is its own toggle)
  assert.match(src("src/App.jsx"), /t==="light"\|\|t==="system"\?t:"dark"/);
  assert.match(src("index.html"), /t==="system"\)t=matchMedia\("\(prefers-color-scheme: light\)"\)/);
});

// ---------- voice ----------
test("a sentence ends with a period wherever it stands: headline, empty state, error or toast (Voice and tone)", () => {
  const close = /(니다|세요|에요|예요|해요|돼요|네요)\s*$/;
  const hits = SRC.flatMap(f => read(f).split("\n").flatMap((l, i) => /^\s*(\/\/|\/?\*)/.test(l) ? []
    : [...l.matchAll(/"([^"\n]*[가-힣][^"\n]*)"|`([^`\n]*[가-힣][^`\n]*)`|>([^<>{}\n]*[가-힣][^<>{}\n]*)</g)]
      .map(m => m[1] ?? m[2] ?? m[3]).filter(t => close.test(t)).map(t => `${rel(f)}:${i + 1}: ${t}`)));
  assert.deepEqual(hits, [], "end it with a period");
});
test("Korean copy has no middle dot separators (Voice and tone)", () => {
  const hits = SRC.flatMap(f => read(f).split("\n").map((l, i) => ({ l, at: `${rel(f)}:${i + 1}` })))
    .filter(({ l }) => l.includes("·") && !/^\s*(\/\/|\/?\*)/.test(l) && !/\/[^/\n]*·[^/\n]*\/[gimsuy]*/.test(l)); // a regex that strips dots is fine
  assert.deepEqual(hits.map(h => h.at), []);
});

// ---------- made by people ----------
// The site's own words, the strings in its source, never what people write in it (Made by people).
const COPY = SRC.flatMap(f => read(f).split("\n").map((l, i) => ({ l, at: `${rel(f)}:${i + 1}` })))
  .filter(({ l }) => !/^\s*(\/\/|\/?\*)/.test(l)).map(({ l, at }) => ({ at, t: l.replace(/\/\/.*$|\/\*.*?\*\//g, "") }));
test("no emoji in the site's own words (Made by people)", () => {
  assert.deepEqual(COPY.filter(({ t }) => /\p{Extended_Pictographic}/u.test(t.replace(/[©®™↗→←↑↓✓×]/g, ""))).map(h => h.at), []);
});
test("no sales words a machine reaches for (Made by people)", () => {
  const words = /혁신적|특별한 경험|새로운 차원|완벽한|손쉽게|간편하게|한눈에|지금 바로|만나보세요|경험하세요|여정|당신을 위한|모든 것을 한 곳에|단순한 [가-힣]+(이|가) 아니라|환영합니다|함께해요|함께하세요|다양한|최고의|강력한|스마트한|원활한|효율적인|최적의|다채로운|언제 어디서나|누구나 쉽게|놓치지 마세요|즐겨 ?보세요|즐기세요|자세히 보기|더 알아보기|준비 중인 기능/;
  assert.deepEqual(COPY.filter(({ t }) => words.test(t)).map(h => `${h.at}: ${words.exec(h.t)[0]}`), []);
});
test("no stock English keys and no placeholder people (Made by people)", () => {
  const words = /["'`>]\s*(Welcome|Get started|Learn more|Dashboard|Coming soon|Read more|Sign up now)\b|홍길동|John Doe|Jane Doe|[Ll]orem ipsum/;
  assert.deepEqual(COPY.filter(({ t }) => words.test(t)).map(h => `${h.at}: ${words.exec(h.t)[0]}`), []);
});
test("the body sets the type: keep-all, no faked faces, tabular digits (Typesetting)", () => {
  const body = /\nbody \{([\s\S]*?)\n\}/.exec(TOKENS)[1];
  for (const rule of [/word-break: keep-all/, /font-synthesis: none/, /font-variant-numeric: tabular-nums/, /-webkit-tap-highlight-color: transparent/])
    assert.match(body, rule);
  assert.match(TOKENS, /--font: "Albert Sans", "Freesentation",/, "Albert Sans first, so Latin and digits in a Korean line are Albert Sans");
  assert.match(TOKENS, /i, em \{ font-style: normal; \}/, "upright only");
  assert.match(TOKENS, /--ls20: -\.01em; --ls32: -\.02em;/, "tracking only tightens, with size");
  assert.deepEqual(DECLS.filter(d => d.prop === "letter-spacing" && /^\.?\d|^var\(--ls(?!20|32|-fig)/.test(d.value) && d.value !== "0").map(keyOf), [], "no open tracking");
  assert.match(TOKENS, /--ls-fig: -\.04em;/, "a figure only tightens");
});

// ---------- motion ----------
// A new thing that moves is one of the verbs. These files are where the verbs that need the finger or a measurement live.
const ANIMATES = new Set(["src/components/common/motion.js", "src/components/common/Modal.jsx", "src/components/common/Menu.jsx", "src/components/common/Dropdown.jsx",
  "src/components/common/Toaster.jsx", "src/components/common/StandTable.jsx",
  // the battle stage's effects travel, burst and shake (DESIGN.md "Battle", What the stage plays): the one motion outside the verbs
  "src/pages/battle/stageFx.js"]);
test("pages move through the verbs of motion.js, never their own .animate() (Motion)", () => {
  assert.deepEqual(SRC.filter(f => /\.animate\(/.test(read(f)) && !ANIMATES.has(rel(f))).map(rel), []);
});
test("keyframes are a closed list: a new one needs a new verb in DESIGN.md (Motion)", () => {
  const names = CSS.flatMap(f => [...read(join(STYLES, f)).matchAll(/@keyframes\s+([\w-]+)/g)].map(m => m[1])).sort();
  assert.deepEqual(names, ["y-busy", "y-fade", "y-rise", "y-turn"]);
});
test("script animations take their durations from DUR (Motion)", () => {
  const hits = SRC.flatMap(f => [...read(f).matchAll(/\.animate\([^;]*?duration:\s*(\d+)/g)].filter(m => +m[1] > 0).map(m => `${rel(f)}: ${m[1]}`));
  assert.deepEqual(hits, []);
});
test("scripted animations move transform and opacity only (Motion)", () => {
  const hits = SRC.flatMap(f => [...read(f).matchAll(/\.animate\(\s*\[[^\]]*\]/g)].filter(([m]) => /\b(filter|clipPath|backgroundPosition|boxShadow|width|height)\s*:/.test(m)).map(([m]) => `${rel(f)}: ${m.slice(0, 80)}`));
  assert.deepEqual(hits, [], "move it by transform and opacity, or give it a still picture to move");
});
test("css keyframes move transform and opacity only (Motion)", () => {
  const css = CSS.map(f => read(join(STYLES, f))).join("\n");
  const blocks = [...css.matchAll(/@keyframes ([\w-]+) \{((?:[^{}]*\{[^{}]*\})*)[^{}]*\}/g)].map(([, name, body]) => ({ name, props: [...body.matchAll(/([\w-]+)\s*:/g)].map(m => m[1]) }));
  assert.ok(blocks.length >= 4);
  assert.deepEqual(blocks.filter(b => b.props.some(p => !["transform", "opacity"].includes(p))).map(b => `${b.name}: ${b.props}`), []);
});
test("a page change copies nothing and flies nothing; there is no burst (Motion)", () => {
  const motion = src("src/components/common/motion.js");
  assert.doesNotMatch(motion, /cloneNode|"ghost"|celebrate|placePill/);
  assert.doesNotMatch(TOKENS, /@property --(stage|surface|fg)\b/);
});
// A button's own transition list replaces the global one (tokens.css, press and hover), so it has to carry the press itself or the
// press snaps. Only a selector that names the button element can be checked here; a class that sits on a button cannot be told from CSS.
test("a button's own transition keeps the press: scale at --move-press (Motion, Controls)", () => {
  const subject = sel => sel.split(",").some(part => /(^|[\s>+~])button(?![\w-])[^\s>+~]*$/.test(part.trim()));
  const hits = DECLS.filter(d => d.prop === "transition" && d.value !== "none" && subject(d.sel) && !/\bscale var\(--move-press\)/.test(d.value));
  assert.deepEqual(hits.map(keyOf), []);
});
test("no View Transitions snapshots (Don't)", () => {
  const hits = [...SRC, ...CSS.map(f => join(STYLES, f))].filter(f => /startViewTransition|view-transition/.test(read(f)));
  assert.deepEqual(hits.map(rel), []);
});

// ---------- the eye and the shared parts ----------
test("the middle is measured by ink: text from the font's baseline, a sprite from its own pixels (The eye)", () => {
  assert.match(TOKENS, /ascent-override: 97%; descent-override: 25%;/, "without it text rides above the middle of its box");
  assert.match(src("src/main.jsx"), /centreInk\(e\.target\)/, "every sprite stands on its ink");
});
test("icons stand on three sizes: 16, 20, 24 (Icons)", () => {
  const hits = SRC.flatMap(f => [...read(f).matchAll(/<Icon [^>]*?size=\{(\d+)\}/g)].filter(m => !["16", "20", "24"].includes(m[1])).map(m => `${rel(f)}: ${m[1]}`));
  assert.deepEqual(hits, []);
  assert.match(src("src/components/common/Icon.jsx"), /viewBox="0 0 24 24"[\s\S]*strokeWidth="1\.5" strokeLinecap="square" strokeLinejoin="miter"/, "drawn on a 24 grid");
});
test("icons only say what words cannot: no decorative icons on pages (Icons)", () => {
  const files = [...readdirSync(join(ROOT, "src/pages")).filter(f => /\.jsx?$/.test(f)).map(f => `src/pages/${f}`), "src/components/layout/SiteFooter.jsx"];
  const hits = files.flatMap(f => [...src(f).matchAll(/<Icon n="(crown|medal|chart|trophy|discord|msg|list)"/g)].map(m => `${f}: ${m[1]}`));
  assert.deepEqual(hits, []);
});
test("three breakpoints: 640, 860, 1100 (Layout)", () => {
  const css = CSS.map(f => read(join(STYLES, f))).join("\n");
  const widths = [...new Set([...css.matchAll(/\((?:min|max)-width:\s*(\d+)px\)/g)].map(m => +m[1]))];
  assert.deepEqual(widths.filter(w => ![639, 640, 859, 860, 1099, 1100].includes(w)), []);
});
test("the touch floor raises a control but never lowers a field or a row (Accessibility)", () => {
  const floor = DECLS.filter(d => d.file === C && d.prop === "min-height" && d.value === "var(--h-control)" && d.sel.includes(".ypl button"));
  assert.ok(floor.length > 0, "the touch floor is still there");
  assert.deepEqual(floor.filter(d => !d.sel.startsWith(":where(")).map(keyOf), [], "the floor's height must carry no weight (:where)");
});
test("every sheet closes the same way: the X is not tied to a title (Sheets, dialogs, toasts)", () => {
  assert.doesNotMatch(src("src/components/common/Modal.jsx"), /title !== undefined && <>\s*<button type="button" className="modal-x/);
});
test("a generation is written one way: 1대, never 초대 (Voice and tone)", async () => {
  const { generationText } = await import("../src/services/seasonLabel.js");
  assert.equal(generationText("초대"), "1대");
  assert.equal(generationText("초대 챔피언"), "1대");
  assert.equal(generationText("6대 챔피언"), "6대");
  for (const f of ["src/pages/TitlesPage.jsx", "src/pages/ChampionsPage.jsx", "src/pages/RecordsPage.jsx"])
    assert.match(src(f), /generationText/, `${f} shows generations through generationText`);
});
test("one button: every button that is a button comes from Button.jsx (Controls)", () => {
  const hits = SRC.filter(f => !f.endsWith("Button.jsx")).flatMap(f => [...read(f).matchAll(/className=["{][^>\n]*\b(ypl-btn|btn-primary|btn-ghost|btn-danger)\b/g)].map(m => `${rel(f)}: ${m[1]}`));
  assert.deepEqual(hits, []);
});
// ---------- the tiers (Hierarchy): a heading's tag is its tier's look, an action is one of three ----------
const JSX = SRC.filter(f => f.endsWith(".jsx"));
const headings = level => JSX.flatMap(f => [...read(f).matchAll(new RegExp(`<h${level} className=(\\{[^}]*\\}|"[^"]*")`, "g"))].map(m => ({ file: rel(f), cls: m[1] })));
test("a page title is tier 1: the page's name at 52 / 84, a thing's own title 32; a page led by its figure captions it (Hierarchy)", () => {
  const led = new Set(["src/pages/HomePage.jsx", "src/pages/StatusPage.jsx"]);
  assert.deepEqual(headings(1).filter(h => !led.has(h.file) && !/\b(t32|page-title)\b/.test(h.cls)).map(h => `${h.file}: ${h.cls}`), []);
});
test("a section or sheet title is tier 2, 20; the decided record's one name stands at 32 (Hierarchy)", () => {
  const off = [2, 3].flatMap(headings).filter(h => !/\bt20\b/.test(h.cls) && !/hof-crown-name|\bchapter\b/.test(h.cls));
  assert.deepEqual(off.map(h => `${h.file}: ${h.cls}`), [], "a label over a control is its label, not a heading");
});
test("an action is main, second or link (Hierarchy)", () => {
  // each <Button's own variant: the first one before the next <Button
  const used = JSX.flatMap(f => [...read(f).matchAll(/<Button\b(?:(?!<Button\b)[\s\S])*?\bvariant=(?:"([^"]+)"|\{([^}]*)\})/g)]
    .flatMap(m => m[1] ? [m[1]] : [...m[2].matchAll(/"([^"]+)"/g)].map(x => x[1])).map(v => `${rel(f)}: ${v}`));
  assert.deepEqual(used.filter(u => !/: (main|second|link)$/.test(u)), []);
  assert.match(src("src/components/common/Button.jsx"), /variant = "second"/, "a button with no variant is a second action");
  assert.doesNotMatch(CSS.map(f => read(join(STYLES, f))).join("\n"), /\.btn--(primary|secondary|destructive)\b/);
});
test("inline space is a token (Space)", () => {
  const hits = SRC.flatMap(f => [...read(f).matchAll(/style=\{\{([^{}]*)\}\}/g)].filter(([, b]) => /\b(margin\w*|padding\w*|gap)\s*:\s*-?[1-9]/.test(b)).map(([m]) => `${rel(f)}: ${m.slice(0, 60)}`));
  assert.deepEqual(hits, []);
});
test("saved images stand on the type scale (Type)", () => {
  const sizes = new Set(["12", "13", "15", "16", "20", "32", "52", "84", "136"]); // ponytail: 13 16 52 84 136 are YPL Navy's, until the bracket and sheet images are rebuilt
  for (const f of ["src/pages/BracketsPage.jsx", "src/components/teamSheetImage.js"]) {
    const fonts = [...src(f).matchAll(/ctx\.font\s*=\s*`([^`]*)`/g)].map(m => m[1]);
    assert.ok(fonts.length > 8, f);
    assert.deepEqual(fonts.filter(x => /\b800\b/.test(x)), [], "weights 400 600 700");
    assert.deepEqual(fonts.filter(x => !sizes.has((/ (\d+(?:\.\d+)?)px/.exec(x) || [])[1])).filter(x => / \d/.test(x)), [], "a size on the scale");
  }
});
test("a switch is the one .sw, a span inside its key (Components)", () => {
  // the switch itself as a button takes a phone's 44 minimum and stands 52 by 44 with its square at the top (the sound sheet, 2026-11-22)
  const hits = SRC.flatMap(f => [...read(f).matchAll(/<(\w+)[^<>]*className=\{"sw"/g)].filter(m => m[1] !== "span").map(() => rel(f)));
  assert.deepEqual(hits, []);
  assert.ok(SRC.some(f => /<span className=\{"sw"/.test(read(f))));
});
test("고대비 is a real high contrast on the platform's convention: every word 7 or more on its ground and its step, what acts and its highlight 7 or more, the main key's words 7 or more on its fill, the mark 3 or more, both themes (Colour and light)", () => {
  const p = n => new RegExp(`--${n}:\\s*(#[0-9A-F]{6})`, "i").exec(TOKENS)?.[1];
  const lum = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255).map(c => c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4).reduce((s, c, i) => s + c * [.2126, .7152, .0722][i], 0);
  const cr = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((q, r) => r - q); return (x + .05) / (y + .05); };
  // [ink, dim, mute, ground, step, mark, act, hi, the words on a filled act or hi]
  const sets = [["#FFFFFF", p("hc-ink-1"), p("hc-ink-2"), p("hc-black"), p("hc-step"), p("hc-yellow"), p("hc-yellow"), p("hc-cyan"), p("hc-black")],
    [p("hc-black"), p("hc-ink-3"), p("hc-ink-4"), "#FFFFFF", p("hc-step-light"), p("hc-amber"), p("hc-blue"), p("hc-purple"), "#FFFFFF"]];
  for (const [lit, dim, mute, ground, step, mark, act, hi, onAct] of sets) {
    for (const bg of [ground, step]) for (const ink of [lit, dim, mute, act]) assert.ok(cr(ink, bg) >= 7, `${ink} on ${bg}: ${cr(ink, bg).toFixed(2)}`);
    for (const c of [act, hi]) { assert.ok(cr(c, ground) >= 7, `${c} on ${ground}`); assert.ok(cr(onAct, c) >= 7, `${onAct} on ${c}`); }
    assert.ok(cr(mark, ground) >= 3, `mark ${mark} on ${ground}`);
  }
  // the yellow is the convention's own (Windows' and the browsers' forced-colours LinkText), and --act and --hl exist only under 고대비
  assert.equal(p("hc-yellow").toUpperCase(), "#FFFF00");
  assert.equal((TOKENS.match(/--act:/g) || []).length, 2);
});
