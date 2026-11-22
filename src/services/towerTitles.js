/* 탑의 정상 (2026-11-22, the owner's draft A): each past month's first of 도전의 탑 (tower_history.sql streak_month_tops) is offered to the
   operators as a task until they grant it; the grant is kept like a record's (grants with eventId "tower:YYYY-MM"), so the month is
   never offered twice and a mistaken grant can be undone by that id. */
export const TOWER_TITLE = "탑의 정상";
export const towerGrantId = month => `tower:${String(month || "").slice(0, 7)}`;

// the months whose first has not been given the title yet, oldest first: [{ month, trainer_name, wins, grantId }]
export function towerTitlesDue(tops = [], titleGroups = []) {
  const item = titleGroups.find(g => g?.key === "etc")?.items?.find(i => String(i?.name || "").trim() === TOWER_TITLE);
  const given = new Set((item?.grants || []).map(g => g.eventId));
  return (tops || []).filter(t => t.place === 1 && t.trainer_name && !given.has(towerGrantId(t.month)))
    .map(t => ({ month: t.month, trainer_name: t.trainer_name, wins: t.wins, grantId: towerGrantId(t.month) }))
    .sort((a, b) => String(a.month).localeCompare(String(b.month)));
}
export const towerMonthLabel = month => { const [y, m] = String(month).split("-").map(Number); return `${y}년 ${m}월`; };
