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

test("each row is [centre x, centre y, feet x, feet y] in percent, or null for a picture with no ink", () => {
  for (const [slug, row] of Object.entries(table)) {
    if (row === null) continue;
    assert.equal(row.length, 4, slug);
    for (const v of row) assert.ok(Number.isFinite(v) && Math.abs(v) <= 50, `${slug} ${row}`);
  }
});
