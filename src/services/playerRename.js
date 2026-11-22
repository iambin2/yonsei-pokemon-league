/* 선수 이름 바꾸기와 같은 사람 합치기 (2026-11-22, the owner's draft 2 A). The normalized records change by the RPCs in
   docs/db/handover_features.sql; the league's older records, titles, champions and rankings keep names as text in site_data, so the same
   name is changed there in the same act. Only a whole value equal to the old name changes (a holder, a winner, a ranking row's name),
   never a name inside a sentence; notices are left alone. */
const NAMED = ["tournaments", "brackets", "seasons", "titleGroups", "rankings", "champions"];

function swap(value, from, to) {
  if (typeof value === "string") return value === from ? to : value;
  if (Array.isArray(value)) {
    const next = value.map(v => swap(v, from, to));
    // a holder list that already had the kept name keeps it once
    return next.every(v => typeof v === "string") ? next.filter((v, i) => v !== to || next.indexOf(v) === i) : next;
  }
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, swap(v, from, to)]));
  return value;
}

export function renameInSiteData(data, from, to) {
  const a = String(from || "").trim(), b = String(to || "").trim();
  if (!data || !a || !b || a === b) return data;
  return { ...data, ...Object.fromEntries(NAMED.filter(k => k in data).map(k => [k, swap(data[k], a, b)])) };
}

// db: the normalized schema client (normalizedCompetitionService db()), passed in so this module stays pure for node tests
export async function renamePlayer(db, playerId, name) {
  const { error } = await db.rpc("admin_rename_player", { p_player_id: playerId, p_name: name });
  if (error) throw new Error(error.message || "이름을 바꾸지 못했습니다.");
}

export async function mergePlayers(db, keepId, dropId) {
  const { data, error } = await db.rpc("admin_merge_players", { p_keep: keepId, p_drop: dropId });
  if (error) throw new Error(error.message || "합치지 못했습니다.");
  return data;
}
