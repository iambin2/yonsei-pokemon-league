import test from "node:test";
import assert from "node:assert/strict";
import { formatBits, functionModules, makeQr, rsRemainder, versionBits } from "../src/services/qrCode.js";

test("Reed-Solomon matches the standard's worked example (HELLO WORLD, 1-Q)", () => {
  const data = [32, 91, 11, 120, 209, 114, 220, 77, 67, 64, 236, 17, 236];
  assert.deepEqual(rsRemainder(data, 13), [168, 72, 22, 82, 217, 54, 156, 0, 46, 15, 180, 122, 16]);
});

test("format and version bits match the standard's tables", () => {
  assert.equal(formatBits(0).toString(2).padStart(15, "0"), "101010000010010"); // M, mask 0
  assert.equal(formatBits(5).toString(2).padStart(15, "0"), "100000011001110"); // M, mask 5
  assert.equal(versionBits(7).toString(2).padStart(18, "0"), "000111110010010100");
  assert.equal(versionBits(10).toString(2).padStart(18, "0"), "001010010011010011");
});

// a reader written apart from the writer: the format from both copies, the mask undone, codewords read upward-first in column pairs,
// the blocks taken apart again, every block's error words checked, and the byte segment decoded
function read(qr) {
  const { size, rows } = qr;
  const bit = (x, y) => (rows[y][x] ? 1 : 0);
  let a = 0, b = 0;
  const first = [[8, 0], [8, 1], [8, 2], [8, 3], [8, 4], [8, 5], [8, 7], [8, 8], [7, 8], [5, 8], [4, 8], [3, 8], [2, 8], [1, 8], [0, 8]];
  first.forEach(([x, y], i) => { a |= bit(x, y) << i; });
  for (let i = 0; i < 8; i++) b |= bit(size - 1 - i, 8) << i;
  for (let i = 8; i < 15; i++) b |= bit(8, size - 15 + i) << i;
  assert.equal(a, b, "the two format copies agree");
  const mask = [0, 1, 2, 3, 4, 5, 6, 7].find(k => formatBits(k) === a);
  assert.notEqual(mask, undefined, "the format is one of level M's eight");
  const flip = [(x, y) => (x + y) % 2 === 0, (x, y) => y % 2 === 0, x => x % 3 === 0, (x, y) => (x + y) % 3 === 0,
    (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0, (x, y) => (x * y) % 2 + (x * y) % 3 === 0,
    (x, y) => ((x * y) % 2 + (x * y) % 3) % 2 === 0, (x, y) => ((x + y) % 2 + (x * y) % 3) % 2 === 0][mask];
  const { fixed } = functionModules(qr.version);
  const bits = [];
  let up = true;
  for (let x = size - 1; x > 0; x -= 2) {
    if (x === 6) x = 5;
    for (let k = 0; k < size; k++) {
      const y = up ? size - 1 - k : k;
      for (const xx of [x, x - 1]) if (!fixed[y][xx]) bits.push(bit(xx, y) ^ (flip(xx, y) ? 1 : 0));
    }
    up = !up;
  }
  const words = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) words.push(bits.slice(i, i + 8).reduce((v, c) => (v << 1) | c, 0));
  const layout = { 1: [10, [16]], 2: [16, [28]], 3: [26, [44]], 4: [18, [32, 32]], 5: [24, [43, 43]], 6: [16, [27, 27, 27, 27]],
    7: [18, [31, 31, 31, 31]], 8: [22, [38, 38, 39, 39]], 9: [22, [36, 36, 36, 37, 37]], 10: [26, [43, 43, 43, 43, 44]] }[qr.version];
  const [ecLen, lens] = layout;
  const blocks = lens.map(() => ({ d: [], e: [] }));
  let at = 0;
  for (let i = 0; i < Math.max(...lens); i++) lens.forEach((len, j) => { if (i < len) blocks[j].d.push(words[at++]); });
  for (let i = 0; i < ecLen; i++) blocks.forEach(blk => blk.e.push(words[at++]));
  blocks.forEach(blk => assert.deepEqual(rsRemainder(blk.d, ecLen), blk.e, "every block's error words check"));
  const data = blocks.flatMap(blk => blk.d);
  const stream = data.flatMap(w => [7, 6, 5, 4, 3, 2, 1, 0].map(s => (w >>> s) & 1));
  const take = n => { const v = stream.splice(0, n).reduce((acc, c) => (acc << 1) | c, 0); return v; };
  assert.equal(take(4), 0b0100, "byte mode");
  const n = take(qr.version < 10 ? 8 : 16);
  return new TextDecoder().decode(new Uint8Array(Array.from({ length: n }, () => take(8))));
}

test("what is written reads back, from a short word to a long address, in every version used", () => {
  const texts = ["YPL", "https://league.pokeyonsei.com/?view=bracket&eventId=4379f233-b441-43ba-8c05-581d6c07af05",
    "https://league.pokeyonsei.com/?view=news&notice=abc123", "연세 포켓몬 리그 ".repeat(8), "x".repeat(200)];
  const versions = new Set();
  for (const t of texts) { const qr = makeQr(t); versions.add(qr.version); assert.equal(qr.size, qr.version * 4 + 17); assert.equal(read(qr), t); }
  assert.ok(versions.has(1) && [...versions].some(v => v >= 7), [...versions].join(","));
  assert.throws(() => makeQr("x".repeat(300)), /너무 깁니다/);
});
