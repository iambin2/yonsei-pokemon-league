/* 포켓몬의 울음소리 (DESIGN.md "Battle", Sound). 효과음(sfx.js)도 이 AudioContext 하나로 운다. 나올 때와 쓰러질 때 운다(쓰러질 때는 낮게). 소리는 PokeOS의 HOME 울음소리를
   scripts/build-cries.py가 public/cries/<도감 번호>.m4a로 받아 둔 것이고, Web Audio로 튼다. 브라우저는 손길 없이 소리를 내지 않으므로
   첫 탭이 소리를 깨운다. 그 전이나 파일이 없으면 조용히 넘어가고, 무대는 울음이 끝날 때까지 기다린다(cry가 그때 풀린다). */
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
/* the first AudioContext of a browser's session waits on the audio service starting: half a second with the page frozen (2026-11-10,
   measured on Windows: 620 in the constructor, the whole first visit to the battle page). Asking for the device list first starts
   that service without holding the page (a promise, no prompt, nothing read from it), and the context is then made in 40: primeAudio
   resolves once it is there. The stage calls it as the battle page mounts (stageFx prewarm) */
let primed = null;
export function primeAudio(idle = () => Promise.resolve()) {
  if (!AC || !touched()) return Promise.resolve(null);
  return (primed ||= Promise.resolve(ctx ? null : navigator.mediaDevices?.enumerateDevices?.()).catch(() => null).then(idle).then(() => audio()));
}
// the 소리 chip (BattlePage.jsx): cries and every effect sound go quiet together, remembered on the device
const SOUND_KEY = "ypl-battle:audio"; // not the old "ypl-battle:sound", which saved "off" for every visitor of the first sound
let on = (() => { try { return localStorage.getItem(SOUND_KEY) !== "off"; } catch { return true; } })();
export const soundOn = () => on;
export function setSoundOn(value) { on = Boolean(value); try { localStorage.setItem(SOUND_KEY, on ? "on" : "off"); } catch { /* the next visit sounds */ } if (on) audio()?.resume?.().catch(() => {}); }
const wake = () => { const c = audio(); if (c && c.state !== "running") c.resume().catch(() => {}); };
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
      .catch(() => null));
  }
  return buffers.get(num);
}

// plays the cry and resolves when it has been heard (rate under 1 is lower and longer); a cry not ready in a moment is let go
export async function cry(num, rate = 1) {
  const buffer = await Promise.race([loadCry(num), new Promise(resolve => setTimeout(resolve, 400))]);
  if (!buffer || !on || ctx?.state !== "running") return;
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  src.playbackRate.value = rate;
  src.connect(ctx.destination);
  await new Promise(resolve => { src.onended = resolve; src.start(); setTimeout(resolve, buffer.duration / rate * 1000 + 300); });
}
