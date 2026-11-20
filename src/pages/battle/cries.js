/* 포켓몬의 울음소리 (DESIGN.md "Battle", Sound). 효과음(sfx.js)도 이 AudioContext 하나로 운다. 나올 때와 쓰러질 때 운다(쓰러질 때는 낮게). 소리는 PokeOS의 HOME 울음소리를
   scripts/build-cries.py가 public/cries/<도감 번호>.m4a로 받아 둔 것이고, Web Audio로 튼다. 브라우저는 손길 없이 소리를 내지 않으므로
   첫 탭이 소리를 깨운다. 그 전이나 파일이 없으면 조용히 넘어가고, 무대는 울음이 끝날 때까지 기다린다(cry가 그때 풀린다). */
import CRY_DB from "./cryLevels.js";

const AC = typeof window !== "undefined" && (window.AudioContext || window.webkitAudioContext);
let ctx = null;
// a page no hand has touched yet cannot sound, so it makes no context: the first gesture makes it (wake below)
const touched = () => typeof navigator === "undefined" || !navigator.userActivation || navigator.userActivation.hasBeenActive;
const buffers = new Map();
/* the one context, made only once a hand has touched the page (touched below): before that the browser holds any context silent,
   and making one woke the sound device in the middle of a replay's opening (2026-11-18, 180 to 270 ms at a phone's speed). whenAudio:
   told when it is made (the replay bar's sound key follows it) */
const waiting = [];
export function audio() {
  if (!ctx && AC && touched()) { ctx = new AC(); waiting.splice(0).forEach(fn => fn(ctx)); }
  return ctx;
}
export const whenAudio = fn => { if (ctx) fn(ctx); else waiting.push(fn); };
// the context if it is made, never making it: a sound or a key asked before primeAudio made it at once, with the audio service still
// asleep (2026-11-18: 340 ms of a replay's opening at a phone's speed, 23 once the device list had been asked)
export const madeAudio = () => ctx;
/* the first AudioContext of a browser's session waits on the audio service starting: half a second with the page frozen (2026-11-10,
   measured on Windows: 620 in the constructor, the whole first visit to the battle page). Asking for the device list first starts
   that service without holding the page (a promise, no prompt, nothing read from it), and the context is then made in 40: primeAudio
   resolves once it is there. The stage calls it as the battle page mounts (stageFx prewarm) */
let primed = null;
export function primeAudio(idle = () => Promise.resolve()) {
  if (!AC || !touched()) return Promise.resolve(null);
  return (primed ||= Promise.resolve(ctx ? null : navigator.mediaDevices?.enumerateDevices?.()).catch(() => null).then(idle).then(() => audio()));
}
/* the sound sheet (BattlePage.jsx SoundSheet, 2026-11-20): 전체 and four channels, each a level 0 to 1 and a mute, remembered on the
   device. 배경음악 (music.js), 울음소리 (cry below), 기술 효과음 and 알림음 (sfx.js: the keys, the clock, the turn, the lamps and the result
   are 알림음, every other sound 기술 효과음). Each channel is one gain into 전체's, made on the live context as a sound first needs it */
export const CHANNELS = [["all", "전체"], ["music", "배경음악"], ["cry", "울음소리"], ["fx", "기술 효과음"], ["ui", "알림음"]];
const MIX_KEY = "ypl-battle:mix";
const MIX_DEFAULT = { all: 1, music: .5, cry: 1, fx: 1, ui: 1 };
let mix = (() => {
  const m = Object.fromEntries(CHANNELS.map(([k]) => [k, { v: MIX_DEFAULT[k], mute: false }]));
  try {
    const saved = JSON.parse(localStorage.getItem(MIX_KEY) || "null");
    if (saved) for (const [k] of CHANNELS) if (saved[k]) m[k] = { v: Math.min(1, Math.max(0, Number(saved[k].v) || 0)), mute: Boolean(saved[k].mute) };
    // the 소리 switch before the sheet ("ypl-battle:audio" off) is 전체 muted
    else if (localStorage.getItem("ypl-battle:audio") === "off") m.all.mute = true;
  } catch { /* the defaults */ }
  return m;
})();
const level = k => (mix[k].mute ? 0 : mix[k].v);
export const mixOf = () => mix;
// a channel that would make no sound is not played at all (no node is built for it)
export const heard = k => level("all") > 0 && level(k) > 0;
export const soundOn = () => !mix.all.mute;
const gains = new Map();
/* the mix's end (2026-11-20, measured with earshot on a recorded battle: the output reached +1.4 dBTP with 2,763 clipped samples, the
   cries 10 dB over the music): 전체 goes through a limiter before the speakers, and the music through its own duck (duck below) */
function master(c) {
  const lim = c.createDynamicsCompressor();
  lim.threshold.value = -6; lim.knee.value = 0; lim.ratio.value = 20; lim.attack.value = .001; lim.release.value = .12;
  const g = c.createGain(); g.gain.value = level("all");
  // the compressor has no look-ahead, so its first milliseconds overshoot (-1.1 dBTP measured): 1 dB under it keeps the peaks inside -1
  const trim = c.createGain(); trim.gain.value = .89;
  g.connect(lim).connect(trim).connect(c.destination);
  gains.set("all", g);
  const d = c.createGain(); d.connect(g); gains.set("duck", d);
}
// the channel's input on the live context: its gain, made as a sound first needs it
export function channel(c, k) {
  if (!gains.has("all")) master(c);
  if (!gains.has(k)) { const g = c.createGain(); g.gain.value = level(k); g.connect(gains.get(k === "music" ? "duck" : "all")); gains.set(k, g); }
  return gains.get(k);
}
/* the music steps back while a cry or a big moment sounds (from at seconds on, db down for hold seconds, then back over a quarter of a second), so they
   are heard over it; the steps never stack lower than the deepest one asked */
