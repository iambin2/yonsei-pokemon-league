// 알림(Web Push)을 보내는 하나뿐인 곳(docs/PUSH.md). 무엇을 누구에게 보낼지는 DB가 정하고(docs/db/push_kinds.sql 의 push_take),
// 여기서는 꺼낸 줄을 푸시 서비스로 보낸다. 같은 줄은 DB가 한 번만 내주므로 누가 몇 번 불러도 같은 알림이 두 번 가지 않는다.
//   { id }      운영진이 새 공지를 올린 뒤(운영진 토큰만): 그 공지를 줄에 넣고 보낸다. 내용은 요청이 아니라 저장된 공지에서 읽는다.
//   { sweep }   15분마다(.github/workflows/push-sweep.yml): 대회 일정, 오늘의 탑, 게시판까지 살피고 보낸다.
//   { }         배틀 함수가 공식 경기의 방을 연 뒤: 이미 쌓인 줄(내 경기)만 바로 보낸다.
// 비밀값: VAPID_KEYS(JWK 키 쌍 JSON). 공개키는 src/services/announcementPush.js 의 VAPID_PUBLIC_KEY와 짝이다.
// 배포: npx supabase functions deploy notify-announcement --use-api --no-verify-jwt --project-ref rqffrogcverfjqzjasax
// (정리와 배틀 함수의 호출은 로그인 토큰이 없다. 공지만 운영진 토큰을 이 함수가 직접 확인한다.)
import { createClient } from "npm:@supabase/supabase-js@2";
import { ApplicationServer, importVapidKeys, PushMessageError, Urgency } from "jsr:@negrel/webpush@0.5.0";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
};
const reply = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

// 내 경기는 기다리는 동안만 쓸모가 있다. 나머지는 하루 안에 닿으면 된다.
const TTL: Record<string, number> = { match: 900 };
const URGENT = new Set(["notice", "match"]);

Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const body = await req.json().catch(() => ({}));

  if (body?.id != null) {
    const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "") ?? "";
    const { data: { user } } = await db.auth.getUser(token);
    if (user?.app_metadata?.ypl_admin !== true) return reply(403, { error: "forbidden" });
    const id = String(body.id);
    const { data: site, error: siteError } = await db.from("site_data").select("value").eq("key", "ypl_data_v4").single();
    if (siteError) return reply(500, { error: siteError.message });
    const notice = site.value.announcements?.find((a: { id: string }) => a.id === id);
    if (!notice) return reply(404, { error: "notice not found" });
    const { error } = await db.rpc("push_queue_notice", { p_id: id, p_title: String(notice.title ?? "") });
    if (error) return reply(500, { error: error.message });
  }

  const { data: due, error } = await db.rpc("push_take", { p_sweep: body?.sweep === true });
  if (error) return reply(500, { error: error.message });
  if (!due.length) return reply(200, { sent: 0, failed: 0, removed: 0 });

  const server = await ApplicationServer.new({
    contactInformation: "https://league.pokeyonsei.com/",
    vapidKeys: await importVapidKeys(JSON.parse(Deno.env.get("VAPID_KEYS")!)),
  });
  type Due = { kind: string; endpoint: string; p256dh: string; auth: string; title: string; body: string; url: string };
  const results = await Promise.allSettled((due as Due[]).map(({ kind, endpoint, p256dh, auth, title, body, url }) =>
    server.subscribe({ endpoint, keys: { p256dh, auth } }).pushTextMessage(JSON.stringify({ title, body, url }), {
      ttl: TTL[kind] ?? 86400, urgency: URGENT.has(kind) ? Urgency.High : Urgency.Normal,
    })
  ));

  // 404, 410은 브라우저가 구독을 버린 것이다. 일시적인 실패는 지우지 않는다.
  const failed = results.flatMap((result, i) => result.status === "rejected" ? [{ reason: result.reason, endpoint: due[i].endpoint }] : []);
  failed.forEach(({ reason }) => console.error(String(reason)));
  const gone = [...new Set(failed
    .filter(({ reason }) => reason instanceof PushMessageError && [404, 410].includes(reason.response.status))
    .map(({ endpoint }) => endpoint))];
  if (gone.length) await db.from("push_subscriptions").delete().in("endpoint", gone);

  return reply(200, { sent: due.length - failed.length, failed: failed.length, removed: gone.length });
});
