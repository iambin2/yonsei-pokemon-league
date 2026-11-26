# Visual audit diagnostic report

2026-11-22 to 23. Audited branch `design/scoreboard` (3ffd32c) on the dev server connected read-only to production data.

## How to read this report

- Screenshot paths are relative to `docs/visual-audit/shots/`. This folder is not committed to git (regenerate with `scripts/visual-audit.cjs`, see `plan.md`). Screenshots contain real participant names.
- Measurements are CSS px read from `getBoundingClientRect` and `getComputedStyle` at dpr 1. Items marked "read from shot" were read directly from the image.
- Screen IDs match `inventory.md`.
- Severity levels are High (anyone notices), Medium (attentive users notice), and Low (noticeable only side by side).
- Items marked "verified" were re-measured or cross-checked against screenshots and code independently. Unmarked items come from a single audit pass.

## Key takeaways

1. The token system holds up well. Across the 20 site CSS files (excluding the 3 battle files), spacing tokens appear 1,205 times, transition tokens appear 136 times, and raw transition declarations appear 0 times. Rendered text sizes across 1,781 captures stay strictly within five scales (12/16, 15/20, 15/24, 20/28, and 32/40). Page-level horizontal overflow is 0.
2. Most findings stem from layout composition rather than out-of-system values: mobile layouts stretched unchanged across 1200px desktop widths, identical roles rendered differently across pages, empty DOM elements doubling gaps, and unhandled viewport ranges between 860 and 1199.
3. The audit also uncovered four functional bugs (section 9), kept out of the visual fix plan.

---

## 1. Shared root causes (recurring across screens)

### K-01 Short controls stretched to 1200 width on desktop (high)
Full-width mobile controls are reused unchanged at 860 and above, separating controls from their values and targets by hundreds of pixels.

| Where | Measurement (1440) | Cause | Shot |
|---|---|---|---|
| Records trainers tab: search, sort chips, season dropdown stacked in three rows (verified) | Search 1200x52, gap 12, chips 178x32, gap 2, dropdown 1200x52 ("모든 시즌" text 50, arrow 1090 away) | `RecordsPage.jsx:343-347`, `records-board.css:76-77`, `components.css:103` | `REC-02/1440x900-dark.png` |
| Rankings tab season dropdown and menu | Button 1200x52 (text 68), menu 1200x356, checkmark 1090 from text | `components.css:103-124` | `REC-14-dd/1440x900-dark.png` |
| Private bracket tool buttons | Result entry, share link, and two image buttons each 599x52, edit 1200x52 (official brackets put the same buttons on one 44px row right of the title, width 62 to 113) | `brackets.css:24-26`, `BracketsPage.jsx:2694-2701` | `_extra-c/pb-1440x900.png` |
| Admin entry buttons: add title, add past champion, edit scores, edit round, delete bracket | Each 1200x52. Rankings tab stacks add season (599) + add cumulative tab (599) + edit scores (1200) into a 1200x104 block. Meanwhile write notice and new bracket are 50x20 underlined links | `TitlesPage.jsx:124`, `ChampionsPage.jsx:106`, `RecordsPage.jsx:896,1136-1139,1158,1174`, `BracketsPage.jsx:3074` | `ADM-REC-03-offline/rank-1440x900-dark.png`, `ADM-TTL-01-offline/page-1440x900-dark.png` |
| Bottom sheet buttons (share link on trainer and Pokemon sheets) | 1160x52 | `RecordsPage.jsx:262,1094` | `REC-05/1440x900-dark-sheet.png` |
| Team builder two rule dropdowns | 599 + 599 (misaligned with the 559/611 column split below) | `builder.css:149` | `BLD-07/1440x900-dark-team-full.png` |
| Bracket wizard step 1 | Both dropdowns 1200, Cancel and Next in right 439 column, 760 away from inputs (read from shot) | `BracketsPage.jsx:632-872` | `ADM-BRK-02/1440x900-dark.png` |

### K-02 Reading prose wider than the 709 column (high)
DESIGN.md "Made by people" caps reading prose at 709 (about 47 characters per line).

| Where | Measurement | Cause |
|---|---|---|
| Free board post body and comments | `.prose` 1200 (about 95 characters per line), YouTube 1200x675, comment form nickname and password 599 each, submit button 1089 from label | `BoardPage.jsx:265-276`, `posts.css:57,63` (709 only applies to `.bd-art.many`) |
| Rankings tab footnote | Ink width 1032, about 80 characters per line | `records-board.css:24` |

Shots: `BOARD-03/1440x900-dark.png`, `REC-14/1440x900-dark.png`

### K-03 Search input jumps and shrinks while typing (high, verified)
- The result count ("19건", "0건") sits outside the right edge of the input, changing input width on every digit shift from 1200 to 1157 to 1167 (at 390: 350 to 321). `ListSearch.jsx:13`, `board.css:209-215`.
- On Notices, typing a query hides the "다가오는 대회" section, jumping the active input up by 124 (at 1440: top 344 to 220; at 390: 352 to 212). `NewsPage.jsx:269,279`.
- On private brackets at 390, the primary button squeezes the search input down to 143 (113 at 360), clipping placeholder text and leaving roughly 60px once a query is entered. `posts.css:110-111`, `BracketsPage.jsx:2726`.
- Shots: `REC-02/1440x900-dark-search.png`, `NEWS-02/1440x900-dark-none.png`, `BRK-13-noresult/390x844-dark.png`

### K-04 Inconsistent gap below section headings (medium)
The spec calls for 12 (`--s3`). Actual values vary across five sizes:

| Gap | Where | Cause |
|---|---|---|
| 2 | Bracket group heading ("1조") to first row | `BracketsPage.jsx:1552-1553` (bare h2 inside stack) |
| 12 | Notices "다가오는 대회" and most sections | `board.css:11` |
| 14 | Bracket list view round headings, board "댓글 N", records tournaments season headers | `.sh` 12 + stack seam 2. `BracketsPage.jsx:1324`, `posts.css:77`, `records-board.css:80` |
| 24 | Admin section headings | `.sh` 12 + `.ad-block` gap 12. `admin.css:139` |
| 34 | Between season chapters in records tournaments tab (spec is 32) | `records-board.css:80` |

### K-05 Inconsistent spacing below h1 and tab bars (medium)
- Distance from h1 to the next element at 1440 is 20 on Notices, Alerts, and About, versus 32 on More and Records. `news.css:9`, `more.css:27`, `hall.css:80`, `more.css:6`, `.rc-tabs`.
- Distance from tab bar to content is 12 on Records versus 20 on Titles. `records-board.css:10`, `titles.css:7`.
- Back links sit at different top edges on identical sub-views: 148 on notice posts (side column is 160) versus 160 on the registration form. On mobile, the 44px back button box overlaps LiveStrip by 6. `news.css:18`, with the same rule in `brackets.css:15` and `posts.css:40`. Verified in 1440 shots where the back link sits 12 above the side column.

### K-06 New-post lamp and row-end lamp placement (medium, verified)
- Three different orders appear: lead panels put the lamp before the text (gap 8), rows put the lamp after the text (gap 22), and More "새 알림" puts the lamp before the text. `NoticeRows.jsx:13`, `Board.jsx:101-102,116`, `more.css:10`.
- On desktop, the row-end lamp has 12 right padding (lamp ends at 1308), while every other element on the same screen uses 20 (1300). Home uses 22. `board.css:30`, `home.css:74`.
- Shots: `HOME/1440x900-dark.png`, `NEWS-01/1440x900-dark.png`

