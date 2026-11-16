/* 지난 대회 (홈, 다음 대회가 없는 날): 기록에 반영된 가장 최근 대회와 리그마다의 우승, 준우승.
   raw는 기록 화면과 같은 정규 기록 읽기(fetchNormalizedRecordsSnapshot)다. 결과(Result)만 읽고 예전 기록으로 대신하지 않는다.
   같은 날 같은 회차의 리그(마스터, 루키)는 한 대회로 묶고, 마스터가 앞이다. 없으면 null. */
const LEAGUE = { master: "마스터 리그", rookie: "루키 리그" };

export function lastEventResult(raw) {
  const events = (raw?.events || []).filter(e => e.record_applied_at && e.held_on && e.championship_phase !== "qualifier");
  if (!events.length) return null;
  const latest = events.reduce((a, b) => (b.held_on > a.held_on ? b : a));
  const group = events
    .filter(e => e.held_on === latest.held_on && e.round_number === latest.round_number && e.event_type === latest.event_type)
    .sort((a, b) => (a.division === "master" ? -1 : b.division === "master" ? 1 : 0));
  const player = new Map((raw.players || []).map(p => [p.id, p.display_name]));
  const entry = new Map((raw.entries || []).map(e => [e.id, e]));
  const nameOf = entryId => {
    const row = entry.get(entryId);
    if (row?.entry_type === "team") return row.display_name || "";
    const first = (raw.entryParticipants || []).find(p => p.entry_id === entryId);
    return player.get(first?.player_id) || "";
  };
  const placed = (eventId, code) => (raw.results || []).filter(r => r.event_id === eventId && r.placement_code === code).map(r => nameOf(r.entry_id)).filter(Boolean);
  const leagues = group.map(e => ({
    eventId: e.id,
    league: group.length > 1 ? LEAGUE[e.division] || "" : "",
    team: Boolean(e.is_team_event),
    count: (raw.entries || []).filter(x => x.event_id === e.id).length,
    win: placed(e.id, "champion")[0] || "",
    ru: placed(e.id, "runner_up"),
  })).filter(l => l.win);
  if (!leagues.length) return null;
  // the leagues' shared name: 38회 파이컵 마스터 리그 NPC 배틀 7 → 38회 파이컵 NPC 배틀 7
  const name = group.length > 1 ? String(latest.name || "").replace(/\s*(마스터|루키) ?리그/, "") : String(latest.name || "");
  const [, m, d] = latest.held_on.split("-");
  return { name, date: (latest.date_precision || "exact") === "exact" ? `${m}.${d}` : "", eventId: leagues[0].eventId, leagues };
}
