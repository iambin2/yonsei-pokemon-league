// 프레임마다 잰 수치(흰 면적, 타입 색 면적)에서 연출의 단계를 자르고, 원작과 우리 것을 비교한다.
// 설계: docs/superpowers/specs/2026-11-21-move-fx-match-design.md. 순수 계산뿐이라 tests/fxPhases.test.mjs가 검사한다.

// 연출이 실제로 내는 색의 범위(타입 토큰의 색이 아니라 화면에 보이는 빛: 불꽃은 빨강에서 노랑까지).
// hue는 도, 범위가 0을 넘으면 [330, 20]처럼 쓴다. nearWhite 타입은 옅은 빛도 타입의 빛으로 센다.
const WIN = {
  normal: [[20, 70], .1, .75, true], fire: [[0, 58], .55, .7], water: [[180, 240], .06, .6, true], electric: [[38, 66], .5, .8],
  grass: [[75, 150], .4, .5], ice: [[170, 215], .04, .75, true], fighting: [[10, 45], .5, .7], poison: [[265, 305], .35, .45],
  ground: [[18, 45], .35, .4], flying: [[190, 230], .04, .75, true], psychic: [[300, 350], .35, .6], bug: [[55, 95], .45, .5],
  rock: [[30, 60], .08, .6, true], ghost: [[255, 310], .3, .3], dragon: [[225, 265], .4, .5], dark: [[250, 20], .15, .12],
  steel: [[180, 220], .04, .7, true], fairy: [[290, 340], .25, .7],
};
export function typeWindow(type) {
  const w = WIN[type];
  if (!w) throw new Error(`unknown type ${type}`);
  return { hue: w[0], minSat: w[1], minVal: w[2], nearWhite: Boolean(w[3]) };
}
function hsv(r, g, b) {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  let h = 0;
  if (d) h = mx === r ? ((g - b) / d + 6) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, mx ? d / mx : 0, mx / 255];
}
export function classify([r, g, b], win) {
  const [h, s, v] = hsv(r, g, b), [a, z] = win.hue;
  const inType = (a <= z ? h >= a && h <= z : h >= a || h <= z) && s >= win.minSat && v >= win.minVal;
  const white = r > 235 && g > 225 && b > 200;
  if (win.nearWhite && inType) return "type";
  return white ? "white" : inType ? "type" : null;
}

