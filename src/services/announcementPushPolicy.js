// 공지 알림 버튼의 상태. ready: 켜고 끌 수 있다, install: iOS라 홈 화면에 추가해야 한다,
// unsupported: 앱 안의 브라우저처럼 푸시가 없는 곳이라 이유를 알려 준다, none: Supabase가 없어 보이지 않는다.
// iOS는 홈 화면에 추가한 앱에서만 PushManager가 생긴다.
export function pushMode({ connected, hasPush, ios, standalone }) {
  if (!connected) return "none";
  if (hasPush) return "ready";
  return ios && !standalone ? "install" : "unsupported";
}

/* 알림 종류(docs/PUSH.md), 알림 화면의 판에 이 차례로 선다. personal: 구글 계정에 이어진 기기에만 오는 것. group: 판의 칸 아래 회색 줄.
   이름은 docs/db/push_kinds.sql 의 push_subscriptions_kinds 와 같아야 한다(tests/announcementPushPolicy.test.mjs). */
export const PUSH_KINDS = [
  { kind: "notice", label: "공지", group: "리그" },
  { kind: "schedule", label: "대회 일정", group: "리그" },
  { kind: "match", label: "내 경기", group: "리그", personal: true },
  { kind: "board", label: "게시판 새 글", group: "게시판" },
  { kind: "reply", label: "내 글의 댓글", group: "게시판", personal: true },
  { kind: "tower", label: "도전의 탑 순위", group: "도전의 탑", personal: true },
  { kind: "record", label: "도전의 탑 신기록", group: "도전의 탑" },
];
export const kindLabel = kind => PUSH_KINDS.find(k => k.kind === kind)?.label ?? "";

// one kind switched: the list the server keeps, in this order
export const toggleKind = (kinds, kind) => PUSH_KINDS.map(k => k.kind).filter(k => (k === kind) !== kinds.includes(k));

/* 받은 알림(docs/db/push_inbox.sql)을 한국 시각의 날짜로 묶는다: [{ day: "오늘" | "11월 18일", items: [{ ...item, time: "오전 1:12" }] }].
   seenAt(ISO) 뒤에 온 것은 unread. */
const DAY = new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", month: "numeric", day: "numeric" });
const TIME = new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", hour: "numeric", minute: "2-digit" });
const dayOf = date => { const p = Object.fromEntries(DAY.formatToParts(date).map(x => [x.type, x.value])); return `${p.month}월 ${p.day}일`; };
export function inboxDays(items, now = new Date(), seenAt = null) {
  const today = dayOf(now), seen = seenAt ? Date.parse(seenAt) : -Infinity, days = [];
  for (const item of items) {
    const at = new Date(item.created_at), label = dayOf(at), day = label === today ? "오늘" : label;
    if (days.at(-1)?.day !== day) days.push({ day, items: [] });
    days.at(-1).items.push({ ...item, time: TIME.format(at), unread: at.getTime() > seen });
  }
  return days;
}
export const unreadCount = (items, seenAt) => items.filter(item => Date.parse(item.created_at) > (seenAt ? Date.parse(seenAt) : -Infinity)).length;
