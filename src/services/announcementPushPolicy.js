// 공지 알림 버튼의 상태. ready: 켜고 끌 수 있다, install: iOS라 홈 화면에 추가해야 한다,
// unsupported: 앱 안의 브라우저처럼 푸시가 없는 곳이라 이유를 알려 준다, none: Supabase가 없어 보이지 않는다.
// iOS는 홈 화면에 추가한 앱에서만 PushManager가 생긴다.
export function pushMode({ connected, hasPush, ios, standalone }) {
  if (!connected) return "none";
  if (hasPush) return "ready";
  return ios && !standalone ? "install" : "unsupported";
}

/* 알림 종류(docs/PUSH.md), 더보기에 이 차례로 선다. personal: 구글 계정에 이어진 기기에만 오는 것.
   이름은 docs/db/push_kinds.sql 의 push_subscriptions_kinds 와 같아야 한다(tests/announcementPushPolicy.test.mjs). */
export const PUSH_KINDS = [
  { kind: "notice", label: "공지" },
  { kind: "schedule", label: "대회 일정" },
  { kind: "match", label: "내 경기", personal: true },
  { kind: "board", label: "게시판 새 글" },
  { kind: "tower", label: "도전의 탑 순위", personal: true },
  { kind: "record", label: "도전의 탑 신기록" },
  { kind: "daily", label: "오늘의 탑" },
];

// one kind switched: the list the server keeps, in this order
export const toggleKind = (kinds, kind) => PUSH_KINDS.map(k => k.kind).filter(k => (k === kind) !== kinds.includes(k));
