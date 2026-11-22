/* 운영 화면의 전체 내보내기: 정규화 기록의 표를 그대로 JSON 하나로, 사람이 읽을 결과, 경기, 랭킹, 명단을 CSV 넷으로.
   읽기만 한다. 운영자의 세션으로 읽으므로 공개 전 파티와 비공개 답처럼 운영자만 보는 행도 담긴다(받은 파일은 운영진 안에서만).
   주간 백업(.github/workflows/backup.yml)은 복구용이고, 이것은 운영자가 표 계산기로 열어 보는 사본이다. */
import { readAll } from "./pagedRead.js";

export const EXPORT_TABLES = ["seasons", "events", "players", "entries", "entry_participants", "event_registrations", "matches", "results", "ranking_awards", "ranking_baselines", "entry_departures"];
// a table a later SQL file adds (entry_departures, handover_features.sql) is left out until that file has run
const MISSING = new Set(["PGRST205", "42P01"]);

export async function fetchExportTables() {
  // the connection is loaded here, so the CSV builders below stay pure (tests/recordsExport.test.mjs)
  const [{ supa }, { NORMALIZED_DATA_SCHEMA }] = await Promise.all([import("../storage.js"), import("./normalizedCompetitionService.js")]);
  if (!supa) throw new Error("데이터베이스 연결이 설정되지 않았습니다.");
  const db = supa.schema(NORMALIZED_DATA_SCHEMA);
  const out = {};
  for (const table of EXPORT_TABLES) {
    const { data, error } = await readAll(() => db.from(table).select("*"));
    if (error && MISSING.has(error.code)) continue;
    if (error) throw new Error(`${table}을 읽지 못했습니다. ${error.message || ""}`.trim());
    out[table] = data || [];
  }
  return out;
}

// 표 계산기가 한글을 깨뜨리지 않도록 BOM을 붙이고, 쉼표와 따옴표와 줄바꿈이 든 칸은 따옴표로 감싼다
export function toCsv(header, rows) {
  const cell = v => { const s = v == null ? "" : String(v); return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  return "﻿" + [header, ...rows].map(r => r.map(cell).join(",")).join("\r\n") + "\r\n";
}

export function buildExportCsvs(t) {
  const byId = list => new Map((list || []).map(x => [x.id, x]));
  const events = byId(t.events), players = byId(t.players), seasons = byId(t.seasons), entries = byId(t.entries);
  const eventName = id => events.get(id)?.name || "";
  const eventDay = id => events.get(id)?.held_on || "";
  // an entry's name: a team's own name, else its one player's
  const membersOf = new Map();
  for (const p of t.entry_participants || []) { if (!membersOf.has(p.entry_id)) membersOf.set(p.entry_id, []); membersOf.get(p.entry_id).push(p); }
  const playerName = id => players.get(id)?.display_name || "";
  const entryName = id => entries.get(id)?.display_name || (membersOf.get(id) || []).map(p => playerName(p.player_id)).filter(Boolean).join(", ");
  const byEvent = (a, b) => String(eventDay(a.event_id)).localeCompare(String(eventDay(b.event_id))) || eventName(a.event_id).localeCompare(eventName(b.event_id));

  const results = toCsv(["대회", "날짜", "순위", "최고 순위", "최저 순위", "출전", "선수"],
    [...(t.results || [])].sort((a, b) => byEvent(a, b) || (a.rank_min ?? 99) - (b.rank_min ?? 99)).map(r => [
      eventName(r.event_id), eventDay(r.event_id), r.placement_label, r.rank_min, r.rank_max, entryName(r.entry_id),
      (membersOf.get(r.entry_id) || []).map(p => playerName(p.player_id)).join(", "),
    ]));

  const matches = toCsv(["대회", "날짜", "단계", "경기", "종류", "A", "B", "승자", "A 점수", "B 점수", "결과", "입력 시각"],
    [...(t.matches || [])].sort((a, b) => byEvent(a, b) || (a.sequence_no ?? 0) - (b.sequence_no ?? 0)).map(m => [
      eventName(m.event_id), eventDay(m.event_id), m.stage_label, m.source_node_key, m.match_kind,
      m.entry_a_id ? entryName(m.entry_a_id) : playerName(m.player_a_id), m.entry_b_id ? entryName(m.entry_b_id) : playerName(m.player_b_id),
      m.winner_entry_id ? entryName(m.winner_entry_id) : playerName(m.winner_player_id),
      m.score_a, m.score_b, RESOLUTION[m.resolution] || m.resolution, m.played_at,
    ]));

  // 시즌마다 선수의 포인트와 우승, 준우승, 4강: 대회가 준 점수(ranking_awards)에 기준 점수(ranking_baselines)를 더한다
  const ranks = new Map();
  const bump = (seasonId, playerId, d) => {
    const key = `${seasonId || ""}|${playerId}`;
    const cur = ranks.get(key) || { seasonId, playerId, points: 0, wins: 0, ru: 0, top4: 0 };
    cur.points += Number(d.points || 0); cur.wins += d.wins || 0; cur.ru += d.ru || 0; cur.top4 += d.top4 || 0;
    ranks.set(key, cur);
  };
  for (const a of t.ranking_awards || []) if (a.counts_season !== false)
    bump(events.get(a.event_id)?.season_id, a.player_id, { points: a.points_delta, wins: a.win_delta, ru: a.runner_up_delta, top4: a.top4_delta });
  for (const b of t.ranking_baselines || []) if (b.scope === "season")
    bump(b.season_id, b.player_id, { points: b.points, wins: b.wins, ru: b.runner_ups, top4: b.top4s });
  const ranking = toCsv(["시즌", "선수", "포인트", "우승", "준우승", "4강"],
    [...ranks.values()].sort((a, b) => (seasons.get(a.seasonId)?.sort_order ?? 0) - (seasons.get(b.seasonId)?.sort_order ?? 0) || b.points - a.points)
      .map(r => [seasons.get(r.seasonId)?.name || "", playerName(r.playerId), Math.round(r.points * 100) / 100, r.wins, r.ru, r.top4]));

  const roster = toCsv(["대회", "날짜", "신청 이름", "선수", "신청 경로", "신청 시각"],
    [...(t.event_registrations || [])].sort((a, b) => byEvent(a, b) || String(a.created_at).localeCompare(String(b.created_at))).map(r => [
      eventName(r.event_id), eventDay(r.event_id), r.registration_name, playerName(r.player_id), r.registration_source, r.registered_at || r.created_at,
    ]));

  return { results, matches, ranking, roster };
}

const RESOLUTION = { played: "경기", forfeit: "불참", admin: "운영 판정", draw: "무승부", cancelled: "취소", unknown: "결과 전" };

export function downloadText(filename, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = Object.assign(document.createElement("a"), { href: url, download: filename });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}
