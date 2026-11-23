// The scenes scripts/visual-audit.cjs shoots. An id is the one in docs/visual-audit/inventory.md.
//   set: public (a page, shot whole) | sheet (a sheet, a dialog, a menu: the window as it stands) | state (a forced state) |
//        battle | admin (needs --login)
//   act(page, { w, h, phone }): what is pressed after the page has settled; `window: true` shoots the window, not the whole page
//   vps(width): leave the scene out at widths where it does not exist
// Nothing here presses a key that writes: a scene stops at the screen before it.
const first = (page, sel) => page.locator(sel).locator("visible=true").first();
const click = async (page, sel, opts) => { const el = first(page, sel); await el.scrollIntoViewIfNeeded({ timeout: 5000 }); await el.click({ timeout: 5000, ...opts }); };
const byText = (page, text, tag = "button, a, [role=button], [role=tab]") => page.locator(tag).filter({ hasText: text }).locator("visible=true").first();
const press = async (page, text, tag) => { const el = byText(page, text, tag); await el.scrollIntoViewIfNeeded({ timeout: 5000 }); await el.click({ timeout: 5000 }); };
const main = "#ypl-main";

const pages = [
  ["HOME", "/"], ["ABOUT-01", "/?view=about"], ["NEWS-01", "/?view=news"], ["BOARD-01", "/?view=board"],
  ["BOARD-08-sample", "/?view=board&tab=sample"], ["BOARD-08-party", "/?view=board&tab=party"],
  ["REC-02", "/?view=records"], ["REC-04", "/?view=records&me=1"], ["REC-09", "/?view=records&tab=tour"],
  ["REC-11", "/?view=records&tab=pokemon"], ["REC-14", "/?view=records&tab=rank"],
  ["BRK-01", "/?view=bracket"], ["BRK-13", "/?view=bracket&tab=private"],
  ["BLD", "/?view=builder"], ["TTL-01", "/?view=titles"], ["CHAMP-02", "/?view=champions"],
  ["CALC-02", "/?view=calc"], ["CALC-05", "/?view=calc&tab=speed"], ["CALC-06", "/?view=calc&tab=dex"],
  ["MORE-01", "/?view=more"], ["ALERT", "/?view=alerts"], ["PRIV-01", "/?view=privacy"],
  ["SHELL-10", "/?view=nothing-here"],
  ["BTL-01-open", "/?view=battle"], ["TWR-01", "/?view=battle&tab=streak"], ["BTL-05", "/?view=battle&tab=rooms"],
  ["BTL-25", "/?view=battle&tab=live"], ["BTL-26", "/?view=battle&tab=mine"],
].map(([id, url]) => ({ id, url, set: "public" }));

// a page inside a page: opened from its list, shot whole
const inner = [
  { id: "NEWS-05", url: "/?view=news", act: p => click(p, `${main} a[href*="notice="]`), whole: true },
  { id: "BOARD-02", url: "/?view=board", act: p => click(p, `${main} a[href*="post="]`), whole: true },
  { id: "BOARD-09", url: "/?view=board&tab=party", act: p => click(p, `${main} .bd-post`), whole: true },
  { id: "BOARD-09-sample", url: "/?view=board&tab=sample", act: p => click(p, `${main} .bd-post`), whole: true },
  { id: "BRK-02", url: "/?view=bracket", act: p => click(p, `${main} a[href*="eventId="]`), whole: true },
  { id: "BRK-08", url: "/?view=bracket", act: async p => { await click(p, `${main} a[href*="eventId="]`); await p.waitForTimeout(1500); await press(p, "목록", "[role=tab], button"); }, whole: true },
  { id: "BRK-14", url: "/?view=bracket&tab=private", act: p => click(p, `${main} a[href*="pb="]`), whole: true },
  { id: "TTL-01-type", url: "/?view=titles&tab=type", whole: true },
  { id: "TTL-01-region", url: "/?view=titles&tab=region", whole: true },
  { id: "TTL-01-partner", url: "/?view=titles&tab=partner", whole: true },
  { id: "TTL-01-etc", url: "/?view=titles&tab=etc", whole: true },
  { id: "TTL-01-event", url: "/?view=titles&tab=event", whole: true },
].map(s => ({ set: "inner", ...s }));

