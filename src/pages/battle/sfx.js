/* 배틀의 효과음 (DESIGN.md "Battle", Sound). 자리마다 하나씩: 누르는 키, 공을 던지고 여는 소리, 돌아오는 빛, 기술이 모이고 날아가고
   맞는 소리(타입마다, 베기와 물기와 주먹마다), 효과가 굉장함과 별로와 급소, 빗나감, 능력이 오르고 내리는 소리, 상태 이상마다의 소리,
   회복, 쓰러짐, 방어, 특성과 도구, 대타, 날씨와 필드와 벽과 함정, 메가진화, 턴, 시계, 승패.
   소리는 녹음된 효과음이다(2026-11-20, 운영자: "AI 스테레오 타입 같은 느낌"이던 합성음을 바꿈). 코드로 지은 배경음악(2026-11-22,
   scripts/compose-music.py)과는 세 가지로 묶인다: 음높이가 있는 조각은 음악의 조에 맞춰 틀고(TUNED), 울림은 음악과 같은 방이고(room),
   승패는 음악의 팡파르로 지은 마디가 알린다(J). Kenney와 Lentikula의 CC0 팩에서 고른 것을 scripts/build-sfx.py가 public/sfx/sprite.m4a 하나에 이어 두고(sfxSprite.js가 자리),
   여기서 그 조각을 무대의 그림과 같은 시각에 튼다(at: 무대의 ms). 연출 속도를 따르고, 건너뛰기는 조용하고, 소리 시트의 채널(기술 효과음,
   알림음)을 따른다. 왼쪽은 우리, 오른쪽은 상대: 소리가 나는 자리를 따라 좌우로 놓이고, 경기장의 울림(짧은 잔향)이 뒤에 깔린다. */
import { channel, duck, heard, madeAudio, primeAudio } from "./cries.js";
import SPRITE from "./sfxSprite.js";

const LEVEL = .5; // the stage under the cries, never startling
let speed = 1;
export const setSfxSpeed = s => { speed = s; };
let moveType = "normal";
export const setMoveType = t => { moveType = String(t || "normal").toLowerCase(); };

let bus = null, wetIn = null, buses = null;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/* the air behind a sound: the music's own room (compose-music.py room(): noise falling as exp(-t / 0.25 s), 1.2 s), a little different
   in each ear, so the effects and the music stand in one place (2026-11-22; it was a stadium of 1.6 s while the music moved to a small room) */
function room(ctx) {
  const len = Math.round(ctx.sampleRate * 1.2), buf = ctx.createBuffer(2, len, ctx.sampleRate), tau = ctx.sampleRate * .25;
  // the fall-off taken every 256 samples and drawn straight between (a power for each sample was 60 ms of a phone's frame, 2026-11-18)
  const fall = i => Math.exp(-Math.min(len, i) / tau);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i0 = 0; i0 < len; i0 += 256) {
      const a = fall(i0), b = fall(i0 + 256), end = Math.min(len, i0 + 256);
      for (let i = i0; i < end; i++) d[i] = (Math.random() * 2 - 1) * (a + (b - a) * (i - i0) / 256) * (i < 400 ? i / 400 : 1);
    }
  }
  return buf;
}
// how much of each sound's own send reaches the room: the music's went from .9 to .35 of its send, and the effects follow it
const WET = .4;
// the keys and the clock are not effects: they sound under 건너뛰기 too
const ALWAYS = new Set(["select", "tick"]);
// the big moments the music steps back for (cries.js duck): how long, in seconds of the stage
const DUCK = { megaStart: 1.4, megaEnd: 1.2, boom: 1.6, quake: 1.8, super: .7, crit: .6, lamps: 1 };
// 알림음 in the sound sheet: what tells the player where the battle stands, not what a move does
const UI = new Set(["select", "tick", "turn", "lamps", "win", "lose", "draw"]);
// one channel's output: its voices into a bus, a compressor, and the stadium's air behind it, into the channel's gain (cries.js)
function strip(ctx, out) {
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -14; comp.knee.value = 10; comp.ratio.value = 4; comp.attack.value = .002; comp.release.value = .18;
  const b = ctx.createGain(); b.gain.value = LEVEL;
  b.connect(comp).connect(out);
  const verb = ctx.createConvolver(); verb.buffer = room(ctx);
  const w = ctx.createGain(); w.connect(verb).connect(b);
  return [b, w];
}
function wire(ctx) {
  buses = { fx: strip(ctx, channel(ctx, "fx")), ui: strip(ctx, channel(ctx, "ui")) };
  [bus, wetIn] = buses.fx;
}

/* the sprite: one file fetched and decoded once, by a context that never sounds (as the cries are, cries.js). Its clips are counted
   from the buffer's end, since Chrome keeps the AAC encoder's 1024 samples of silence at its start and a decoder that trims them keeps
   none (as the music, music.js). A sound asked before it is decoded is let go, as one before the first touch is */
