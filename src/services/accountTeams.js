import { visitorSignedIn, visitorToken } from "./visitorAuth.js";

/* 계정에 팀과 배틀 기록 (docs/db/account_teams.sql, 2026-11-16 시안 5의 A).
   구글로 로그인하면 팀 빌더의 내 팀은 계정에서 읽고 계정에 저장하고, 배틀의 기록 탭은 계정의 배틀을 이 기기의 배틀과 합쳐 보인다.
   그 SQL이 실행되기 전(표나 함수가 없다는 답)이나 로그인하지 않았을 때는 null 을 돌려주고, 화면은 지금처럼 이 기기만 쓴다.
   이 기기의 저장(localStorage)은 언제나 남는다: 로그인하지 않았을 때와 계정이 꺼졌을 때의 길이다. */

const URL_BASE = String(import.meta.env?.VITE_SUPABASE_URL || "").replace(/\/?$/, "/");
const KEY = import.meta.env?.VITE_SUPABASE_ANON_KEY || "";
export const TEAM_BYTES = 16384;
export const MY_BATTLES = 60;

// the SQL has not run: no such table (42P01, PGRST205) or function (PGRST202, 42883); PostgREST answers those with 404
export const featureMissing = error => error?.status === 404 || ["42P01", "PGRST205", "PGRST202", "42883"].includes(String(error?.code || ""));
export const teamFits = saved => new TextEncoder().encode(JSON.stringify(saved)).length <= TEAM_BYTES;
export const teamRow = saved => ({ id: saved.id, name: saved.name, team: saved, regulation: String(saved.regulationId || "").slice(0, 24), updated_at: saved.updatedAt });
export const teamFromRow = row => ({ ...(row.team || {}), id: row.id, name: row.name, updatedAt: row.updated_at || row.team?.updatedAt });
// the device's teams the account does not have yet (offered once with 계정에 올리기)
export const onlyOnDevice = (device = [], account = []) => { const ids = new Set(account.map(t => t.id)); return device.filter(t => !ids.has(t.id)); };
// what this device keeps while the account is on: the account's teams, and the device's own not yet in it
export const deviceCopy = (account = [], deviceOnly = []) => [...account, ...onlyOnDevice(deviceOnly, account)];
// the account's battles and this device's, once each (the account's row carries my_side), newest first
export function mergeBattles(device = [], account = []) {
  const byId = new Map();
  for (const b of [...account, ...device]) if (b?.id && !byId.has(b.id)) byId.set(b.id, b);
  return [...byId.values()].sort((a, b) => (Date.parse(b.updated_at) || 0) - (Date.parse(a.updated_at) || 0));
}

async function call(path, { method = "GET", body, prefer } = {}) {
  const bearer = await visitorToken();
  if (!bearer) throw Object.assign(new Error("로그인이 만료되었습니다. 다시 로그인해 주세요."), { signedOut: true });
  const response = await fetch(`${URL_BASE}rest/v1/${path}`, {
    method, body: body ? JSON.stringify(body) : undefined,
    headers: { apikey: KEY, Authorization: `Bearer ${bearer}`, "Content-Type": "application/json", ...(prefer ? { Prefer: prefer } : {}) },
  }).catch(() => null);
  if (!response) throw Object.assign(new Error("연결이 끊겼습니다. 연결을 확인하고 다시 시도해 주세요."), { status: 0 });
  const json = await response.json().catch(() => null);
  if (!response.ok) throw Object.assign(new Error(json?.message || "잠시 뒤 다시 시도해 주세요."), { status: response.status, code: json?.code });
  return json;
}
const off = async run => {
  if (!URL_BASE || URL_BASE === "/" || !KEY || !visitorSignedIn()) return null;
  try { return await run(); } catch (error) { if (featureMissing(error) || error.signedOut) return null; throw error; }
};

// the account's teams as the builder saves them, newest first; null: off
export const readAccountTeams = () => off(async () => (await call("account_teams?select=id,name,team,updated_at&order=updated_at.desc")).map(teamFromRow));
// one or more teams written to the account (a new one, or the same id again)
export function putAccountTeams(teams) {
  const list = (Array.isArray(teams) ? teams : [teams]).filter(Boolean);
  if (list.some(t => !teamFits(t))) return Promise.reject(new Error("팀이 너무 커서 계정에 저장하지 못했습니다."));
  return call("account_teams?on_conflict=auth_user_id,id", { method: "POST", body: list.map(teamRow), prefer: "resolution=merge-duplicates,return=minimal" });
}
export const deleteAccountTeam = id => call(`account_teams?id=eq.${encodeURIComponent(id)}`, { method: "DELETE", prefer: "return=minimal" });

// the battles the account sat in (my_battles), each with my_side; null: off
// ponytail: the newest 60, paged on the device with this device's own; page on the server if an account outgrows that
export const readMyBattles = () => off(() => call("rpc/my_battles", { method: "POST", body: { p_limit: MY_BATTLES, p_offset: 0 } }));