### K-07 Two font weights for gray subtitle lines (medium)
Lead panels render gray subtitle lines at weight 400 (`.reg`), while rows directly beneath them render at 600 across Notices, Bracket lists, Alerts, and More. Hierarchy 5 specifies 600 for labels and 400 for gray lines. `Board.jsx:99` (Row line omits `reg`), `Board.jsx:119`.

### K-08 Shared confirmation dialog and sheet components (medium)
- The two dialog buttons do not keep the 1 : 1.618 ratio: 158 : 230 (1.46) at 390 and 229 : 345 (1.51) at 1440, because `flex-grow` applies only to space left after padding. `components.css:223-225`.
- The notification enable dialog stacks both buttons vertically (two 536x52 buttons, 20 apart). `PushControl.jsx:57-60`, `board.css:275`.
- Desktop dialogs have a 20px empty strip at the top where `.grip` reserves space, leaving 28 above the title, 20 on the sides, and 32 below. `components.css:189,235,237`.
- The close `×` sits 4 lower than the title (title vertical center 68 vs `×` center 72; 94 vs 98 at 390). `components.css:208`.
- Dangerous confirmations show "✓ 삭제" just like save buttons. `danger` is passed in but never used in rendering, and alert dialogs show "✓ 닫기". Only the battle menu forfeit button uses an untokenized `#4A1820`. `SiteDialog.jsx:23-24,66-71`, `battle.css:348`. Moved to `questions.md` (Q-01) because DESIGN.md Hierarchy defines dangerous confirmations as primary actions.
- Bottom sheet actions vary by sheet: the party sheet uses a full-bleed 1200x52 dock, the champion sheet uses an inset 1160x52 button, trainer and Pokemon sheets put 20 above share link, and the title sheet puts 32 (width 536). `RecordsPage.jsx:136,262,1094`, `ChampionSheet.jsx:33`, `hall.css:43-44`, `TitlesPage.jsx:76`, `titles.css:38`.
- Shots: `BRK-09/1440x900-dark.png`, `ALERT-04/1440x900-light.png`, `ADM-09-offline/delete-confirm-1440x900-dark.png`, `REC-13/1440x900-dark.png`

### K-09 Floating surfaces lack visible edges (medium)
- The "더보기" popover (shown only at 860 to 1099) has item color `rgb(18,41,79)` over panel `rgb(14,36,73)` with no border or scrim, blending into LiveStrip in light theme. Item padding is 12 instead of desktop `--pad` 20. `components.css:139,149`.
- Dropdown menus share `rgb(14,36,73)` with underlying rows, and selected value (x 140) is misaligned by 8 from menu items (x 132). `components.css:116-124`.
- Shots: `SHELL-04/1024x768-light.png`, `REC-14-dd/1440x900-dark.png`

### K-10 Focus ring invisible on inverted panels (medium)
A 2px white outline sits on a white inverted background. Measured on the top-1 trainer panel: `outline: 2px solid rgb(255,255,255)` over `rgb(255,255,255)`. Affects every inverted interactive surface. `tokens.css:175`.

### K-11 Secondary buttons inside panels match the panel color (medium)
On the registration form, the "구글 로그인" button has background `rgb(14,36,73)` matching its row, making a 138x52 button look like floating text. Other files (`bracket.css:74`, `team-builder.css:26`, `components.css:198`) override `--btn-bg: var(--panel-2)`. `NewsPage.jsx:487`. The same issue hits inputs inside the collapsed link section of the notice sheet (both `rgb(18,41,79)`, `.fold` missing from `admin.css:123`), multiple-choice option dots `.fb-dot` (same color as card, `admin.css:61-64,124`), and hovered top-3 record panels where inner cells disappear into the panel (`records-board.css:37,40`).

### K-12 Three different treatments for short last grid rows (medium)
- Left open: past champions wall (5 champions in 3 columns at 1440 leaves a 399x192 gap on row 2; 2 columns at 768 does the same). `hall.css:73,76`.
- Padded with empty panels: medal boards (7 partner + 5 empty, 3 other + 3 empty, 8 event + 4 empty). `TitleFaces.jsx:69,84`, `TitlesPage.jsx:25`.
- Unfilled cells: 7 alert categories in 2 columns (219x64 empty cell), 18 monotype types in 4 columns on mobile (2 cells on last row), Pokemon sheet items 3 / abilities 2 / natures 3. `board.css:291`, `builder.css:44`.
- The 404 page uses 1 + 2 (439 / 219 / 219) for its three links. `board.css:316-317`.

### K-13 Empty elements double spacing (medium)
- Team builder has a 40px gap between the rules row and "포켓몬 선택" because `.tb-rules` stays rendered with all hidden children, applying 20 twice. `builder.css:150-151`.
- Team builder editor has 44 between ability/item/nature and stat points, and 32 between stat points and moves due to an empty `<p class="tb-field-meta">`. `TeamBuilderPage.jsx:1644`.
- Official submission panel puts 32 between the name field and error line versus 20 between other blocks. `team-builder.css:14,30`.
- Notice sheet tournament settings block has 20 above and 40 below. `AdminEditors.jsx:216`.
- Points sheet puts 32 between fields (notice sheet uses 20) and 24 from title to first label. `admin.css:141`.
- Shots: `BLD-07/1440x900-dark-team-full.png`, `ADM-06-offline/points-1440x900-dark.png`

### K-14 Unhandled viewport width ranges (high, verified)
- At 1100 to 1150, the top bar breaks. The moment all 12 tabs appear, "명예의 전당", "팀 빌더", and "진행 중" wrap to two lines and the account button truncates to "내 …". This appears on tournament days when both the live lamp and account button are present, and clears at 1160. `Navigation.jsx:14` (`WIDE = 1100`). Shot: `SHELL-01/1100x900-dark-topbar.png`
- At 860 to 1099, the team builder candidate list is trapped inside a 198px inner scroll box (124px rows, showing 1.6 rows). `team-builder.css:138-141`. Shot: `BLD-04/1099x900-dark.png`
- At 860 to 1199, battle does not fit in one viewport. At 860x900 the bench clips by 4 and the header drops below the deck (y 936); at 1199x800 all four move buttons sit off-screen (y 851 to 935) with document height 2467. Two-column layout only starts at 1200. `battle.css:157-182`. Shot: `BTL-12/moves-1199x800-dark.png`

### K-15 Touch and click targets under 44px (medium)
- Mobile stat point sliders have 32px rows with 0 gap between the six rows, while the same control in the calculator is 44. `builder.css:85`.
- Desktop comment actions (reply, edit, delete, report) are 30.7x44 (`posts.css:81`), and tab bar buttons are 22.9 to 34.4 wide (`board.css:243`).
- Desktop sound sheet switches are 52x32, and section link `.sh-link` "열기" is 23x20.
- Desktop admin bar buttons are 40 and question tools are 32.
- Full motion and interaction target list is in section 8.

### K-16 Repeated copy (low to medium)
Empty notice search says "0건" + "맞는 공지가 없습니다." + "'없는말'에 맞는 공지를 찾지 못했습니다." (`NewsPage.jsx:280-283`). Unclaimed title sheets say "주인 0명" + "아직 주인이 없습니다." (`TitlesPage.jsx:67-74`). Champion sheets say "현 챔피언" + "6대 챔피언". Team builder says "임시저장됨" + "마지막 임시저장 오후 11:21" (`TeamBuilderPage.jsx:1589,1599`). Move sheets show "위력 70" alongside "70" on the right. Room list shows three 0 counters plus "기다리는 방이 없습니다.". Tournament-day notice posts show "진행 중" three times above the fold. Opponent sheet repeats "상대" as both title and label, and the gate sheet uses "구글 로그인" for both title and button.

