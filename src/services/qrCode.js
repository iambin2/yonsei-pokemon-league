/* QR 코드 (2026-11-22, 시안 9 A): 대진표와 공지의 주소를 행사장 화면에 띄워 폰으로 찍게 한다. 새 라이브러리 없이 ISO/IEC 18004를 따라
   바이트 모드(UTF-8), 오류 정정 M, 버전 1에서 10(바이트 213개까지)만 만든다. 사이트의 주소는 100바이트 안팎이라 버전 6 근처다.
   돌려주는 것: { size, dark(x, y) }. tests/qrCode.test.mjs 가 리드솔로몬 예제, 형식과 버전 비트, 그리고 따로 짠 읽기로 확인한다.
   ponytail: 버전 10(바이트 213개)까지만. 더 긴 글이 필요하면 표를 늘린다. */

// version -> [EC codewords per block, [[block count, data codewords per block], ...]] at level M
const M_BLOCKS = {
  1: [10, [[1, 16]]], 2: [16, [[1, 28]]], 3: [26, [[1, 44]]], 4: [18, [[2, 32]]], 5: [24, [[2, 43]]],
  6: [16, [[4, 27]]], 7: [18, [[4, 31]]], 8: [22, [[2, 38], [2, 39]]], 9: [22, [[3, 36], [2, 37]]], 10: [26, [[4, 43], [1, 44]]],
};
const ALIGN = { 1: [], 2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30], 6: [6, 34], 7: [6, 22, 38], 8: [6, 24, 42], 9: [6, 26, 46], 10: [6, 28, 50] };

// GF(256) with the QR polynomial x^8 + x^4 + x^3 + x^2 + 1
function gfMul(x, y) {
  let z = 0;
  for (let i = 7; i >= 0; i--) { z = (z << 1) ^ ((z >>> 7) * 0x11D); z ^= ((y >>> i) & 1) * x; }
  return z & 0xFF;
}
function rsDivisor(degree) {
  const result = new Array(degree).fill(0); result[degree - 1] = 1;
  let root = 1;
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < result.length; j++) { result[j] = gfMul(result[j], root); if (j + 1 < result.length) result[j] ^= result[j + 1]; }
    root = gfMul(root, 0x02);
  }
  return result;
}
export function rsRemainder(data, degree) {
  const divisor = rsDivisor(degree), result = new Array(degree).fill(0);
  for (const b of data) {
    const factor = b ^ result.shift(); result.push(0);
    divisor.forEach((coef, i) => { result[i] ^= gfMul(coef, factor); });
  }
  return result;
}

export function formatBits(mask) {
  const data = (0 << 3) | mask; // level M is 00
  let rem = data;
  for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
  return ((data << 10) | rem) ^ 0x5412;
}
export function versionBits(version) {
  let rem = version;
  for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1F25);
  return (version << 12) | rem;
}

const MASKS = [
  (x, y) => (x + y) % 2 === 0, (x, y) => y % 2 === 0, x => x % 3 === 0, (x, y) => (x + y) % 3 === 0,
  (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0, (x, y) => (x * y) % 2 + (x * y) % 3 === 0,
  (x, y) => ((x * y) % 2 + (x * y) % 3) % 2 === 0, (x, y) => ((x + y) % 2 + (x * y) % 3) % 2 === 0,
];

// the data codewords then the error codewords, interleaved block by block
export function codewords(bytes, version) {
  const [ecLen, groups] = M_BLOCKS[version];
  const capacity = groups.reduce((s, [n, k]) => s + n * k, 0);
  const bits = [];
  const put = (value, len) => { for (let i = len - 1; i >= 0; i--) bits.push((value >>> i) & 1); };
  put(0b0100, 4); put(bytes.length, version < 10 ? 8 : 16); bytes.forEach(b => put(b, 8));
  put(0, Math.min(4, capacity * 8 - bits.length));
  while (bits.length % 8) bits.push(0);
  const data = [];
  for (let i = 0; i < bits.length; i += 8) data.push(bits.slice(i, i + 8).reduce((v, b) => (v << 1) | b, 0));
  for (let pad = 0xEC; data.length < capacity; pad ^= 0xEC ^ 0x11) data.push(pad);
  const blocks = [];
  let at = 0;
  for (const [n, k] of groups) for (let i = 0; i < n; i++) { const d = data.slice(at, at + k); at += k; blocks.push({ d, e: rsRemainder(d, ecLen) }); }
  const out = [];
  const longest = Math.max(...blocks.map(b => b.d.length));
  for (let i = 0; i < longest; i++) for (const b of blocks) if (i < b.d.length) out.push(b.d[i]);
  for (let i = 0; i < ecLen; i++) for (const b of blocks) out.push(b.e[i]);
  return out;
}

function penalty(m, size) {
  let score = 0, dark = 0;
  const at = (x, y) => m[y][x];
  for (let pass = 0; pass < 2; pass++) for (let a = 0; a < size; a++) {
    let run = 1;
    const line = [];
    for (let b = 0; b < size; b++) line.push(pass ? at(a, b) : at(b, a));
    for (let b = 1; b <= size; b++) {
      if (b < size && line[b] === line[b - 1]) { run++; continue; }
      if (run >= 5) score += 3 + run - 5;
      run = 1;
    }
    const s = line.map(v => (v ? 1 : 0)).join("");
    for (const p of ["10111010000", "00001011101"]) for (let i = s.indexOf(p); i >= 0; i = s.indexOf(p, i + 1)) score += 40;
  }
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    if (m[y][x]) dark++;
    if (x + 1 < size && y + 1 < size && m[y][x] === m[y][x + 1] && m[y][x] === m[y + 1][x] && m[y][x] === m[y + 1][x + 1]) score += 3;
  }
  return score + 10 * Math.max(0, Math.ceil(Math.abs(dark * 20 - size * size * 10) / (size * size)) - 1);
}

