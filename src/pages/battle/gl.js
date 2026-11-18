/* 배틀 무대의 그래픽 엔진 (DESIGN.md "Battle"). 경기장, 포켓몬, 기술, 날씨와 필드, 카메라를 WebGL2 캔버스 한 장에 한 시계로 그린다.
   - 파티클은 GPU에서 산다: 태어날 때 위치, 속도, 가속, 수명, 크기, 색의 길(ramp)을 한 번 적어 두면 셰이더가 매 프레임 자리를 계산한다.
     그래서 수천 개가 날아도 자바스크립트는 아무것도 하지 않고, 히트 스톱과 슬로 모션은 시계 하나를 늦추는 것으로 끝난다.
   - 리본(빔, 번개, 베기의 궤적, 물줄기)은 매 프레임 몇백 개의 꼭짓점으로 다시 짓는다.
   - 포켓몬은 텍스처 한 장의 사각형이다: 번쩍임, 물들임, 흑백, 윤곽의 빛, 바닥 아래로 가라앉기, 바닥의 반사, 잔상.
   - 빛나는 것만 따로 모아 블룸을 얹고, 충격파와 열기는 장면을 굴절시킨다. 라이트 테마에서는 빛이 물감처럼 덮인다.
   - 카메라는 임계 감쇠 스프링이다: 목표가 바뀌어도 속도가 끊기지 않아 꺾임이 없다. 흔들림은 부드러운 잡음(trauma)이다.
   좌표는 무대의 CSS 픽셀(넓은 화면일 때의 자리)이다. DOM의 자리(.bs-slot)는 배치와 누르기만 맡는다. */
import { reduced } from "../../components/common/motion.js";
import { inkBoxOf } from "../../components/common/inkCentre.js";
import { C, GRID, ROWS, TEX, MATERIALS, atlasStep, atlasNow } from "./atlas.js";
export { TEX, MATERIALS, atlasStep, atlasPainted } from "./atlas.js";

export const TYPE_COLOR = {
  normal: "#E8ECF4", fire: "#FF6A1F", water: "#2F8CFF", electric: "#FFD21A", grass: "#56D23A", ice: "#7FEBFF", fighting: "#FF7A2A",
  poison: "#B455F0", ground: "#D89A4A", flying: "#9CCBFF", psychic: "#FF4F93", bug: "#B5C824", rock: "#C9B98A", ghost: "#A35CF0",
  dragon: "#6A72FF", dark: "#8A6BB8", steel: "#B8DDEE", fairy: "#FF8AE8",
};
export const DEEP = {
  normal: "#8FA3C8", fire: "#C4160A", water: "#0B47B8", electric: "#E07A00", grass: "#1E7A18", ice: "#1E8FD6", fighting: "#B83A00",
  poison: "#5E1E9C", ground: "#7A4310", flying: "#3A6FC0", psychic: "#A8104E", bug: "#5E7A0A", rock: "#6A5A2A", ghost: "#3E1478",
  dragon: "#2A2FB0", dark: "#24163E", steel: "#3E7F9C", fairy: "#C02FA8",
};
export const TYPES = Object.keys(TYPE_COLOR);
export const typeId = t => String(t || "normal").toLowerCase();

export const rand = (a, b) => a + Math.random() * (b - a);
export const lerp = (a, b, t) => a + (b - a) * t;
export const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const pick = v => (Array.isArray(v) ? rand(v[0], v[1]) : v);
export const EASE = {
  linear: t => t,
  in: t => t * t * t,
  in2: t => t * t,
  out: t => 1 - (1 - t) ** 3,
  out2: t => 1 - (1 - t) ** 2,
  out5: t => 1 - (1 - t) ** 5,
  inout: t => (t < .5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2),
  sine: t => -(Math.cos(Math.PI * t) - 1) / 2,
  back: t => { const c = 1.70158; return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2; },
  expo: t => (t >= 1 ? 1 : 1 - 2 ** (-10 * t)),
};
const hex = (c, a = 1) => { const n = parseInt(c.slice(1), 16); return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255, a]; };
export const colorOf = t => TYPE_COLOR[typeId(t)] || (String(t).startsWith("#") ? t : TYPE_COLOR.normal);