// sheets, dialogs, menus: the window as it stands
const sheets = [
  { id: "SHELL-04", url: "/", act: p => click(p, `.navlink[data-tab="more"]`), vps: w => w >= 860 && w < 1100 },
  { id: "HOME-15", url: "/?view=champions", act: p => press(p, "파티 보기") },
  { id: "REC-05", url: "/?view=records", act: p => click(p, `${main} .rc-tr`) },
  { id: "REC-12", url: "/?view=records&tab=pokemon", act: p => click(p, `${main} .rc-mon`) },
  { id: "REC-10", url: "/?view=records&tab=tour", act: p => press(p, "공식 파티") , whole: true },
  { id: "REC-14-dd", url: "/?view=records&tab=rank", act: p => click(p, `${main} .dd-btn`) },
  { id: "BRK-09", url: "/?view=bracket", act: async p => { await click(p, `${main} a[href*="eventId="]`); await p.waitForTimeout(2000); await click(p, `${main} .mb.can-open`); } },
  { id: "BRK-10", url: "/?view=bracket", act: async p => { await click(p, `${main} a[href*="eventId="]`); await p.waitForTimeout(1500); await press(p, "QR"); } },
  { id: "BRK-15", url: "/?view=bracket&tab=private", act: p => press(p, "새 사설 대진표") },
  { id: "BRK-15-errors", url: "/?view=bracket&tab=private", act: async p => { await press(p, "새 사설 대진표"); await p.waitForTimeout(700); await press(p, "대진표 만들기"); } },
  { id: "BOARD-04", url: "/?view=board", act: p => press(p, "글쓰기") },
  { id: "BOARD-04-errors", url: "/?view=board", act: async p => { await press(p, "글쓰기"); await p.waitForTimeout(700); await press(p, "등록"); } },
  { id: "BOARD-10", url: "/?view=board&tab=party", act: p => press(p, "올리기") },
  { id: "TTL-04", url: "/?view=titles", act: p => click(p, `${main} .tl-cell`) },
  { id: "BLD-13", url: "/?view=builder", act: p => press(p, "내 팀") },
  { id: "CALC-07", url: "/?view=calc", act: p => click(p, `${main} button:has-text("선택")`) },
  { id: "ALERT-04", url: "/?view=alerts", act: p => click(p, `${main} [role=switch], ${main} button:has-text("알림")`) },
  { id: "TWR-03", url: "/?view=battle&tab=streak", act: p => press(p, "도전 시작") },
  { id: "BTL-03", url: "/?view=battle", act: p => click(p, `${main} button:has-text("상대"), ${main} [class*="lobby"] button`), vps: w => w < 860 },
  { id: "BTL-28", url: "/?view=battle&tab=streak", act: p => click(p, `${main} .sh-link:has-text("열기")`) },
].map(s => ({ set: "sheet", window: !s.whole, ...s }));

// the operators' screens (--login): every scene stops before a key that writes, and the camera refuses writes besides
const openBracket = async p => { await click(p, `${main} a[href*="eventId="]`); await p.waitForTimeout(2000); };
const admin = [
  { id: "ADM-03", url: "/", whole: true },
  { id: "ADM-04", url: "/?view=admin", whole: true },
  { id: "ADM-06", url: "/?view=admin", act: p => press(p, "포인트") },
  { id: "ADM-NEWS-01", url: "/?view=news", act: p => click(p, `${main} a[href*="notice="]`), whole: true },
  { id: "ADM-NEWS-02", url: "/?view=news", act: async p => { await click(p, `${main} a[href*="notice="]`); await p.waitForTimeout(1500); await press(p, "응답 보기"); } },
  { id: "ADM-09", url: "/?view=news", act: p => press(p, "공지 작성") },
  { id: "ADM-09-form", url: "/?view=news", act: async p => { await press(p, "공지 작성"); await p.waitForTimeout(1200); await click(p, `[role=dialog] [role=switch], .modal [role=switch], [role=dialog] label:has-text("대회 신청 받기")`); } },
  { id: "ADM-09-edit", url: "/?view=news", act: async p => { await click(p, `${main} a[href*="notice="]`); await p.waitForTimeout(1500); await press(p, "수정"); } },
  { id: "ADM-TTL-01", url: "/?view=titles", act: p => press(p, "칭호 추가") },
  { id: "ADM-CHAMP-01", url: "/?view=champions", act: p => press(p, "이전 챔피언 추가") },
  { id: "ADM-CHAMP-01-edit", url: "/?view=champions", act: p => press(p, "수정") },
  { id: "ADM-REC-01", url: "/?view=records", whole: true },
  { id: "ADM-REC-02", url: "/?view=records", act: p => click(p, `${main} .rc-tr`) },
  { id: "ADM-REC-03", url: "/?view=records&tab=tour", act: p => press(p, "회차 편집") },
  { id: "ADM-10", url: "/?view=records&tab=rank", act: p => press(p, "수정") },
  { id: "ADM-BRK-01", url: "/?view=bracket", whole: true },
  { id: "ADM-BRK-02", url: "/?view=bracket", act: p => press(p, "새 대진표"), whole: true },
  { id: "ADM-BRK-03", url: "/?view=bracket", act: openBracket, whole: true },
  { id: "ADM-BRK-04", url: "/?view=bracket", act: async p => { await openBracket(p); await click(p, `${main} .mb`); } },
  { id: "ADM-BRK-08", url: "/?view=bracket", act: async p => { await openBracket(p); await press(p, "기록에 반영"); } },
  { id: "ADM-BOARD", url: "/?view=board", act: p => click(p, `${main} a[href*="post="]`), whole: true },
].map(s => ({ set: "admin", window: !s.whole, ...s }));

module.exports = [...pages, ...inner, ...sheets, ...admin];
