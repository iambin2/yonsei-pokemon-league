// 최근 변경 (docs/db/change_log.sql): how a row of the log reads on the 운영 page.
import test from "node:test";
import assert from "node:assert/strict";
import { describeChange } from "../src/services/changeLog.js";

const at = "2026-11-22T05:00:00Z";
test("a winner entered, corrected and cleared read as such, with who did it", () => {
  const row = (old, now, extra = {}) => ({ at, table_name: "matches", op: "UPDATE", actor_email: "yplofficial@ypl.invalid", actor_role: "authenticated", old, new: now, ...extra });
  assert.equal(describeChange(row({ winner_entry_id: null }, { winner_entry_id: "b" })).title, "경기 승자 입력");
  assert.equal(describeChange(row({ winner_entry_id: "a" }, { winner_entry_id: "b" })).title, "경기 승자 정정");
  assert.equal(describeChange(row({ winner_entry_id: "a" }, { winner_entry_id: null })).title, "경기 승자 지움");
  assert.match(describeChange(row({}, { winner_entry_id: "b" })).line, /yplofficial$/);
  assert.match(describeChange(row({}, { winner_entry_id: "b" }, { actor_email: null, actor_role: "service_role" })).line, /배틀 함수$/);
});

test("a site_data save names the parts it changed, and a named row carries its name", () => {
  assert.equal(describeChange({ at, table_name: "site_data", op: "UPDATE", old: {}, new: { changed: ["announcements", "titleGroups"] } }).title, "공지, 칭호 저장");
  assert.equal(describeChange({ at, table_name: "events", op: "UPDATE", old: { record_applied_at: null }, new: { record_applied_at: at, name: "제9회 YPL" } }).title, "기록 반영, 제9회 YPL");
  assert.equal(describeChange({ at, table_name: "event_registrations", op: "DELETE", old: { registration_name: "가나" }, new: null }).title, "신청 삭제, 가나");
  assert.equal(describeChange({ at, table_name: "results", op: "INSERT", old: null, new: {} }).line.includes("SQL 편집기"), true);
});