/* ---------------------------------------------------------------- colour over a life ---------------------------------------------------------------- */
// a ramp is the colour and alpha a particle passes through from birth (0) to death (1)
const RAMPS = [];
export const RAMP = {};
const ramp = (name, stops) => { RAMP[name] = RAMPS.length; RAMPS.push(stops); };
// light: a white heart, the colour, its deep tone, gone. matter: its colour held, fading at the end
for (const t of TYPES) {
  ramp(t, [[0, "#FFFFFF", 0], [.06, "#FFFFFF", 1], [.22, TYPE_COLOR[t], 1], [.7, DEEP[t], .6], [1, DEEP[t], 0]]);
  ramp(`${t}.m`, [[0, TYPE_COLOR[t], 0], [.08, TYPE_COLOR[t], 1], [.7, TYPE_COLOR[t], .9], [1, DEEP[t], 0]]);
  ramp(`${t}.h`, [[0, TYPE_COLOR[t], 0], [.15, TYPE_COLOR[t], 1], [.85, TYPE_COLOR[t], 1], [1, TYPE_COLOR[t], 0]]);
}
// the pale types' light held at a deeper tone, halfway to their deep colour (2026-11-07 round 4: Flying's, Steel's and Ice's own colours
// are almost white, and a blow's star and streaks of them over a pale body summed to a white body)
const mid = (a, b) => "#" + [1, 3, 5].map(i => Math.round((parseInt(a.slice(i, i + 2), 16) + parseInt(b.slice(i, i + 2), 16)) / 2).toString(16).padStart(2, "0")).join("");
for (const t of ["flying", "steel", "ice", "rock"]) { const m = mid(TYPE_COLOR[t], DEEP[t]); ramp(`${t}.d`, [[0, m, 0], [.08, m, 1], [.75, m, .9], [1, DEEP[t], 0]]); }
// a blow of no type is lit warm, the games' pale gold (its type colour is almost white, and stacked light of it read as a white-out)
ramp("normal.m", [[0, "#F5C85A", 0], [.08, "#F5C85A", 1], [.7, "#F0BC48", .9], [1, "#C88A10", 0]]);
ramp("normal.h", [[0, "#FFD978", 0], [.15, "#FFD978", 1], [.85, "#FFD06A", 1], [1, "#FFD06A", 0]]);
ramp("fire", [[0, "#FFF0B0", 0], [.04, "#FFE070", 1], [.14, "#FFA030", 1], [.36, "#FF6A1A", .95], [.6, "#D8300E", .7], [.85, "#5A1E14", .35], [1, "#2A1410", 0]]);
ramp("blue", [[0, "#FFFFFF", 0], [.05, "#E6F4FF", 1], [.25, "#7FD0FF", 1], [.6, "#2F6BFF", .7], [1, "#1A2A8A", 0]]);
ramp("smoke", [[0, "#9AA3B4", 0], [.15, "#7C8597", .6], [.6, "#4E5566", .4], [1, "#2E3340", 0]]);
ramp("smoke.l", [[0, "#F2F4F8", 0], [.15, "#E2E6EE", .7], [.6, "#C8CFDB", .45], [1, "#AEB6C4", 0]]);
ramp("dust", [[0, "#F2E2C2", 0], [.12, "#E4CDA4", .8], [.6, "#CBB085", .5], [1, "#A88C64", 0]]);
// a sandstorm's drifting dust: it ends where it starts, so its loop has no seam
ramp("dust.c", [[0, "#C9A06A", .6], [.5, "#A8804E", .42], [1, "#C9A06A", .6]]);
ramp("steam", [[0, "#FFFFFF", 0], [.15, "#EAF4FF", .55], [1, "#BFD6EE", 0]]);
ramp("spray", [[0, "#FFFFFF", 0], [.05, "#F4FBFF", 1], [.4, "#9ED4FF", .85], [1, "#2F7BE0", 0]]);
ramp("white", [[0, "#FFFFFF", 0], [.05, "#FFFFFF", 1], [.6, "#FFFFFF", .7], [1, "#FFFFFF", 0]]);
ramp("white.h", [[0, "#FFFFFF", 0], [.1, "#FFFFFF", 1], [.9, "#FFFFFF", 1], [1, "#FFFFFF", 0]]);
ramp("flash", [[0, "#FFFFFF", 0], [.02, "#FFFFFF", 1], [.12, "#FFF6D8", .3], [.3, "#FFFFFF", 0], [1, "#FFFFFF", 0]]);
// a Pokémon called back: the red light of its ball, white at its heart
ramp("recall", [[0, "#FFFFFF", 0], [.05, "#FFE4E4", 1], [.22, "#FF5A5A", 1], [.65, "#D81E2A", .7], [1, "#5A0A12", 0]]);
ramp("recall.h", [[0, "#FF4A4A", 0], [.12, "#FF4A4A", 1], [.85, "#FF2A36", 1], [1, "#C41422", 0]]);
ramp("shadow", [[0, "#1A0E2E", 0], [.1, "#120A22", .85], [.7, "#0A0614", .6], [1, "#000000", 0]]);
ramp("scorch", [[0, "#2A1A12", 0], [.1, "#1E140E", .7], [.7, "#1E140E", .55], [1, "#1E140E", 0]]);
ramp("rainbow", [[0, "#FF3B3B", 0], [.1, "#FF3B3B", 1], [.27, "#FFC21A", 1], [.44, "#4FD836", 1], [.61, "#3FD8FF", 1], [.78, "#7060FF", 1], [.92, "#FF70F0", .8], [1, "#FF70F0", 0]]);
ramp("gold", [[0, "#FFFFFF", 0], [.06, "#FFF6C8", 1], [.3, "#FFD24A", 1], [.75, "#C88A10", .7], [1, "#6A4A08", 0]]);
ramp("aurora", [[0, "#7FFFD4", 0], [.15, "#7FFFD4", .8], [.4, "#7FD0FF", .9], [.65, "#C08AFF", .8], [.85, "#FF8AE8", .5], [1, "#FF8AE8", 0]]);
ramp("lamp", [[0, "#FFF4D6", 0], [.5, "#FFF4D6", 1], [1, "#FFF4D6", 0]]);
ramp("crowdflash", [[0, "#FFFFFF", 0], [.9, "#FFFFFF", 0], [.91, "#FFFFFF", 1], [.94, "#FFFFFF", .3], [.96, "#FFFFFF", 0], [1, "#FFFFFF", 0]]);
ramp("pulse", [[0, "#FFFFFF", .5], [.5, "#FFFFFF", 1], [1, "#FFFFFF", .5]]);
ramp("rain", [[0, "#CFE6FF", 0], [.1, "#CFE6FF", .9], [.9, "#9CC8FF", .9], [1, "#9CC8FF", 0]]);
ramp("rain.l", [[0, "#4F7FC8", 0], [.1, "#4F7FC8", .9], [.9, "#3A68B0", .9], [1, "#3A68B0", 0]]);
ramp("grass.d", [[0, "#2F7D2A", 0], [.08, "#2F7D2A", 1], [.9, "#3B9434", 1], [1, "#3B9434", 0]]);
ramp("grass.e", [[0, "#6CEBB0", 0], [.08, "#6CEBB0", 1], [.9, "#4FD89A", 1], [1, "#4FD89A", 0]]);
ramp("grass.l", [[0, "#5FAE45", 0], [.08, "#5FAE45", 1], [.9, "#74C255", 1], [1, "#74C255", 0]]);
ramp("sunlit", [[0, "#FFF4C8", 0], [.25, "#FFE9A0", .8], [.5, "#FFF4C8", 1], [.75, "#FFE9A0", .8], [1, "#FFF4C8", 0]]);
ramp("psy.wave", [[0, "#FF7AC8", 0], [.2, "#FF7AC8", .9], [.6, "#C77DFF", .7], [1, "#8F6BFF", 0]]);
ramp("electric.d", [[0, "#E0A100", 0], [.08, "#E0A100", 1], [.9, "#C98F00", 1], [1, "#C98F00", 0]]);
ramp("caltrop", [[0, "#E6ECF5", 0], [.08, "#E6ECF5", 1], [.9, "#C9D3E2", 1], [1, "#C9D3E2", 0]]);
ramp("toxic.h", [[0, "#C77DFF", 0], [.08, "#C77DFF", 1], [.9, "#A64FEA", 1], [1, "#A64FEA", 0]]);
ramp("stone.l", [[0, "#C8B58C", 0], [.08, "#C8B58C", 1], [.85, "#A8946A", 1], [1, "#A8946A", 0]]);
ramp("stone", [[0, "#9A8866", 0], [.08, "#9A8866", 1], [.85, "#7A6A4A", 1], [1, "#6A5A3A", 0]]);
ramp("iron", [[0, "#6A7488", 0], [.08, "#6A7488", 1], [.9, "#4E586C", 1], [1, "#4E586C", 0]]);
ramp("iron.l", [[0, "#AEB8CC", 0], [.08, "#AEB8CC", 1], [.9, "#98A4BA", 1], [1, "#98A4BA", 0]]);
ramp("snow", [[0, "#FFFFFF", 0], [.1, "#FFFFFF", 1], [.9, "#EAF6FF", 1], [1, "#EAF6FF", 0]]);
// Protect's panes: a pale sky blue that holds, and the deep blue violet its ball sinks into at the rim
ramp("guard", [[0, "#B4DCFF", 0], [.12, "#B4DCFF", 1], [.8, "#A6D2FF", 1], [1, "#A6D2FF", 0]]);
ramp("guard.rim", [[0, "#5A5CE8", 0], [.12, "#5A5CE8", .9], [.8, "#3F3FC0", .8], [1, "#3F3FC0", 0]]);
ramp("sand", [[0, "#E8C890", 0], [.1, "#D8B070", .9], [.9, "#B88A4A", .8], [1, "#B88A4A", 0]]);
ramp("sunray", [[0, "#FFF2C0", 0], [.5, "#FFE08A", .55], [1, "#FFF2C0", 0]]);
ramp("toxic", [[0, "#E8B0FF", 0], [.1, "#C070F0", 1], [.6, "#8A2EC8", .8], [1, "#4A1070", 0]]);
ramp("mist", [[0, "#FFE0FA", 0], [.3, "#FFD0F6", .5], [.7, "#F0B0F0", .45], [1, "#F0B0F0", 0]]);
ramp("ink", [[0, "#2A1A4A", 0], [.1, "#1A0E30", .9], [.7, "#120A22", .7], [1, "#000000", 0]]);
/* lit matter (2026-11-06 remake, from 포켓몬 챔피언스): the colour a lit thing is made of, its light coming from its surface */
// a billow of fire: white-hot as it bursts, yellow, orange, red, and a brown smoke as it cools
ramp("fire.b", [[0, "#FFFBE0", 0], [.04, "#FFF6C0", 1], [.16, "#FFD24A", 1], [.36, "#FF8A1E", .95], [.6, "#E0400E", .8], [.82, "#6A2A16", .5], [1, "#2A1A14", 0]]);
// a flamethrower's body: orange from the start with a yellow heart, reddening and browning at its edge (white only in its core)
ramp("fire.s", [[0, "#FFD860", 0], [.05, "#FFC23A", 1], [.24, "#FF9426", 1], [.5, "#F2621A", .95], [.76, "#B8360E", .75], [1, "#4A1E14", 0]]);
// the hot heart of a flame that stays bright (a stream's core)
ramp("fire.c", [[0, "#FFFFFF", 0], [.06, "#FFFBE6", 1], [.3, "#FFE27A", 1], [.7, "#FFA531", .8], [1, "#E8541A", 0]]);
ramp("foam", [[0, "#FFFFFF", 0], [.06, "#FFFFFF", 1], [.5, "#E6F6FF", .9], [1, "#BFE4FF", 0]]);
ramp("water.l", [[0, "#D8F0FF", 0], [.06, "#BCE6FF", 1], [.8, "#7CC8FF", .95], [1, "#4AA6F0", 0]]);
ramp("ice.c", [[0, "#F2FCFF", 0], [.06, "#DDF6FF", 1], [.85, "#B4E8FA", 1], [1, "#8FD6F2", 0]]);
ramp("chip", [[0, "#EADFC6", 0], [.06, "#E2D4B4", 1], [.88, "#D6C6A0", 1], [1, "#C2B088", 0]]);
ramp("earth", [[0, "#B88A58", 0], [.06, "#A87C4E", 1], [.88, "#946A40", 1], [1, "#7A5634", 0]]);
ramp("steel.c", [[0, "#F0F4FA", 0], [.06, "#DCE4EE", 1], [.9, "#C4CEDC", 1], [1, "#AEB9C9", 0]]);
ramp("gold.c", [[0, "#FFE9A0", 0], [.06, "#FFD45A", 1], [.9, "#F0B830", 1], [1, "#D89A18", 0]]);
// a shadow ball: nearly black, deep violet, its rim lit violet by the shader
ramp("shadowball", [[0, "#3A1A5A", 0], [.08, "#2A1240", 1], [.85, "#22103A", 1], [1, "#22103A", 0]]);
ramp("magenta", [[0, "#FFFFFF", 0], [.06, "#FFE0F6", 1], [.25, "#FF5ADC", 1], [.7, "#B020C0", .6], [1, "#5A0A70", 0]]);
ramp("magenta.h", [[0, "#E23CCF", 0], [.12, "#E23CCF", 1], [.85, "#B43AE0", 1], [1, "#8A5CFF", 0]]);
ramp("moon", [[0, "#EAF4FF", 0], [.1, "#E2EEFF", 1], [.9, "#D2E2FF", 1], [1, "#D2E2FF", 0]]);
ramp("leaf.c", [[0, "#7ED957", 0], [.06, "#6CCB45", 1], [.88, "#4FAE34", 1], [1, "#3C8A28", 0]]);
ramp("toxic.c", [[0, "#C98AF0", 0], [.06, "#B46BE6", 1], [.88, "#9248CC", 1], [1, "#6E2AA8", 0]]);
ramp("glint", [[0, "#FFFFFF", 0], [.08, "#FFFFFF", 1], [.4, "#FFF6D8", .8], [1, "#FFFFFF", 0]]);
ramp("aurora.v", [[0, "#7FFFE0", 0], [.2, "#7FFFE0", .7], [.45, "#7FD8FF", .8], [.7, "#C8A0FF", .7], [.9, "#FFA8E8", .4], [1, "#FFA8E8", 0]]);
ramp("bar.gold", [[0, "#FFF6D0", 0], [.15, "#FFE89A", 1], [.85, "#FFD45A", 1], [1, "#FFD45A", 0]]);
ramp("bar.pink", [[0, "#FFF0FA", 0], [.15, "#FFD8F2", 1], [.85, "#F0B8FF", 1], [1, "#F0B8FF", 0]]);
const RAMP_ROWS = 128;
let rampsMade = null;
function buildRamps() {
  const W = 256, out = new Uint8Array(W * RAMP_ROWS * 4);
  RAMPS.forEach((stops, row) => {
    for (let x = 0; x < W; x++) {
      const t = x / (W - 1);
      let i = 0; while (i < stops.length - 2 && t > stops[i + 1][0]) i++;
      const [t0, c0, a0] = stops[i], [t1, c1, a1] = stops[Math.min(i + 1, stops.length - 1)];
      const k = t1 > t0 ? clamp((t - t0) / (t1 - t0)) : 0, A = hex(c0), B = hex(c1), o = (row * W + x) * 4;
      for (let c = 0; c < 3; c++) out[o + c] = lerp(A[c], B[c], k) * 255;
      out[o + 3] = lerp(a0, a1, k) * 255;
    }
  });
  return out;
}