const run = (xs, i, ok) => { let a = i, z = i; while (a > 0 && ok(xs[a - 1])) a--; while (z < xs.length - 1 && ok(xs[z + 1])) z++; return [a, z]; };
// rows: [{ white, type }] 화면에서 차지하는 비율(0..1). baseline: 연출 전의 한 줄(없으면 처음 여섯 줄의 평균, 그래서 녹화는 연출보다 200ms 먼저 시작한다).
// ink: 대상의 잉크 높이를 화면 높이로 나눈 값(면적을 대상 크기로 나누는 분모). hit: 맞는 순간이 있는 기술인가.
// marks: 실험실이 알려 준 시각(ms, 첫 프레임이 0): { play, emit, hit }. 있으면 단계는 그 시각으로 자르고, 화면에서는 섬광과 끝만 잰다.
export function phasesOf(rows, { fps = 30, baseline, ink = 1, hit = true, floor = .004, marks } = {}) {
  const head = rows.slice(0, 6), mean = k => head.reduce((s, r) => s + r[k], 0) / head.length;
  const base = baseline || { white: mean("white"), type: mean("type") };
  const sd = k => Math.sqrt(head.reduce((s, r) => s + (r[k] - mean(k)) ** 2, 0) / head.length);
  const thW = Math.max(3 * sd("white"), floor), thT = Math.max(3 * sd("type"), floor);
  const w = rows.map(r => r.white - base.white), t = rows.map(r => r.type - base.type);
  const ms = i => (i * 1000) / fps, area = x => x / (ink * ink);
  // any(첫 프레임과 달라진 화소)가 있으면 그것으로도 켜짐을 본다: 타입 색 범위에 안 드는 옅은 물질도 남아 있는 동안은 센다
  // 서 있는 포켓몬도 숨을 쉬듯 움직여 화면의 1.7%까지 달라진다(2026-11-21에 잰 값): 그보다 큰 변화만 물질로 센다
  const hasAny = rows[0]?.any !== undefined;
  const on = rows.map((r, i) => w[i] > thW || t[i] > thT || (hasAny && r.any > .022));
  const first = on.indexOf(true), last = on.lastIndexOf(true);
  if (marks) {
    if (!hit) marks = { play: marks.play }; // 대상을 치지 않는 기술은 착지가 불려도 맞는 순간이 없다: 시작부터 끝까지가 한 단계다
    const onC = rows.map((_, i) => w[i] > thW || t[i] > thT); // 맞기 전의 물질은 색으로만 본다: 달려드는 몸도 화소를 바꾸지만 물질이 아니다
    const z = marks.hit ?? marks.play ?? ms(Math.max(first, 0)), zi = Math.round(z * fps / 1000), rel = t => Math.round(t - z);
    const lo = Math.max(0, zi - 2), hi = Math.min(rows.length - 1, zi + 12);
    let pk = -1, pa = lo;
    for (let i = lo; i <= hi; i++) if (w[i] > pk) { pk = w[i]; pa = i; }
    let flash = null;
    // 섬광은 대상 크기의 7%를 넘는 흰 빛만 센다(불덩이의 흰 심, 도깨비불의 심은 섬광이 아니다)
    if (pk > thW && area(pk) >= .07) { const [a0, b] = run(w, pa, x => x > Math.max(thW, pk / 2)), a = Math.max(a0, lo); flash = { start: rel(ms(a)), end: rel(ms(b + 1)), peak: area(pk) }; }
    const end = rel(ms(Math.max(last + 1, zi))), phases = [];
    // 모으기(charge)를 거치지 않은 기술(몸으로 치는 기술)은 물질이 화면에 처음 보인 때가 떠나는 순간이다: 달려드는 몸은 물질이 아니다
    let a = zi; while (a > 0 && ms(a - 1) >= (marks.play ?? 0) && onC[a - 1]) a--;
    const emit = marks.emit != null && marks.emit < z ? marks.emit : Math.min(ms(a), z);
    if (marks.hit != null) {
      if (marks.emit != null && emit - marks.play > 50) phases.push({ name: "charge", start: rel(marks.play), end: rel(emit) });
      if (z - emit > 50) phases.push({ name: "travel", start: rel(emit), end: 0 });
    }
    phases.push({ name: marks.hit != null && hit ? "residue" : "show", start: 0, end });
    return { zero: z, phases, flash, typePeak: area(Math.max(...t.slice(Math.max(0, zi - 30)), 0)), residueEnd: end };
  }
  if (first < 0) return { zero: 0, phases: [], flash: null, typePeak: 0, residueEnd: 0 };

  const wPeak = Math.max(...w), wAt = w.indexOf(wPeak);
  let flash = null, zeroI = first;
  if (wPeak > thW) { const [a, z] = run(w, wAt, x => x > Math.max(thW, wPeak / 2)); flash = { a, z, peak: area(wPeak) }; }
  if (hit) zeroI = flash ? flash.a : t.indexOf(Math.max(...t));
  const zero = ms(zeroI), rel = i => Math.round(ms(i) - zero);

  const phases = [];
  if (hit && zeroI > first) {
    // 맞기 직전까지 끊기지 않고 이어진 구간이 날아가는 시간, 그 앞에 따로 떨어진 것이 모으기
    let a = zeroI; while (a > first && on[a - 1]) a--;
    if (a > first) phases.push({ name: "charge", start: rel(first), end: rel(a) });
    if (zeroI > a) phases.push({ name: "travel", start: rel(a), end: 0 });
  }
  if (last + 1 > zeroI) phases.push({ name: hit ? "residue" : "show", start: 0, end: rel(last + 1) });
  return {
    zero, phases,
    flash: flash && { start: rel(flash.a), end: rel(flash.z + 1), peak: flash.peak },
    typePeak: area(Math.max(...t, 0)), residueEnd: rel(last + 1),
  };
}

// 설계의 통과 기준: 단계 ±80ms, 섬광 길이 ±50ms이고 크기는 원작 이하, 타입 색 면적 ±25%, 남는 것 ±120ms
export function compareRow(ref, ours) {
  const fails = [];
  for (const p of ref.phases) {
    if (p.name === "residue" || p.name === "show") continue; // 끝은 아래의 ±120으로 본다
    const q = ours.phases.find(x => x.name === p.name);
    // 길이만 본다: 시작은 뒤 단계의 길이에 따라 밀리고, 그 어긋남은 그 단계에서 이미 센다
    if (!q || Math.abs(q.end - q.start - (p.end - p.start)) > 80) fails.push(p.name);
  }
  // 기술이 시작해 맞기까지(모으기 + 날아가기)는 ±120ms: 단계의 나눔이 달라도 맞는 순간은 원작과 같은 때에 온다
  const lead = o => -Math.min(0, ...o.phases.map(q => q.start));
  if (Math.abs(lead(ours) - lead(ref)) > 120) fails.push("lead");
  if (ref.flash && !ours.flash) fails.push("flash");
  else if (!ref.flash && ours.flash) fails.push("flash-extra");
  else if (ref.flash) {
    if (Math.abs(ours.flash.end - ours.flash.start - (ref.flash.end - ref.flash.start)) > 50) fails.push("flash");
    if (ref.flash.peak > 0 && ours.flash.peak > ref.flash.peak) fails.push("flash-size");
  }
  if (ref.typePeak > 0 && Math.abs(ours.typePeak / ref.typePeak - 1) > .25) fails.push("area");
  if (Math.abs(ours.residueEnd - ref.residueEnd) > 120) fails.push("residue");
  return { pass: !fails.length, fails };
}
