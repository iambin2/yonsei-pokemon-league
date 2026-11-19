import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PUSH_KINDS, inboxDays, kindLabel, pushMode, toggleKind, unreadCount } from "../src/services/announcementPushPolicy.js";

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
  assert.deepEqual(toggleKind(["notice", "old"], "record"), ["notice", "record"]);
  // 오늘의 탑 went on 2026-11-19: a device that still holds it drops it with its next switch
  assert.deepEqual(toggleKind(["notice", "daily"], "board"), ["notice", "board"]);
});

// the screen's kinds are the database's (docs/db/push_kinds.sql), so a switch never saves a kind the check refuses; the database still
// knows daily, 오늘의 탑, taken off the screen on 2026-11-19 (docs/db/drop_daily_tower.sql)
test("the switches and the database name the same kinds", () => {
  const sql = readFileSync(new URL("../docs/db/push_kinds.sql", import.meta.url), "utf8");
  const allowed = sql.match(/push_subscriptions_kinds\s+check \(kinds <@ array\[([^\]]+)\]/)[1].match(/'(\w+)'/g).map(k => k.slice(1, -1));
  assert.deepEqual(PUSH_KINDS.map(k => k.kind).sort(), allowed.filter(k => k !== "daily").sort());
});

// 받은 알림: 한국 시각의 날짜로 묶고, 오늘은 오늘, 본 뒤에 온 것만 새 알림
test("the inbox groups by the day in Seoul and lights what came after the last look", () => {
  const items = [
    { kind: "tower", body: "a", created_at: "2026-11-18T16:12:00Z" },  // 11.19 01:12 in Seoul
    { kind: "reply", body: "b", created_at: "2026-11-18T05:47:00Z" },  // 11.18 14:47
    { kind: "record", body: "c", created_at: "2026-11-17T17:54:00Z" }, // 11.18 02:54
  ];
  const days = inboxDays(items, new Date("2026-11-19T03:00:00Z"), "2026-11-18T05:00:00Z");
  assert.deepEqual(days.map(d => [d.day, d.items.map(i => [i.body, i.time, i.unread])]), [
    ["오늘", [["a", "오전 1:12", true]]],
    ["11월 18일", [["b", "오후 2:47", true], ["c", "오전 2:54", false]]],
  ]);
  assert.equal(unreadCount(items, "2026-11-18T05:00:00Z"), 2);
  assert.equal(unreadCount(items, null), 3);
  assert.equal(kindLabel("record"), "도전의 탑 신기록");
});