### K-17 Empty search results look different across pages (medium)
Board shows a two-line text panel. Private brackets and Notices put a two-digit segment on the left, but value 0 has no lit strokes and reads as an unlit "88". Notices also styles "최근 공지" below it as a 12px label while "다가오는 대회" on the same page is an h2 at 20. `BoardPage.jsx:294,508`, `BracketsPage.jsx:2729`, `NewsPage.jsx:280-283`.

---

## 2. Shell, home, about, notices, more, alerts

| ID | Finding | Measurement | Cause | Severity |
|---|---|---|---|---|
| A-02 | Home clock overflows the viewport at 360 (verified: "시작" clips in shot, date and deadline touch the right edge). `HOME/360x800-dark.png` | `.ho-board.today` 335 (clock 292 + 12 + "시작" 31) inside 296 panel, right edge 366.6. At 390 right margin is 3 (spec is 12) | `home.css:15-16` (grid without column tracks) | High |
| A-04 | More at 1440: admin login floats in the middle of the right column (verified: children at 168 to 244 and 714 to 766, 470 gap between). `MORE-01/1440x900-dark.png` | Left column ends at 1054, right column at 830 | `more.css:18` (`span 3`, left has four groups) | High |
| A-05 | Champion sheet at 1440: inverted 1160x156 panel holds content only in the left 195. `HOME-15/1440x900-dark.png` | Right 945 is blank white (spec caps inkless panel band at 40) | `hall.css:46`, `ChampionSheet.jsx:23-28` | High |
| A-10 | Notice post side column: four 52px buttons of equal weight under the primary button (edit registration, submit party, calendar, share link). On mobile they sit after the 2390px body | Each 439x52, 2 apart. In the list view "캘린더에 추가" is a 72x20 underlined link | `news.css:22,33,67`, `NewsPage.jsx:221-233` | Medium |
| A-12 | Same fact rows styled differently on home versus notices | Home: right-aligned 700 values, `--panel-2`, padding `0 20`. Notices: 72 label column, left-aligned 600 values, `--panel`, padding `12 20` | `home.css:21-23`, `board.css:218` | Medium |
| A-13 | Home hero at 1440: 72 empty band below title (verified) | "개인전" bottom 232, clock top 304. Same date and time repeated three times | `home.css:64` (`align-items: end`) | Medium |
| A-16 | Edit registration: error message sits 36 below input. `NEWS-14-errors/1440x900-dark.png` | Name field error is 8 below; password error is pushed below the hint to 36 | `NewsPage.jsx:465-466` | Medium |
| A-20 | About: 56 empty band under lead panel, numbered "2" and "3" with no "1", two column bottoms off by 122, split differs from home (740+2+458 vs 759+2+439) | | `hall.css:81,109,113`, `AboutPage.jsx:56-59`, `home.css:62` | Medium |
| A-21 | About mobile: season flow wraps 2x2 without an arrow on the third cell, reading as two pairs. Inverted 52px strip looks like a primary button but is not clickable | | `hall.css:94-97` | Medium |
| A-22 | Mobile top bar: "내 기록" at 15/600 beside "진행 중" at 12/700 | | `shell.css:34`, `SiteHeader.jsx:93` | Low |
| A-23 | Mobile footer: disclaimer text at 15/24 is larger than copyright line at 12/16 | | `shell.css:127,132` | Low |
| A-25 | Home 360: past champions wall truncates season name to "클래식 시즌…", hiding the number | 4 of 5 cells | `home.css` `.ho-line` | Low |
| A-26 | Notice list at 1440: over 1000px empty on the right of rows (spec has lists span 1200) | | Preference (Q-08) | Low |
| A-28 | Privacy: wrapped second lines of numbered lists return under the number (x 120) | | `Prose` list | Low |

No issues found: mobile tab bar, top bar at 860/1099/1280/1920, registration form validation errors (8 below input, 20 to next field), privacy two-column top alignment.

## 3. Records, titles, hall of fame

| ID | Finding | Measurement | Cause | Severity |
|---|---|---|---|---|
| B-02 | Rank numbers are not right-aligned by digit | "4" ink 140 to 149.6, "10" 140 to 159.2 (left-aligned) | `records-board.css:48` | Medium |
| B-03 | League tag width shifts the following column | Badge column left edge: master rows 312.5, rookie rows 301.1 (breaks between ranks 29 and 30) | `records-board.css:57` (`auto 1fr`) | Medium |
| B-04 | Only the first of the top 3 panels has different counter alignment | First: transparent cell, label x 140 aligned with name. Second and third: `--panel-2` cell, label 688.9 (12 inside name at 676.9) | `records-board.css:37,40` | Medium |
| B-06 | Tournaments tab is 15,568px tall at 1440. All 62 tournaments render as 1200-wide cards, with a single 45px name on a 1160x44 placement strip and toggle label 1040 away from its arrow. `REC-09/1440x900-dark.png` | 14,456px at 390 | `records-board.css:85-106`, `RecordsPage.jsx:831-852` | High |
| B-06b | Expanded official party rows match the card background (verified: dead selector mismatch) | Row `rgb(14,36,73)` = card; 2px seams disappear | `records-board.css:108` (targets `.records-round-detail .row`, actual class is `.rc-party-row`) | Medium |
| B-08 | Mixed ranking row heights | 84 / 64 / 52 / 52 / 52 / 64 / 64 / 52 / 52 (four tied "공동 6위" rows are 64, 64, 52, 52) | `board.css:37-39` | Low |
| B-12 | Hall of fame crown: 120 empty above the six Pokemon at 1440, and at 390 the current champion's six (55.3) match the past wall size (54.3) | | `hall.css:22-24,70-72` | Medium |
| B-14 | Titles tab bar: at 360 the last two tabs disappear with no visual cue | "파트너" ends cleanly at 310.8 to 344.9 with the next tab off-screen; 390 shows only a 13px sliver | `board.css:239` (gap 32) | Medium |
| B-16 | Grounded Pokemon name bands use two alignments (`.rc-band` left, `.hof-band` center) | | `records-board.css:115`, `hall.css:25` | Low |
| B-17 | Pokemon sheet: 162 empty in left stage column; "많이 등록한 트레이너" bars span one 1160 column (600 between name and bar); "10개 전체 보기" is a 1160 button just to reveal 2 more rows after 8 | | `records-board.css:165-185`, `RecordsPage.jsx:1067-1080` | Medium |
| B-18c | Trainer sheet "최근 대회" mixes date formats | "11월 7일 (토)", "2026년 8월", "5월 2일 (토)", "2025년 10월" | `services/dateFormat.js:22-25` | Medium |
| B-18d | Result tag right edges misaligned: inverted "우승" at 1280, dim "4강" at 1272 | | `records-board.css:138` | Low |
| B-18e | "내 기록 연결" (Google login row) sits between recent tournaments and used parties on every trainer sheet | | `RecordsPage.jsx:531` | Medium |
| B-18f | At 390, 8 season chips in the sheet wrap to two rows with a 2px row gap, overlapping touch targets | | `components.css:226`, `board.css:261-263` | Low |
| B-19a | Title sheet says "초대 챔피언", while other screens say "1대 챔피언" for the same person | | `TitlesPage.jsx:63` | Medium |
| B-20 | Regional elite medals are half the size of other boards on mobile (52.4 vs 99.3) | | `TitlesPage.jsx:25` | Low |
| B-21 | Tied rank formatting differs: Pokemon tab uses "2, 2, 4", Rankings tab uses "공동 3위" | | `RecordsPage.jsx:940` | Low |

