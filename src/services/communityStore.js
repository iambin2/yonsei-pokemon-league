import { getData, setData, supa } from "../storage.js";
import { readAll } from "./pagedRead.js";
import { PIN_DENIED, applyLocalWrite, assembleCommunityItems } from "./communityItems.js";
import { visitorToken } from "./visitorAuth.js";

/* 방문자가 자유롭게 쓰는 공간(자유게시판, 샘플과 파티 소개글, 사설 대진표)은 community_items 표에 행 단위로 둔다.
   - 쓰기는 community_write 함수로만 들어간다. 한 사람의 쓰기가 남의 글을 건드릴 수 없고, 비밀번호는 서버가 닫힌 표와 대조한다.
   - 공식 데이터(정규화 스키마, 기록, 랭킹)와 어떤 경로로도 이어지지 않는다. 아래 키는 화면이 쓰는 이름이다. */
export const FREE_BOARD_KEY = "ypl_board_v1";
export const SHOWCASE_KEY = "ypl_showcase_v1";
export const PRIVATE_BRACKETS_KEY = "ypl_private_brackets_v1";
const BOARD_OF = { [FREE_BOARD_KEY]: "free", [SHOWCASE_KEY]: "showcase", [PRIVATE_BRACKETS_KEY]: "private_bracket" };

// a failed read's sentence: the server's own Korean when it has one, never the browser's exception (TypeError: Failed to fetch)
export const readErrorText = (error, fallback) => (/[가-힣]/.test(error?.message || "") ? error.message : fallback);

/* the board written as an account (docs/db/community_accounts.sql): reads and writes go as the signed-in visitor, so the server
   knows whose they are and shows an account its own 관리자 전용 posts. Until that SQL has run the table has no by_account column:
   the read goes on without it and the account option stays hidden (accountWriting) */
let accountColumn = null;
export const accountWriting = () => accountColumn === true;
const asVisitor = async () => { const token = await visitorToken().catch(() => null); return builder => (token ? builder.setHeader("Authorization", `Bearer ${token}`) : builder); };

export async function readCommunity(key) {
  if (!BOARD_OF[key]) throw new Error(`알 수 없는 저장 키: ${key}`);
  if (!supa) {
    const value = await getData(key);
    return Array.isArray(value?.items) ? value.items : [];
  }
  const signed = await asVisitor();
  const read = columns => readAll(() => signed(supa.from("community_items").select(columns).eq("board", BOARD_OF[key])));
  let { data, error } = accountColumn === false ? { error: { code: "42703" } } : await read("id, parent_id, payload, secret, has_pin, by_account, created_at");
  if (error?.code === "42703") ({ data, error } = await read("id, parent_id, payload, secret, has_pin, created_at"));
  else if (!error) accountColumn = true;
  if (error) throw new Error(error.message);
  if (accountColumn === null) accountColumn = false;
  return assembleCommunityItems(key === FREE_BOARD_KEY ? await withMySecrets(data || []) : data || []);
}

/* 익명으로 쓴 관리자 전용 글은 이 브라우저가 글과 비밀번호를 기억했다가 community_secret_read 로 다시 읽는다
   (docs/db/community_secret_read.sql; 실행 전이면 조용히 빠진다). 지워졌거나 비밀번호가 안 맞으면 잊는다. */
const MY_SECRETS_KEY = "ypl-board-secrets";
const mySecrets = () => { try { return JSON.parse(localStorage.getItem(MY_SECRETS_KEY) || "{}") || {}; } catch { return {}; } };
const keepMySecrets = map => { try { localStorage.setItem(MY_SECRETS_KEY, JSON.stringify(map)); } catch { /* 기억 못 해도 된다 */ } };
export const rememberSecret = (id, pin) => keepMySecrets({ ...mySecrets(), [id]: pin });
async function withMySecrets(rows) {
  const mine = mySecrets();
  const missing = Object.keys(mine).filter(id => !rows.some(r => r.id === id));
  if (!missing.length) return rows;
  const seen = new Set(rows.map(r => r.id));
  const out = [...rows];
  for (const id of missing) {
    const { data, error } = await supa.rpc("community_secret_read", { p_id: id, p_pin: mine[id] });
    if (error) continue;
    if (!data?.length) { delete mine[id]; continue; }
    for (const r of data) if (!seen.has(r.id)) { seen.add(r.id); out.push(r); }
  }
  keepMySecrets(mine);
  return out;
}

