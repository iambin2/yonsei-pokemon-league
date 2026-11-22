// 탑의 정상: each past month's first of 도전의 탑 is offered until granted, once a month.
import test from "node:test";
import assert from "node:assert/strict";
import { towerTitlesDue, towerGrantId } from "../src/services/towerTitles.js";
import { applyTitleAwards, revertTitleAwards } from "../src/services/titleAwards.js";

const tops = [
  { month: "2026-12-01", place: 1, trainer_name: "김선수", wins: 12 },
  { month: "2026-12-01", place: 2, trainer_name: "이제빈", wins: 9 },
  { month: "2026-11-01", place: 1, trainer_name: "이제빈", wins: 9 },
];
test("the first of each past month is due until granted, and a grant is undone by its month", () => {
  let groups = [{ key: "etc", items: [] }];
  assert.deepEqual(towerTitlesDue(tops, groups).map(t => [t.month, t.trainer_name]), [["2026-11-01", "이제빈"], ["2026-12-01", "김선수"]]);
  const due = towerTitlesDue(tops, groups)[0];
  groups = applyTitleAwards(groups, [{ groupKey: "etc", title: "탑의 정상", holder: due.trainer_name, eventId: due.grantId }]);
  assert.deepEqual(towerTitlesDue(tops, groups).map(t => t.month), ["2026-12-01"]);
  assert.deepEqual(groups[0].items[0].holders, ["이제빈"]);
  groups = revertTitleAwards(groups, towerGrantId("2026-11-01"));
  assert.equal(groups[0].items.length, 0, "the title the month made goes with it");
});