No issues found: find my record (logged out), mobile party sheet, empty search copy placement, pager, light-theme sheet edges.

## 4. Brackets, board

| ID | Finding | Measurement | Cause | Severity |
|---|---|---|---|---|
| C-01 | Single-round final tree clips the champion panel top and bottom and overlaps the "우승" column header. `BRK-02/1440x900-dark.png` | `.bk-scroll` 804 to 930 (126), `.bk-champ-pos` 783 to 963 (180); clipped 21 at top and 33 at bottom | `brackets.css:36-37,66` | High |
| C-02 | 5-column tree (9 to 16 players) overflows 1200 by 8 (verified: clientWidth 1200, scrollWidth 1208, champion column 1112 to 1328) | 216x5 + 32x4 = 1208. At 768 triggers a 28px scroll | `brackets.css:89,92` (`flex: 1 0`) | High |
| C-05 | Mobile comment header date wraps to two lines, giving comments uneven heights. `BOARD-03/390x844-dark.png` | Panel 68 when name is 18 wide, 84 when name is 36 wide. Three buttons (148 + 16) take half the 326 row | `posts.css:79-82`, `BoardPage.jsx:206-208,270` | High |
| C-07 | "본선" header floats with 32 top and bottom margin. Group standings and group matches both use 64px rows with no visual separation. On desktop, name (140) and "본선 진출" (1251) are 1100 apart | | `brackets.css:27`, `BracketsPage.jsx:1914,1554-1557` | Medium |
| C-08 | Mobile list view pushes the winner panel to the bottom (y 268 in tree vs y 1322 in list). Desktop list view shrinks the winner heading to 20/28 | | `brackets.css:31,43` (`:has(.bk-champ-node)`) | Medium |
| C-09 | Double elimination has fractional column widths (378.67, 173.33), causing half-pixel edges, two card widths (379 and 173), two vertical gaps (20 and 12), and Grand Final plus Champion tucked under the "패자조" heading | | `brackets.css:92,95-96,153-157`, `BracketsPage.jsx:1450-1456` | Medium |
| C-12 | Edit and delete weight differs by post type | Free board: 12pt text buttons. Sample and party posts: 52x175 buttons in a 2x2 grid | `BoardPage.jsx:478,270` | Medium |
| C-15 | Board rows separate author and date with only an 8px gap (notices and brackets use a comma) | | `posts.css:11` | Low |

No issues found: desktop QR sheet, new private bracket empty and error states, new post empty and error states, report sheet, sample and party list, match sheet side rows.

## 5. Team builder, calculator

| ID | Finding | Measurement | Cause | Severity |
|---|---|---|---|---|
| D-03 | Desktop candidate list takes less than half the panel height. `BLD-04/1280x800-dark-team.png` | At 1280x800, list is 326 inside a 704 panel (2.6 rows at 124 height) | `team-builder.css:47-49,144-155` | High |
| D-05 | Move slot gray subtitle renders at 15/600 like the title and clips on mobile. `BLD-08/390x844-dark-moves.png` | Markup has `t12 reg dim`, computed style is 15/20/600 nowrap | Overridden by `board.css:158`, `TeamBuilderPage.jsx:1686` | High |
| D-06 | Pokedex base stat range wraps to two lines on desktop ("183 ~ / 215"). `CALC-06/1440x900-dark-mon.png` | Cell width 64 becomes 64x40 at desktop 15px | `calculator.css:121` | High |
| D-09 | Save dock sits closer to rule check (20 below) than to the editor (52 above) | Move slots end 1306, dock 1358, rule check 1430 | `board.css:182` + `.tb-main-column` gap | Medium |
| D-10 | Rule check panel has three different left edges (172, 168, 140) | | `team-builder.css:8,15` | Medium |
| D-11 | Stat point number inputs and team name input show both an underline and the global focus ring | | `builder.css:89,104`, `tokens.css:175` | Medium |
| D-12 | Calculator detail settings float the Pokemon sprite with no panel or floor (spec requires every Pokemon inside a panel with feet grounded) | Bare 64x64 image | `CalculatorPage.jsx:232`, `calculator.css:72` | Medium |
| D-13 | Calculator stat slider is only 134 wide at 390 (104 at 360) | 0 to 32 steps are 4.2px each; HP row leaves a 104 empty rank column | `calculator.css:158` | Medium |
| D-14 | Calculator move slots: filled and empty labels misalign by 2, and names truncate at four characters at 390 ("플레어드…") | Type tag height 24 vs empty slot 20 | `team-builder.css:107`, `components.css:284,288` | Medium |
| D-15 | Matchup slots: picking only one side misaligns the two name lines by 10, and "서로 바꾸기" sits isolated | Names at 430 vs 440 | `calculator.css:29`, `CalculatorPage.jsx:349-352` | Medium |
| D-16 | Desktop calculator stretches mobile rows: 960 blank gap between name (260) and base stat (1234) in speed rows, 394 between "기술" (120) and "타입" (514) in Pokedex move table | | `calculator.css:23-25,91,99,133` | Medium |
| D-17 | Official submission panel puts the "cannot submit" notice at the very bottom (hidden under the dock at 390), and locked dropdowns still show a chevron | | `TeamBuilderPage.jsx:364-392,1452,1456` | Medium |
| D-18 | "최종" column left edge is ragged ("최종 185" at x 1264, "최종 90" at x 1274) and repeats the word six times | | `builder.css:90`, `TeamBuilderPage.jsx:1659` | Medium |
| D-19 | Plus icon in empty team slots does nothing when clicked | | `TeamBuilderPage.jsx:188,1513` | Medium |
| D-22 | My teams sheet still labels the button "변경사항 저장" right after saving, and uses an 8px gap between button rows (panels use 2) | | `TeamBuilderPage.jsx:1771`, `builder.css:99` | Low |
| D-23 | Rule-change confirmation renders removed Pokemon as a default browser bullet list (52 left padding) | | `team-builder.css:135` | Low |
| D-25 | At 1100 to 1199, candidate row stat numbers crowd together ("125 115 80", gap 3) | | `team-builder.css:151` | Low |
| D-26 | Type chart "특성 반영" sits 1085 away from the section heading | | `TeamBuilderPage.jsx:250` | Low |

No issues found: step tabs, empty search, mobile type chart, undo toast, import/export sheet, item sheet, candidate row hover and focus, calculator battle conditions, Pokemon picker sheet.

## 6. Battle, `도전의 탑`

Battle screens were evaluated against their own rubric in DESIGN.md "Battle" (Judging the play screen).

