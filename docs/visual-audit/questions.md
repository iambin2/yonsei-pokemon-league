# Questions for the user

Confirmed 2026-11-23. Rather than picking each item individually, the user delegated the entire list to the recommended options ("너의 추천안대로 해줘. 내 판단이 들어가면 오히려 왜곡될 것 같아"). The confirmed choices are tracked as tasks in `plan.md` section 5 (T-59 to T-102). This document preserves the options that were on the table and records each final choice below.

| Question | Decision | Plan tasks |
|---|---|---|
| Q-01 Dangerous confirmation buttons | (a) Drop the checkmark icon and focus Cancel | T-66, T-59 |
| Q-02 Help text size | (a) Move to the 12px scale | T-80 |
| Q-03 Controls stretched to 1200 | (a) Size controls to their content | T-60 to T-64 |
| Q-04 Spacing below page titles | (a) 32 below h1, 20 below tabs, align back link to side column top | T-79 |
| Q-05 Short last grid rows | (b) Match column count to item count (Law 26 already forbids empty cells) | T-71 |
| Q-06 Bottom sheet actions | (a) Primary action as docked full-bleed bar, share link sized to label | T-63 |
| Q-07 Home clock at 360 | (a) Move "시작" to the label row | T-74 |
| Q-08 Home hero, notice search | Hero (a), notice search (b) above upcoming tournament | T-74, T-77 |
| Q-09 Notice post secondary buttons | (a) Registration buttons at 52, utility buttons on one 44 row | T-67 |
| Q-10 Mobile comment header | (a) Short date format | T-78 |
| Q-11 Empty search result layout | (a) Standardize on a single-line text panel | T-76 |
| Q-12 Brackets | Each (a), losers bracket connectors (b) do not draw | T-75 |
| Q-13 Sample and party edit and delete | (a) Text buttons | T-68 |
| Q-14 Records | Tags (a) keep as-is, counters (a), tournaments tab (a) 20 then show all, crown (a), link my record (a), champion sheet (a), dates (a) | T-70, T-72, T-81 to T-85 |
| Q-15 Team builder, calculator | 860 to 1099 (a), rows (a) 64 single line, sliders (a), calculator (a), submission panel (a), plus icon (b) remove, rules (a) | T-64, T-65, T-86 to T-91 |
| Q-16 Admin | Admin row (a), tournament progress (a), skip round editor and validation alerts this pass, applicants sheet (b) | T-69 |
| Q-17 Top bar hover | (b) Keep as-is | T-97 |
| Q-18 Structural motion changes | Sheet (b) measure first, home (a), tabs (a), dialog (a), disclosure (a), pager (b) keep as-is | T-92 to T-98 |
| Q-19 Battle at 860 to 1199 | (a) Start two-column layout at 860 | T-99 |
| Q-20 Remaining battle items | Menu (a), toast (a), doubles plates (a), team preview cards (a), remaining four (b) keep as-is | T-100, T-101 |
| Q-21 Functional bugs | Include BUG-1 only; debug BUG-2 separately | T-102 |

Two decisions differ from the initial recommendations. For Q-08 notice search, we chose (b) instead of (a) "439 on the right of the h1 row", because shrinking search to 439 splits mobile and desktop structure while (b) alone fixes the jumping input. For Q-16, we left out the round edit sheet and validation alerts because they restructure an admin-only editor that was not verified against live production data.

---

Below are the original questions. Finding IDs refer to `report.md`, and option (a) was the initial recommendation for each item.

## A. Shared components

### Q-01 Dangerous confirmation buttons (K-08, high)
Confirmation buttons for delete, cancel tournament, forfeit, and undo sync look identical to save ("✓ 삭제", inverted primary button with a checkmark). DESIGN.md Hierarchy states that dangerous confirmations are still primary actions and the copy explains what gets removed.
- (a) Keep the inverted primary button but remove the checkmark icon. Also drop the icon from alert "✓ 닫기", and place initial focus on Cancel.
- (b) Keep as-is (strictly following the current rule).
- (c) Give dangerous buttons a dedicated tone by promoting the battle menu's forfeit color (`#4A1820`) to a token for dialogs. Requires a new color token.

### Q-02 Help text size (G-12, medium)
`.hint` is 15/24, making it larger than its own field label (12/16) on mobile. The Hierarchy table puts hints at 12/16, and other help text in the same sheet (`fb-note`) is 12.
- (a) Set all `.hint` text to 12/16 (15/20 on desktop), dim 400. Help text becomes smaller on mobile across the site.
- (b) Keep as-is (treat it as reading prose at 15/24).

### Q-03 Controls stretched to 1200 on desktop (K-01, high)
Affects the three rows of search, chips, and season dropdown in Records, private bracket tool buttons, admin entry buttons, and bottom sheet buttons.
- (a) At 860 and above, place search (remaining width), chips, and season dropdown (220) on one row. Place private bracket tools on a single 44px row right of the title like official brackets. Turn all admin entry buttons into underlined links right of the title row (matching "공지 작성"). Align bottom sheet buttons to the right at 439 width.
- (b) Put only chips and dropdown on one row, keeping search full-width above them, with all other items same as (a).
- (c) Keep as-is.

