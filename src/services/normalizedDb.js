import { supa as client } from "../storage.js";

const DATA_SCHEMA = import.meta.env.VITE_YPL_DATA_SCHEMA || "public";
export const CHAMPIONS_EVENT_SELECT_FIELDS = DATA_SCHEMA === "ypl_schema_validation"
  ? `,
      championship_phase,
      championship_final_event_id,
      qualification_slots`
  : "";

export const EVENT_DETAIL_SELECT = `
  id,
  competition_edition_id,
  name,
  event_type,
  division,
  battle_format,
  competition_format,
  competition_settings,
  is_team_event,
  regulation_id,
  cup_rule_id,
  cup_rule_settings,
  registration_settings,
  season_id,
  round_number,
  held_on,
  status,
  submission_target_at,
  team_reveal_mode,
  team_revealed_at,
  record_applied_at${CHAMPIONS_EVENT_SELECT_FIELDS}
`;

export const NORMALIZED_DATA_SCHEMA = DATA_SCHEMA;

// also handed to the pure modules (playerRename, recordsExport) by their screens, so node tests never load the connection
export function db() {
  if (!client) throw new Error("데이터베이스 연결이 설정되지 않았습니다.");
  return client.schema(DATA_SCHEMA);
}

export function fail(error, fallback) {
  const next = new Error(error?.message || fallback);
  next.code = error?.code || "YPL_DB_ERROR";
  next.details = error?.details || null;
  throw next;
}

export async function getEvent(eventId) {
  if (!eventId) return null;

  const { data, error } = await db()
    .from("events")
    .select(EVENT_DETAIL_SELECT)
    .eq("id", eventId)
    .maybeSingle();

  if (error) fail(error, "대회 정보를 불러오지 못했습니다.");
  return data || null;
}

// 이름 비교는 띄어쓰기와 대소문자를 무시해야 해서 PostgREST 필터로 좁히지 않고 전부 읽는다.
// ponytail: 선수 전체 읽기, 수천 명이 되면 같은 식의 생성 열을 두고 그 열로 거른다.
export async function loadPlayerNames() {
  const { data, error } = await db().from("players").select("id, display_name");
  if (error) fail(error, "참가자 정보를 확인하지 못했습니다.");
  return data || [];
}