| ID | Finding | Measurement | Cause | Severity |
|---|---|---|---|---|
| E-01 | Winner strip text is invisible in light theme (verified: specificity 0,2,1 beats 0,2,0). `BTL-21/end-390x844-light.png` | White text `rgb(255,255,255)` on light background `rgb(232,236,242)` | `battle.css:379` overrides `:589` | High |
| E-04 | Desktop battle always scrolls by 88 when the tournament live strip is active (verified: strip hide rule only exists in the mobile media query, `battle.css:120`) | Document height 888 at 1200x800, 988 at 1440x900; bench pushed 40 off-screen at 1200x800 | `battle.css:166,173-181` | High |
| E-05 | Desktop animation, sound, and forfeit menu sits below the fold | Menu at y 840 to 1088 in a 900px viewport (y 300 to 548 during team preview) | `BattlePage.jsx:1765-1766`, `battle.css:179-183` | Medium |
| E-06 | Lobby to team preview hard-cuts in one frame and leaves a black box (4x CPU slowdown recording). `BTL-M/lobby-to-pick-390-cpu4-sheet.png` | Title, tabs, and strip vanish in one frame at 1501ms; 251ms and 400ms frame gaps | `BattlePage.jsx:1064-1090` | Medium |
| E-07 | First-turn tip toast covers my status strip and message box for the entire first turn | At 390: toast (64, 534) 262x52 over my strip 542 to 586 | `battle.css:943`, `BattlePage.jsx:1749` | Medium |
| E-08 | Desktop doubles plates overlap my Pokemon's feet | Overlap 149x60, 25% of sprite box | `battle.css:450-459` | Medium |
| E-09 | At 375x667, the third row of team preview cards is clipped 17px by the dock | Card height 106 (94 at 390), document height 720 | `battle.css:839-841` | Medium |
| E-11 | Post-battle rematch and leave buttons are 84px tall on desktop (verified: `.bt-end-row` min-height 84, button 100%) | Rematch 692x84, leave 74x84; site buttons are 52 | `battle.css:245-250` | Medium |
| E-10 | At 390x480, plates overlap Pokemon and the message box sinks under the deck | | `battle.css:888` | Low |
| E-12 | Post-battle mobile deck has 140px of empty space at the top | Deck 586 to 844, content starts at 726 | `BattlePage.jsx:1725` | Low |
| E-14 | Locked move buttons in light theme leave effectiveness chips fully lit (visual check, unmeasured) | | Near `battle.css:612` | Low |
| E-15 | Mobile lobby: 197px court followed by 107px empty background | | `battle.css:891` | Low |
| E-17 | Header two-digit turn counter has no visible label and looks identical to the clock | | `BattlePage.jsx:1636` | Low |

No issues found: my party and opponent party sheets, long-press move card, forced switch, replay bar, empty history, static tower scene.

## 7. Admin

| ID | Finding | Measurement | Cause | Severity |
|---|---|---|---|---|
| G-01 | Mobile pushes tournament progress below edit links and recent changes (verified: sits around y 1900 of 3264 in real-data shot). `ADM-04/390x844-dark.png` | Order: to-do, 7 edit rows, 10 recent changes, tournament progress | `admin.css:154-156` (`:last-child` leftover from when edit was last; CSS comment expects to-do, tournament progress, edit) | High |
| G-03 | Bracket bottom admin row is scattered. `ADM-BRK-03/1440x900-dark.png` | "기록 반영됨" x 120 y 1120, "칭호 다시 판정" x 381 y 1141, "반영 취소" x 995 y 1120 (read from shot) | `BracketsPage.jsx:1894`, `brackets.css:60-61` | High |
| G-04 | Mobile applicants sheet: submission time overlaps "미제출" (verified: reads "11.17 화 23미제출" in shot). `ADM-NEWS-02/390x844-dark.png` | All 7 rows | `pages.css:53-58`, `NewsPage.jsx:578-585` | High |
| G-09 | Question card has five different left edges inside (472, 484, 492, 500, 512) | | `admin.css:53-66` | Medium |
| G-11 | Round edit sheet traps 12,740px inside a 468px inner scroll; inputs lack labels for winner, runner-up, and top 4; at 390 the 81px date input clips "2023.05" | | `admin.css:94,97-101`, `AdminEditors.jsx:377-407` | Medium |
| G-12 | Mobile help text (15/24) is larger than its field label (12/16), and one sheet mixes two help text styles | | `components.css:96`, `admin.css:79` | Medium |
| G-13 | Tournament progress panel has no primary button during registration, making "대회 취소" the widest button | | `AdminPage.jsx:113-121`, `admin.css:144-148` | Medium |
| G-14 | Validation failures pop up an alert dialog instead of inline field errors (spec requires errors under the field), and the offending field stays scrolled out of view | | `AdminEditors.jsx:317,69` | Medium |
| G-07 | Rankings tab admin button rows lack a vertical seam (0 vertical, 2 horizontal) | | `RecordsPage.jsx:1136,1158`, `records-board.css:23,69-71` | Medium |
| G-15 | Empty state panel (44) is shorter than rows in the same list (64) | | `admin.css:149` | Low |
| G-17 | Toast above sheet sits 7 away from the fixed button | Toast bottom 816, button top 823 | Toast rules | Low |
| G-18 | Score edit table heading "트레이너" (452) is offset 12 from input text (464) | | `admin.css:91-93` | Low |

No issues found: login sheet, login and save toasts, title and champion edit sheets, notice side column response count and edit links, add season prompt.

## 8. Motion and interaction

Measured on the dev server (unminified bundle). Durations and curves were read from `document.getAnimations()`, per-frame bounding boxes, and screen recordings. Time-to-first-frame values run slower than a production build.

| ID | Finding | Measurement | Cause | Severity |
|---|---|---|---|---|
| F-01 | Focus ring is invisible on lit (inverted) controls (same root as K-10; verified only two exceptions exist). `BOARD-01/f-focus-main-1440-dark.png` | 2px `--lit` outline on `--lit` background (contrast 1.0): all primary buttons, selected segment options, skip link, active chips, 1st-place row | `tokens.css:175`; only exceptions are `board.css:145,177` | High |
| F-02 | At mobile CPU speed, heavy sheets appear nearly open without showing the slide-up. `MOT-08/f-sheet-open-390-cpu4.png` | At 4x CPU slowdown: 316ms blank frame gap after click, first painted frame already at y 130 (start 864, end 52). Lightweight sheets (new post) animate cleanly | `Modal.jsx:118-125` (spring starts on the same commit as initial content render) | High (re-measure on production build) |
| F-03 | First-visit home lights up one state then swaps to another. `MOT-01/f-first-open-390-cpu4.png` | "다음 대회", unlit 88, and "공지 보기" stay lit for about 700ms before swapping to "지난 대회" and "대진표 보기", pushing standings down 54 (layout-shift 0.0204) and changing button label and destination | `HomePage.jsx:206-213,221-` | High (first visit only) |
| F-04 | Switching tabs or chips re-animates unchanged search inputs and primary buttons up by 12 | Clicking "더블" chip runs translateY 12 to 0 over 420ms on `.search-in` and `.btn--main` | `motion.js:154-157` (`lightAfter` lights all following siblings), `Board.jsx:16,37` | Medium |
| F-06 | Desktop dialog jumps 28 up and grows 56 in a single frame when a form error appears | `.sheet` y 54 to 26, height 792 to 848; only the error text animates over 420 while the rest teleports | `components.css` at 860+ `.sheet { top: 50%; translate: -50% -50% }` | Medium |
| F-07 | Disclosures animate open but vanish in one frame on close (spec: every entrance has an exit) | Closing rotates only the chevron over 420 while 376px of content disappears immediately at 390 (layout-shift 0.083) | `RecordsPage.jsx:838`, `NewsPage.jsx:309`, `BracketsPage.jsx:1510` | Medium |
| F-08 | Controls that do not respond to pointer hover (verified: `--btn-bg-hover: var(--lit)` equals the background) | Arrowless primary buttons (write post, submit, create bracket), top bar logo, "내 기록", "진행 중", and theme button (no hover rules), standalone dropdown buttons, page search inputs (same input inside sheets responds), footer admin login (already `--lit`) | `board.css:103`, `shell.css:24,28,34,41,126`, `components.css:104-111` | Medium |
| F-09 | Text buttons snap on press and segments flip background in one frame (verified) | `.sh-link` and `.site-foot-login` hit .976 at 20ms with no transition; `.seg-track > button` lacks a `background-color` transition; selection labels have no press feedback | `board.css:328` overrides `tokens.css:228` scale transition, `components.css:54` | Low |
| F-10 | Page leave dim uses 160 ease-out instead of 260 ease-in defined in spec and `motion.js` `dimAway` (verified) | | `shell.css:102` | Low |
| F-05 | Tab content double-fades (`.swap` 420 fade stacked on 420 per-panel light-up) | Half-lit point arrives later than page navigation (roughly 130ms vs 75ms) | `tokens.css:241`, `RecordsPage.jsx:248`, `TitlesPage.jsx:123` | Low |
| F-11 | Pager jumps 132 up under the finger when the next page is shorter | layout-shift 0.092 (390) | `BoardPage.jsx`, `Pager.jsx:9` | Low |
| F-12 | DESIGN.md timing table disagrees with actual timing (doc mismatch) | Spec says light finishes in "420 in all", but the last panel finishes around 680; mobile sheet spring runs 658 total | `DESIGN.md:476,488` | Low |
| F-13 | Sub-44 touch targets: 580 player names inside tournament tab rounds measure 42x44 | 2px short horizontally | `records.css:9` (`inset: -12px -4px`) | Low |