async function write(key, action, { id, parentId = null, payload = null, secret = null, pin = "" }) {
  const signed = await asVisitor();
  if (!supa) {
    if (action === "verify") return "ok";
    const next = applyLocalWrite(await readCommunity(key), { action, id, parentId, payload, secret });
    if (!(await setData(key, { items: next }))) throw new Error("잠시 뒤 다시 시도해 주세요.");
    return "ok";
  }
  const { data, error } = await signed(supa.rpc("community_write", {
    p_action: action, p_board: BOARD_OF[key], p_id: id, p_parent_id: parentId, p_payload: payload, p_secret: secret, p_pin: pin,
  }));
  if (error) throw new Error(error.message);
  if (data !== "ok" && action !== "verify") throw new Error(PIN_DENIED[data] || "잠시 뒤 다시 시도해 주세요.");
  return data;
}

// 쓰기 전에 비밀번호만 확인한다. ok 가 아니면 PIN_DENIED 의 이유로 안내한다.
export const verifyCommunityPin = (key, id, pin) => write(key, "verify", { id, pin });
// byAccount: written as the signed-in approved account (its name, no pin; the server sets both)
export const createCommunityItem = (key, id, payload, { parentId, secret, pin, byAccount } = {}) =>
  write(key, "create", { id, parentId, payload: byAccount ? { ...payload, _byAccount: true } : payload, secret, pin: byAccount ? "" : pin });
export const patchCommunityItem = (key, id, payload, { secret, pin, expectedUpdatedAt } = {}) => write(key, "update", {
  id, payload: key===PRIVATE_BRACKETS_KEY ? {...payload,_expectedUpdatedAt:expectedUpdatedAt??null} : payload, secret, pin,
});
export const deleteCommunityItem = (key, id, pin) => write(key, "delete", { id, pin });

export const newCommunityId = () => crypto.randomUUID().replaceAll("-", "").slice(0, 12);

/* 글이나 대진표를 바로 여는 주소. 폰은 공유 시트, 그 밖에는 클립보드에 복사한다. */
export function communityUrl(params) {
  const url = new URL(window.location.href);
  url.search = new URLSearchParams(params).toString();
  url.hash = "";
  return url.href;
}

export async function shareLink(params, title = "") {
  const url = communityUrl(params);
  if (matchMedia("(pointer: coarse)").matches && navigator.share) {
    try { await navigator.share({ url, title }); return "shared"; }
    catch (error) { if (error?.name === "AbortError") return "cancelled"; }
  }
  try { await navigator.clipboard.writeText(url); return "copied"; }
  catch { window.prompt("주소를 복사해 주세요.", url); return "prompted"; }
}

/* 게시판 사진과 신고 (docs/db/handover_features.sql, 2026-11-22, the owner's draft 10 A).
   사진은 긴 변 1280의 webp로 줄여 공개 버킷 board 에 'YYYYMM/12자.webp'로 올리고, 그 주소를 글의 링크 칸에 넣는다. 512KB를 넘으면 더 줄인다. */
const STORAGE_BASE = String(import.meta.env?.VITE_SUPABASE_URL || "").replace(/\/?$/, "/");
const STORAGE_KEY = import.meta.env?.VITE_SUPABASE_ANON_KEY || "";
export async function uploadBoardImage(file) {
  if (!STORAGE_KEY || !file) throw new Error("사진을 올릴 수 없습니다.");
  const bitmap = await createImageBitmap(file).catch(() => { throw new Error("사진을 읽지 못했습니다."); });
  let blob = null;
  for (const [side, quality] of [[1280, 0.82], [1280, 0.6], [960, 0.6]]) {
    const scale = Math.min(1, side / Math.max(bitmap.width, bitmap.height));
    const canvas = Object.assign(document.createElement("canvas"), { width: Math.round(bitmap.width * scale), height: Math.round(bitmap.height * scale) });
    canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    blob = await new Promise(done => canvas.toBlob(done, "image/webp", quality));
    if (blob && blob.size <= 512 * 1024) break;
  }
  if (!blob || blob.size > 512 * 1024 || blob.type !== "image/webp") throw new Error("사진이 너무 큽니다.");
  const now = new Date(), path = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}/${newCommunityId()}.webp`;
  const response = await fetch(`${STORAGE_BASE}storage/v1/object/board/${path}`, {
    method: "POST", body: blob, headers: { apikey: STORAGE_KEY, Authorization: `Bearer ${STORAGE_KEY}`, "Content-Type": "image/webp" },
  }).catch(() => null);
  if (!response?.ok) throw new Error("사진을 올리지 못했습니다. 잠시 뒤 다시 시도해 주세요.");
  return `${STORAGE_BASE}storage/v1/object/public/board/${path}`;
}