let duckUntil = 0;
export function duck(hold = .6, db = -7, at = 0) {
  const d = gains.get("duck");
  if (!d) return;
  const t = d.context.currentTime + at, until = Math.max(duckUntil, t + hold);
  d.gain.cancelScheduledValues(t);
  d.gain.setTargetAtTime(10 ** (db / 20), t, .04);
  d.gain.setTargetAtTime(1, until, .25);
  duckUntil = until;
}
const listeners = new Set();
export const onMix = fn => { listeners.add(fn); return () => listeners.delete(fn); };
export function setMix(k, patch) {
  mix = { ...mix, [k]: { ...mix[k], ...patch } };
  try { localStorage.setItem(MIX_KEY, JSON.stringify(mix)); } catch { /* the next visit has the defaults */ }
  gains.get(k)?.gain.setTargetAtTime(level(k), ctx.currentTime, .03);
  if (level(k) > 0) audio()?.resume?.().catch(() => {});
  listeners.forEach(fn => fn(mix));
}
export const setSoundOn = value => setMix("all", { mute: !value });
/* the first touch of a page that loaded untouched does not make the context in its own task: made there, it held the click that opens
   도전의 탑 for 346 ms at a phone's speed and froze the tower's entrance (2026-11-19). It is primed (the audio service woken, then made in
   an idle moment once what the touch opened has come in: an idle moment alone fell inside the tower's 1.78 s entrance, still 290 ms);
   a later touch resumes it, which iOS asks of a gesture. A sound asked before then is not heard, as before any touch */
const idle = () => new Promise(resolve => setTimeout(() => (typeof requestIdleCallback === "function" ? requestIdleCallback(() => resolve(), { timeout: 3000 }) : resolve()), 2200));
const wake = () => { if (!ctx) { primeAudio(idle); return; } if (ctx.state !== "running") ctx.resume().catch(() => {}); };
/* a touch's pointerdown does not count as the user's gesture (only its end does: pointerup, touchend, click), and iOS wakes the
   sound on nothing else, so the context is asked again when the finger lifts */
if (AC) for (const type of ["pointerdown", "pointerup", "touchend", "click", "keydown"]) addEventListener(type, wake, { capture: true, passive: true });

/* the cries are decoded by a context that never sounds: decoding with the one that plays made it, and woke the sound device, on a
   page no hand had touched (2026-11-18: 180 ms of a replay's opening at a phone's speed). A decoded buffer plays in any context */
const OAC = typeof window !== "undefined" && (window.OfflineAudioContext || window.webkitOfflineAudioContext);
let dec = null;
const decoder = () => (dec ||= OAC ? new OAC(1, 1, 44100) : audio());
// fetched and decoded once a number, when the team preview names the Pokémon
export function loadCry(num) {
  if (!num || !AC) return Promise.resolve(null);
  if (!buffers.has(num)) {
    buffers.set(num, fetch(`${import.meta.env?.BASE_URL ?? "/"}cries/${num}.m4a`)
      .then(res => (res.ok ? res.arrayBuffer() : null))
      .then(data => data && new Promise(resolve => decoder().decodeAudioData(data, resolve, () => resolve(null))))
      .then(buffer => buffer && { buffer, gain: CRY_DB[num] != null ? 10 ** (CRY_DB[num] / 20) : levelOf(buffer) })
      .catch(() => null));
  }
  return buffers.get(num);
}

/* the cries' own files differ by 13 dB (2026-11-20, 60 measured: -15.6 to -2.6 LUFS, median -7.3, some over 0 dBTP): each is brought to
   -22 LUFS by the gain scripts/build-cry-levels.py measured (cryLevels.js), or one not measured there from the RMS of its loudest 0.4 s */
const CRY_RMS = 10 ** (-24 / 20);
function levelOf(buffer) {
  const x = buffer.getChannelData(0), win = Math.round(buffer.sampleRate * .4);
  let sum = 0, top = 0;
  for (let i = 0; i < x.length; i++) { sum += x[i] * x[i]; if (i >= win) sum -= x[i - win] * x[i - win]; if (i >= win - 1 || i === x.length - 1) top = Math.max(top, sum / Math.min(win, i + 1)); }
  return top > 0 ? Math.min(4, CRY_RMS / Math.sqrt(top)) : 1;
}
// plays the cry and resolves when it has been heard (rate under 1 is lower and longer); a cry not ready in a moment is let go
export async function cry(num, rate = 1) {
  const loaded = await Promise.race([loadCry(num), new Promise(resolve => setTimeout(resolve, 400))]);
  if (!loaded || !heard("cry") || ctx?.state !== "running") return;
  const { buffer } = loaded, src = ctx.createBufferSource(), g = ctx.createGain();
  src.buffer = buffer;
  src.playbackRate.value = rate;
  g.gain.value = loaded.gain;
  src.connect(g).connect(channel(ctx, "cry"));
  duck(buffer.duration / rate);
  await new Promise(resolve => { src.onended = resolve; src.start(); setTimeout(resolve, buffer.duration / rate * 1000 + 300); });
}