Verified against spec (no issues): back navigation, entering and exiting notices, board posts, and brackets (420 panels, 0 to 260 stagger, ease-out), tab underline (420 ease-out), late images (160 tone batch), sheet close (260 ease-in), desktop dialog (420 open, 160 ease-in close), dropdowns (160), toasts (420 in, 260 ease-in out), theme switch (.618 to 0 over 260), busy cell (840), segment value updates (160 on changed cell only), and 0 layout-shift across full page transitions. Under reduced motion, 0 transform animations run, leaving only 160 color/background transitions and 160 to 260 close opacity fades ("only tone remains").

## 9. Functional bugs found during audit (excluded from visual fix plan)

| ID | Bug | Evidence | Location |
|---|---|---|---|
| BUG-1 | Calculator result board prints "난수 5타 (NaN%)" (verified: computed directly when `ko.chance` is undefined) | `CALC-03/1440x900-dark-both-full.png` | `src/services/calculatorCore.js:171` |
| BUG-2 | CPU battles with a random party show blank player Pokemon info: 0 sprites in my strip (12 of 14 runs), blank moves in info sheet, ability "A 또는 B 또는 C", item "모름", result strip "나: 0장". Fixed lab teams work normally | `BTL-12/moves-390x844-dark.png`, `BTL-16/moninfo-390x844-dark.png` | `Stage.jsx:574-576,856-858`, `BattlePage.jsx:1654` (root cause untraced) |
| BUG-3 | On tournament day (11-22), top bar and LiveStrip showed "39회 파이컵 리전 더블배틀 진행 중", while the bracket list lead showed the same tournament as finished ("우승 김채운") with no live lamp. May be a data state | `BRK-01/1440x900-dark.png` | Needs check |
| BUG-4 | Once, opening a 12-player single-elimination bracket URL in 390 dark loaded the 39th tournament bracket instead. Not reproduced | `BRK-09/390x844-dark.png` | Needs check |

Note (not a bug): trainer rows in Records, sample and party cards on Board, and match cards in Brackets are `<button>` elements without URLs, differing from CLAUDE.md's "doors are links with URLs" (`viewHref`) rule. Finished CPU battles send `action: "record"` to the `battle` function (blocked during this audit).

## 10. Uncaptured states

States not seen on a live screen and left unjudged. These remain blind spots even after fixes.

- Write-dependent states: registration submitting, failure, and confirmation; board post creation; busy buttons; error toast `!` cell; official submission applicant check and submit.
- Account-gated screens: find my record checking, approved, pending, and rejected states; More account states; trainer sheet "내 전적". Not visible under an admin session.
- Full `도전의 탑` progression: party draft, doors, break screen, swaps, defeat, and tower scene transitions. Skipped because starting a run writes to the server.
- Real-time two-player states: joining rooms, waiting for opponent, official match seats, live spectator screens, and rematch offers.
- Admin write screens: bracket wizard steps 2 and 3, result entry, match schedule, record sync sheet, link requests, and trainer management. The offline server lacks the normalized DB, and production shots (ADM-BRK-04, ADM-BRK-08, ADM-REC-02) captured before the sheet opened.
- States absent from current data: bracket party submission status, match card live, waiting, forfeit, and no-show badges, 32-player and 3rd-place brackets, five admin question types on registration forms, and home countdown, registration-open, and party-submission counters (audit day was a tournament day, so only tournament-day state appeared).
- Most loading, error, and empty states: response interception was not built in this pass; only copy and layout were checked in code.
- Data extremes (EXT-01 to 05): synthetic long names and hundred-item lists were not generated. Real data clipped "메가한카리아스Z" at 360, "메가메타그로스" at 860, and "클래식 시즌…" on home at 360.
- Real devices and 125% scaling (dpr 1.25): all measurements used desktop Chrome at dpr 1, leaving hairlines, sheet drag gestures, and real mobile frame rates unchecked.
- Light theme: all static screens were captured, though detailed review covered home, registration form, sheets, brackets, team builder, and battle results. Motion was recorded in dark theme only.
- 1280 and 1920: verified automated overflow and clipping metrics only without inspecting every screenshot by eye.

## 11. Screens visible only with a linked account (added 2026-11-23)

The initial pass used only admin login without Google account linking. Using a headed Chrome window where the user logged into production (blocking non-read requests), we captured 12 screens at 390 and 1440 in both themes under `ACCT-*/`.

| ID | Finding | Measurement | Cause | Severity |
|---|---|---|---|---|
| H-01 | Logout is the largest button in the account block, with two centered links stacked underneath. `ACCT-more/1440x900-dark.png`, `ACCT-records-me/1440x900-dark.png` | Logout: 1156x52 on Records, 709x52 on More, 1145x52 on my sheet. "기록 연결 해제" and "계정 삭제" stack centered on two rows | `AccountKeys.jsx:16-19` | High |
| H-02 | On my trainer sheet, the link-status strip and logout button sit right below the counters. `ACCT-my-sheet/1440x900-light.png` | Inverted strip "내 기록으로 연결되었습니다." 1145x44, logout 1145x52, followed by "내 전적" | `RecordsPage.jsx` `TrainerLink lead` | High |
| H-03 | "내 전적" wraps its description in a panel, repeats "자주 만난 상대" on every row, and duplicates labels and units | Description panel 64 tall; "자주 만난 상대" repeated on all three rows; "승 3승", "패 2패" | `RecordsPage.jsx:398,404` | Medium |
| H-04 | More lists "알림" twice (under "내 계정" and "함께하기"). `ACCT-more/1440x900-dark.png` | | `MorePage.jsx` | Medium |
| H-05 | Sheet scrollbars render as native OS scrollbars with arrow buttons. `ACCT-my-sheet/1440x900-light.png` | Inherited `scrollbar-color` causes Chrome to ignore the 8px rule. Invisible in headless captures, so missed in pass 1; also visible in mobile width emulation | `tokens.css:140,185-187` | Medium |
| H-06 | "나" badge on my row shifts the icon column by 43 (confirms B-03 on live data) | 이제빈 row at 344 vs other rows at 301 | `records-board.css:57` | Medium |
| H-07 | More right-column admin login still floats mid-column when logged in (confirms A-04) | y 1160 vs left column bottom 1436 | `more.css:18` | High |

