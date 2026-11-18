import { invokeFunction, supa } from "../storage.js";
import { pushMode } from "./announcementPushPolicy.js";
import { visitorToken } from "./visitorAuth.js";

// VAPID 공개키. 비공개 짝은 Supabase의 VAPID_KEYS 비밀값에만 있다.
const VAPID_PUBLIC_KEY = "BDEiajwx8KVQ0lhlM0ML3jVCBCY9dIYs6MOITkOgYSdx4qioLWc81F3vMyTsIKWY4TITFtuVccEh612fVxIXKEE";
const SCOPE = import.meta.env.BASE_URL;
const URL_BASE = String(import.meta.env?.VITE_SUPABASE_URL || "").replace(/\/?$/, "/");
const KEY = import.meta.env?.VITE_SUPABASE_ANON_KEY || "";

export const currentPushMode = () => pushMode({
  connected: !!supa,
  hasPush: "serviceWorker" in navigator && "PushManager" in window && "Notification" in window,
  ios: /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1),
  standalone: navigator.standalone === true,
});

/* the push functions as the visitor's Google session when there is one (docs/db/push_kinds.sql ties the subscription to auth.uid(),
   so 내 경기 and 도전의 탑 reach this device), anonymous otherwise: never the operators' session, which is no trainer */
async function rpc(name, args) {
  const bearer = (await visitorToken().catch(() => null)) || KEY;
  const response = await fetch(`${URL_BASE}rest/v1/rpc/${name}`, {
    method: "POST", body: JSON.stringify(args),
    headers: { apikey: KEY, Authorization: `Bearer ${bearer}`, "Content-Type": "application/json" },
  });
  const json = await response.json().catch(() => null);
  if (!response.ok) throw Object.assign(new Error(json?.message || ""), { status: response.status, code: json?.code });
  return json;
}

async function saveSubscription(subscription) {
  const { endpoint, keys } = subscription.toJSON();
  try { await rpc("save_push_subscription", { p_endpoint: endpoint, p_p256dh: keys.p256dh, p_auth: keys.auth }); }
  catch { throw new Error("알림을 등록하지 못했습니다. 잠시 뒤 다시 시도해 주세요."); }
}

const browserSubscription = async () => (await navigator.serviceWorker.getRegistration(SCOPE))?.pushManager.getSubscription() ?? null;

// 브라우저가 구독 주소를 바꿨어도, 로그인이 바뀌었어도 서버가 따라오도록, 켜 둔 사람이 공지나 더보기에 오면 다시 저장한다.
export async function isPushOn() {
  const subscription = await browserSubscription();
  if (subscription) await saveSubscription(subscription).catch(console.error);
  return !!subscription;
}

export async function enablePush() {
  if (await Notification.requestPermission() !== "granted") throw new Error("브라우저 설정에서 이 사이트의 알림을 허용해 주세요.");
  await navigator.serviceWorker.register(`${SCOPE}sw.js`);
  const { pushManager } = await navigator.serviceWorker.ready;
  const subscription = await pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: VAPID_PUBLIC_KEY });
  try {
    await saveSubscription(subscription);
  } catch (error) {
    await subscription.unsubscribe();
    throw error;
  }
}

export async function disablePush() {
  const subscription = await browserSubscription();
  if (!subscription) return;
  await subscription.unsubscribe();
  // 지우지 못해도 다음 발송에서 410을 받고 정리된다.
  await supa.rpc("delete_push_subscription", { p_endpoint: subscription.endpoint });
}

/* 이 기기가 받는 알림 종류: { kinds, linked } (linked: 구글 계정에 이어진 기기). null: 구독이 없거나 push_kinds.sql 이 아직
   실행되지 않았다. 그때 화면은 종류를 감추고 예전처럼 공지 알림 하나만 보인다. */
export async function readPushKinds() {
  const subscription = await browserSubscription();
  if (!subscription) return null;
  try { return await rpc("push_settings", { p_endpoint: subscription.endpoint }); }
  // no such function: PostgREST answers 404 (PGRST202), as accountTeams.js featureMissing reads it
  catch (error) { if (error.status === 404 || error.code === "PGRST202") return null; throw error; }
}

export async function savePushKinds(kinds) {
  const subscription = await browserSubscription();
  if (!subscription) throw new Error("알림이 꺼져 있습니다.");
  try { return await rpc("set_push_kinds", { p_endpoint: subscription.endpoint, p_kinds: kinds }); }
  catch { throw new Error("잠시 뒤 다시 시도해 주세요."); }
}

export const notifyAnnouncement = id => invokeFunction("notify-announcement", { id });
