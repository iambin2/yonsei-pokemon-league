import { formatDate } from "./dateFormat.js";

/* 최근 변경 (docs/db/change_log.sql, 2026-11-22): every write to the league's records, read by operators only. Until that SQL has run
   the function does not exist and the block stays hidden (null), as every feature waiting on its SQL does. */

const TABLES = {
  matches: "경기", results: "순위", ranking_awards: "랭킹 포인트", ranking_baselines: "누적 랭킹", events: "대회", event_registrations: "신청",
  entries: "참가자", entry_participants: "참가자 명단", bracket_runtimes: "대진표", bracket_entry_slots: "대진 자리", players: "트레이너",
  seasons: "시즌", hall_of_fame_entries: "명예의 전당", championship_advancements: "챔피언스 진출", championship_qualifier_direct_selections: "챔피언스 직행",
  competition_editions: "회차", league_intakes: "통합 접수", player_partners: "파트너", site_data: "사이트 데이터", player_accounts: "기록 연결",
};
// site_data's parts, as its save names them (changed: the parts a save changed)
const PARTS = {
  announcements: "공지", titleGroups: "칭호", champions: "명예의 전당", rankings: "옛 랭킹", tournaments: "옛 대회 기록", seasons: "시즌 설정",
  brackets: "옛 대진표", pokecup: "파이컵", meta: "사이트 정보",
};
const OPS = { INSERT: "추가", UPDATE: "변경", DELETE: "삭제" };

function who(row) {
  if (row.actor_email) return row.actor_email.endsWith("@ypl.invalid") ? row.actor_email.slice(0, -"@ypl.invalid".length) : row.actor_email;
  return { service_role: "배틀 함수", anon: "방문자", authenticated: "계정" }[row.actor_role] || "SQL 편집기";
}

// one row of the log as the 운영 page reads it: what changed (title) and when and by whom (line)
export function describeChange(row) {
  const old = row.old || {}, now = row.new || {};
  let what = `${TABLES[row.table_name] || row.table_name} ${OPS[row.op] || row.op}`;
  if (row.table_name === "site_data" && Array.isArray(now.changed)) {
    what = `${now.changed.map(key => PARTS[key] || key).join(", ") || "사이트 데이터"} 저장`;
  } else if (row.table_name === "matches" && row.op === "UPDATE" && "winner_entry_id" in now) {
    what = now.winner_entry_id == null ? "경기 승자 지움" : old.winner_entry_id == null ? "경기 승자 입력" : "경기 승자 정정";
  } else if (row.table_name === "events" && row.op === "UPDATE" && "record_applied_at" in now) {
    what = now.record_applied_at ? "기록 반영" : "기록 반영 취소";
  }
  const name = now.name || old.name || now.registration_name || old.registration_name || "";
  return { title: name ? `${what}, ${name}` : what, line: [formatDate(row.at, { time: true }), who(row)].filter(Boolean).join(", ") };
}