No issues found: top bar account name, home (past tournament panel), alerts list, board new-post "계정 이름으로 쓰기" row.

Not evaluated: battle history and `도전의 탑` tabs (blocked `battle` function calls prevented loading), home "내 다음 경기" and check-in (not tournament day), bracket "내 경기로" and result reporting (no live match), pending and rejected link states (one real account only shows approved).

## 12. States tested in simulated environments (added 2026-11-23)

Built test harnesses to cover the blind spots from pass 1. Checked out the pre-fix code (commit `1be7a96`) into a separate folder, ran a dev server passing only read requests to production while mocking all other responses, and injected fake account and admin sessions. Production data stayed untouched. Line numbers match the pre-fix commit.

### 12-1. Account states, loading, error, empty states, and data extremes (R-)

Environment: `scratchpad/r/` scripts `lib.cjs` (request guard, fake session, response patching, delay, failure), `account.cjs`, `states.cjs`, `shell.cjs`, `shell08.cjs`, `extremes.cjs`, `manyhome.cjs`, `headed.cjs` against server 5193. Example runs: `node states.cjs 390 844 dark`, `node account.cjs none pending rejected approved checking long`, `node extremes.cjs long 390 844 dark`.

| ID | Finding | Measurement | Cause | Severity |
|---|---|---|---|---|
| R-01 | Home: when all reads fail, stale bundled fallback data renders as real data with no error notice (verified: shot displays "현 챔피언 5대 정두호" and "YPL 시즌 2 순위", while live data is 6대 김현민 and Season 3). `U-LOAD-home/fail-390x844-dark.png` | 0 `.error-note` elements; Records and Hall of fame show errors under the same failure | `HomePage.jsx:297` (only checks `factsFailed`, ignoring `site_data` failure) | High |
| R-02 | Notices and Alerts: read failures look like empty states. `U-LOAD-news/fail-390x844-dark.png` | 500 response shows "등록된 공지가 없습니다." and "최근 7일의 알림이 없습니다.", whereas Board, Brackets, and Calculator show ErrorNote | `NewsPage.jsx:285`, `AlertsPage.jsx:47` | High |
| R-03 | Brackets: error banner and "아직 만들어진 대진표가 없습니다." appear together (verified: empty-state condition does not check error state). `U-LOAD-bracket/fail-1440x900-dark.png` | 1200x124 error panel stacked over 1200x60 empty panel | `BracketsPage.jsx:3038,3043` | High |
| R-04 | Home past champions strip: with many champions, cells collapse to 64 width and become unreadable (tested with 20). `EXT-many-home/hall-1440x900-dark.png` | 19 cells at 64x252; "19대" overflows 24 width (content 40) to "1…"; overflows 1440 at 1252 with hidden scrollbar | `home.css:49-50` | High (5 champions today; worsens over time) |
| R-05 | Hall of fame current champion name: 24-character unspaced Latin name overflows the screen. `EXT-long-champions/390x844-dark.png` | Width 394, clipped 36 at 390 and 66 at 360 with no wrap or ellipsis | `hall.css:20` | High (extreme) |
| R-06 | Home loading: two lit elements appear where unlit placeholders belong, and content shifts 54 down on arrival (same root as F-03, quantified). `U-LOAD-home/hold1500q-390x844-dark.png` | Standings skeleton first row renders inverted white (350x84); "다음 대회, 공지 보기" swaps to "지난 대회, 대진표 보기" and drops 54 (layout-shift 0.072) | `StandTable.jsx:27` (`inv ls-row ls-first` skeleton), `HomePage.jsx:205-246` | High |
| R-07 | ErrorNote retry button is a 1160-wide text strip touching h1 with 0 gap. `SHELL-09/1440x900-light.png` | "새로고침" 1160x52 (326x52 at 390); h1 bottom 136, panel top 136 | `board.css:295-296` (`.error-note { display: grid }`), `LazyContent.jsx:117-139` | Medium |
| R-08 | Find my record: trainer list shifts 46 to 100 down once account status resolves | "72명 전체 보기" y at 390: checking 1972, pending 2018, approved 2072 | `RecordsPage.jsx:672-682`, `AccountKeys.jsx:16-19` | Medium |
| R-09 | More my account: slow or failed responses mix row heights | Single group shows 64, 64, 52, 52, 64, 64; resolving shifts below by up to 48; failure leaves row permanently blank | `MorePage.jsx:65-68` | Medium |
| R-10 | Top bar at 390: a long name pushes the account button within 2 of the wordmark | Account button x 110 to 312 (width 202), wordmark ends at 108 | `shell.css:34-37` | Medium |
| R-11 | `도전의 탑` gate sheet repeats "트레이너 이름 정하기" as both title and sole button, and shows the same sheet for rejected accounts without saying they were rejected | | `Streak.jsx:501-506` | Medium |
| R-12 | Inner scrollers show 15px native OS scrollbars (confirms H-05 and hits team builder candidate list too). `U-HEADED-sheet/390x844-dark.png` | `offsetWidth - clientWidth`: `.modal` 15, `.tb-pokemon-list` 15 | `tokens.css:140` | Medium |
| R-13 | Team builder: removing the data status row jumps search and grid up by 52, and its text contains "…" | `.tb-search-row` 357 to 305 (layout-shift 0.035) | `TeamBuilderPage.jsx:1436,1519-1564` | Medium |
| R-14 | Account link buttons are 20px tall at 1440 (same spot as H-01) | "기록 연결 해제" 1200x20, 2px gap between rows | `AccountKeys.jsx:17-19` | Low |
| R-15 | Rejected account state still shows "기록 연결 해제" even though nothing is linked | | `RecordsPage.jsx:681`, `MorePage.jsx:70` | Low |
| R-16 | Alerts at 390: "이 기기 알림" jumps 32 up after loading finishes | y 180 to 148 | Near `AlertsPage.jsx:47` | Low |
| R-17 | Busy cell during page transition overlaps dimmed content and reads like an unlit "8". `SHELL-08/t1000-390x844-dark.png` | | `shell.css:102-103` | Low |
| R-18 | Page loading renders one spinner cell on a blank page instead of an unlit panel (elements above do not move, layout-shift 0) | Records document height 1152 to 1926 | `App.jsx:309-310`, page `<Loader />` | Low |
| R-19 | Home empty state still displays a white primary "공지 보기" button when there are 0 notices | 719x52 | `HomePage.jsx:213` | Low |

No issues found: 500 screen, "공지를 찾을 수 없습니다.", long names in record rows and sheet headers (ellipsized), long notice lead and row titles, long past-tournament names on home (two lines then ellipsis), long bracket header titles (wraps to three lines), "1,200점", top bar account button (four states), board new-post sheet, focus rings and dropdown menus in headed Chrome.

Still uncaptured: "{name} 이름으로 시작" row, registration form account row and duplicate-name check, team builder "계정에 올리기", battle history tab and `도전의 탑` rankings (mock payload shape did not match), trainer sheet build loading and error, 150 trainers, long names and 10:9 scores on bracket cards, light theme and 1920 for loading, error, and empty states.

### 12-2. Admin write screens and tournament-day states (Q-)

Environment: `scratchpad/q/` scripts `lib.cjs` (fake admin login, passes GET and patches JSON, mocks writes), `live.cjs` (fixture turning the 38th Master League into a live tournament day with undecided matches, no-show, forfeit, DQ, timeout, scores, tables, site battles, player reports, and linked player), `flow.cjs` (step runner), `login.cjs`, `dump.cjs`. Example run (with `export MSYS_NO_PATHCONV=1`): `node flow.cjs live ADM-BRK-04 1440x900 dark admin "/?view=bracket&eventId=c34f3629-ad49-4d32-82fb-38d1f989fa13" wait:2500 "M5" shot:decided`. Focused on 1440 dark; checked 390 on home, brackets, result entry, admin, and login, and light theme on two home shots.