/* ---------------------------------------------------------------- shaders ---------------------------------------------------------------- */
const PARTICLE_VS = `#version 300 es
precision highp float;
layout(location=0) in vec2 aQ;
layout(location=1) in vec4 iA; layout(location=2) in vec4 iB; layout(location=3) in vec4 iC;
layout(location=4) in vec4 iD; layout(location=5) in vec4 iE; layout(location=6) in vec4 iF;
uniform mat3 uView; uniform float uTime, uLayer, uPass; uniform float uGroups[32]; uniform vec4 uWrap;
out vec2 vUv; out vec2 vQ; out float vK; flat out float vRamp; out float vAlpha; flat out vec4 vM; flat out float vField; flat out vec3 vLit;
void main(){
  int f = int(iE.w + .5);
  bool wrap = (f & 32) != 0;
  // a looping particle's colour starts over each life; a wrapping one keeps travelling (it never jumps back to where it began)
  float age = uTime - iB.w, life = iC.x, run = age;
  if ((f & 1) != 0 && age >= 0.) { age = mod(age, life); if (!wrap) run = age; }
  float layer = float((f >> 1) & 1); float dist = float((f >> 4) & 1);
  if (age < 0. || age > life || abs(layer - uLayer) > .5 || abs(dist - uPass) > .5) { gl_Position = vec4(3., 3., 3., 1.); return; }
  float t = run / 1000., k = age / life, d = iB.z;
  vec2 vel = iA.zw, acc = iB.xy, pos;
  if (d > 0. && (f & 128) == 0) { float e = exp(-d * t); pos = iA.xy + vel * (1. - e) / d + .5 * acc * t * t; vel = vel * e + acc * t; }
  else { pos = iA.xy + vel * t + .5 * acc * t * t; vel += acc * t; }
  // round the stage on both axes, turning over only once the whole of it is out of sight (a cloud is most of the stage wide)
  if (wrap) { float r = .5 * max(iC.y, iC.z) * max(iE.z, 1.); vec2 lo = uWrap.xz - r; pos = lo + mod(pos - lo, uWrap.yw + 2. * r); }
  if ((f & 128) != 0) { float ph = uTime / 1000. * 6.2832 / max(.1, iD.y) + iF.z * 6.2832; pos += vec2(cos(ph * .7) * .45, sin(ph)) * iB.z; }
  float kk = (f & 64) != 0 ? 1. - (1. - k) * (1. - k) : k;
  float size = mix(iC.y, iC.z, kk);
  float ang = iC.w + iD.x * t;
  vec2 q = aQ * vec2(size * iE.z, size) * .5;
  if ((f & 8) != 0) { ang = atan(vel.y, vel.x) + iC.w; q.x *= 1. + iD.y * length(vel) / 1000.; }
  float c = cos(ang), s = sin(ang);
  vec2 w = pos + vec2(c * q.x - s * q.y, s * q.x + c * q.y);
  gl_Position = vec4((uView * vec3(w, 1.)).xy, 0., 1.);
  float tex = iD.z; vec2 cell = vec2(mod(tex, 8.), floor(tex / 8.));
  vUv = (cell + mix(vec2(.006), vec2(.994), aQ * .5 + .5)) / vec2(8., ${ROWS}.);
  vQ = vec2(c * aQ.x - s * aQ.y, s * aQ.x + c * aQ.y); vK = k; vRamp = (iD.w + .5) / ${RAMP_ROWS}.;
  vAlpha = iF.x * uGroups[int(iF.w + .5)];
  vM = vec4(iE.x, iE.y, iF.y, float((f >> 2) & 1));
  vField = iF.w > .5 ? 1. : 0.;
  // a lit thing: its turn (to turn its surface with it), which cell it is (its material), and whether it is lit at all
  vLit = vec3(ang, tex, float((f >> 8) & 1));
}`;
const PARTICLE_FS = `#version 300 es
precision highp float;
in vec2 vUv; in vec2 vQ; in float vK; flat in float vRamp; in float vAlpha; flat in vec4 vM; flat in float vField; flat in vec3 vLit;
uniform sampler2D uAtlas, uRamp, uNormal; uniform float uLight, uPass; uniform vec4 uMat[${ROWS * GRID}];
layout(location=0) out vec4 o0; layout(location=1) out vec4 o1;
void main(){
  vec4 a = texture(uAtlas, vUv); vec4 r = texture(uRamp, vec2(vK, vRamp));
  float m = a.r;
  if (vM.z > 0.) { float th = vM.z * pow(vK, 1.3); m *= smoothstep(th, th + .22, a.g * .8 + a.r * .2); }
  float al = m * r.a * vAlpha;
  if (uPass > .5) { vec2 dir = normalize(vQ + 1e-4); o0 = vec4(max(dir.x, 0.), max(-dir.x, 0.), max(dir.y, 0.), max(-dir.y, 0.)) * al; o1 = vec4(0.); return; }
  vec3 col = r.rgb + a.b * .3;
  if (vLit.z > .5) {
    // lit as the ball is: the light from the upper left in front, a soft fall-off, a highlight, a cool rim; the surface turns with the piece
    vec4 nn = texture(uNormal, vUv); vec4 mt = uMat[int(vLit.y + .5)];
    vec2 q = nn.xy * 2. - 1.; float cs = cos(vLit.x), sn = sin(vLit.x);
    vec3 n = normalize(vec3(cs * q.x - sn * q.y, sn * q.x + cs * q.y, sqrt(max(0., 1. - dot(q, q)))));
    vec3 L = normalize(vec3(-.55, -.62, .56)), H = normalize(L + vec3(0., 0., 1.));
    float diff = max(dot(n, L), 0.), spec = pow(max(dot(n, H), 0.), mt.y) * mt.x, rim = pow(1. - n.z, 2.6) * mt.w;
    // a soft thing (smoke, a billow of fire, mist; its highlight under 10) scatters light through itself and never goes dark
    float shade = mt.y < 9.5 ? .64 + .48 * diff : .36 + .8 * diff;
    col = r.rgb * shade * mix(.82, 1., nn.b) + spec + rim * mix(r.rgb, vec3(.78, .88, 1.), .55);
    // a see-through thing (a drop, a bubble, ice) is clear in its middle and solid at its edge; its highlight stays solid
    al *= mix(1., .3 + .7 * pow(1. - n.z, 1.4), mt.z);
    al = min(1., al + spec * m * r.a * vAlpha * mt.z);
  }
  float emis = vM.x, occ = mix(vM.y, max(vM.y, vM.w > .5 ? .25 : .6), uLight);
  col = mix(col, col * mix(1., .78, 1. - vM.y), uLight);
  o0 = vec4(col * al * max(emis, occ), al * occ);
  o1 = vec4(col * al * emis * (1. - .55 * uLight) * (1. - .85 * vField), al * occ * .6 * (1. - vField));
}`;
const STRIP_VS = `#version 300 es
precision highp float;
layout(location=0) in vec2 aP; layout(location=1) in vec2 aUv; layout(location=2) in vec4 aC; layout(location=3) in vec4 aM;
uniform mat3 uView;
out vec2 vUv; out vec4 vC; flat out vec4 vM;
void main(){ gl_Position = vec4((uView * vec3(aP, 1.)).xy, 0., 1.); vUv = aUv; vC = aC; vM = aM; }`;
const STRIP_FS = `#version 300 es
precision highp float;
in vec2 vUv; in vec4 vC; flat in vec4 vM;
uniform sampler2D uNoise; uniform float uTime, uLight;
layout(location=0) out vec4 o0; layout(location=1) out vec4 o1;
void main(){
  float v = vUv.y, mode = vM.x, core, prof;
  float n = texture(uNoise, vec2(vUv.x * vM.w - uTime * .0016, v * .5 + .5 + uTime * .0003)).r;
  if (mode < .5) { prof = exp(-v * v * 2.6) * (.55 + .9 * n); core = exp(-v * v * 26.) ; }
  else if (mode < 1.5) { prof = exp(-v * v * 5.) * .7; core = exp(-v * v * 60.); }
  else if (mode < 2.5) { prof = (1. - v * v) * (.75 + .5 * n); core = exp(-v * v * 9.) * .9; }
  else if (mode < 3.5) { float e = smoothstep(1., .55 - .35 * n, abs(v)); prof = e; core = e * smoothstep(.55, 1., n) * .8 + exp(-v * v * 12.) * .35; }
  else { prof = smoothstep(1., .9, abs(v)); core = 0.; }
  float al = clamp(prof + core, 0., 1.) * vC.a;
  // a white heart only on the dark stage: on paper it would vanish, so the line keeps its colour through
  // (2026-11-07 round 3: the heart is whitened to sixty percent, so a blade or a beam keeps its type's colour through its middle)
  vec3 col = mix(vC.rgb, vec3(1.), clamp(core, 0., 1.) * .6 * (1. - uLight));
  float emis = vM.y, occ = mix(vM.z, max(vM.z, .5), uLight);
  col = mix(col, col * .8, uLight * (1. - vM.z));
  o0 = vec4(col * al * max(emis, occ), al * occ);
  // a flat pane (a room's wall, a terrain's floor) is a surface, not a light: it never blooms over the Pokémon
  float bloom = mode > 3.5 ? 0. : 1.;
  o1 = vec4(col * al * emis * (1. - .55 * uLight) * bloom, al * occ * .6 * bloom);
}`;
const SPRITE_VS = `#version 300 es
precision highp float;
layout(location=0) in vec2 aQ;
uniform mat3 uView, uModel;
out vec2 vUv; out vec2 vW;
void main(){ vec2 q = aQ * .5 + .5; vec3 w = uModel * vec3(q, 1.); vW = w.xy; gl_Position = vec4((uView * w).xy, 0., 1.); vUv = vec2(q.x, q.y); }`;
const SPRITE_FS = `#version 300 es
precision highp float;
in vec2 vUv; in vec2 vW;
uniform sampler2D uTex; uniform vec2 uTexel; uniform vec4 uUv;
uniform float uAlpha, uFlash, uGray, uBright, uClip, uFloor, uReflect, uDissolve;
uniform vec4 uTint, uRim; uniform sampler2D uNoise;
layout(location=0) out vec4 o0; layout(location=1) out vec4 o1;
float A(vec2 p){ return texture(uTex, p).a; }
void main(){
  if (vW.y > uClip || vW.y < uFloor) discard;
  vec2 uv = uUv.xy + vUv * uUv.zw;
  vec4 c = texture(uTex, uv);
  float rim = 0.;
  if (uRim.a > 0.) {
    float m = 0.; for (int i = 0; i < 8; i++) { float a = float(i) * .785398; m = max(m, A(uv + vec2(cos(a), sin(a)) * uTexel * 5.)); }
    rim = clamp(m - c.a, 0., 1.);
  }
  float l = dot(c.rgb, vec3(.3, .59, .11));
  c.rgb = mix(c.rgb, vec3(l), uGray) * uBright;
  c.rgb = mix(c.rgb, uTint.rgb * c.a, uTint.a);
  c.rgb += uFlash * c.a;
  if (uDissolve > 0.) { float n = texture(uNoise, vUv * 2.).r; float e = smoothstep(uDissolve, uDissolve + .08, n); c *= e; c.rgb += uRim.rgb * (1. - e) * step(n, uDissolve + .08) * c.a; }
  vec4 r = vec4(uRim.rgb, 1.) * rim * uRim.a;
  vec4 col = (c + r * (1. - c.a)) * uAlpha;
  if (uReflect > 0.) col *= uReflect * smoothstep(.35, 1., vUv.y);
  // the Pokémon covers the glow of what lies behind it, so no field's light blooms through its body
  // the rim lights its outline; its bloom stays a halo at the edge and never washes the body white (2026-11-07)
  o0 = col; o1 = vec4(r.rgb * uAlpha * .3 + c.rgb * min(uFlash, 1.) * .12 * uAlpha, col.a);
}`;
const FULL_VS = `#version 300 es
layout(location=0) in vec2 aQ; out vec2 vUv; void main(){ vUv = aQ * .5 + .5; gl_Position = vec4(aQ, 0., 1.); }`;
const DOWN_FS = `#version 300 es
precision highp float; in vec2 vUv; uniform sampler2D uTex; uniform vec2 uTexel; out vec4 o;
void main(){ vec2 h = uTexel * .5; vec4 s = texture(uTex, vUv) * 4.; s += texture(uTex, vUv - h); s += texture(uTex, vUv + h); s += texture(uTex, vUv + vec2(h.x, -h.y)); s += texture(uTex, vUv - vec2(h.x, -h.y)); o = s / 8.; }`;
const UP_FS = `#version 300 es
precision highp float; in vec2 vUv; uniform sampler2D uTex; uniform vec2 uTexel; out vec4 o;
void main(){ vec2 h = uTexel; vec4 s = texture(uTex, vUv + vec2(-h.x * 2., 0.)); s += texture(uTex, vUv + vec2(-h.x, h.y)) * 2.; s += texture(uTex, vUv + vec2(0., h.y * 2.)); s += texture(uTex, vUv + vec2(h.x, h.y)) * 2.;
  s += texture(uTex, vUv + vec2(h.x * 2., 0.)); s += texture(uTex, vUv + vec2(h.x, -h.y)) * 2.; s += texture(uTex, vUv + vec2(0., -h.y * 2.)); s += texture(uTex, vUv + vec2(-h.x, -h.y)) * 2.; o = s / 12.; }`;
