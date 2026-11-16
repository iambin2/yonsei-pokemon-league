/* 대회 날의 경기 일정 (docs/db/match_schedule.sql): 라운드마다 시작 시각(bracket_runtimes.round_schedule), 만들어진 경기마다
   테이블(matches.table_label). 그 SQL을 실행하기 전에는 열이 없어 읽기가 실패한다: null을 돌려주고, 화면은 시각과 테이블을
   보이지 않는다 (점수와 불참의 readMatchOutcomes 와 같은 길). */
import { supa } from "../storage.js";

const DATA_SCHEMA = import.meta.env?.VITE_YPL_DATA_SCHEMA || "public";
const SOURCE = "normalized_bracket_runtime";

// a round's key is its matches' key without the match number: single:r1:m3 -> single:r1, double:gf:m1 -> double:gf
export const roundKeyOf = matchId => /^(.+):m\d+$/.exec(String(matchId || ""))?.[1] || null;

// the rows as the bracket reads them: { rounds: { key: iso }, tables: Map(node key -> label) }
export function scheduleFrom(roundSchedule, matchRows) {
  const rounds = {};
  if (roundSchedule && typeof roundSchedule === "object" && !Array.isArray(roundSchedule)) {
    for (const [key, at] of Object.entries(roundSchedule)) if (typeof at === "string" && !Number.isNaN(Date.parse(at))) rounds[key] = at;
  }
  const tables = new Map();
  for (const row of matchRows || []) {
    const label = String(row?.table_label ?? "").trim();
    if (row?.source_node_key && label) tables.set(row.source_node_key, label);
  }
  return { rounds, tables };
}

// what a box's head strip says: the site writes numbers, read as 3번 테이블
export const tableWord = label => (/^\d+$/.test(label) ? `${label}번 테이블` : label);

// a time typed for the event's day (HH:MM) as the instant it is in Korea; empty clears the round
export const roundStartIso = (day, time) => (/^\d{4}-\d{2}-\d{2}$/.test(day || "") && /^\d{2}:\d{2}$/.test(time || "") ? `${day}T${time}:00+09:00` : null);

export async function readBracketSchedule({ eventId, runtimeId } = {}) {
  if (!supa || !eventId || !runtimeId) return null;
  const db = supa.schema(DATA_SCHEMA);
  const [runtime, matches] = await Promise.all([
    db.from("bracket_runtimes").select("round_schedule").eq("id", runtimeId).eq("event_id", eventId).maybeSingle(),
    db.from("matches").select("source_node_key, table_label").eq("event_id", eventId).eq("source", SOURCE),
  ]);
  if (runtime.error || matches.error || !runtime.data) return null;
  return scheduleFrom(runtime.data.round_schedule, matches.data);
}

// the whole schedule at once (the RPC replaces it), so 되돌리기 is the earlier schedule sent again
export async function setRoundSchedule({ eventId, runtimeId, rounds }) {
  const { data, error } = await supa.schema(DATA_SCHEMA).rpc("set_normalized_round_schedule", { p_runtime_id: runtimeId, p_event_id: eventId, p_schedule: rounds || {} });
  if (error) throw new Error(error.message || "경기 일정을 저장하지 못했습니다.");
  return data || {};
}

export async function setMatchTable({ eventId, sourceNodeKey, label = null }) {
  const { error } = await supa.schema(DATA_SCHEMA).rpc("set_normalized_match_table", { p_event_id: eventId, p_source_node_key: sourceNodeKey, p_table_label: label || null });
  if (error) throw new Error(error.message || "테이블을 저장하지 못했습니다.");
}