| ID | Finding | Measurement | Cause | Severity |
|---|---|---|---|---|
| Q-01 | Result entry: player name and score sit 1000 apart, and three rare outcomes stack as the widest buttons (verified in shot). `ADM-BRK-04/1440x900-dark-decided.png` | Player row 1200x84, name x 172, score stepper x 1183 to 1312; "불참 처리 / 기권 처리 / 실격 처리" each 1200x52; "다음 경기 M6" 1200x52; identical at 1920 | `bracket.css:206,215-216,221`, `BracketsPage.jsx:1261-1263` | High |
| Q-05 | Mobile admin page: tournament progress sits below 20 recent-change rows (confirms G-01 with populated data). `ADM-07/390x844-dark-rows.png` | First tournament progress panel at y 3864, "결과 입력" button at y 4442 | `admin.css:154-156` | High |
| Q-02 | Delete bracket is the widest button on the screen | "삭제" 1200x52 while the widest tree column is 379 | `BracketsPage.jsx:3074`, `brackets.css:24-26` | Medium |
| Q-03 | "테이블 미정" appears on finished matches too. `BRK-07/390x844-dark-live.png` | 12 of 14 match cards show the strip, including 9 decided matches and 2 byes | `BracketsPage.jsx:1383` (`stripOf`) | Medium |
| Q-04 | Bye winner's name renders gray on a white row | `.mb-row.inv` background `rgb(255,255,255)`, `.mb-name` `rgb(129,150,185)` (contrast around 3:1; normal winner rows use `rgb(8,28,61)`) | Exact line unverified; bye color path in `BracketsPage.jsx:973-978` | Medium |
| Q-06 | Tournament progress panel: rare "대회 취소" is the widest button (confirms G-13). `ADM-08/1440x900-dark-step1.png` | "지금 마감" 167x52, "신청 현황" 270x52, "대회 취소" 439x52 | `AdminPage.jsx:119`, `admin.css:145` | Medium |
| Q-07 | Reports: "신고 지우기" sits as centered text wedged between rows | Row, text, row, text joined by one stack seam | `CommunityReports.jsx:37-42` | Medium |
| Q-08 | Bracket wizard steps 2 and 3 split 1200 across tool buttons. `ADM-BRK-02/1440x900-dark-step2.png` | Select all / clear all / add participant each 399x52; redraw / ranking seed each 599x52; participant row has name at x 204 and "미제출" at x 1266 | `bracket.css:100,185-187`, `BracketsPage.jsx:755-770,873-874` | Medium |
| Q-10 | Trainer sheet admin tools: a three-character name input and save button both span 1160, and the save button sits closer to the next section than its own input | Name input 1160x52, 32 down to "이름 저장" 1160x52, 21 down to next label | `RecordsPage.jsx:438-446`, `admin.css:139` | Medium |
| Q-11 | Tournament-day home at 1440: champion panel stretches to 950 when "내 다음 경기" and live matches appear together. `HOME-08/1440x900-light-mynext.png` | Left 759x950, right 439x950; roughly 450 blank between text and Pokemon (normally 364) | `home.css:62` (`align-items: stretch`) | Medium |
| Q-13 | Tournament-day home: progress line under a losers-bracket match card says "승자조 3라운드 진행" (wrong label) | | `HomePage.jsx:159,287` | Medium (functional bug) |
| Q-09 | Link requests: three-character buttons span 354 | "거절" 234x52, "승인" 354x52 | `records-board.css:134-136` | Low |
| Q-12 | Tournament-day home: primary button "내 경기 보기" and the "내 다음 경기" card right below lead to the same destination | | `HomePage.jsx:207,260-270` | Low |
| Q-14 | Mobile live bracket: "내 경기로" has the same weight below share buttons | Share link 174x52, QR 174x52, 32 down to "내 경기로" 350x52; all three are secondary | `BracketsPage.jsx:1897,3070` | Low |
| Q-15 | Match schedule sheet mixes winners and losers rounds on one line, and round headers expand on click with no affordance | Row 2 reads "승자조 3라운드 시작 \| 패자조 1라운드 시작" | Exact line unverified | Low |

No issues found: both login errors, expired toast, sync-to-records sheet, change-winner dialog, delete-by-name prompt, home countdown (two and three digits), registration-open state, clock, party submission counter, match card live lamp, waiting, no-show, forfeit, DQ, timeout, score, and "나" badge, live site battle sheet, result report sheet. Zero horizontal overflow on all inspected screens.

Still uncaptured: draw animation and post-creation screen, 32-player and 3rd-place brackets, team match sheet, bye and void battle, slot swap, group controls, qualifier status, pre-sync confirmation and title awarded, merge preview, edit sheet lazy load, before and after check-in, expanded party submission status, admin light theme, and admin at 360 and 1280.

### 12-3. `도전의 탑` progression and two-player battles (P-)

Environment: `scripts/visual-audit-env/streak/` and `standin/` (see README). All three high-severity items were cross-checked against pre-fix code.

| ID | Finding | Measurement | Cause | Severity |
|---|---|---|---|---|
| P-01 | Battle screen is always 24px taller than the viewport and scrolls; break screen clips 24 off the header. `U-TWR-trans/break-header-cut-390.png` | Document height 868 at 390x844 and 924 at 1440x900; two symbol-preload spans (`position: absolute` without top or left) land at the end of body | `BattlePage.jsx:109-114` | High |
| P-02 | Entering a match from the tower flashes team preview cards lit before the dark overlay covers them and lights them again. `U-TWR-trans/enter-key-frames-390-cpu4.png` | Six cards hit opacity 1 at 2965ms, dark veil covers at 3132ms, then re-light until 3500ms; repeats on the next match | `BattlePage.jsx:1080-1081` (when `.bt-card` is missing, calls `light(main)` and returns early, skipping `look()` for late cards) | High |
| P-03 | Site top bar and tab bar briefly flash back between tower matches | 254ms at 4x CPU slowdown (about 65ms real time) | `BattlePage.jsx:1538-1542` (unmounting Arena removes `page--battle`) | Medium |
| P-04 | Mobile code-room wait screen: wait timer and cancel button sit under the dock | Counter 671 to 803, dock 696 to 780, cancel wait 823 to 875 (off-screen) | `BattlePage.jsx:833-845`, `battle.css:21,30` | Medium |
| P-05 | Mobile tower party draft: bottom 32px of candidate card stats is hidden behind the dock | `.streak-pick-stats` 614 to 728, dock starts at 696 | `tower-play.css:129-162` | Medium |
| P-06 | Desktop header truncates "도전의 탑 2층 두…" | scrollWidth 133, clientWidth 103 | `BattlePage.jsx:1631` | Low |
| P-07 | Break screen transition from swap to doors has a 250ms blank frame gap (4x CPU) | | Suspected `Streak.jsx:768-772` | Low |
| P-08 | Mobile live tab format chips extend 60 past the viewport | | `battle.css:41,70` | Low |

No issues found: tower board, four doors, break screen (win, swap, promotion swap), defeat and run end, room list, join (public, code, wrong code), end screen and rematch, spectating, history tab.
Still uncaptured: floor climb scene after gatekeeper, official two-player match wait, real phone and server latency.
