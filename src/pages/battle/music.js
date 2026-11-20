/* 배틀의 배경음악 (DESIGN.md "Battle", Sound). 한 작곡가의 한 묶음(LemonheadVGM, CC0)을 scripts/build-music.py가 public/music/에 둔다:
   lobby(대기실과 선출), battle(배틀), pinch(마지막 한 마리와 수문장), tower(도전의 탑의 선출, 문, 쉼), win과 lose(결과의 짧은 곡).
   울음소리와 같은 AudioContext로 끝없이 돌고, 소리 시트의 배경음악 채널(cries.js channel)을 따른다. 첫 탭 전에는 조용하고,
   곡이 없으면 조용히 넘어간다. 결과의 짧은 곡은 끝까지 울고, 그동안 부른 곡은 그 뒤에 이어진다. */
import { useEffect } from "react";
import { channel, madeAudio, whenAudio } from "./cries.js";

const OAC = typeof window !== "undefined" && (window.OfflineAudioContext || window.webkitOfflineAudioContext);
let dec = null;
const buffers = new Map();
function load(name) {
  if (!OAC) return Promise.resolve(null);
  if (!buffers.has(name)) {
    buffers.set(name, fetch(`${import.meta.env?.BASE_URL ?? "/"}music/${name}.m4a`)
      .then(res => (res.ok ? res.arrayBuffer() : null))
      .then(data => data && new Promise(resolve => (dec ||= new OAC(2, 1, 44100)).decodeAudioData(data, resolve, () => resolve(null))))
      .catch(() => null));
  }
  return buffers.get(name);
}

/* each loop's length in samples, and the PAD of its own sound on each side (scripts/build-music.py): an AAC file's first and last frames
   are not exact, so the seam is played from the middle of the file. Chrome also keeps the encoder's 1024 samples of silence at the
   start of the decoded buffer (2026-11-20, measured against the source) and a decoder that trims them keeps none: the loop is counted
   from the buffer's end, so it stays on the beat either way */
const LENGTH = { lobby: 2869981, battle: 3486238, pinch: 5820944, tower: 4630238 };
const PAD = 2048;
const FADE = .6;
const ONCE = new Set(["win", "lose"]);
let now = null; // { name, src, gain }
let want = null; // the track asked last
let jingle = null; // a result's jingle asked and not yet over: what is asked meanwhile waits for its end
function stopNow(fade = FADE) {
  if (!now) return;
  const { src, gain } = now, c = gain.context, t = c.currentTime;
  gain.gain.cancelScheduledValues(t); gain.gain.setValueAtTime(gain.gain.value, t); gain.gain.linearRampToValueAtTime(0, t + fade);
  try { src.stop(t + fade + .05); } catch { /* already stopped */ }
  now = null;
}
function after(name) { if (jingle === name) { jingle = null; play(want); } }
function play(name) {
  if (!name) { stopNow(); return; }
  if (now?.name === name) return;
  const once = ONCE.has(name);
  Promise.all([load(name), new Promise(resolve => whenAudio(resolve))]).then(([buffer, c]) => {
    if (!buffer) { after(name); return; }
    if (once ? jingle !== name : want !== name || jingle || now?.name === name) return;
    stopNow(once ? .3 : FADE);
    const src = c.createBufferSource(), gain = c.createGain();
    src.buffer = buffer;
    // each track is a whole number of bars, so the loop is the track
    const sr = buffer.sampleRate, end = (buffer.length - PAD) / sr, lead = once ? 0 : end - LENGTH[name] / sr;
    if (!once) { src.loop = true; src.loopStart = lead; src.loopEnd = end; }
    gain.gain.setValueAtTime(0, c.currentTime); gain.gain.linearRampToValueAtTime(1, c.currentTime + (once ? .02 : FADE));
    src.connect(gain).connect(channel(c, "music"));
    src.start(0, lead);
    const playing = now = { name, src, gain };
    if (once) src.onended = () => { if (now === playing) now = null; after(name); };
  });
}
/* name: the track to play now (null for silence). A jingle (win, lose) cuts what plays, and what is asked while it plays waits for its end */
export function music(name) {
  // a jingle before the sound has woken would play at the first touch, long after its moment
  if (ONCE.has(name)) { if (madeAudio()) { jingle = name; play(name); } return; }
  want = name;
  if (!jingle) play(name);
}
// a scene's track while it is on screen
export function useMusic(name) {
  useEffect(() => { music(name); }, [name]);
  useEffect(() => () => music(null), []);
}
