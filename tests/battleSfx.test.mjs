// The battle's sound (DESIGN.md "Battle", Sound): every sound the stage names exists, every type lands with its own sound, and every
// verb a move's script uses makes a sound, through its drawing, its gesture or the event it sets.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { LIBRARY, VERB_SOUNDS, EVENT_VERBS, TYPE_HIT } from "../src/pages/battle/sfx.js";

const read = f => readFileSync(new URL(`../src/pages/battle/${f}`, import.meta.url), "utf8");
const TYPES = ["normal", "fire", "water", "electric", "grass", "ice", "fighting", "poison", "ground", "flying", "psychic", "bug", "rock", "ghost", "dragon", "dark", "steel", "fairy"];

test("every named sound is in the library", () => {
  const files = ["stageFx.js", "moveFx.js", "Stage.jsx", "sfx.js", "../BattlePage.jsx"].map(read).join("\n");
  const named = [...files.matchAll(/\bsfx\(\s*"([A-Za-z_]+)"/g)].map(m => m[1]);
  assert.ok(named.length > 40);
  for (const n of [...named, ...Object.values(VERB_SOUNDS), "st_brn", "st_par", "st_psn", "st_slp", "st_frz", "rain", "sun", "sand", "snow", "win", "lose", "draw"]) assert.ok(LIBRARY[n], `no sound "${n}"`);
});

test("every type lands with its own sound", () => {
  for (const t of TYPES) assert.equal(typeof TYPE_HIT[t], "function", t);
});

test("every verb of every move sounds", () => {
  const src = read("moveFx.js");
  const loud = /\b(charge|aura|lunge|fly|stream|fallOn|beamStrip|boltStrip|slashStrip|pathStrip|orbs|quake|heal|boost|ailment|sway|morph|leave|gatherUp|underneath|dropOnto|sfx)\(|\bD\.\w+\(/;
  const bodies = Object.fromEntries(src.split(/\n {2}D\.(\w+) = /).slice(1).reduce((out, part, i, all) => (i % 2 ? out : [...out, [part, all[i + 1].split(/\n {2}(?:D\.|const \w+ = \(|function |\/\/ |\/\*)/)[0]]]), []));
  const moves = JSON.parse(readFileSync(new URL("../src/data/move-fx.json", import.meta.url), "utf8"));
  const verbs = new Set(Object.values(moves).flatMap(s => s.split(" then ").map(p => p.trim().split(/\s+/)[0])));
  for (const v of verbs) {
    assert.ok(bodies[v] !== undefined, `verb "${v}" is not drawn`);
    assert.ok(loud.test(bodies[v]) || VERB_SOUNDS[v] || EVENT_VERBS.includes(v), `verb "${v}" makes no sound`);
  }
});

test("every clip a sound plays is in the sprite, and the sprite holds no clip nothing plays", async () => {
  const { CLIPS } = await import("../src/pages/battle/sfx.js");
  const used = new Set([...read("sfx.js").matchAll(/\bS\(c, t, (?:"([A-Za-z0-9]+)"|o\.n <= 3 \? "(\w+)" : "(\w+)")/g)].flatMap(m => m.slice(1).filter(Boolean)));
  for (const id of ["softH"]) used.add(id); // played through heavy()
  for (const id of used) assert.ok(CLIPS[id], `no clip "${id}"`);
  for (const id of Object.keys(CLIPS)) assert.ok(used.has(id), `clip "${id}" is never played (scripts/build-sfx.py)`);
});

test("a clip that sounds a note is played on a note the music's keys share", async () => {
  const { tunedRate, TUNED_CLIPS } = await import("../src/pages/battle/sfx.js");
  for (const [id, takes] of Object.entries(TUNED_CLIPS)) for (const [take, own] of takes.entries()) for (const rate of [.5, .6, .7, .85, 1, 1.1, 1.25, 1.3, 1.45]) {
    if (own == null) { assert.equal(tunedRate(id, take, rate), null); continue; }
    const m = own + 12 * Math.log2(tunedRate(id, take, rate));
    assert.ok(Math.abs(m - Math.round(m)) < .01 && [4, 7, 9, 11, 2].includes(Math.round(m) % 12), `${id} at ${rate} sounds ${m.toFixed(2)}`);
    assert.ok(Math.abs(12 * Math.log2(tunedRate(id, take, rate) / rate)) <= 2, `${id} at ${rate} is moved more than a tone`);
  }
  assert.equal(tunedRate("punch", 0, 1), null);
});