const COMP_FS = `#version 300 es
precision highp float; in vec2 vUv;
uniform sampler2D uScene, uBloom, uDist; uniform float uBloomK, uDistK, uCA, uVig, uSat, uFlashA, uHasDist; uniform vec3 uMul, uAdd, uFlash; uniform vec2 uAspect, uStep;
out vec4 o;
// the scene is finer than the screen: four bilinear taps across a screen pixel's footprint average it down (a box filter), so a line's
// edge is its true coverage, not a sample that steps
vec4 scene(vec2 p){ return (texture(uScene, p + vec2(-uStep.x, -uStep.y)) + texture(uScene, p + vec2(uStep.x, -uStep.y)) + texture(uScene, p + vec2(-uStep.x, uStep.y)) + texture(uScene, p + uStep)) * .25; }
void main(){
  vec2 uv = vUv;
  if (uHasDist > .5) { vec4 d = texture(uDist, vUv); uv += vec2(d.r - d.g, -(d.b - d.a)) * uDistK; }
  vec3 col;
  if (uCA > 0.) { vec2 dir = (uv - .5) * uCA; col = vec3(scene(uv + dir).r, scene(uv).g, scene(uv - dir).b); }
  else col = scene(uv).rgb;
  col += texture(uBloom, vUv).rgb * uBloomK;
  col = col * uMul + uAdd;
  float l = dot(col, vec3(.299, .587, .114)); col = mix(vec3(l), col, uSat);
  col = mix(col, uFlash, uFlashA);
  float v = length((vUv - .5) * uAspect); col *= 1. - uVig * smoothstep(.42, 1.05, v);
  o = vec4(col, 1.);
}`;

/* a program in two halves: started (its shaders handed over and the link asked) and finished (its result read). Every program of a
   stage is started before any is finished, so the driver compiles them side by side; asked one by one, each waited on its own
   (2026-11-10, measured: 93 of the first stage's 240) */
function compileStart(gl, vs, fs) {
  const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; };
  const p = gl.createProgram(), shaders = [sh(gl.VERTEX_SHADER, vs), sh(gl.FRAGMENT_SHADER, fs)];
  shaders.forEach(s => gl.attachShader(p, s)); gl.linkProgram(p);
  return { p, shaders };
}
function compileEnd(gl, { p, shaders }) {
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(shaders.map(s => gl.getShaderInfoLog(s)).filter(Boolean).join("\n") || gl.getProgramInfoLog(p));
  const u = {}, n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < n; i++) { const name = gl.getActiveUniform(p, i).name.replace(/\[0\]$/, ""); u[name] = gl.getUniformLocation(p, name); }
  return { p, u };
}
function texture(gl, w, h, data = null, { filter = gl.LINEAR, wrap = gl.CLAMP_TO_EDGE, format = gl.RGBA, internal = gl.RGBA8 } = {}) {
  const t = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texImage2D(gl.TEXTURE_2D, 0, internal, w, h, 0, format, gl.UNSIGNED_BYTE, data);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap);
  return t;
}
function target(gl, w, h, n = 1) {
  const fb = gl.createFramebuffer(), tex = [];
  gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
  for (let i = 0; i < n; i++) { tex.push(texture(gl, w, h)); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0 + i, gl.TEXTURE_2D, tex[i], 0); }
  gl.drawBuffers(tex.map((_, i) => gl.COLOR_ATTACHMENT0 + i));
  return { fb, tex, w, h };
}

/* ---------------------------------------------------------------- the engine ---------------------------------------------------------------- */
const FLOATS = 24, CAP = 32768, FIELD_CAP = 8192;
// the camera holds the wide shot (2026-11-06: its pushes and pans read as dizzy); the lab can turn them back on to compare
export const CAMERA_MOVES = false;
const F = { loop: 1, front: 2, matter: 4, face: 8, distort: 16, wrap: 32, grow: 64, bob: 128, lit: 256 };
const ACTOR_KEYS = ["x", "y", "rot", "sx", "sy", "alpha", "flash", "gray", "bright", "tintR", "tintG", "tintB", "tintA", "rimR", "rimG", "rimB", "rimA", "clip", "ghost", "dissolve"];
const ACTOR_BASE = { x: 0, y: 0, rot: 0, sx: 1, sy: 1, alpha: 1, flash: 0, gray: 0, bright: 1, tintR: 1, tintG: 1, tintB: 1, tintA: 0, rimR: 1, rimG: 1, rimB: 1, rimA: 0, clip: 0, ghost: 0, dissolve: 0 };
const MULT = new Set(["alpha", "bright"]);
// a colour is set, not added (2026-11-07 round 3): added to the base (1, 1, 1) every rim and tint came out above one, white, which is
// why "tint makes the body white" and the rims read as white outlines; the amount of each stays in tintA and rimA
const ASSIGN = new Set(["clip", "fR", "fG", "fB", "tintR", "tintG", "tintB", "rimR", "rimG", "rimB"]);
const GRADE_BASE = { flashA: 0, fR: 1, fG: 1, fB: 1, mR: 1, mG: 1, mB: 1, aR: 0, aG: 0, aB: 0, sat: 1, ca: 0, vig: .55, dim: 1, bloom: 1, dist: 1 };

class Engine {
  constructor(stage) {
    this.stage = stage;
    const canvas = document.createElement("canvas");
    canvas.className = "bs-gl";
    canvas.setAttribute("aria-hidden", "true");
    const gl = canvas.getContext("webgl2", { alpha: false, antialias: false, depth: false, stencil: false, premultipliedAlpha: true, powerPreference: "high-performance" });
    if (!gl) throw new Error("webgl2");
    stage.prepend(canvas);
    this.canvas = canvas; this.gl = gl;
    this.T = 0; this.R = 0; this.rate = 1; this.slowRate = 1; this.slowUntil = 0;
    // the lab's controls: a slow-motion scale, a pause (the camera holds too), one step of game time while paused, a camera that stays wide
    this.scale = 1; this.paused = false; this.stepMs = 0; this.camFixed = !CAMERA_MOVES;
    this.light = document.documentElement.dataset.theme === "light" ? 1 : 0;
    this.lightK = this.light;
    this.actors = new Map();
    this.warmed = new Map(); // src → a picture already on the GPU, waiting for the actor that shows it (warm)
    this.tweens = []; this.timers = []; this.strips = []; this.sprites = []; this.decals = [];
    this.grade = { ...GRADE_BASE }; this.gradeBase = { ...GRADE_BASE };
    this.groups = new Float32Array(32); this.groups[0] = 1;
    this.fxData = new Float32Array(CAP * FLOATS); this.head = 0; this.dirty = []; this.liveUntil = -1; this.distUntil = -1;
    this.fieldData = new Float32Array(FIELD_CAP * FLOATS); this.fieldCount = 0; this.fieldDirty = false;
    this.cam = { x: 0, y: 0, z: 1, r: 0, vx: 0, vy: 0, vz: 0, vr: 0, tx: 0, ty: 0, tz: 1, tr: 0, smooth: .35, trauma: 0, follow: null };
    this.setup();
    this.measure(true);
    this.ro = new ResizeObserver(() => this.measure());
    this.ro.observe(stage);
    this.mo = new MutationObserver(() => { const l = document.documentElement.dataset.theme === "light" ? 1 : 0; if (l !== this.light) { this.light = l; this.paint?.(); } });
    this.mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    this.last = performance.now();
    this.frame = requestAnimationFrame(t => this.tick(t));
  }