const OAC = typeof window !== "undefined" && (window.OfflineAudioContext || window.webkitOfflineAudioContext);
let sprite = null, lead = 0, loading = null;
// the result's bars, composed from the music's fanfare (compose-music.py cadences()): one small file each
const bars = new Map();
function loadSprite() {
  if (!OAC || loading) return;
  loading = fetch(`${import.meta.env?.BASE_URL ?? "/"}sfx/sprite.m4a`)
    .then(res => (res.ok ? res.arrayBuffer() : null))
    .then(data => data && new Promise(resolve => new OAC(2, 1, SPRITE.rate).decodeAudioData(data, resolve, () => resolve(null))))
    .then(buffer => { if (buffer) { sprite = buffer; lead = Math.max(0, buffer.length - SPRITE.length); } })
    .catch(() => {});
  for (const id of ["win", "lose", "draw"]) {
    fetch(`${import.meta.env?.BASE_URL ?? "/"}sfx/${id}.m4a`)
      .then(res => (res.ok ? res.arrayBuffer() : null))
      .then(data => data && new Promise(resolve => new OAC(2, 1, SPRITE.rate).decodeAudioData(data, resolve, () => resolve(null))))
      .then(buffer => { if (buffer) bars.set(id, buffer); })
      .catch(() => {});
  }
}

function ready(always) {
  // a context just made is not running yet either, so the sound that asked for it was never heard
  const ctx = madeAudio();
  if (!ctx) primeAudio();
  loadSprite();
  if (!ctx || ctx.state !== "running" || !sprite || (!speed && !always)) return null;
  if (!bus || bus.context !== ctx) wire(ctx);
  return ctx;
}
// the sprite fetched and the graph built before the first sound needs them (stageFx warm)
export const warmSound = () => { loadSprite(); ready(true); };

/* ---------------------------------------------------------------- the voice ---------------------------------------------------------------- */
function outlet(ctx, pan, wet) {
  const g = ctx.createGain();
  let head = g;
  if (pan && ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = clamp(pan, -1, 1); g.connect(p); head = p; }
  head.connect(bus);
  if (wet) { const s = ctx.createGain(); s.gain.value = wet * WET; head.connect(s).connect(wetIn); }
  return g;
}
/* The clips that sound a note, and the note each sounds (MIDI, measured 2026-11-22; a take with no clear note is null). The music is in
   E minor and A minor, and these were C#, A# and a quarter-tone off: each is played at the nearest of E G A B D, the notes both keys
   share, whatever rate its sound asks for, and is not wavered as the others are. */
const TUNED = { field: [49.27], field2: [57.81], field3: [55.16], bell: [57.47], wind: [67.68, null], hum: [41.97] };
const SHARED = [4, 7, 9, 11, 2];
export function tunedRate(id, take, rate) {
  const own = TUNED[id]?.[take];
  if (own == null) return null;
  const m = own + 12 * Math.log2(rate), near = Math.round(m);
  for (const n of [near, near - 1, near + 1, near - 2, near + 2]) if (SHARED.includes(((n % 12) + 12) % 12)) return rate * 2 ** ((n - m) / 12);
  return rate;
}
export const TUNED_CLIPS = TUNED;
// one of the result's bars, whole
function J(ctx, t, id, g) {
  const buffer = bars.get(id);
  if (!buffer) return;
  const src = ctx.createBufferSource(), out = outlet(ctx, 0, 0);
  src.buffer = buffer; out.gain.value = g;
  src.connect(out); src.start(t);
}
const lastTake = new Map();
/* one clip of the sprite. g: its level, rate: played faster and higher (or slower and lower), at: seconds after t, dur: how long it
   may last before it fades (0, the clip's own length), lp and hp: a low-pass or a high-pass, from a frequency (or [from, to]) */
