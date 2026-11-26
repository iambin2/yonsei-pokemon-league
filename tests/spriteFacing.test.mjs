import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { RIGHT_FACING_SLUGS, actorFlipped, facesRight, spriteSlugFromUrl } from "../src/pages/battle/spriteFacing.js";

const slugs = new Set(
  readdirSync(new URL("../public/sprites/pokemon/", import.meta.url))
    .filter(f => f.endsWith(".webp"))
    .map(f => f.slice(0, -5))
);

test("every right-facing slug exists in public/sprites/pokemon and the list is sorted and unique", () => {
  const missing = RIGHT_FACING_SLUGS.filter(s => !slugs.has(s));
  assert.deepEqual(missing, []);
  const sorted = [...new Set(RIGHT_FACING_SLUGS)].sort();
  assert.deepEqual(RIGHT_FACING_SLUGS, sorted);
});

test("actorFlipped keeps own facing right and foe facing left for both native orientations", () => {
  assert.equal(spriteSlugFromUrl("/sprites/pokemon/gardevoir.webp"), "gardevoir");
  assert.equal(spriteSlugFromUrl("/sprites/pokemon/charizard.webp?v=1"), "charizard");

  // Default left-facing sprite: own flips, foe does not
  assert.equal(facesRight("/sprites/pokemon/charizard.webp"), false);
  assert.equal(actorFlipped(true, "/sprites/pokemon/charizard.webp"), true);
  assert.equal(actorFlipped(false, "/sprites/pokemon/charizard.webp"), false);

  // Right-facing sprite: own does not flip, foe flips
  assert.equal(facesRight("/sprites/pokemon/gardevoir.webp"), true);
  assert.equal(actorFlipped(true, "/sprites/pokemon/gardevoir.webp"), false);
  assert.equal(actorFlipped(false, "/sprites/pokemon/gardevoir.webp"), true);

  // Mega form can differ from base form (Charizard faces left, Mega Charizard X faces right)
  assert.equal(actorFlipped(true, "/sprites/pokemon/charizard-megax.webp"), false);
  assert.equal(actorFlipped(false, "/sprites/pokemon/charizard-megax.webp"), true);

  // Substitute doll faces left
  assert.equal(facesRight("/sprites/pokemon/substitute.webp"), false);
  assert.equal(actorFlipped(true, "/sprites/pokemon/substitute.webp"), true);
  assert.equal(actorFlipped(false, "/sprites/pokemon/substitute.webp"), false);
});
