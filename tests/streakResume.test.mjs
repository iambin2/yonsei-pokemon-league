// 도전의 탑: the account's run as the server holds it, kept on a device that did not hold it (keepStreakResume).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const store = new Map();
globalThis.localStorage = { getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) };
const source = readFileSync(new URL("../src/services/battleService.js", import.meta.url), "utf8")
  .replace('import { callFunction, supa } from "../storage.js";', "const callFunction = null, supa = null;");
const { keepStreakResume, readStreakDraft, currentStreakGame, readSeat } = await import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);

test("a run picked elsewhere replaces this device's stale draft with its game and seat", () => {
  store.clear();
  localStorage.setItem("ypl-battle:streak-draft", JSON.stringify({ run: { run_id: "old" }, draft: [[{ species: "Raichu" }]] }));
  assert.equal(keepStreakResume({ run: { run_id: "r" }, id: "g1", token: "t", side: "p1", wins: 0, lives: 1, daily: null, party: ["Raichu"] }), true);
  assert.equal(readStreakDraft(), null);
  assert.equal(currentStreakGame(), "g1");
  assert.equal(readSeat("g1").token, "t");
});

test("a draft waiting on the server replaces another run's, and the same run's is left alone", () => {
  store.clear();
  localStorage.setItem("ypl-battle:streak-draft", JSON.stringify({ run: { run_id: "old" }, draft: [] }));
  assert.equal(keepStreakResume({ run: { run_id: "new" }, draft: [[{ species: "Pikachu" }]] }), true);
  assert.equal(readStreakDraft().run.run_id, "new");
  assert.equal(keepStreakResume({ run: { run_id: "new" }, draft: [[{ species: "Pikachu" }]] }), false);
});

test("no run on the server drops a stale draft; a game this device holds changes nothing", () => {
  store.clear();
  localStorage.setItem("ypl-battle:streak-draft", JSON.stringify({ run: { run_id: "old" }, draft: [] }));
  assert.equal(keepStreakResume({ run: null }), true);
  assert.equal(readStreakDraft(), null);
  assert.equal(keepStreakResume({ run: { run_id: "r" }, id: "g1", known: true }), false);
  assert.equal(keepStreakResume({ run: null }), false);
});

test("no run on the server forgets the game this device remembers, so its tab stops offering 이어서 하기", () => {
  store.clear();
  localStorage.setItem("ypl-battle:streak", "g1");
  localStorage.setItem("ypl-battle:streak:day", "d1");
  assert.equal(keepStreakResume({ run: null }), true);
  assert.equal(currentStreakGame(), null);
  assert.equal(currentStreakGame(true), "d1", "the other kind's game stays");
  assert.equal(keepStreakResume({ run: null }, true), true);
  assert.equal(currentStreakGame(true), null);
  assert.equal(keepStreakResume({ run: null }), false, "nothing left to forget");
});

/* 2026-11-16: 새로 도전 on a run that rested on an ended game began the new run on the server, but the device kept the old run's game,
   so its tab went on offering 이어서 하기 for a run that had ended, the server refused it every time, and the draft never showed */
test("a draft held means the run has no game: the game this device remembered goes with it", async () => {
  store.clear();
  localStorage.setItem("ypl-battle:streak", "old-game");
  localStorage.setItem("ypl-battle:streak:day", "d1");
  const { keepStreakDraft } = await import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);
  keepStreakDraft({ run: { run_id: "new" }, draft: [[{ species: "Pikachu" }]] });
  assert.equal(currentStreakGame(), null);
  assert.equal(currentStreakGame(true), "d1", "the other kind's game stays");
});

test("a draft waiting on the server forgets a game of an ended run, even when this device already holds that draft", () => {
  store.clear();
  localStorage.setItem("ypl-battle:streak", "old-game");
  localStorage.setItem("ypl-battle:streak-draft", JSON.stringify({ run: { run_id: "new" }, draft: [[{ species: "Pikachu" }]] }));
  assert.equal(keepStreakResume({ run: { run_id: "new" }, draft: [[{ species: "Pikachu" }]] }), true, "the tab is told to read again");
  assert.equal(currentStreakGame(), null);
  assert.equal(readStreakDraft().run.run_id, "new");
  assert.equal(keepStreakResume({ run: { run_id: "new" }, draft: [[{ species: "Pikachu" }]] }), false);
});
