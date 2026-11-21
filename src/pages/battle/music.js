/* 배틀의 배경음악 (DESIGN.md "Battle", Sound). 코드로 지은 한 벌(2026-11-21, 운영자가 고른 시안 C: 전광판 램프 같은 부드러운 펄스)을
   scripts/compose-music.py가 public/music/에 둔다:
   lobby(대기실과 선출), battle(배틀), tower(도전의 탑의 선출, 문, 쉼). 승패는 음악이 아니라 효과음이 알린다(sfx.js win, lose).
   울음소리와 같은 AudioContext로 끝없이 돌고, 소리 시트의 배경음악 채널(cries.js channel)을 따른다. 첫 탭 전에는 조용하고,
   곡이 없으면 조용히 넘어간다. */
import { useEffect } from "react";
import { channel, whenAudio } from "./cries.js";

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

/* each loop's length in samples, and the PAD of its own sound on each side (scripts/compose-music.py prints them): an AAC file's first and last frames
   are not exact, so the seam is played from the middle of the file. Chrome also keeps the encoder's 1024 samples of silence at the
   start of the decoded buffer (2026-11-20, measured against the source) and a decoder that trims them keeps none: the loop is counted
   from the buffer's end, so it stays on the beat either way */
const LENGTH = { battle: 1282909, lobby: 920348, tower: 1568000 };
const PAD = 2048;
/* a track comes in slowly and goes out quicker (2026-11-21, the owner: "갑자기 재생되는 것 같고"): in over 2.4 s, only a sixth of the
   way up in its first second, out over 1.2 s under the next one coming in */
const FADE = 1.2, FADE_IN = 2.4;
let now = null; // { name, src, gain }
let want = null; // the track asked last
function stopNow(fade = FADE) {
  if (!now) return;
  const { src, gain } = now, c = gain.context, t = c.currentTime;
  gain.gain.cancelScheduledValues(t); gain.gain.setValueAtTime(gain.gain.value, t); gain.gain.linearRampToValueAtTime(0, t + fade);
  try { src.stop(t + fade + .05); } catch { /* already stopped */ }
  now = null;
}
/* name: the track to play now, faded in over the one before (null for silence) */
export function music(name) {
  want = name;
  if (!name) { stopNow(); return; }
  if (now?.name === name) return;
  Promise.all([load(name), new Promise(resolve => whenAudio(resolve))]).then(([buffer, c]) => {
    if (!buffer || want !== name || now?.name === name) return;
    stopNow();
    const src = c.createBufferSource(), gain = c.createGain();
    src.buffer = buffer;
    // the loop is whole bars (compose-music.py): the track starts on its first bar and comes back to it
    const sr = buffer.sampleRate, end = (buffer.length - PAD) / sr, lead = end - LENGTH[name] / sr;
    src.loop = true; src.loopStart = lead; src.loopEnd = end;
    const t = c.currentTime; // ramps, not a value curve: a fade out may cut in at any moment (stopNow)
    gain.gain.setValueAtTime(0, t); gain.gain.linearRampToValueAtTime(.15, t + FADE_IN * .42); gain.gain.linearRampToValueAtTime(1, t + FADE_IN);
    src.connect(gain).connect(channel(c, "music"));
    src.start(0, lead);
    now = { name, src, gain };
  });
}
// a scene's track while it is on screen
export function useMusic(name) {
  useEffect(() => { music(name); }, [name]);
  useEffect(() => () => music(null), []);
}
