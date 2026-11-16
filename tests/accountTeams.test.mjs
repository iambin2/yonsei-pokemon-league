// 계정에 팀과 배틀 기록 (src/services/accountTeams.js): the pure parts. The module is loaded without the sign-in (visitorAuth.js).
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../src/services/accountTeams.js", import.meta.url), "utf8")
  .replace('import { visitorSignedIn, visitorToken } from "./visitorAuth.js";', "const visitorSignedIn = () => globalThis.__signedIn, visitorToken = async () => 't';");
const m = await import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);

test("the feature is off only when the table or the function is missing", () => {
  assert.ok(m.featureMissing({ status: 404, code: "PGRST205" }));
  assert.ok(m.featureMissing({ status: 400, code: "42P01" }));
  assert.ok(m.featureMissing({ code: "PGRST202" }));
  assert.ok(!m.featureMissing({ status: 401, code: "42501" }));
  assert.ok(!m.featureMissing({ status: 0 }));
  assert.ok(!m.featureMissing(null));
});

test("signed out, every read stands aside without asking", async () => {
  globalThis.__signedIn = false;
  globalThis.fetch = () => { throw new Error("asked"); };
  assert.equal(await m.readAccountTeams(), null);
  assert.equal(await m.readMyBattles(), null);
});

test("a team is capped at 16KB", () => {
  assert.ok(m.teamFits({ id: "a", members: [{ pokemonName: "Pelipper", moves: ["a", "b", "c", "d"] }] }));
  assert.ok(!m.teamFits({ id: "a", blob: "x".repeat(m.TEAM_BYTES) }));
  assert.equal(m.teamFits({ id: "a", blob: "가".repeat(6000) }), false); // counted in bytes (18000), not characters (6000)
});

test("a team goes to a row and back as the builder saved it", () => {
  const saved = { id: "saved-1", name: "비 파티", regulationId: "m-b", updatedAt: "2026-11-14T00:00:00.000Z", members: [] };
  const row = m.teamRow(saved);
  assert.deepEqual(row, { id: "saved-1", name: "비 파티", team: saved, regulation: "m-b", updated_at: saved.updatedAt });
  assert.deepEqual(m.teamFromRow({ ...row, name: "새 이름", updated_at: "2026-11-15T00:00:00Z" }), { ...saved, name: "새 이름", updatedAt: "2026-11-15T00:00:00Z" });
});

test("only this device's teams are offered, and the device keeps both", () => {
  const account = [{ id: "a" }, { id: "b" }];
  const device = [{ id: "b" }, { id: "c" }, { id: "d" }];
  assert.deepEqual(m.onlyOnDevice(device, account).map(t => t.id), ["c", "d"]);
  assert.deepEqual(m.onlyOnDevice(account, account), []);
  assert.deepEqual(m.deviceCopy(account, device).map(t => t.id), ["a", "b", "c", "d"]);
  assert.deepEqual(m.deviceCopy([], device).map(t => t.id), ["b", "c", "d"]);
});

test("the account's battles and this device's merge once each, newest first, the account's row winning", () => {
  const device = [{ id: "x", updated_at: "2026-11-15T03:00:00Z" }, { id: "y", updated_at: "2026-11-14T00:00:00Z" }];
  const account = [{ id: "x", updated_at: "2026-11-15T03:00:00Z", my_side: "p2" }, { id: "z", updated_at: "2026-11-16T00:00:00Z", my_side: "p1" }];
  const merged = m.mergeBattles(device, account);
  assert.deepEqual(merged.map(b => b.id), ["z", "x", "y"]);
  assert.equal(merged[1].my_side, "p2");
  assert.deepEqual(m.mergeBattles(device, []).map(b => b.id), ["x", "y"]);
});