  setup() {
    const gl = this.gl;
    const started = {
      particle: compileStart(gl, PARTICLE_VS, PARTICLE_FS), strip: compileStart(gl, STRIP_VS, STRIP_FS), sprite: compileStart(gl, SPRITE_VS, SPRITE_FS),
      down: compileStart(gl, FULL_VS, DOWN_FS), up: compileStart(gl, FULL_VS, UP_FS), comp: compileStart(gl, FULL_VS, COMP_FS),
    };
    this.prog = Object.fromEntries(Object.entries(started).map(([name, s]) => [name, compileEnd(gl, s)]));
    /* the atlas (the particles' shapes and their normals) is taken when it is painted, and until then the stage stands on an empty one
       and paints the rest of it 6 ms a frame itself. Taken at once, a stage that came before it was painted finished it inside one
       frame: 984 ms at a phone's speed as a replay opened (2026-11-18, scripts/measure-frames.cjs). Nothing draws a particle before
       then: the opening waits for the atlas (stageFx warm). Painted by the worker (stageFx prewarm), the stage only waits for it.
       The noise tile comes with it (40 ms of a phone's frame made here): only a move's ribbons and a fall's dissolve read it */
    this.atlas = texture(gl, 1, 1, new Uint8Array(4));
    this.normals = texture(gl, 1, 1, new Uint8Array([128, 128, 255, 255]));
    this.noise = texture(gl, 1, 1, new Uint8Array([128]), { wrap: gl.REPEAT, format: gl.RED, internal: gl.R8 });
    const takeAtlas = () => {
      if (this.disposed) return;
      const t = performance.now();
      while (atlasStep() && performance.now() - t < 6);
      const atlas = atlasNow();
      if (!atlas) { requestAnimationFrame(takeAtlas); return; }
      gl.deleteTexture(this.atlas); gl.deleteTexture(this.normals); gl.deleteTexture(this.noise);
      const nz = new Uint8Array(C * C); atlas.noise.forEach((v, i) => { nz[i] = v * 255; });
      this.noise = texture(gl, C, C, nz, { wrap: gl.REPEAT, format: gl.RED, internal: gl.R8 });
      this.atlas = texture(gl, atlas.N, atlas.NH, atlas.out);
      gl.bindTexture(gl.TEXTURE_2D, this.atlas); gl.generateMipmap(gl.TEXTURE_2D); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      this.normals = texture(gl, atlas.N, atlas.NH, atlas.nrm);
      gl.bindTexture(gl.TEXTURE_2D, this.normals); gl.generateMipmap(gl.TEXTURE_2D); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    };
    takeAtlas();
    this.mats = new Float32Array(ROWS * GRID * 4); MATERIALS.forEach((m, i) => this.mats.set(m, i * 4));
    // the ramps are fixed: worked out once for every stage (each stage worked them out again, 26 ms of the first frame at a phone's speed)
    this.ramps = texture(gl, 256, RAMP_ROWS, rampsMade ||= buildRamps());
    // the unit quad every sprite and particle is drawn on
    this.quad = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, this.quad); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const instanced = cap => {
      const vao = gl.createVertexArray(), buf = gl.createBuffer();
      gl.bindVertexArray(vao);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.quad); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, cap * FLOATS * 4, gl.DYNAMIC_DRAW);
      for (let i = 0; i < 6; i++) { gl.enableVertexAttribArray(1 + i); gl.vertexAttribPointer(1 + i, 4, gl.FLOAT, false, FLOATS * 4, i * 16); gl.vertexAttribDivisor(1 + i, 1); }
      gl.bindVertexArray(null);
      return { vao, buf };
    };
    this.fxBuf = instanced(CAP); this.fieldBuf = instanced(FIELD_CAP);
    this.quadVao = gl.createVertexArray(); gl.bindVertexArray(this.quadVao); gl.bindBuffer(gl.ARRAY_BUFFER, this.quad); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0); gl.bindVertexArray(null);
    this.stripVao = gl.createVertexArray(); this.stripBuf = gl.createBuffer();
    gl.bindVertexArray(this.stripVao); gl.bindBuffer(gl.ARRAY_BUFFER, this.stripBuf);
    [[0, 2, 0], [1, 2, 8], [2, 4, 16], [3, 4, 32]].forEach(([l, n, o]) => { gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, n, gl.FLOAT, false, 48, o); });
    gl.bindVertexArray(null);
    this.stripData = new Float32Array(12 * 6000);
    gl.disable(gl.DEPTH_TEST); gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  }

  measure(first = false) {
    const st = this.stage, W = st.clientWidth || 1, H = st.clientHeight || 1;
    const changed = W !== this.W || H !== this.H;
    this.W = W; this.H = H;
    /* supersampled (2026-11-06: the court's lines looked jagged): the canvas matches the screen's own pixels one to one, and the scene
       is drawn finer than that (at least twice the CSS size, up to 3 on a phone, within 4 million pixels) and filtered down to it in
       the last pass. Before, the scene was drawn at 2 and the browser shrank the canvas to the screen (1.6 times at 125%), which
       sampled lines without filtering them and left their edges stepped */
    const device = Math.max(1, window.devicePixelRatio || 1);
    let dpr = Math.min(3, Math.max(2, device * 1.5));
    if (W * H * dpr * dpr > 4e6) dpr = Math.max(device, Math.sqrt(4e6 / (W * H)));
    this.dpr = dpr;
    const ow = Math.max(2, Math.round(W * device)), oh = Math.max(2, Math.round(H * device));
    const pw = Math.max(2, Math.round(W * dpr)), ph = Math.max(2, Math.round(H * dpr));
    /* the targets are made at the first frame, at the size the stage has then: made here as the stage mounted, before the page around it
       took its battle frame (page--battle, a layout effect of the match that runs after the stage's), they were made at 350 and at once
       made again at 390, each a wait on the GPU of 40 to 70 ms at a phone's speed (2026-11-18, scripts/measure-frames.cjs) */
    if (first) this.sizeLater = true;
    else if (pw !== this.sw || ph !== this.sh || ow !== this.canvas.width || oh !== this.canvas.height) {
      this.canvas.width = ow; this.canvas.height = oh;
      this.sw = pw; this.sh = ph;
      const gl = this.gl;
      [this.sceneRT, this.distRT, ...(this.mips || [])].forEach(rt => { if (rt) { gl.deleteFramebuffer(rt.fb); rt.tex.forEach(t => gl.deleteTexture(t)); } });
      this.sceneRT = target(gl, pw, ph, 2);
      this.distRT = target(gl, Math.max(2, pw >> 1), Math.max(2, ph >> 1));
      this.mips = [1, 2, 3, 4].map(i => target(gl, Math.max(2, pw >> i), Math.max(2, ph >> i)));
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }
    if (changed || first) {
      if (first) { this.cam.x = this.cam.tx = W / 2; this.cam.y = this.cam.ty = H / 2; }
      else { this.cam.tx = this.cam.x = W / 2; this.cam.ty = this.cam.y = H / 2; this.cam.z = this.cam.tz = 1; }
      this.sync();
      this.paint?.();
    }
  }

  /* ---------- the clock ---------- */
  slow(ms, rate = .5) { if (reduced()) return; this.slowRate = rate; this.slowUntil = this.R + ms; }
  // a callback on the game clock (it stretches in slow motion)
  at(ms, fn) { this.timers.push({ at: this.T + ms, fn }); }
  after(ms) { return new Promise(resolve => { let done = false; const end = () => { if (!done) { done = true; resolve(); } }; this.at(ms, end); this.untilGone(end, () => done); }); }
  // a promise on the game clock gives up only if the stage goes (a slow or paused clock is waited for); the check stops once it is done
  untilGone(fn, isDone) { const check = () => { if (isDone()) return; if (!this.stage.isConnected || this.disposed) fn(); else setTimeout(check, 500); }; setTimeout(check, 500); }

  tick(now) {
    if (!this.stage.isConnected) { this.dispose(); return; }
    this.frame = requestAnimationFrame(t => this.tick(t));
    if (this.sizeLater) { this.sizeLater = false; this.measure(); }
    const dt = Math.min(50, now - this.last);
    this.last = now;
    const paused = this.paused && !this.stepMs;
    if (!paused) this.R += dt;
    const slow = this.R < this.slowUntil ? this.slowRate : 1;
    let gdt = paused ? 0 : dt * this.rate * slow * this.scale;
    if (this.paused && this.stepMs) { gdt = this.stepMs; this.stepMs = 0; }
    this.T += gdt;
    if (this.timers.length) { const due = this.timers.filter(t => t.at <= this.T); if (due.length) { this.timers = this.timers.filter(t => t.at > this.T); due.forEach(t => t.fn()); } }
    this.update(gdt, paused ? 0 : dt);
    this.render();
  }

  /* ---------- tweens: channels on an actor or the grade, keyframed, played on the game clock ---------- */
  // anim(target, { x: [0, 20, 0], flash: [0, 1, 0] }, { dur, ease, at: offsets, delay, fill })
  anim(target, chans, { dur = 400, ease = "out", at = null, delay = 0, fill = false, eases = null } = {}) {
    if (!target) return Promise.resolve();
    return new Promise(resolve => {
      const tw = { target, chans, dur: Math.max(1, dur), at, start: this.T + delay, ease: EASE[ease] || ease, eases, fill, resolve, done: false };
      this.tweens.push(tw);
      this.untilGone(() => { if (!tw.done) { tw.done = true; resolve(); } }, () => tw.done);
    });
  }
  cancel(target, keep = null) { this.tweens = this.tweens.filter(t => { const go = t.target === target && (!keep || !keep(t)); if (go && !t.done) { t.done = true; t.resolve(); } return !go; }); }
  sample(tw, key, p) {
    const vals = tw.chans[key], n = vals.length;
    if (n === 1) return vals[0];
    const at = tw.at || vals.map((_, i) => i / (n - 1));
    let i = 0; while (i < n - 2 && p > at[i + 1]) i++;
    const span = at[i + 1] - at[i] || 1, ease = tw.eases?.[i] ? EASE[tw.eases[i]] : tw.ease;
    return lerp(vals[i], vals[i + 1], ease(clamp((p - at[i]) / span)));
  }
  update(gdt, dt) {
    for (const a of this.actors.values()) { Object.assign(a.st, a.base); }
    Object.assign(this.grade, this.gradeBase);
    const keep = [];
    for (const tw of this.tweens) {
      const p = clamp((this.T - tw.start) / tw.dur);
      if (this.T < tw.start) { if (tw.fill === "both") this.apply(tw, 0); keep.push(tw); continue; }
      this.apply(tw, p);
      if (p >= 1) { if (!tw.done) { tw.done = true; tw.resolve(); } if (tw.fill) keep.push(tw); }
      else keep.push(tw);
    }
    this.tweens = keep;
    // the idle: each Pokémon breathes from its feet, never lifting off them
    for (const a of this.actors.values()) {
      const ph = (this.T / (a.own ? 3400 : 3800) + a.phase) * Math.PI * 2;
      a.breath = Math.sin(ph) * .5 + .5;
      if (a.trail) { a.hist.unshift([a.st.x, a.st.y, a.st.sx, a.st.sy, a.st.rot]); a.hist.length = Math.min(a.hist.length, 14); }
    }
    this.camera(dt / 1000);
    this.fieldTick?.(dt);
    this.lightK += (this.light - this.lightK) * Math.min(1, dt / 160);
  }
  apply(tw, p) {
    const o = tw.target.st || tw.target;
    for (const k in tw.chans) {
      const v = this.sample(tw, k, p);
      if (MULT.has(k)) o[k] *= v;
      else if (k === "sx" || k === "sy") o[k] *= v;
      else if (k in GRADE_BASE && (k[0] === "m" || k === "sat" || k === "dim" || k === "bloom")) o[k] *= v;
      else if (ASSIGN.has(k)) o[k] = v;
      else o[k] += v;
    }
  }

  /* ---------- the camera: a critically damped spring after its shot, a smooth shake over it ---------- */
  shot(x, y, z = 1, { smooth = .38, roll = 0 } = {}) {
    if (reduced() || this.camFixed && (z !== 1 || x !== this.W / 2)) return;
    Object.assign(this.cam, { tx: x, ty: y, tz: z, tr: roll, smooth, follow: null });
  }
  wide(smooth = .5) { this.shot(this.W / 2, this.H / 2, 1, { smooth }); }
  follow(fn, z, smooth = .16) { if (reduced() || this.camFixed) return; Object.assign(this.cam, { follow: fn, tz: z, smooth }); }
  shake(amount = .4) { if (reduced()) return; this.cam.trauma = Math.min(1, this.cam.trauma + amount); }
  kick(amount = .04) { if (reduced() || this.camFixed) return; this.cam.vz += amount * 6; }
  camera(dt) {
    const c = this.cam;
    if (c.follow) { const [x, y] = c.follow(); c.tx = x; c.ty = y; }
    const damp = (cur, vel, to, smooth) => { const w = 2 / Math.max(.02, smooth), x = w * dt, e = 1 / (1 + x + .48 * x * x + .235 * x * x * x), ch = cur - to, tmp = (vel + w * ch) * dt; return [to + (ch + tmp) * e, (vel - w * tmp) * e]; };
    [c.x, c.vx] = damp(c.x, c.vx, c.tx, c.smooth);
    [c.y, c.vy] = damp(c.y, c.vy, c.ty, c.smooth);
    [c.z, c.vz] = damp(c.z, c.vz, c.tz, c.smooth * .9);
    [c.r, c.vr] = damp(c.r, c.vr, c.tr, c.smooth);
    c.trauma = Math.max(0, c.trauma - dt * 1.5);
  }
  view() {
    const c = this.cam, W = this.W, H = this.H, R = this.R / 1000;
    const z = Math.max(1, c.z);
    // the view never shows past the arena's margin
    const M = .1, hw = W / 2 / z, hh = H / 2 / z;
    let x = clamp(c.x, hw - W * M, W * (1 + M) - hw), y = clamp(c.y, hh - H * M, H * (1 + M) - hh);
    const s = c.trauma * c.trauma * (this.camFixed ? .55 : 1), n = (a, b) => Math.sin(R * a) * .6 + Math.sin(R * b + 1.3) * .4;
    x += s * W * .022 * n(47, 61); y += s * H * .026 * n(53, 71);
    const roll = c.r + s * .02 * n(37, 43);
    const cs = Math.cos(roll) * z, sn = Math.sin(roll) * z;
    // world → clip: translate to the camera, roll and push, scale to clip, flip y
    const sx = 2 / W, sy = -2 / H;
    return new Float32Array([cs * sx, sn * sy, 0, -sn * sx, cs * sy, 0, (-x * cs + y * sn) * sx, (-x * sn - y * cs) * sy, 1]);
  }

  /* ---------- particles ---------- */
  // one particle per call of spec.make(i), or n of the spec's own randomised kind
  emit(spec) {
    const n = Math.max(0, Math.round(spec.n ?? 1));
    const field = spec.field;
    for (let i = 0; i < n; i++) {
      const s = spec.each ? { ...spec, ...spec.each(i, n) } : spec;
      let [x, y] = typeof s.at === "function" ? s.at(i, n) : s.at || [0, 0];
      if (s.r) { const a = Math.random() * Math.PI * 2, rr = Math.sqrt(Math.random()); const [rx, ry] = Array.isArray(s.r) ? s.r : [s.r, s.r]; x += Math.cos(a) * rx * rr; y += Math.sin(a) * ry * rr; }
      let vx = 0, vy = 0;
      if (s.vel) [vx, vy] = typeof s.vel === "function" ? s.vel(i, n, x, y) : s.vel;
      else if (s.speed) { const a = (s.dir ?? 0) + (s.arc == null ? Math.random() * Math.PI * 2 : (Math.random() - .5) * s.arc), sp = pick(s.speed); vx = Math.cos(a) * sp; vy = Math.sin(a) * sp; }
      if (s.vj) { vx += rand(-s.vj, s.vj); vy += rand(-s.vj, s.vj); }
      const size = Array.isArray(s.size) ? s.size : [s.size ?? 20, s.size ?? 20];
      const s0 = pick(size[0]), s1 = size[1] === "same" ? s0 : pick(size[1]) * (s.keep ? s0 / pick(size[0]) : 1);
      const flags = (s.loop ? F.loop : 0) | (s.layer === 0 ? 0 : F.front) | (s.occ ? F.matter : 0) | (s.face ? F.face : 0) | (s.distort ? F.distort : 0) | (s.wrap ? F.wrap : 0) | (s.grow ? F.grow : 0) | (s.bob ? F.bob : 0) | (s.lit ? F.lit : 0);
      const life = pick(s.life ?? 600);
      // a looping particle is already part way through its life when it comes, so a field is full from its first frame
      const off = (s.over ? (s.even ? i / Math.max(1, n - 1) : Math.random()) * s.over : 0) + (s.stagger ? i * s.stagger : 0);
      const T = this.T + (s.delay || 0);
      const t0 = s.hold ? T - life * .5 : s.loop ? T - off : T + off;
      const rot = s.rot === "rand" ? Math.random() * Math.PI * 2 : s.rot ?? 0;
      const rec = [x, y, vx, vy, s.acc?.[0] || 0, s.acc?.[1] || 0, s.bob ? pick(s.bob) : s.drag || 0, t0, life, s0, s1, rot + (s.rj ? rand(-s.rj, s.rj) : 0),
        pick(s.spin ?? 0), s.bob ? pick(s.period ?? 3) : s.stretch || 0, TEX[s.tex || "glow"] ?? 0, RAMP[s.tint || s.ramp || "white"] ?? 0, s.emis ?? (s.occ ? 0 : 1), s.occ || 0, pick(s.aspect ?? 1), flags,
        pick(s.alpha ?? 1), s.erode || 0, Math.random(), s.group || 0];
      if (field) {
        if (this.fieldCount >= FIELD_CAP) break;
        this.fieldData.set(rec, this.fieldCount * FLOATS); this.fieldCount++; this.fieldDirty = true;
      } else {
        const at = this.head;
        this.fxData.set(rec, at * FLOATS);
        this.dirty.push(at);
        this.head = (this.head + 1) % CAP;
        const end = s.loop ? Infinity : t0 + life;
        if (end > this.liveUntil) this.liveUntil = end;
        if (s.distort && end > this.distUntil) this.distUntil = end;
      }
    }
  }
  clearField() { this.fieldCount = 0; this.fieldDirty = true; }
  strip(s) { s.born = this.T; this.strips.push(s); return s; }
  // a painted canvas as a texture (premultiplied, mipmapped): the field's decals and a move's thrown pieces share it
  texture(canvas) {
    const gl = this.gl, tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return tex;
  }
  // a decal: { tex, rect: [x, y, w, h] or T => [x, y, w, h, rot], group, alpha }, drawn on the floor behind the Pokémon
  decal(d) { this.decals.push(d); return d; }
  dropDecal(d) { const i = this.decals.indexOf(d); if (i >= 0) this.decals.splice(i, 1); if (!d.shared) this.gl.deleteTexture(d.tex); }

  /* ---------- the Pokémon ---------- */
  // what stands in each slot is read from the stage's DOM (Stage.jsx keeps it as layout and pick targets)
  sync() {
    const st = this.stage, box = st.getBoundingClientRect(), seen = new Set();
    for (const slot of st.querySelectorAll(".bs-slot[data-mon]")) {
      const key = slot.dataset.mon, mon = slot.querySelector(".bs-mon"), r = slot.getBoundingClientRect();
      const rect = { left: r.left - box.left, top: r.top - box.top, width: r.width, height: r.height };
      if (!mon) continue;
      seen.add(key);
      const img = mon.querySelector("img"), sub = mon.querySelector(".bs-sub");
      const src = sub ? subUrl(sub) : img?.getAttribute("src") || "";
      const name = mon.dataset.name || "";
      let a = this.actors.get(key);
      if (!a || a.name !== name) { if (a) this.drop(a); a = this.actor(key, name, slot.closest(".bs-side")?.classList.contains("own")); }
      a.rect = rect;
      if (src && src !== a.src) this.load(a, src);
    }
    for (const [key, a] of this.actors) if (!seen.has(key)) { this.drop(a); this.actors.delete(key); }
  }
  actor(key, name, own) {
    const a = { key, name, own, base: { ...ACTOR_BASE }, st: { ...ACTOR_BASE }, phase: Math.random(), hist: [], trail: false, tex: null, prev: null, rect: null, src: "" };
    this.actors.set(key, a);
    return a;
  }
  /* the stage read again from the top (a replay's jump, a change of side) cuts the effect being played: whatever it left lasting
     goes back, its held tweens, the dark it laid (Mega Evolution's, the opening's) and the Pokémon it hid (2026-11-07: a jump in the
     middle of a Mega Evolution left the stage dark for good) */
  settle() {
    for (const t of this.tweens) if (!t.done) { t.done = true; t.resolve(); }
    this.tweens = [];
    this.gradeBase.dim = 1;
    this.megaDim = false;
    if (this.mega) { this.mega.burst = this.T; this.mega = null; }
    for (const a of this.actors.values()) { a.base.alpha = 1; a.lit = false; }
    this.wide(.3);
  }
  drop(a) { this.cancel(a); if (a.tex) this.gl.deleteTexture(a.tex); if (a.prev) this.gl.deleteTexture(a.prev); }
  load(a, src) {
    a.src = src;
    // a picture warmed before it was needed (a replay's opening) is taken as it is: no upload in the middle of the throw
    const warm = this.warmed.get(src);
    if (warm?.done) {
      this.warmed.delete(src);
      if (a.tex) this.gl.deleteTexture(a.tex);
      Object.assign(a, warm.done);
      a.ready = Promise.resolve();
      return;
    }
    const img = new Image();
    img.decoding = "async";
    a.ready = new Promise(resolve => {
      img.onload = async () => {
        if (a.src !== src) return resolve();
        const bitmap = await bitmapOf(img, src);
        if (a.src !== src || this.disposed) return resolve();
        const pic = this.upload(bitmap || img, src);
        if (!pic) return resolve();
        if (a.tex) this.gl.deleteTexture(a.tex);
        Object.assign(a, pic);
        resolve();
      };
      img.onerror = () => resolve();
      setTimeout(resolve, 1500);
    });
    img.src = src;
  }
  // a decoded picture on the GPU: { tex, iw, ih, ink }, or null when it cannot go
  upload(img, src) {
    const gl = this.gl, tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    // an SVG (the doll) is drawn to a canvas at a size of its own first: it has no pixels until it is given some
    let pic = img;
    const bitmap = typeof ImageBitmap !== "undefined" && img instanceof ImageBitmap;
    if (!bitmap && (src.startsWith("data:") || !img.naturalWidth)) { pic = document.createElement("canvas"); pic.width = 480; pic.height = 500; pic.getContext("2d").drawImage(img, 0, 0, 480, 500); }
    try { gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, pic); } catch { gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false); gl.deleteTexture(tex); return null; }
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return { tex, iw: pic.width || img.naturalWidth, ih: pic.height || img.naturalHeight, ink: inkBox(pic, pic === img ? src : "") };
  }
  /* pictures fetched, decoded and put on the GPU one a frame, before they are needed (a replay's team before its opening), so the
     throws never stop for an upload; resolves when all are there or after a moment. ponytail: pictures warmed and never shown keep
     their textures until the stage goes (at most the twelve of a team preview) */
  warm(srcs) {
    const todo = srcs.filter(src => src && !this.warmed.has(src));
    for (const src of todo) this.warmed.set(src, { done: null });
    const frame = () => new Promise(resolve => requestAnimationFrame(resolve));
    // fetched and decoded all at once, put on the GPU one a frame
    const decoding = todo.map(src => { const img = new Image(); img.decoding = "async"; img.src = src; return [src, img.decode().then(() => bitmapOf(img, src).then(b => b || img), () => null)]; });
    const run = (async () => {
      for (const [src, decoded] of decoding) {
        const img = await decoded;
        if (!img) continue;
        await frame();
        const entry = this.warmed.get(src);
        if (entry && !entry.done) entry.done = this.upload(img, src);
      }
    })();
    return Promise.race([run, new Promise(resolve => setTimeout(resolve, 1600))]);
  }
  // where a Pokémon is drawn in the world: its picture fitted in its slot, standing on the slot's floor
  placed(a) {
    const r = a.rect;
    if (!r || !a.iw) return null;
    const k = Math.min(r.width / a.iw, r.height / a.ih), w = a.iw * k, h = a.ih * k;
    return { x: r.left + (r.width - w) / 2, y: r.top + r.height - h, w, h, fx: r.left + r.width / 2, fy: r.top + r.height * .985 };
  }

  /* ---------- drawing ---------- */
  render() {
    const gl = this.gl, P = this.prog, view = this.view(), W = this.sw, H = this.sh;
    const g = this.grade, L = this.lightK;
    if (this.dirty.length) {
      // upload what changed since the last frame, in runs
      this.dirty.sort((a, b) => a - b);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.fxBuf.buf);
      let s = this.dirty[0], p = s;
      const flush = (a, b) => gl.bufferSubData(gl.ARRAY_BUFFER, a * FLOATS * 4, this.fxData, a * FLOATS, (b - a + 1) * FLOATS);
      for (let i = 1; i < this.dirty.length; i++) { const v = this.dirty[i]; if (v === p || v === p + 1) { p = v; continue; } flush(s, p); s = p = v; }
      flush(s, p);
      this.dirty = [];
    }
    if (this.fieldDirty) { gl.bindBuffer(gl.ARRAY_BUFFER, this.fieldBuf.buf); gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.fieldData, 0, Math.max(1, this.fieldCount) * FLOATS); this.fieldDirty = false; }
    const fxLive = this.T <= this.liveUntil;

    // 1. the scene: the arena, the floor, the Pokémon and every effect, with what glows written to a second target
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.sceneRT.fb);
    gl.viewport(0, 0, W, H);
    gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT);
    if (this.arena) this.drawQuad(this.arena.tex, this.arena.rect, view, { bright: g.dim });
    const sp = P.sprite;
    // reflections on the floor
    for (const a of this.ordered()) this.drawActor(a, view, true);
    // the field's painted pieces (a web on the floor, caltrops, a wall round a side), crisp at any size, behind the Pokémon;
    // a decal marked front (the foe's wall, glass between them and us) is drawn over them
    const decals = front => { for (const d of this.decals.slice()) {
      if (Boolean(d.front) !== front) continue;
      // a move's own decal (a stone in flight, a wall going up) ends at its time
      if (d.until && this.T > d.until) { this.dropDecal(d); continue; }
      const al = (typeof d.alpha === "function" ? d.alpha(this.T) : d.alpha ?? 1) * (d.group ? this.groups[d.group] : 1);
      if (al < .003) continue;
      const r = typeof d.rect === "function" ? d.rect(this.T) : d.rect;
      this.drawQuad(d.tex, r, view, { alpha: al, bright: g.dim, rot: r[4] || 0 });
    } };
    decals(false);
    const particles = (layer, pass = 0) => {
      const pp = P.particle;
      gl.useProgram(pp.p);
      gl.uniformMatrix3fv(pp.u.uView, false, view); gl.uniform1f(pp.u.uTime, this.T); gl.uniform1f(pp.u.uLayer, layer); gl.uniform1f(pp.u.uPass, pass);
      gl.uniform1fv(pp.u.uGroups, this.groups); gl.uniform4f(pp.u.uWrap, -this.W * .1, this.W * 1.2, -this.H * .1, this.H * 1.2); gl.uniform1f(pp.u.uLight, L);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.atlas); gl.uniform1i(pp.u.uAtlas, 0);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, this.ramps); gl.uniform1i(pp.u.uRamp, 1);
      gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, this.normals); gl.uniform1i(pp.u.uNormal, 2);
      if (pp.u.uMat) gl.uniform4fv(pp.u.uMat, this.mats);
      if (this.fieldCount) { gl.bindVertexArray(this.fieldBuf.vao); gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, this.fieldCount); }
      if (fxLive || pass) { gl.bindVertexArray(this.fxBuf.vao); gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, CAP); }
      gl.bindVertexArray(null);
    };
    this.drawStrips(view, 0, true);
    particles(0);
    this.drawStrips(view, 0);
    for (const a of this.ordered()) this.drawActor(a, view, false);
    decals(true);
    particles(1);
    this.drawStrips(view, 1);
    if (this.sprites.length) this.sprites = this.sprites.filter(sp2 => { const o = sp2.at(this.T); if (!o) return false; this.drawQuad(o.tex || sp2.tex, [o.x - o.w / 2, o.y - o.h / 2, o.w, o.h], view, { alpha: o.alpha ?? 1, rot: o.rot || 0, flash: o.flash || 0 }); return true; });
    void sp;

    // 2. distortion: shockwaves and heat bend the picture
    const hasDist = this.T <= this.distUntil || this.fieldDistort;
    if (hasDist) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.distRT.fb); gl.viewport(0, 0, this.distRT.w, this.distRT.h);
      gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); gl.blendFunc(gl.ONE, gl.ONE);
      particles(0, 1); particles(1, 1);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    }

    // 3. bloom from the glow target: halved four times and added back up
    gl.disable(gl.BLEND);
    let src = this.sceneRT.tex[1], sw = W, sh = H;
    for (const m of this.mips) { this.pass(P.down, m, src, [1 / sw, 1 / sh]); src = m.tex[0]; sw = m.w; sh = m.h; }
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
    for (let i = this.mips.length - 1; i > 0; i--) this.pass(P.up, this.mips[i - 1], this.mips[i].tex[0], [1 / this.mips[i].w, 1 / this.mips[i].h]);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); gl.disable(gl.BLEND);

    // 4. the picture: the scene bent by the distortion, the bloom over it, the grade and the vignette
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    const c = P.comp; gl.useProgram(c.p);
    // the filter's reach: a screen pixel covers this many scene pixels, sampled across that whole footprint
    gl.uniform2f(c.u.uStep, .25 / this.canvas.width, .25 / this.canvas.height);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.sceneRT.tex[0]); gl.uniform1i(c.u.uScene, 0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, this.mips[0].tex[0]); gl.uniform1i(c.u.uBloom, 1);
    gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, this.distRT.tex[0]); gl.uniform1i(c.u.uDist, 2);
    gl.uniform1f(c.u.uBloomK, g.bloom * lerp(.62, .4, L)); gl.uniform1f(c.u.uDistK, .045 * g.dist); gl.uniform1f(c.u.uHasDist, hasDist ? 1 : 0);
    gl.uniform1f(c.u.uCA, g.ca); gl.uniform1f(c.u.uVig, 0); gl.uniform1f(c.u.uSat, g.sat);
    /* a stage with its lamps down goes to the site's navy in the light theme: its pale court times the lamps alone stood as a
       neutral charcoal box on a white page (2026-11-10). Only under the dim a fall lays (.7), so a faint keeps its colours */
    const night = this.lightK * clamp((.7 - g.dim) / .52);
    gl.uniform3f(c.u.uMul, g.mR * lerp(1, .3, night), g.mG * lerp(1, .75, night), g.mB * lerp(1, 1.45, night)); gl.uniform3f(c.u.uAdd, g.aR, g.aG, g.aB); gl.uniform3f(c.u.uFlash, g.fR, g.fG, g.fB); gl.uniform1f(c.u.uFlashA, clamp(g.flashA));
    gl.uniform2f(c.u.uAspect, 1, this.H / this.W);
    gl.bindVertexArray(this.quadVao); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); gl.bindVertexArray(null);
    gl.enable(gl.BLEND);
    if (this.onRender) { const f = this.onRender; this.onRender = null; f(this.canvas); }
  }
  pass(prog, dst, src, texel) {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, dst.fb); gl.viewport(0, 0, dst.w, dst.h);
    if (!gl.isEnabled(gl.BLEND)) { gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); }
    gl.useProgram(prog.p);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, src); gl.uniform1i(prog.u.uTex, 0); gl.uniform2f(prog.u.uTexel, texel[0], texel[1]);
    gl.bindVertexArray(this.quadVao); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); gl.bindVertexArray(null);
  }
  ordered() { return [...this.actors.values()].filter(a => a.tex && a.rect).sort((a, b) => a.rect.top + a.rect.height - (b.rect.top + b.rect.height)); }
  spriteUniforms(o) {
    const gl = this.gl, u = this.prog.sprite.u;
    gl.uniform1f(u.uAlpha, o.alpha ?? 1); gl.uniform1f(u.uFlash, o.flash ?? 0); gl.uniform1f(u.uGray, o.gray ?? 0); gl.uniform1f(u.uBright, o.bright ?? 1);
    gl.uniform1f(u.uClip, o.clip ?? 1e9); gl.uniform1f(u.uFloor, o.floor ?? -1e9); gl.uniform1f(u.uReflect, o.reflect ?? 0); gl.uniform1f(u.uDissolve, o.dissolve ?? 0);
    gl.uniform4fv(u.uTint, o.tint || [1, 1, 1, 0]); gl.uniform4fv(u.uRim, o.rim || [1, 1, 1, 0]);
    gl.uniform4fv(u.uUv, o.uv || [0, 0, 1, 1]); gl.uniform2f(u.uTexel, o.texel?.[0] || .002, o.texel?.[1] || .002);
  }
  drawQuad(tex, [x, y, w, h], view, o = {}) {
    const gl = this.gl, sp = this.prog.sprite;
    gl.useProgram(sp.p); gl.uniformMatrix3fv(sp.u.uView, false, view);
    const r = o.rot || 0, c = Math.cos(r), n = Math.sin(r), cx = x + w / 2, cy = y + h / 2;
    gl.uniformMatrix3fv(sp.u.uModel, false, new Float32Array([c * w, n * w, 0, -n * h, c * h, 0, cx - (c * w - n * h) / 2, cy - (n * w + c * h) / 2, 1]));
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tex); gl.uniform1i(sp.u.uTex, 0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, this.noise); gl.uniform1i(sp.u.uNoise, 1);
    this.spriteUniforms(o);
    gl.bindVertexArray(this.quadVao); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); gl.bindVertexArray(null);
  }
  drawActor(a, view, reflect) {
    const p = this.placed(a);
    if (!p) return;
    const s = a.st, gl = this.gl, sp = this.prog.sprite;
    if (s.alpha <= .002) return;
    const breathe = a.breath * .014, flip = a.own ? -1 : 1;
    const model = (st, mirror) => {
      // about the feet: push, turn, then scale; the picture's own box is the unit quad
      const sx = st.sx * (1 - breathe * .35) * flip, sy = st.sy * (1 + breathe) * (mirror ? -1 : 1), c = Math.cos(st.rot), n = Math.sin(st.rot);
      const ox = p.x - p.fx, oy = p.y - p.fy;
      const ax = p.w * sx, by = p.h * sy;
      // columns: x axis, y axis, origin
      return new Float32Array([c * ax, n * ax, 0, -n * by, c * by, 0, p.fx + st.x + (c * ox * sx - n * oy * sy), p.fy + st.y * (mirror ? -1 : 1) + (n * ox * sx + c * oy * sy), 1]);
    };
    gl.useProgram(sp.p); gl.uniformMatrix3fv(sp.u.uView, false, view);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, a.tex); gl.uniform1i(sp.u.uTex, 0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, this.noise); gl.uniform1i(sp.u.uNoise, 1);
    const texel = [1 / (a.iw || 256), 1 / (a.ih || 256)];
    const tint = [s.tintR, s.tintG, s.tintB, s.tintA], rim = [s.rimR, s.rimG, s.rimB, s.rimA];
    const clip = s.clip ? p.fy + 1 : 1e9;
    gl.bindVertexArray(this.quadVao);
    if (reflect) {
      if (s.y < -p.h * .5) return;
      gl.uniformMatrix3fv(sp.u.uModel, false, model(s, true));
      this.spriteUniforms({ alpha: s.alpha * (1 - s.dissolve), flash: s.flash * .5, gray: s.gray, bright: s.bright * this.grade.dim, tint, texel, floor: p.fy - 1, reflect: lerp(.3, .16, this.lightK) * Math.max(0, 1 + s.y / (p.h * .5)) });
    } else {
      if (s.ghost > 0 && a.hist.length > 4) {
        // (round 3: two copies, fainter; three heavy copies read as a smudge behind every dash)
        for (const [i, k] of [[4, .2], [9, .08]]) {
          const h = a.hist[Math.min(i, a.hist.length - 1)];
          gl.uniformMatrix3fv(sp.u.uModel, false, model({ ...s, x: h[0], y: h[1], sx: h[2], sy: h[3], rot: h[4] }, false));
          // the copies a dash leaves are coloured by the move's type and stay dim (pale white copies read as a raw blur, 2026-11-07)
          this.spriteUniforms({ alpha: s.alpha * k * s.ghost * .85, flash: .08, bright: 1, tint: [...hex(a.ghostColor || "#BFD8FF").slice(0, 3), .7], texel, clip });
          gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        }
      }
      gl.uniformMatrix3fv(sp.u.uModel, false, model(s, false));
      this.spriteUniforms({ alpha: s.alpha, flash: s.flash, gray: s.gray, bright: s.bright * (a.lit ? 1 : this.grade.dim), tint, rim, texel, clip, dissolve: s.dissolve });
    }
    gl.bindVertexArray(this.quadVao); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); gl.bindVertexArray(null);
  }
  // layer 0: behind the Pokémon (a room's walls, a floor's lines), 1: over them (a beam, a slash)
  // under: the strips drawn before the layer's particles (a weather's air), so its rain and snow fall in front of it
  drawStrips(view, layer = 1, under = false) {
    if (!this.strips.length) return;
    const out = this.stripData; let n = 0;
    /* a vertex is written number by number and the last one copied in place: an array made for every vertex and a view for every
       join were some thousands of throwaways a frame under a terrain's lines (2026-11-10, measured: a third of the frame's own work) */
    const put = (x, y, u, v, r, g, b, a, mode, emis, occ, tile) => { const i = n * 12; out[i] = x; out[i + 1] = y; out[i + 2] = u; out[i + 3] = v; out[i + 4] = r; out[i + 5] = g; out[i + 6] = b; out[i + 7] = a; out[i + 8] = mode; out[i + 9] = emis; out[i + 10] = occ; out[i + 11] = tile; n++; };
    const again = () => { out.copyWithin(n * 12, (n - 1) * 12, n * 12); n++; };
    const keep = [];
    for (const s of this.strips) {
      const age = this.T - s.born - (s.delay || 0);
      if (age < 0) { keep.push(s); continue; }
      const k = s.dur === Infinity ? 0 : age / s.dur;
      if (k > 1 || s.dead) { s.end?.(); continue; }
      keep.push(s);
      if ((s.layer ?? 1) !== layer || Boolean(s.under) !== under) continue;
      if (s.quad) {
        const q = s.quad(k, age);
        if (!q) continue;
        // a weather's air (s.dims) dims with the arena's lamps, as the ground under it does
        const d = s.dims ? this.grade.dim : 1, [r, g, b] = hex(s.color || "#FFFFFF").map(c => c * d), al = s.alpha ?? 1, v = [q[0], q[1], q[3], q[2]];
        if (n) { again(); put(v[0][0], v[0][1], 0, 0, r, g, b, al, 4, s.emis ?? 1, s.occ || 0, 1); }
        for (const [x, y] of v) put(x, y, 0, 0, r, g, b, al, 4, s.emis ?? 1, s.occ || 0, 1);
        again();
        continue;
      }
      const pts = s.points(k, age);
      if (!pts || pts.length < 2) continue;
      const [r, g, b] = hex(s.color || "#FFFFFF"), mode = s.mode || 0, emis = s.emis ?? 1, occ = s.occ || 0, tile = s.tile || 1;
      let len = 0;
      for (let i = 0; i < pts.length; i++) {
        const [x, y, w, al = 1] = pts[i], [px, py] = pts[Math.max(0, i - 1)], [qx, qy] = pts[Math.min(pts.length - 1, i + 1)];
        if (i) len += Math.hypot(x - pts[i - 1][0], y - pts[i - 1][1]);
        let dx = qx - px, dy = qy - py; const d = Math.hypot(dx, dy) || 1; dx /= d; dy /= d;
        const nx = -dy * w / 2, ny = dx * w / 2, u = s.uLen ? len / s.uLen : i / (pts.length - 1);
        const alpha = al * (s.alpha ?? 1);
        if (i === 0 && n > 0) { again(); put(x + nx, y + ny, u, -1, r, g, b, alpha, mode, emis, occ, tile); }
        put(x + nx, y + ny, u, -1, r, g, b, alpha, mode, emis, occ, tile);
        put(x - nx, y - ny, u, 1, r, g, b, alpha, mode, emis, occ, tile);
        if (n > 5900) break;
      }
      // a degenerate join to the next strip
      if (n) again();
    }
    this.strips = keep;
    if (n < 4) return;
    const gl = this.gl, P = this.prog.strip;
    gl.useProgram(P.p); gl.uniformMatrix3fv(P.u.uView, false, view); gl.uniform1f(P.u.uTime, this.T); gl.uniform1f(P.u.uLight, this.lightK);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.noise); gl.uniform1i(P.u.uNoise, 0);
    gl.bindVertexArray(this.stripVao); gl.bindBuffer(gl.ARRAY_BUFFER, this.stripBuf); gl.bufferData(gl.ARRAY_BUFFER, out.subarray(0, n * 12), gl.STREAM_DRAW);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, n); gl.bindVertexArray(null);
  }

  dispose() {
    cancelAnimationFrame(this.frame);
    this.disposed = true;
    this.ro?.disconnect(); this.mo?.disconnect();
    this.tweens.forEach(t => { if (!t.done) { t.done = true; t.resolve(); } });
    this.gl.getExtension("WEBGL_lose_context")?.loseContext();
    if (this.stage.__gl === this) this.stage.__gl = null;
  }
}