function S(ctx, t0, id, { g = 1, rate = 1, pan = 0, wet = .15, at = 0, dur = 0, lp = null, hp = null } = {}) {
  const takes = SPRITE.clips[id];
  if (!takes || !sprite) return;
  // one of the clip's takes, never the one just played when there are more, a few cents higher or lower each time (a note stays in tune)
  const pick = takes.length > 1 ? (lastTake.get(id) + 1 + Math.floor(Math.random() * (takes.length - 1))) % takes.length || 0 : 0;
  lastTake.set(id, pick);
  const c = takes[pick];
  rate = tunedRate(id, pick, rate) ?? rate * (1 + (Math.random() - .5) * .06);
  const t = t0 + at, own = c[1] / SPRITE.rate / rate, len = dur ? Math.min(dur, own) : own, fade = Math.min(.08, len / 3);
  const src = ctx.createBufferSource(), out = outlet(ctx, pan, wet);
  src.buffer = sprite; src.playbackRate.value = rate;
  let node = src;
  for (const [kind, f] of [["lowpass", lp], ["highpass", hp]]) {
    if (!f) continue;
    const flt = ctx.createBiquadFilter(); flt.type = kind;
    const [a, b] = Array.isArray(f) ? f : [f, f];
    flt.frequency.setValueAtTime(a, t); if (b !== a) flt.frequency.exponentialRampToValueAtTime(b, t + len);
    node.connect(flt); node = flt;
  }
  node.connect(out);
  out.gain.setValueAtTime(g, t); out.gain.setValueAtTime(g, t + len - fade); out.gain.linearRampToValueAtTime(0, t + len);
  src.start(t, (lead + c[0]) / sprite.sampleRate, len * rate + .01);
}
// the pitch each type sings at, as a playback rate: a charge, a flight, a field
const PITCH = { normal: 1, fire: .85, water: 1.05, electric: 1.25, grass: 1.1, ice: 1.4, fighting: .8, poison: .75, ground: .65, flying: 1.2, psychic: 1.15, bug: 1.3, rock: .75, ghost: .7, dragon: .6, dark: .7, steel: 1.3, fairy: 1.45 };
const rateOf = t => PITCH[t] || 1;

/* ---------------------------------------------------------------- what each type sounds like as it lands ---------------------------------------------------------------- */
// p: how hard (1 a plain blow), every type a blow under its own matter
export const TYPE_HIT = {
  normal: (c, t, p, pan) => { S(c, t, "punch", { g: .9 * p, pan }); },
  fire: (c, t, p, pan) => { S(c, t, "punch2", { g: .6 * p, pan }); S(c, t, "fire", { g: .8 * p, pan, wet: .25, dur: .9 }); },
  water: (c, t, p, pan) => { S(c, t, "punch2", { g: .55 * p, pan }); S(c, t, "water", { g: .85 * p, pan, wet: .25, dur: 1 }); },
  electric: (c, t, p, pan) => { S(c, t, "punch2", { g: .55 * p, pan }); S(c, t, "bolt", { g: .8 * p, pan, wet: .2, dur: 1 }); },
  grass: (c, t, p, pan) => { S(c, t, "punch2", { g: .55 * p, pan }); S(c, t, "plant", { g: .85 * p, pan, wet: .2, dur: 1 }); },
  ice: (c, t, p, pan) => { S(c, t, "glassM", { g: .6 * p, pan }); S(c, t, "ice", { g: .85 * p, pan, wet: .3 }); },
  fighting: (c, t, p, pan) => { S(c, t, "punchH", { g: 1.05 * p, pan }); S(c, t, "softH", { g: .5 * p, pan }); },
  poison: (c, t, p, pan) => { S(c, t, "punch2", { g: .55 * p, pan }); S(c, t, "slime", { g: .75 * p, pan, wet: .2, rate: .85 }); },
  ground: (c, t, p, pan) => { S(c, t, "softH", { g: .8 * p, pan }); S(c, t, "earth", { g: .9 * p, pan, wet: .25 }); },
  flying: (c, t, p, pan) => { S(c, t, "punch", { g: .6 * p, pan }); S(c, t, "whoosh2", { g: .7 * p, pan, wet: .2, dur: .5, rate: 1.3 }); },
  psychic: (c, t, p, pan) => { S(c, t, "punch2", { g: .5 * p, pan }); S(c, t, "field2", { g: .6 * p, pan, wet: .45, rate: .85 }); S(c, t, "shine", { g: .35 * p, pan, wet: .5, rate: .8 }); },
  bug: (c, t, p, pan) => { S(c, t, "punch2", { g: .55 * p, pan }); S(c, t, "slime", { g: .6 * p, pan, rate: 1.5, hp: 900 }); },
  rock: (c, t, p, pan) => { S(c, t, "punch", { g: .7 * p, pan }); S(c, t, "mining", { g: .85 * p, pan, wet: .2 }); },
  ghost: (c, t, p, pan) => { S(c, t, "soft", { g: .6 * p, pan }); S(c, t, "field", { g: .55 * p, pan, wet: .6, rate: .6 }); S(c, t, "dream", { g: .3 * p, pan, wet: .6, rate: .6, dur: .8 }); },
  dragon: (c, t, p, pan) => { S(c, t, "punchH2", { g: .85 * p, pan }); S(c, t, "crunch", { g: .6 * p, pan, wet: .3, rate: .8 }); },
  dark: (c, t, p, pan) => { S(c, t, "punchD", { g: .95 * p, pan, rate: .85 }); S(c, t, "soft", { g: .4 * p, pan }); },
  steel: (c, t, p, pan) => { S(c, t, "metalH", { g: .85 * p, pan }); S(c, t, "bell", { g: .45 * p, pan, wet: .35 }); },
  fairy: (c, t, p, pan) => { S(c, t, "punch2", { g: .45 * p, pan }); S(c, t, "shine", { g: .7 * p, pan, wet: .45 }); S(c, t, "glassL", { g: .35 * p, pan, wet: .3, at: .03 }); },
};
const MARK_SOUND = {
  slash: (c, t, pan) => S(c, t, "swish", { g: .7, pan, rate: 1.6, dur: .25 }),
  claw: (c, t, pan) => [0, .05, .1].forEach(at => S(c, t, "swish", { g: .5, pan, rate: 1.9, dur: .14, at })),
  cross: (c, t, pan) => [0, .07].forEach(at => S(c, t, "swish", { g: .6, pan, rate: 1.7, dur: .2, at })),
  fang: (c, t, pan) => [0, .09].forEach(at => S(c, t, "woodL", { g: .8, pan, rate: .8, at })),
};
const heavy = (c, t, at, g, pan) => S(c, t, "softH", { g, pan, at });