### Q-04 Spacing below page titles (K-05, medium)
Space below h1 is 20 on Notices, Alerts, and About, and 32 on More and Records. Space below tab bars is 12 on Records and 20 on Titles. The back link sits at y 148 on notice posts and 160 on the registration form.
- (a) Standardize on 32 below h1, 20 below tabs, and align the back link to 160 (matching the side column top).
- (b) Standardize on 20 below h1, 12 below tabs, and align the back link as in (a).

### Q-05 Short last grid rows (K-12, medium)
- (a) Apply the medal board pattern (padding with empty panels to form a rectangle) to the past champions wall too.
- (b) Lay out the past champions wall as one 5-column row at 1440, and match medal board column counts to the medal count (7 columns for partner, 3 for other).
- (c) Keep as-is.

### Q-06 Bottom sheet actions (K-08, medium)
The party sheet uses a full-bleed docked button, the champion sheet uses an inset button, and other sheets use a share-link row.
- (a) Place primary actions like "○○ 기록 보기" in a docked `.modal-actions` bar, with share link on a row above it.
- (b) Keep as-is.

## B. Page-specific issues

### Q-07 Home clock overflow at 360 (A-02, high)
- (a) At 389 and below, move "시작" up to the label row next to "오늘 대회 진행 중". Keep the clock at 84 so its 292 width fits inside 296.
- (b) Scale the clock SVG down to fit the panel width (drops below 84 and breaks the segment height scale).

### Q-08 Home hero empty band and repeated date at 1440 (A-13, medium), notice list empty right side at 1440 (A-26, low)
- Hero: (a) Hide the date row on tournament day and top-align the clock with the spec rows. (b) Keep as-is.
- Notice list: (a) Place search at 439 width on the right of the h1 row (also resolves K-03 jumping input). (b) Move search above "다가오는 대회". (c) Keep as-is.

### Q-09 Four secondary buttons on notice posts (A-10, medium)
- (a) Keep only edit registration and party submission as 52 buttons, and put add-to-calendar and share link on one row of two 44 buttons. On mobile, move this group above the body right below the spec rows.
- (b) Turn add-to-calendar and share link into underlined links, with the same mobile placement as (a).
- (c) Keep as-is.

### Q-10 Mobile comment header (C-05, high)
- (a) Use a shorter date format ("11.19 오후 3:12") and prevent line wrapping.
- (b) Move reply, edit, and delete buttons to a row below the comment body.

### Q-11 Empty search result layout (K-17, medium)
- (a) Standardize on a single-line text panel across all screens, dropping the "0건" segment (the count is already inside the search box).
- (b) Show a segment on every screen, but light up the 0 digit.

### Q-12 Brackets (C-03, C-07, C-08, C-09)
- Group stage: (a) Add a 12 gap between group standings and match rows and 12 below the "본선" header; (b) keep as-is. On desktop, set group blocks to (a) a 709 column, (b) 2 columns, or (c) keep 1200.
- Mobile list view winner panel: (a) Move to the top like tree view; (b) keep at the bottom.
- Double elimination: (a) Move Grand Final and Champion outside the "패자조" group onto a separate row and use integer column widths; (b) keep as-is. For losers bracket connectors: (a) draw them; (b) do not draw them.

### Q-13 Edit and delete on sample and party posts (C-12, medium)
- (a) Move them to text buttons in the meta row like free board posts, leaving only save image and share link in the large button grid.
- (b) Keep as-is.

### Q-14 Records (B-03, B-04, B-06, B-12, B-18e)
- League tags on every row: (a) keep as-is; (b) show only rookie; (c) move league to a chip filter and drop row tags.
- Top 3 panel counters: (a) remove cell background on all three panels and align left with the name; (b) give the first panel a cell background too.
- Tournaments tab (15,568px tall at 1440): (a) show the latest 20 then "전체 보기" (matching the trainers tab); (b) collapse past season chapters; (c) use a 2-column card grid at 860+; (d) keep as-is.
- Hall of fame crown team of six: (a) lower the mobile name band to 32 so sprites grow, and match column height at 1440; (b) keep as-is.
- Trainer sheet "내 기록 연결" row: (a) move to the bottom above share link; (b) keep between recent tournaments and used parties.
- Champion sheet empty inverted panel at 1440 (A-05): (a) use a 576-wide sheet when there are no sets; (b) place the 439 seal beside the 709 team of six; (c) keep as-is.
- Mixed date formats in recent tournaments (B-18c): (a) include the year on every row whenever a list spans multiple years; (b) keep as-is. Requires editing `src/services/dateFormat.js`.

