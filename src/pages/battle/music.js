/* 배틀의 배경음악 (DESIGN.md "Battle", Sound). 코드로 지은 한 벌(2026-11-21, 운영자가 고른 시안 C: 전광판 램프 같은 부드러운 펄스)을
   scripts/compose-music.py가 public/music/에 둔다:
   lobby(대기실과 선출), battle(배틀), tower(도전의 탑의 선출, 문, 쉼). 세 곡은 한 선율을 나눠 쓴다(2026-11-22): 배틀의 후렴이 그 선율이고,
   대기실은 절반 빠르기로 흥얼거리고, 탑은 단조로 바꿔 오른다. 승패는 음악이 아니라 효과음이 알린다(sfx.js win, lose).
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
const LENGTH = { battle: 4089273, lobby: 3848727, tower: 3024000 };
/* the battle's way in is its own last four bars (a heartbeat that builds, one beat of nothing, the drop): the track starts there and
   falls into its first bar, where every later round comes back to */
const INTRO = { battle: 240545 };
/* what a battle adds when it runs hot (2026-11-22, 전황 연동): a second loop of the same length played in step over the first, silent
   until asked for (a shaker, a high ostinato, a bell over the tune). hot 0 to 1 is how much of it is heard */
const LAYER = { battle: "battle-heat" };
const PAD = 2048;
/* a track comes in slowly and goes out quicker (2026-11-21, the owner: "갑자기 재생되는 것 같고"): in over 2.4 s, only a sixth of the
   way up in its first second, out over 1.2 s under the next one coming in. The hot layer comes and goes over a bar (HEAT) */
const FADE = 1.2, FADE_IN = 2.4, HEAT = 1.4;
let now = null; // { name, srcs, gain, over }
let want = null, hot = 0; // the track asked last, and how hot
function stopNow(fade = FADE) {
  if (!now) return;
  const { srcs, gain } = now, t = gain.context.currentTime;
  gain.gain.cancelScheduledValues(t); gain.gain.setValueAtTime(gain.gain.value, t); gain.gain.linearRampToValueAtTime(0, t + fade);
  for (const src of srcs) try { src.stop(t + fade + .05); } catch { /* already stopped */ }
  now = null;
}
/* name: the track to play now, faded in over the one before (null for silence); heat: 0 to 1, how much of its hot layer */
export function music(name, heat = 0) {
  want = name; hot = heat;
  if (!name) { stopNow(); return; }
  if (now?.name === name) { if (now.over) { const g = now.over.gain, t = now.over.context.currentTime; g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(hot, t + HEAT); } return; }
  Promise.all([load(name), LAYER[name] ? load(LAYER[name]) : null, new Promise(resolve => whenAudio(resolve))]).then(([buffer, layer, c]) => {
    if (!buffer || want !== name || now?.name === name) return;
    stopNow();
    const gain = c.createGain(), t = c.currentTime + .05; // both loops start on the same sample
    const play = (buf, into) => {
      const src = c.createBufferSource(); src.buffer = buf;
      // the loop is whole bars (compose-music.py): it comes back to its first bar
      const sr = buf.sampleRate, end = (buf.length - PAD) / sr;
      src.loop = true; src.loopStart = end - LENGTH[name] / sr; src.loopEnd = end;
      src.connect(into); src.start(t, end - (INTRO[name] ?? LENGTH[name]) / sr);
      return src;
    };
    const srcs = [play(buffer, gain)];
    let over = null;
    if (layer) { over = c.createGain(); over.gain.value = hot; over.connect(gain); srcs.push(play(layer, over)); }
    // ramps, not a value curve: a fade out may cut in at any moment (stopNow)
    gain.gain.setValueAtTime(0, t); gain.gain.linearRampToValueAtTime(.15, t + FADE_IN * .42); gain.gain.linearRampToValueAtTime(1, t + FADE_IN);
    gain.connect(channel(c, "music"));
    now = { name, srcs, gain, over };
    // the battle's two loops are fetched and decoded while the lobby plays, not as the leads come out: decoding them then stood in the
    // way of the first cries, which are let go when not ready in a moment (cries.js cry)
    if (name === "lobby") { load("battle"); load(LAYER.battle); }
  });
}
// a scene's track while it is on screen, and how hot it runs
export function useMusic(name, heat = 0) {
  useEffect(() => { music(name, heat); }, [name, heat]);
  useEffect(() => () => music(null), []);
}
