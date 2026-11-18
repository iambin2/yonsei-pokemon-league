// every Pokémon picture has its ink read ahead (scripts/build-sprite-ink.cjs), so no picture is measured in the page
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

const table = JSON.parse(readFileSync(new URL("../src/data/sprite-ink.json", import.meta.url), "utf8"));
const slugs = readdirSync(new URL("../public/sprites/pokemon/", import.meta.url)).filter(f => f.endsWith(".webp")).map(f => f.slice(0, -5));

test("the ink table holds every picture in public/sprites/pokemon", () => {
  const missing = slugs.filter(s => !(s in table));
  assert.deepEqual(missing, [], "run node scripts/build-sprite-ink.cjs");
});

test("each row is the centre and the feet in percent and the ink's box in 64ths, or null for a picture with no ink", () => {
  for (const [slug, row] of Object.entries(table)) {
    if (row === null) continue;
    assert.equal(row.length, 8, slug);
    for (const v of row.slice(0, 4)) assert.ok(Number.isFinite(v) && Math.abs(v) <= 50, `${slug} ${row}`);
    const [x0, y0, x1, y1] = row.slice(4);
    assert.ok(Number.isInteger(x0) && 0 <= x0 && x0 < x1 && x1 <= 64 && 0 <= y0 && y0 < y1 && y1 <= 64, `${slug} ${row}`);
  }
});