/* ---------------------------------------------------------------- the library ---------------------------------------------------------------- */
const LIB = {
  /* ---------- keys and the clock ---------- */
  select: (c, t) => S(c, t, "select", { g: .55, wet: .05 }),
  tick: (c, t, o) => S(c, t, o.n <= 3 ? "tickHi" : "tick", { g: o.n <= 3 ? .9 : .6, wet: 0 }),
  turn: (c, t) => S(c, t, "turn", { g: .5, wet: .2 }),

  /* ---------- the big moments ---------- */
  // the stadium's lamps, bank by bank: three heavy switches and the hum of the power coming up
  lamps: (c, t) => { [0, .26, .52].forEach((at, i) => S(c, t, "lamp", { g: .8, rate: 1 - i * .06, wet: .45, at })); S(c, t, "hum", { g: .25, dur: 1.4, lp: 800, wet: .4 }); },
  throw: (c, t, o) => S(c, t, "whoosh", { g: .55, pan: o.pan, dur: o.sec || .72, rate: 1.1 }),
  // the game's send-out (its shape measured from 포켓몬 챔피언스, scripts/data/sfx-shapes.json): a bright band rising to the top fast
  /* only its burst, the first 0.22 s: the footage the shape was measured from has the Pokémon's cry right after the ball opens, and that
     part read as a monster's growl (earshot, forced choice: 96% for the whole clip, 1% for its first 0.2 s, which reads as a burst of
     light), heard at every send-out even with 울음소리 off (2026-11-21, the owner: "이상한 괴물 울음소리가 나던데? 아예 소리 안 나는 걸로") */
  ballOpen: (c, t, o) => S(c, t, "open", { g: .8, pan: o.pan, wet: .35, dur: .22 }),
  // the red light flying home: a power falling away, then a short rise as it reaches the ball
  recall: (c, t, o) => S(c, t, "recallS", { g: .8, pan: o.pan, wet: .35, rate: 1 / Math.max(.6, Math.min(1.6, o.k || 1)) }),
  drag: (c, t, o) => { S(c, t, "breeze", { g: .6, pan: o.pan, dur: .6 }); heavy(c, t, 0, .4, o.pan); },
  faint: (c, t, o) => { const k = o.k || 1; S(c, t, "faintS", { g: .75, pan: o.pan, wet: .4, rate: 1 / Math.max(.6, Math.min(1.6, k)) }); heavy(c, t, .55 * k, .5, o.pan); },
  // Mega Evolution as the newest games sound it (Legends Z-A, shapes measured): a rising charge, then the burst over a low blow
  megaStart: (c, t, o) => S(c, t, "megaA", { g: .8, pan: o.pan, wet: .5 }),
  megaEnd: (c, t) => { S(c, t, "megaB", { g: .9, wet: .45 }); S(c, t, "lowBoom", { g: .6, wet: .4 }); },
  /* the result: a bar of the music's own fanfare (J, compose-music.py cadences(), 2026-11-22: the effects alone had nothing of the music
     in them), over the gesture the effects made before, now quieter: a win rises and rings over a thump, a loss falls away onto a
     heavy body, a draw hangs on one chord; the music fades under them (BattlePage) */
  win: (c, t) => { J(c, t, "win", .9); S(c, t, "lamp", { g: .5, wet: .4 }); S(c, t, "rise", { g: .35, wet: .5, rate: 1.1 }); S(c, t, "bright", { g: .3, wet: .6, at: .18 }); },
  lose: (c, t) => { J(c, t, "lose", .9); S(c, t, "fall", { g: .4, wet: .5, rate: .7 }); S(c, t, "softH", { g: .5, wet: .4, at: .5 }); },
  draw: (c, t) => J(c, t, "draw", .85),

  /* ---------- a move ---------- */
  // light gathering at the user, at the type's pitch
  charge: (c, t, o) => S(c, t, "gather", { g: .55, pan: o.pan, wet: .35, rate: rateOf(o.type), dur: (o.sec || .42) + .2 }),
  aura: (c, t, o) => {
    const s = o.sec || .6;
    if (o.type === "fire") S(c, t, "flame", { g: .5, pan: o.pan, dur: s, wet: .3 });
    else if (o.type === "electric") S(c, t, "spark", { g: .55, pan: o.pan, dur: s });
    else S(c, t, "field3", { g: .5, pan: o.pan, rate: rateOf(o.type), wet: .4, dur: s });
  },
  // the user dashes at its target: the air tears past as it strikes
  dash: (c, t, o) => S(c, t, "swish", { g: .6, pan: o.pan, rate: 1.1, dur: (o.sec || .27) + .1 }),
  miss: (c, t, o) => S(c, t, "whoosh2", { g: .55, pan: o.pan, rate: 1.5, dur: .35 }),
  fail: (c, t, o) => S(c, t, "fail", { g: .6, pan: o.pan }),
  // what the move sends: a thing in flight, a stream, a beam, a bolt, a slash, a falling stone, a swarm of motes
  shot: (c, t, o) => { const s = clamp(o.sec || .36, .12, 1.2); S(c, t, "pistol", { g: .5, pan: o.pan, rate: rateOf(o.type), dur: s + .15 }); S(c, t, "whoosh", { g: .35, pan: o.pan, rate: 1.4, dur: s }); },
  stream: (c, t, o) => {
    const s = clamp(o.sec || .6, .2, 2) + .25, ty = o.type;
    if (ty === "fire") S(c, t, "flame", { g: .65, pan: o.pan, dur: s, wet: .3 });
    else if (ty === "water") S(c, t, "rain", { g: .6, pan: o.pan, dur: s, wet: .3, rate: 1.1 });
    else if (ty === "ice") S(c, t, "iceL", { g: .6, pan: o.pan, dur: s, wet: .4 });
    else S(c, t, "hum", { g: .5, pan: o.pan, dur: s, rate: rateOf(ty), wet: .3 });
  },
  beam: (c, t, o) => { const s = clamp(o.sec || .7, .2, 2) + .2; S(c, t, "beam", { g: .65, pan: o.pan, dur: s, rate: rateOf(o.type), wet: .35 }); },
  zap: (c, t, o) => { const s = clamp(o.sec || .38, .1, 1) + .3; S(c, t, "boltL", { g: .7, pan: o.pan, dur: s }); if (o.big) S(c, t, "lowBoom", { g: .8, pan: o.pan, wet: .6, at: .04 }); },
  slash: (c, t, o) => MARK_SOUND.slash(c, t, o.pan),
  swoosh: (c, t, o) => S(c, t, "whoosh2", { g: .5, pan: o.pan, dur: clamp(o.sec || .5, .15, 1.2) + .1, wet: .2 }),
  fall: (c, t, o) => S(c, t, "breeze", { g: .4, pan: o.pan, rate: 1.3, dur: (o.sec || .42) + .1 }),
  motes: (c, t, o) => S(c, t, "sparkle", { g: .45, pan: o.pan, rate: rateOf(o.type), dur: clamp(o.sec || .6, .2, 1.6) + .2, wet: .5 }),
  // a quake: the ground breaking and a long low shake under it
  quake: (c, t, o) => { S(c, t, "earthL", { g: .9, pan: o.pan, wet: .4 }); S(c, t, "rumble", { g: .7, dur: 2.4, wet: .5 }); },
  sound: (c, t, o) => [0, .12, .24].forEach((at, i) => S(c, t, "field", { g: .5, pan: o.pan, rate: rateOf(o.type) * (1.1 - i * .06), wet: .5, at })),
  boom: (c, t, o) => { const p = o.p || 1; S(c, t, "boom", { g: .95 * p, pan: o.pan, wet: .5 }); S(c, t, "lowBoom", { g: .85 * p, pan: o.pan, wet: .4 }); },

  /* ---------- what comes of it ---------- */
  // the type's matter at the moment of the blow, and a blade's or a fang's mark; a status move lands as the type's glint
  impact: (c, t, o) => {
    const ty = TYPE_HIT[o.type] ? o.type : "normal", p = clamp(o.p || 1, .4, 1.8);
    if (o.soft) { S(c, t, "shine", { g: .45, pan: o.pan, rate: rateOf(ty), wet: .5 }); return; }
    TYPE_HIT[ty](c, t, p, o.pan || 0);
    MARK_SOUND[o.mark]?.(c, t, o.pan || 0);
  },
  // the damage itself: a plain blow, a heavier double crunch when it is super effective, a muffled one when it is not very effective,
  // a sharp crack over it on a critical hit; HP lost to the field or a status is a dull knock
  // the hits as the game voices them (shapes measured from clean rips of the 3D games, the same sounds 포켓몬 챔피언스 plays)
  damage: (c, t, o) => S(c, t, "hitN", { g: .8 * clamp(.7 + (o.share || .2), .7, 1.4), pan: o.pan, wet: .25 }),
  super: (c, t, o) => S(c, t, "hitS", { g: 1, pan: o.pan, wet: .3 }),
  resist: (c, t, o) => S(c, t, "hitR", { g: .75, pan: o.pan, wet: .2 }),
  crit: (c, t, o) => { S(c, t, "plate3", { g: .75, pan: o.pan, wet: .3 }); S(c, t, "metalL", { g: .55, pan: o.pan, wet: .35 }); S(c, t, "punchH", { g: .6, pan: o.pan }); },
  knock: (c, t, o) => S(c, t, "knockS", { g: .7, pan: o.pan, wet: .25 }),
  flinch: (c, t, o) => { S(c, t, "woodL", { g: .55, pan: o.pan }); S(c, t, "soft", { g: .3, pan: o.pan, rate: 1.2 }); },

  /* ---------- the Pokémon's state ---------- */
  /* a stat rising: a bright rise for each stage; falling, the same played backwards and lower. Plain recordings again (2026-11-22):
     given the game's shape they were heard as a creature crying, more than a real cry is (scripts/check-sfx-voice.py: z 3.1, a cry 2.8
     to 3.5), at every stat change, and so were poison, the sun and the sand below. The owner: "원본 울음소리가 안 나오고 이상한 울음소리가" */
  statUp: (c, t, o) => { const n = clamp(o.n || 1, 1, 3); for (let i = 0; i < n; i++) S(c, t, "rise", { g: .7, pan: o.pan, wet: .4, rate: 1 + i * .12, at: i * .26 }); },
  statDown: (c, t, o) => { const n = clamp(o.n || 1, 1, 3); for (let i = 0; i < n; i++) S(c, t, "fall", { g: .7, pan: o.pan, wet: .4, rate: .85 - i * .08, at: i * .3 }); },
  // the status conditions in the 3D games' shapes (scripts/data/sfx-shapes.json), poison a recording (see statUp); sleep is their three falling chirps
  st_brn: (c, t, o) => S(c, t, "burnS", { g: .7 * (o.n || 1), pan: o.pan, wet: .3 }),
  st_par: (c, t, o) => S(c, t, "parS", { g: .65 * (o.n || 1), pan: o.pan, wet: .2 }),
  st_psn: (c, t, o) => S(c, t, "ooze", { g: .6 * (o.n || 1), pan: o.pan, rate: 1.2, dur: .6, wet: .3 }),
  st_slp: (c, t, o) => [0, .3, .6].forEach((at, i) => S(c, t, "zzz", { g: .5, pan: o.pan, rate: 1 - i * .1, wet: .5, at })),
  st_frz: (c, t, o) => S(c, t, "frost", { g: .65, pan: o.pan, wet: .45 }),
  confused: (c, t, o) => S(c, t, "confS", { g: .6, pan: o.pan, wet: .4 }),
  cure: (c, t, o) => S(c, t, "chime", { g: .55, pan: o.pan, wet: .5, rate: 1.1 }),
  heal: (c, t, o) => S(c, t, "healS", { g: .7, pan: o.pan, wet: .5 }),
  protect: (c, t, o) => { S(c, t, "field", { g: .65, pan: o.pan, wet: .45, rate: 1.1 }); S(c, t, "veil", { g: .35, pan: o.pan, wet: .55 }); if (o.spiky) S(c, t, "metalL2", { g: .45, pan: o.pan, at: .1 }); },
  ability: (c, t, o) => S(c, t, "plate", { g: .55, pan: o.pan, wet: .3 }),
  item: (c, t, o) => S(c, t, "plate2", { g: .55, pan: o.pan, wet: .35 }),
  puff: (c, t, o) => { S(c, t, "softH", { g: .45, pan: o.pan, at: o.at2 || 0 }); S(c, t, "breeze", { g: .35, pan: o.pan, rate: 1.4, dur: .35, at: o.at2 || 0 }); },
  boing: (c, t, o) => { S(c, t, "bloop", { g: .55, pan: o.pan, wet: .3 }); heavy(c, t, 0, .45, o.pan); },
  pop: (c, t, o) => { S(c, t, "glassL", { g: .6, pan: o.pan }); S(c, t, "plank", { g: .45, pan: o.pan, at: .02 }); },
  morph: (c, t, o) => { S(c, t, "morph", { g: .55, pan: o.pan, wet: .5 }); S(c, t, "field3", { g: .3, pan: o.pan, rate: 1.3 }); },
  glass: (c, t, o) => { S(c, t, "glassH", { g: .75, pan: o.pan, wet: .4 }); S(c, t, "glassM", { g: .5, pan: o.pan, at: .04, wet: .4 }); },

  /* ---------- the field ---------- */
  // the weathers and a screen are recordings: in the games' shapes they were heard as a voice, or stood close to it (see statUp)
  rain: (c, t) => S(c, t, "rain", { g: .75, wet: .4 }),
  sun: (c, t) => { S(c, t, "fireL", { g: .5, wet: .5, rate: .8 }); S(c, t, "sparkle", { g: .45, wet: .6 }); },
  sand: (c, t) => { S(c, t, "sand", { g: .7, wet: .4 }); S(c, t, "wind", { g: .4, dur: 1.4, wet: .4 }); },
  snow: (c, t) => { S(c, t, "iceL", { g: .55, wet: .5, rate: .85 }); S(c, t, "breeze", { g: .35, wet: .5 }); },
  terrain: (c, t, o) => { S(c, t, "sparkle", { g: .55, rate: rateOf(o.type), wet: .55 }); if (o.type === "electric") S(c, t, "spark", { g: .4, dur: .6 }); else if (o.type === "grass") S(c, t, "plant", { g: .35, wet: .4 }); },
  room: (c, t) => { S(c, t, "field", { g: .55, rate: .6, wet: .6 }); S(c, t, "field2", { g: .45, rate: .8, wet: .6, at: .1 }); },
  screen: (c, t, o) => { const r = clamp((o.f || 1175) / 1175, .8, 1.4); S(c, t, "bright", { g: .6, pan: o.pan, rate: r, wet: .6 }); S(c, t, "field", { g: .4, pan: o.pan, rate: r, wet: .5 }); },
  rocks: (c, t, o) => [0, .14, .28].forEach((at, i) => S(c, t, "mining2", { g: .6, pan: o.pan, rate: 1 + i * .1, at })),
  spikes: (c, t, o) => [0, .12, .24].forEach((at, i) => S(c, t, "metalL2", { g: .5, pan: o.pan, rate: 1.1 + i * .15, at })),
  web: (c, t, o) => S(c, t, "slime", { g: .55, pan: o.pan, rate: .7, wet: .3 }),
  wind: (c, t, o) => S(c, t, "wind", { g: .65, pan: o.pan, wet: .4, dur: 1.6 }),
  fieldOff: (c, t) => S(c, t, "breeze", { g: .3, rate: 1.3, dur: .6, wet: .4 }),
  // a status move's own gesture (moveFx verbs whose drawing makes no sound of its own)
  shine: (c, t, o) => S(c, t, "shine", { g: .5, pan: o.pan, rate: rateOf(o.type), wet: .45 }),
  blades: (c, t, o) => [0, .2, .4].forEach(at => { S(c, t, "swish", { g: .5, pan: o.pan, rate: 1.7, dur: .2, at }); S(c, t, "metalL", { g: .35, pan: o.pan, at: at + .05, wet: .4 }); }),
  metal: (c, t, o) => S(c, t, "bell", { g: .55, pan: o.pan, wet: .4 }),
  drum: (c, t, o) => [0, .16, .32, .48].forEach(at => heavy(c, t, at, .7, o.pan)),
  gears: (c, t, o) => [0, .1, .2, .3, .4, .5].forEach((at, i) => S(c, t, "tin", { g: .4, pan: o.pan, rate: 1 + (i % 2) * .2, at })),
  crack: (c, t, o) => { S(c, t, "plank", { g: .6, pan: o.pan }); S(c, t, "glassL", { g: .4, pan: o.pan, at: .03 }); },
  sweet: (c, t, o) => S(c, t, "chime", { g: .5, pan: o.pan, rate: 1.25, wet: .5 }),
  sob: (c, t, o) => [0, .25].forEach(at => S(c, t, "glint", { g: .3, pan: o.pan, rate: .7, wet: .4, at })),
  growl: (c, t, o) => S(c, t, "rumble", { g: .55, pan: o.pan, rate: 1.4, dur: .6, wet: .3 }),
  stare: (c, t, o) => S(c, t, "field2", { g: .5, pan: o.pan, rate: .6, wet: .5 }),
  eerie: (c, t, o) => { S(c, t, "field", { g: .45, pan: o.pan, rate: .5, wet: .7 }); S(c, t, "dream", { g: .35, pan: o.pan, rate: .5, wet: .7, dur: 1 }); },
  song: (c, t, o) => [0, .3, .6].forEach((at, i) => S(c, t, "chime", { g: .4, pan: o.pan, rate: [1, 1.25, 1.12][i], wet: .6, at, dur: .5 })),
  chain: (c, t, o) => [0, .08, .16, .24].forEach((at, i) => S(c, t, "metalM", { g: .45, pan: o.pan, rate: 1 + i * .08, at })),
  clap: (c, t, o) => [0, .14].forEach(at => S(c, t, "woodL", { g: .7, pan: o.pan, rate: 1.3, wet: .3, at })),
  squeeze: (c, t, o) => S(c, t, "slime", { g: .5, pan: o.pan, rate: .8, wet: .3 }),
  mist: (c, t, o) => S(c, t, "breeze", { g: .4, pan: o.pan, rate: .9, dur: .9, wet: .5, lp: 2000 }),
  wish: (c, t, o) => S(c, t, "wish", { g: .5, pan: o.pan, wet: .6 }),
};

