// 캘린더에 추가: a notice's event days as an .ics file.
import test from "node:test";
import assert from "node:assert/strict";
import { calendarFile, noticeDays } from "../src/services/calendarFile.js";

const now = new Date("2026-11-22T00:00:00Z");
test("a timed day is a three-hour block in Korean time, a day without a time is all day, and no day gives no file", () => {
  const ics = calendarFile({ id: "n1", title: "39회 파이컵, 더블", days: [{ day: "2026-11-22", time: "16:00" }], url: "https://league.pokeyonsei.com/?view=news&notice=n1", now });
  assert.match(ics, /DTSTART;TZID=Asia\/Seoul:20261122T160000\r\nDTEND;TZID=Asia\/Seoul:20261122T190000/);
  assert.match(ics, /SUMMARY:39회 파이컵\\, 더블/, "commas are escaped");
  assert.ok(ics.startsWith("BEGIN:VCALENDAR\r\n") && ics.endsWith("END:VCALENDAR\r\n"));
  assert.match(calendarFile({ id: "n2", title: "t", days: [{ day: "2026-12-01", time: "" }], now }), /DTSTART;VALUE=DATE:20261201/);
  assert.equal(calendarFile({ id: "n3", title: "t", days: [{ day: "", time: "16:00" }], now }), "");
});

test("a Champions notice gives its qualifier and its final, each named", () => {
  const days = noticeDays({ form: { eventDraft: { eventType: "champions", qualifierHeldOn: "2026-12-05", qualifierStartTime: "13:00", finalHeldOn: "2026-12-06", finalStartTime: "" } } });
  const ics = calendarFile({ id: "c", title: "챔피언스", days, now });
  assert.equal(ics.match(/BEGIN:VEVENT/g).length, 2);
  assert.match(ics, /SUMMARY:챔피언스 선발전/);
  assert.match(ics, /SUMMARY:챔피언스 본선/);
});