// the function patterns of a version: which modules are fixed, and their colour
export function functionModules(version) {
  const size = version * 4 + 17;
  const m = Array.from({ length: size }, () => new Array(size).fill(false));
  const fixed = Array.from({ length: size }, () => new Array(size).fill(false));
  const set = (x, y, dark) => { m[y][x] = dark; fixed[y][x] = true; };
  for (let i = 0; i < size; i++) { set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0); }
  for (const [cx, cy] of [[3, 3], [size - 4, 3], [3, size - 4]])
    for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
      const x = cx + dx, y = cy + dy, d = Math.max(Math.abs(dx), Math.abs(dy));
      if (x >= 0 && x < size && y >= 0 && y < size) set(x, y, d !== 2 && d !== 4);
    }
  const pos = ALIGN[version], last = pos.length - 1;
  pos.forEach((cx, i) => pos.forEach((cy, j) => {
    if ((i === 0 && j === 0) || (i === 0 && j === last) || (i === last && j === 0)) return;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) set(cx + dx, cy + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
  }));
  // the format areas (filled per mask), the dark module, and the version blocks from version 7
  for (let i = 0; i < 9; i++) { set(8, i, false); set(i, 8, false); }
  for (let i = 0; i < 8; i++) { set(size - 1 - i, 8, false); set(8, size - 1 - i, false); }
  set(8, size - 8, true);
  if (version >= 7) {
    const bits = versionBits(version);
    for (let i = 0; i < 18; i++) { const dark = ((bits >>> i) & 1) === 1, a = size - 11 + (i % 3), b = Math.floor(i / 3); set(a, b, dark); set(b, a, dark); }
  }
  return { size, m, fixed };
}

// the zigzag order of the data modules, right to left in column pairs, up then down
export function dataOrder(size, fixed) {
  const order = [];
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert++) for (let j = 0; j < 2; j++) {
      const x = right - j, upward = ((right + 1) & 2) === 0, y = upward ? size - 1 - vert : vert;
      if (!fixed[y][x]) order.push([x, y]);
    }
  }
  return order;
}

export function drawFormat(m, size, mask) {
  const bits = formatBits(mask), bit = i => ((bits >>> i) & 1) === 1;
  for (let i = 0; i <= 5; i++) m[i][8] = bit(i);
  m[7][8] = bit(6); m[8][8] = bit(7); m[8][7] = bit(8);
  for (let i = 9; i < 15; i++) m[8][14 - i] = bit(i);
  for (let i = 0; i < 8; i++) m[8][size - 1 - i] = bit(i);
  for (let i = 8; i < 15; i++) m[size - 15 + i][8] = bit(i);
  m[size - 8][8] = true;
}

export function makeQr(text) {
  const bytes = [...new TextEncoder().encode(String(text))];
  const version = Object.keys(M_BLOCKS).map(Number).find(v => {
    const capacity = M_BLOCKS[v][1].reduce((s, [n, k]) => s + n * k, 0);
    return 4 + (v < 10 ? 8 : 16) + bytes.length * 8 <= capacity * 8;
  });
  if (!version) throw new Error("QR 코드에 담기에 너무 깁니다.");
  const { size, m: base, fixed } = functionModules(version);
  const words = codewords(bytes, version);
  const order = dataOrder(size, fixed);
  let best = null;
  for (let mask = 0; mask < 8; mask++) {
    const m = base.map(row => [...row]);
    order.forEach(([x, y], i) => {
      const bit = i < words.length * 8 && ((words[i >>> 3] >>> (7 - (i & 7))) & 1) === 1;
      m[y][x] = bit !== MASKS[mask](x, y);
    });
    drawFormat(m, size, mask);
    const score = penalty(m, size);
    if (!best || score < best.score) best = { m, score, mask };
  }
  return { size, version, mask: best.mask, dark: (x, y) => best.m[y][x], rows: best.m };
}