/* the verbs of moveFx.js whose drawing makes no sound of its own, and the gestures whose drawing sounds only as light: each is given
   its gesture's sound as the phase begins. A weather, a terrain, a room, a screen and a hazard sound when the line that sets them
   is played (Stage.jsx), and Protect when its guard goes up (stageFx.shield). tests/battleSfx.test.mjs keeps every verb covered. */
const VERB = {
  possess: "eerie", drain: "motes", crack: "quake", guard: "protect", spotlight: "shine", sub: "puff", powder: "mist", hypnosis: "eerie",
  tears: "sob", anger: "growl", glare: "stare", cloud: "mist", curse: "eerie", gust: "wind", clear: "mist", hex: "eerie", lock: "chain",
  feathers: "swoosh", harden: "metal", focus: "shine", speed: "swoosh", sigil: "shine", charm: "sweet", flex: "growl", gears: "gears",
  shell: "crack", blades: "blades", drum: "drum", notes: "song", link: "eerie", chain: "chain", wish: "wish", endure: "growl", clap: "clap",
  squeeze: "squeeze", trap: "squeeze", web: "web",
};
// verbs that sound through the event they set or the drawing they make, named so the test can tell them from a forgotten one
export const EVENT_VERBS = ["protect", "weather", "terrain", "screen", "room", "hazard"];
export const VERB_SOUNDS = VERB;
export const LIBRARY = LIB;
export const CLIPS = SPRITE.clips;

