import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PUSH_KINDS, pushMode, toggleKind } from "../src/services/announcementPushPolicy.js";

const phone = { connected: true, hasPush: false, ios: false, standalone: false };

test("a browser with push can toggle it", () => {
  assert.equal(pushMode({ ...phone, hasPush: true }), "ready");
  assert.equal(pushMode({ ...phone, hasPush: true, ios: true, standalone: true }), "ready");
});

test("iOS Safari without push is told to add the site to the home screen", () => {
  assert.equal(pushMode({ ...phone, ios: true }), "install");
});

test("a browser without push still shows the button and explains why", () => {
  assert.equal(pushMode(phone), "unsupported");
  assert.equal(pushMode({ ...phone, ios: true, standalone: true }), "unsupported");
});

test("nothing shows without Supabase", () => {
  assert.equal(pushMode({ ...phone, hasPush: true, connected: false }), "none");
});

test("one kind switches alone, and the list keeps only known kinds", () => {
  assert.deepEqual(toggleKind(["notice", "match"], "board"), ["notice", "match", "board"]);
  assert.deepEqual(toggleKind(["notice", "match"], "notice"), ["match"]);
  assert.deepEqual(toggleKind(["notice", "old"], "daily"), ["notice", "daily"]);
});

// the screen's kinds are the database's (docs/db/push_kinds.sql), so a switch never saves a kind the check refuses
test("the switches and the database name the same kinds", () => {
  const sql = readFileSync(new URL("../docs/db/push_kinds.sql", import.meta.url), "utf8");
  const allowed = sql.match(/push_subscriptions_kinds\s+check \(kinds <@ array\[([^\]]+)\]/)[1].match(/'(\w+)'/g).map(k => k.slice(1, -1));
  assert.deepEqual(PUSH_KINDS.map(k => k.kind).sort(), allowed.sort());
});