// the substitute doll is a CSS background (battle-stage.css); its data URL is drawn as the picture
function subUrl(el) { const m = getComputedStyle(el).backgroundImage.match(/url\("?(.+?)"?\)$/); return m ? m[1].replace(/\\"/g, "\"") : ""; }
/* a picture decoded and premultiplied off the page's thread (createImageBitmap), so putting it on the GPU is only the copy: read from the
   image itself, a Pokémon's picture was 23 to 53 ms of the frame it went up in at a phone's speed (2026-11-18). WebGL takes an
   ImageBitmap as it is (its own premultiplied alpha, the store's unpack flags left aside), so the texture is the same. A data URL (the
   doll, an SVG) or a browser without it goes up from the image as before */
function bitmapOf(img, src) {
  if (typeof createImageBitmap !== "function" || src.startsWith("data:") || !img.naturalWidth) return Promise.resolve(null);
  /* from the file, not from the <img>: made from the element the picture was decoded on the page's thread, 147 to 160 ms of a frame at a
     phone's speed (2026-11-18, a Chrome trace); from the file it is decoded off it, the same bytes on the GPU (compared: six pictures) */
  return fetch(src).then(res => (res.ok ? res.blob() : Promise.reject()))
    .then(blob => createImageBitmap(blob, { premultiplyAlpha: "premultiply", colorSpaceConversion: "default" })).catch(() => null);
}
// the box of a picture's ink (its non-transparent pixels), as shares of the picture: effects aim at the body, not the empty frame.
// Read from the table built ahead (inkCentre.js, 2026-11-18: read here it was 15 ms a picture at a phone's speed, in a frame of its own)
function inkBox(img, src = "") {
  const known = inkBoxOf(src);
  if (known) return known;
  try {
    const n = 64, c = document.createElement("canvas"); c.width = n; c.height = n;
    const g = c.getContext("2d", { willReadFrequently: true }); g.drawImage(img, 0, 0, n, n);
    const d = g.getImageData(0, 0, n, n).data; let x0 = n, y0 = n, x1 = 0, y1 = 0;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (d[(y * n + x) * 4 + 3] > 40) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    return x1 > x0 ? [x0 / n, y0 / n, (x1 + 1) / n, (y1 + 1) / n] : [0, 0, 1, 1];
  } catch { return [0, 0, 1, 1]; }
}

export function glOf(stage) {
  if (!stage) return null;
  if (stage.__gl === false) return null;
  if (!stage.__gl || !stage.contains(stage.__gl.canvas)) {
    try { stage.__gl = new Engine(stage); stage.classList.add("bs-on-gl"); stage.__gl.onReady?.(); for (const fn of ON_CREATE) fn(stage.__gl); }
    catch (err) { console.warn("battle stage: WebGL2 unavailable", err); stage.__gl = false; stage.classList.add("bs-nogl"); return null; }
  }
  return stage.__gl;
}
const ON_CREATE = [];
export const onEngine = fn => { ON_CREATE.push(fn); };
