// 기술 연출을 원작과 비교하는 계산(docs/move-fx-work/fxphases.mjs): 프레임 수치에서 단계를 자르고 통과 기준으로 비교한다.
// 설계는 docs/superpowers/specs/2026-11-21-move-fx-match-design.md.
import test from "node:test";
import assert from "node:assert/strict";
import { typeWindow, classify, phasesOf, compareRow } from "../docs/move-fx-work/fxphases.mjs";

const rows = (n, fill) => Array.from({ length: n }, (_, i) => ({ white: .02, type: .01, ...fill(i) }));
const near = (a, b, tol) => assert.ok(Math.abs(a - b) <= tol, `${a} is not within ${tol} of ${b}`);

test("flash is found and timed", () => {
  // 불줄기가 프레임 12부터 날아가고, 프레임 20~24에 흰 섬광, 그 뒤 불씨가 프레임 40까지 남는다
  const r = phasesOf(rows(60, i => ({ white: i >= 20 && i <= 24 ? .15 : .02, type: i >= 12 && i < 40 ? .08 : .01 })), { fps: 30 });
  near(r.zero, 667, 1);
  near(r.flash.end - r.flash.start, 167, 34);
  const travel = r.phases.find(p => p.name === "travel");
  near(travel.end - travel.start, 267, 34);
  near(r.residueEnd, 667, 34);
});

test("self moves anchor at first change", () => {
  const r = phasesOf(rows(40, i => ({ type: i >= 7 && i < 25 ? .06 : .01 })), { fps: 30, hit: false });
  near(r.zero, 233, 1);
  assert.equal(r.flash, null);
  assert.deepEqual(r.phases.map(p => p.name), ["show"]);
});

test("a blocked or missed move measures without a flash", () => {
  const r = phasesOf(rows(40, i => ({ type: i >= 10 && i < 20 ? .05 : .01 })), { fps: 30 });
  assert.equal(r.flash, null);
  assert.ok(r.phases.length > 0);
});

test("nothing on the stage gives an empty result, not a crash", () => {
  assert.deepEqual(phasesOf(rows(20, () => ({}))).phases, []);
});

test("near-white type light is not flash", () => {
  assert.equal(classify([238, 248, 255], typeWindow("ice")), "type");
  assert.equal(classify([255, 255, 255], typeWindow("ice")), "white");
  assert.equal(classify([250, 248, 240], typeWindow("fire")), "white");
  assert.equal(classify([255, 150, 30], typeWindow("fire")), "type");
  assert.equal(classify([20, 30, 60], typeWindow("fire")), null);
});

test("every type has a window", () => {
  for (const t of "normal fire water electric grass ice fighting poison ground flying psychic bug rock ghost dragon dark steel fairy".split(" ")) assert.ok(typeWindow(t).hue.length === 2);
  assert.throws(() => typeWindow("light"));
});

test("area is divided by the target's size", () => {
  const make = ink => phasesOf(rows(30, i => ({ type: i >= 10 && i < 20 ? .09 : .01 })), { ink });
  near(make(.5).typePeak / make(1).typePeak, 4, .01);
});

test("compareRow holds the design's limits", () => {
  const ref = { phases: [{ name: "travel", start: -500, end: 0 }, { name: "residue", start: 0, end: 700 }], flash: { start: 0, end: 150, peak: .5 }, typePeak: 1, residueEnd: 700 };
  assert.deepEqual(compareRow(ref, ref), { pass: true, fails: [] });
  const long = { ...ref, phases: [{ name: "travel", start: -1100, end: 0 }, ref.phases[1]] };
  assert.deepEqual(compareRow(ref, long).fails, ["travel", "lead"]);
  // the same time to the blow, split differently: the phases miss, the lead holds
  const split = { ...ref, phases: [{ name: "charge", start: -500, end: -300 }, { name: "travel", start: -300, end: 0 }, ref.phases[1]] };
  assert.deepEqual(compareRow(ref, split).fails, ["travel"]);
  assert.deepEqual(compareRow(ref, { ...ref, flash: null }).fails, ["flash"]);
  assert.deepEqual(compareRow({ ...ref, flash: null }, ref).fails, ["flash-extra"]);
  assert.deepEqual(compareRow(ref, { ...ref, flash: { start: 0, end: 150, peak: .6 } }).fails, ["flash-size"]);
  assert.deepEqual(compareRow(ref, { ...ref, typePeak: 1.3 }).fails, ["area"]);
  assert.deepEqual(compareRow(ref, { ...ref, residueEnd: 900 }).fails, ["residue"]);
});