### Q-15 Team builder and calculator (D-02, D-03, D-13, D-16, D-17, D-19)
- Candidate list at 860 to 1099 (198px inner scroll): (a) scroll with the page like mobile; (b) start the 1100 two-column layout at 860.
- Desktop candidate rows (124 tall, only 2.6 rows visible): (a) make rows a single 64 line; (b) wrap the type grid to two lines; (c) both; (d) keep as-is.
- Calculator mobile stat sliders (134px): (a) move rank controls to a second row below the bar; (b) narrow the rank column to 84.
- Calculator desktop (960 blank gap in speed row, Pokedex table): (a) use a 709 + 439 two-column layout for speed and Pokedex; (b) keep as-is.
- Blocked official submission panel: (a) put the reason directly under the heading and omit the steps and name field; (b) keep as-is.
- Plus icon in empty team slots: (a) make it a button that jumps to candidate selection; (b) remove the plus icon; (c) keep as-is.
- Aligning the two rule dropdowns to the 439 and 709 columns (D-07): (a) align them; (b) keep 599 and 599.

### Q-16 Admin (G-03, G-06, G-11, G-13, G-14)
- Bracket bottom admin row: (a) keep status ("기록 반영됨") on the left, align the two links ("칭호 다시 판정", "반영 취소") on the right baseline, and size delete to 439 on the right; (b) keep as-is.
- Tournament progress panel: (a) turn "대회 취소" into an underlined link at bottom-right, and make "신청 현황" the primary button during registration; (b) keep as-is.
- Round edit sheet: (a) remove inner scroll so the sheet itself scrolls, and add labels for winner, runner-up, and top 4; (b) keep as-is.
- Validation alerts (missing time, empty name): (a) show the error below the field and scroll to it instead of an alert dialog (following the rule that forms report missing values under the field); (b) keep as-is. Requires code changes.
- Applicants sheet on mobile (G-04) already has overlap fixed in T-19. On whether to drop password reset to a second line: (a) move it down; (b) T-19 is enough.

## C. Motion

### Q-17 Top bar hover (F-08)
Logo, "내 기록", "진행 중", and the theme button do not react to pointer hover because all four are already `--lit`.
- (a) Default to `--dim` and shift to `--lit` on hover (matching the close `×` button). The top bar becomes one step dimmer at rest.
- (b) Keep as-is.

### Q-18 Structural motion changes (F-02, F-03, F-04, F-06, F-07)
- Heavy sheets appearing already raised: (a) start the spring on the frame after the sheet's first paint (`Modal.jsx`); (b) re-measure on a production build and a real phone before deciding.
- First-visit home content swap: (a) show an unlit placeholder sized to the past-tournament panel while loading and keep the button unlit; (b) keep as-is.
- Tab and chip switches re-lighting search and primary buttons: (a) light only the changed list; (b) keep as-is.
- Desktop dialog jumping on form errors: (a) anchor the dialog from the top so it grows downward only; (b) keep centered.
- Disclosure collapse: (a) fade rows out over 160 before unmounting; (b) keep single-frame collapse.
- Pager shifting under the user's finger (F-11): (a) give lists a one-page minimum height; (b) keep as-is.

## D. Battle

### Q-19 Battle layout at 860 to 1199 (E-02, high)
Because two-column layout starts at 1200, landscape iPads and small laptops push move buttons off-screen and drop the header below the deck. DESIGN.md specifies the stage on the left and a 400 column on the right starting at 860.
- (a) Start the two-column layout at 860 (update both the 1200 block in `battle.css` and `WIDE` in `BattlePage.jsx`). Re-measure against `docs/BATTLE_FRAMES.md` because the scope is wide.
- (b) Keep one column, cap the stage height, and move the header above the stage.

### Q-20 Remaining battle items (E-05, E-07, E-08, E-09, E-10, E-12, E-15, E-17)
- Desktop animation, sound, and forfeit pushed below the fold: (a) move the menu directly under the header with parties below it; (b) collapse unrevealed opponent party rows; (c) keep as-is.
- First-turn tip toast covering my status strip: (a) auto-dismiss after 4 seconds; (b) move to a single line above the move buttons inside the deck; (c) keep as-is.
- Desktop doubles plates covering Pokemon feet: (a) stack vertically on the right like mobile; (b) keep as-is.
- Team preview cards clipped by dock at 375x667: (a) tighten card vertical padding from 12 to 8 at 379 and below; (b) merge the item and type rows.
- Post-battle 140 gap above mobile deck, 107 gap under lobby court, missing label on turn counter, three zero counters in room list: (a) fix each; (b) keep as-is.
- Lobby to team preview hard cut in one frame (E-06): decide whether to re-measure against `docs/BATTLE_TRANSITIONS.md` and handle separately.

## E. Functional bugs (report.md section 9)

### Q-21 Scope of functional bug fixes
Decide whether to include BUG-1 (calculator `NaN%`) and BUG-2 (missing Pokemon info in CPU random-party battles) in this pass. Both are visible defects, though fixing them touches service code. BUG-3 and BUG-4 need data and reproduction checks first.

## F. Base tokens and breakpoints

No spacing, typography, or transition tokens need to change. Two breakpoints change: the top bar full-tabs threshold moves from 1100 to 1200 (plan T-12, aligning with an existing breakpoint), and battle two-column layout moves from 1200 to 860 (Q-19, awaiting decision). The battle-only 600/601 breakpoint differs from the site's 640, but it applies only to the replay bar and stays as-is.