/* ---------------------------------------------------------------- playing ---------------------------------------------------------------- */
const last = new Map();
/* name: a sound of the library; o.at: the stage's ms from now (played at the playback speed), o.dur: how long it lasts on the stage,
   o.pan: -1 left (ours) to 1 right (theirs), o.type: the move's type. The same sound is not stacked inside 45 ms. */
export function sfx(name, o = {}) {
  const ch = UI.has(name) ? "ui" : "fx";
  const make = LIB[name], ctx = make && heard(ch) && ready(ALWAYS.has(name));
  if (!ctx) return;
  [bus, wetIn] = buses[ch];
  const t = ctx.currentTime + .008 + Math.max(0, o.at || 0) * (speed || 1) / 1000;
  const key = name + (o.type || "");
  if (Math.abs((last.get(key) ?? -1) - t) < .045) return;
  last.set(key, t);
  if (DUCK[name]) duck(DUCK[name] * (speed || 1), -7, t - ctx.currentTime);
  try { make(ctx, t, { ...o, type: o.type ? String(o.type).toLowerCase() : moveType, sec: o.dur ? o.dur * speed / 1000 : 0, k: speed }); } catch (err) { console.warn("sfx", name, err); /* a sound that fails is let go, never the battle */ }
}
export function verbSound(verb, o = {}) { const name = VERB[verb]; if (name) sfx(name, o); }
/* a field or a side's condition going up (Stage.jsx "field" and "side"): a terrain sings its type, a room bends, a screen rings, a
   hazard is laid stone by stone, Tailwind blows; one that ends falls away. Trick Room's own sound plays with its twist (stageFx). */
const TERRAIN = { electricterrain: "electric", grassyterrain: "grass", mistyterrain: "fairy", psychicterrain: "psychic" };
const SIDE = { reflect: ["screen", 988], lightscreen: ["screen", 1319], auroraveil: ["screen", 1175], safeguard: ["screen", 1568], mist: ["screen", 1568], luckychant: ["screen", 1568],
  tailwind: ["wind"], stealthrock: ["rocks"], spikes: ["spikes"], toxicspikes: ["st_psn"], stickyweb: ["web"], wideguard: ["protect"], quickguard: ["protect"], craftyshield: ["protect"], matblock: ["protect"] };
export function conditionSound(id, on, pan = 0) {
  if (!on) { sfx("fieldOff"); return; }
  if (TERRAIN[id]) sfx("terrain", { type: TERRAIN[id] });
  else if (/room$|^gravity$/.test(id)) { if (id !== "trickroom") sfx("room"); }
  else if (SIDE[id]) sfx(SIDE[id][0], { f: SIDE[id][1], pan, type: id === "toxicspikes" ? "poison" : undefined });
  else sfx("shine", { pan, type: "normal" });
}
