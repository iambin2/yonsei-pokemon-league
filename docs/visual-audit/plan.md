# Visual audit fix plan

Execute directly from this document. Diagnostic evidence lives in `docs/visual-audit/report.md` (finding IDs K-, A-, B-, C-, D-, E-, G-, F-), and screen IDs live in `docs/visual-audit/inventory.md`.

## 0. Goal and constraints

The goal is to keep the current design language of league.pokeyonsei.com intact while fixing places where that language is applied unevenly or where layout structure breaks down.

Do not violate any of these constraints:
- Keep the design language untouched: color tokens, fonts, sharp-cornered panels (zero border radius), zero shadows, segmented numbers, amber lamps, and general tone. Placed side by side, before and after must read as the same site made tidier. If it looks redesigned, the change failed.
- Do not change functional or data behavior. Adjust styling and layout only. No task in this plan touches service code (`src/services/`), RPCs, or storage formats (with the single string-formatting exception in T-102).
- Do not invent new values. Use only the values listed in Section 1. If a needed value is missing, stop and ask.
- `DESIGN.md`, `PRODUCT.md`, and `CLAUDE.md` outrank this document. If anything conflicts, stop and ask. Korean copy uses polite formal endings (`합니다체`) with no middle dots and no em dashes.
- `npm test` (especially `tests/designLaw.test.mjs`) must pass. Fix values when a test fails; never add entries to `EXCEPT` in the test.
- Battle screens (`battle.css`, `battle-stage.css`, `tower-play.css`, `src/pages/battle/`) follow the "Battle" chapter of `DESIGN.md`. Do not touch battle selection logic (`src/services/battleCpu.js`).
- Light and dark themes are one unit of work. Check the other theme in the same change whenever you fix one.
- Commit messages must include the four sections from "Commit messages" in `CLAUDE.md` (`문제 인식`, `사고 과정`, `기획 방향성`, `프롬프트`). Do not deploy unless the user explicitly asks.

This document has two parts. Section 3 (T-01 to T-58) fixes off-system values and bugs. Section 5 (T-59 to T-102, plus Batches 17 and 20 added later) covers judgment-based changes, which the user approved on 2026-11-23 from `docs/visual-audit/questions.md` ("권한 쪽으로 전부"). Finish Section 3 first. Only one functional bug from report.md Section 9 is included (T-102).

## 1. Established system

None of these values are newly invented. They are the values the site already uses, verified by occurrence count across the 20 files in `src/styles/*.css` excluding the three battle stylesheets (counted on 2026-11-22).

### Spacing (`tokens.css:107`)

| Token | Value | Use | Count |
|---|---|---|---|
| `--seam` | 2 | Between panels | 70 |
| `--s1` | 4 | Label and value, title and grey line | 134 |
| `--s2` | 8 | Label and input, control inner gap | 210 |
| `--s3` | 12 | Section title and content, mobile panel padding | 285 |
| `--s5` | 20 | Mobile side margin, blocks within a section, between inputs | 214 |
| `--s8` | 32 | Between groups, below page title, desktop side margin | 79 |
| `--s13` | 52 | Between sections, desktop column gap | 80 |
| `--s21` | 84 | Between desktop chapters | 39 |
| `--pad` | 12 (859 or below) / 20 (860 or above) | Panel inner padding | 94 |

Only lines (1, 2), breakpoints, icons (16, 20, 24), and fixed widths (439, 709, 576, 1200, 220, 136) bypass tokens. Gaps like 14, 24, 34, or 40 on screen indicate two margins colliding (report K-04, K-13).

### Typography (`tokens.css:109-111`)

Measured from rendered text at 1440 and 360, dark theme, across 59 scenes:

| Step | Size / line-height | Weight | Use | Rendered count (1440 / 360) |
|---|---|---|---|---|
| 32 | 32/40 | 700 | Page title, single name in records | 66 / 66 |
| 20 | 20/28 | 700 | Section and sheet title, single panel name | 296 / 275 |
| 15 | 15/20 | 700 title and key, 600 input and tab, 400 grey line | Row title, key, value | 10,339 / 2,402 |
| Reading | 15/24 | 400 | Body prose | 102 / 105 |
| 12 | 12/16 (15/20 at 860 or above) | 600 label, 400 grey line | Label, grey line, unit, hint | 0 / 8,136 |

There is no fifth size. There are three weights: 400, 600, and 700.

### Heights (`tokens.css:113`)

Heights are 32 for strips, 44 for touch floor, 52 for rows and keys, 64 for two-line rows, and 84 for counters. Nothing tappable on mobile may be shorter than 44.

### Corners and shadows

Border radius is 0 and shadows are 0. Floating surfaces that need an edge use the same inner hairline rule sheets already use (`box-shadow: inset 0 1px 0 var(--rule)`, `components.css:191`).

### Transitions (`tokens.css:120-123`)

| Token | Value | Use | Count |
|---|---|---|---|
| `--move-press` | 100ms ease-out | Press (scale .976) | 38 |
| `--move-tone` | 160ms ease-out | State change (tone, lamp, inversion) | 76 |
| `--move-leave` | 260ms ease-in | Exit (sheet, toast, old screen) | 3 |
| `--move-light` | 420ms ease-out | Enter (rising 12 while lighting up) | 19 |

Easing uses `--ease-out: cubic-bezier(.22,1,.36,1)` and `--ease-in: cubic-bezier(.5,0,.75,0)`, with stagger intervals of 38 for rows and 62 for segments. Site CSS has 0 untokenized transition declarations. JavaScript uses only `DUR`, `EASE_OUT`, `EASE_IN`, and `STAGGER` from `src/components/common/motion.js`.

### Layout

Mobile side margin is 20. Viewports from 640 to 859 use a single 576 column. Viewports at 860 or above use 1200 (two-kind screens split into 709 + 52 + 439). Reading prose never exceeds 709.

## 2. Tools

Playwright is not a project dependency. Run `npx playwright --version` once to populate the npx cache. The scripts use installed Chrome (`channel: "chrome"`).

```bash
# Dev server reading production data (ypl-dev-prod-data in .claude/launch.json, port 5183)
npx vite --mode production --port 5183 --strictPort

# Full-screen screenshots and measurements. Output: docs/visual-audit/shots/<ID>/<width>x<height>-<theme>.png, shots/measure.jsonl
node scripts/visual-audit.cjs --set public,inner,sheet --vp all          # 360 390 430 768 1280 1440 1920, dark and light
node scripts/visual-audit.cjs --set public,inner --vp edges --theme dark # Just below and above breakpoints
node scripts/visual-audit.cjs --only REC-02,HOME --vp core               # Changed screens only (390x844, 1440x900)
node scripts/visual-audit.cjs --login --set admin --vp core              # Admin: user signs in manually; all non-read requests are blocked

# Single-point measurement probe (prefix with MSYS_NO_PATHCONV=1 in Git Bash)
MSYS_NO_PATHCONV=1 node scripts/visual-audit-probe.cjs "/?view=records" 1440x900 dark \
  "[...document.querySelectorAll('.rc-tr-place')].map(e=>e.getBoundingClientRect().right)" --shot out.png

# Transition recording (frame sheet)
node scripts/record-transition.cjs <out dir> "http://localhost:5183/?view=news" --ms 2000 --every 60 --cpu 1 --act "<js>"
```

- Scene definitions live in `scripts/visual-audit.scenes.cjs`. Add new states there when needed.
- Capture a full baseline with `--out docs/visual-audit/before` before starting, then capture changed screens to `--out docs/visual-audit/after` after each batch for side-by-side review. Add both folders to `.gitignore`.
- Admin captures require the user to sign in manually. Never ask for or write down passwords, and never click write actions against production (save, delete, finalize result, register, submit post).
- CPU battles send a record to the `battle` function on completion. Block `**/functions/v1/battle*` requests during any verification that runs a battle to the end.
- Use `ypl-dev-offline` (port 5182, no Supabase, sign in with any ID, data in localStorage) when checking admin layout only.
- Full-page screenshots draw the fixed mobile tab bar in the middle of the page. That is a script limitation, not a defect.

Run these four checks after every task:
1. Measure the listed verification values with the probe script.
2. Re-capture the listed screens at 390x844 and 1440x900 in both dark and light themes.
3. Confirm `overflow` is empty for those screens in `measure.jsonl`.
4. Run `npm test`.

## 3. Tasks

Work in order. Each batch is one commit. Line references come from commit `3ffd32c` and may shift after earlier edits, so locate code by selector string. If the string listed as current is missing from the file, stop and report rather than guessing.

---

### Batch 1. Shared components

#### T-01 Confirm dialog buttons at 1 to 1.618 (K-08)
- Edit `src/styles/components.css` immediately below `.modal-actions .btn--main { flex-grow: 1.618; }`.
- Currently the two buttons use flex-grow 1 and 1.618, but inner padding skews the ratio to 158 vs 230 (1.46) at 390 and 229 vs 345 (1.51) at 1440.
- Add `.modal-actions:has(> .btn:first-child:nth-last-child(2)) { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.618fr); }`.
- `DESIGN.md` Hierarchy specifies that the back action comes first and the main action is 1.618 times as wide. Rows with one or three buttons stay flex.
- Verify on the team builder `초기화` confirm dialog (open `?view=builder`, add one Pokemon, click `초기화`). The width ratio must be 1.60 to 1.63 (around 148 to 240 at 390, and 219 to 355 at 1440). The three-button notice edit sheet (delete, cancel, save) must remain unchanged.

#### T-02 Notification prompt buttons on one row (K-08)
- Edit `src/components/common/PushControl.jsx` (inside `<div className="push-ask">`) and `src/styles/board.css` (`.push-ask`).
- Currently `알림 받기` (main) and `나중에` (second) stack vertically at 536x52 each with a 20 gap.
- Wrap both `<Button>` elements in `<div className="modal-actions">`, placing `나중에` first and `알림 받기` second. Keep the guidance paragraph (`push-note`) above them. When `mode !== "ready" || blocked` hides `알림 받기`, only `나중에` renders. Leave `.push-ask { display: grid; gap: var(--s5); }` as is.
- Verify on `?view=alerts` by toggling the switch to open the sheet (do not grant browser permission). Both buttons sit on one row with a 2 gap and a width ratio of 1.60 to 1.63.

#### T-03 Top empty band on desktop dialogs (K-08)
- Edit `src/styles/components.css` immediately below `.grip::after { display: none; }` inside `@media (min-width: 860px)`.
- Currently `.grip { height: 20px }` still reserves space on desktop, leaving 28 above the title vs 20 on the sides.
- Add `.grip { height: var(--s3); }`.
- Verify at 1440 on any sheet (open `?view=records` and click a trainer row). Distance from `.sheet` top to `.modal > h3` top must be 20 (12 + 8).

#### T-04 Center close × on the title line (K-08)
- Edit the `.modal-x` rule in `src/styles/components.css`.
- Currently the 52x52 box sits at top 0 of `.modal` with `place-items: center`, putting the center of × 4 lower than the center of the first title line (72 vs 68 at 1440, 98 vs 94 at 390).
- Add `translate: 0 calc(var(--s1) * -1);` to `.modal-x` so the box and hit area move up by 4.
- Verify at 390 and 1440 that the vertical center of the first line of `.modal > h3` and the vertical center of `.modal-x svg` differ by at most 1. Check that the top of the × box is not clipped outside the sheet (below `.sheet` top at 390); if it clips, revert and report.

#### T-05 Focus outline on inverted panels (K-10)
- Edit `src/styles/tokens.css` right below `:focus-visible { outline: var(--line) solid var(--lit); ... }`.
- Currently a white 2px outline on a white inverted surface is invisible.
- Add `:is(.inv, .btn--main, .skip-link, .seg-track > [aria-selected="true"]):focus-visible { outline-color: var(--ground); }`. This extends the pattern already used by `.choice-opt.inv:has(:focus-visible)` and `.opt-row.inv:has(:focus-visible)` in `board.css` to all inverted elements.
- Verify at 1440 and 390 in both dark and light themes. Press Tab once to enter keyboard mode, then call `el.focus()`. Confirm `outline-color` contrasts with the background and a 2px outline is visible on the 1st-place records panel (`.rc-top.inv`), the board `글쓰기` button (`.btn--main`), the selected segment in the new private bracket sheet (`.seg-track`), the skip link, and selected chips.

#### T-06 Search count inside the input box (K-03)
- Edit `src/components/common/ListSearch.jsx`.
- Currently `{q && <span className="search-count t12 dim">{count}건</span>}` sits outside `<label className="pn search-in">`, shrinking the input width from 1200 to 1157 on input and shifting it as digit counts change.
- Move that `<span>` inside `<label>`, between `<input>` and the clear `<button className="search-clear">`. Leave everything else unchanged.
- Verify on `?view=records` at 1440 and 390. `.search-in` width must stay identical before and after typing "김" (1200 at 1440, 350 at 390). Run `grep -rn "<ListSearch" src` to confirm no caller omits `count` and renders `undefined건`.

#### T-07 Row grey lines at weight 400 (K-07)
- Edit `Row` in `src/components/common/Board.jsx` at `{line && <span className="t12 dim">{line}</span>}`.
- Currently row grey lines render at weight 600 while lead panel grey lines in the same list render at 400 (`t12 dim reg`).
- Change the class to `className="t12 dim reg"`.
- `DESIGN.md` Hierarchy step 5 specifies 600 for labels and 400 for grey lines. Lead panels, alert type cells, and sheet hints already use 400.
- Verify by re-capturing `?view=news`, `?view=bracket`, `?view=alerts`, `?view=more`, and `?view=board` at 390 and 1440. Both the lead panel date line and row date lines must have `font-weight` 400, while row titles (`b.t15`) stay 700.

#### T-08 Lamps before words and aligned to inner padding (K-06)
- Four places put the lamp before the word (top bar "진행 중", `LiveStrip`, notice lead "새 글", more page "새 알림") and two put it after (standard `Row`, standard `Lead`). Standardize on lamp-first.
- In `src/components/common/Board.jsx`, update `Row` so that when `lamp` is a string it renders only `<span className="row-lamp-word t12"><i className={"lamp" + (sig ? " sig" : "")} aria-hidden="true" />{lamp}</span>`, and renders the existing `row-lamp` only when `lamp` is not a string. In `Lead`, move `<i ... />` before `{lamp}` inside `<span className="t12 lead-lamp">`.
- In `src/styles/board.css`, change `.row-lamp-word { flex: none; font-weight: 600; white-space: nowrap; }` to `.row-lamp-word { flex: none; display: inline-flex; align-items: center; gap: var(--s2); padding-right: var(--pad); font-weight: 600; white-space: nowrap; }`. On `.row-lamp`, remove `width: var(--s8);` and add `justify-content: flex-end; padding: 0 var(--pad) 0 var(--s3);` so wordless lamps also align to `--pad`.
- In `src/styles/home.css`, delete `.ho-news .row-lamp { width: var(--s13); }`.
- Verify on `?view=news`, home, `?view=news&notice=<id>` (other notices), and `?view=alerts` at 1440. The right edge of the lamp or "새 글" word must align with other row right edges (x = 1300), with an 8 gap between lamp and word. Check "진행 중" rows in the bracket list and battle lobby as well.

#### T-09 Dropdown menu and more popover alignment and hairline (K-09)
- Edit `src/styles/components.css`.
- Change `.dd-opt` padding from `var(--s2) var(--s3)` to `var(--s2) var(--pad)` to remove the 8 misalignment between button value (x = 140) and menu item (x = 132).
- Add `box-shadow: inset 0 0 0 var(--hair) var(--rule);` to both `.dd-menu` and `.popover`.
- If `.mi` uses `var(--s3)` for horizontal padding, change it to `var(--pad)`.
- Floating menus differ from underlying panels by only one tone step and blend together in light mode; the inner hairline matches sheets.
- Verify on `?view=records&tab=rank` at 1440 that the opened dropdown button text and option text share the same `left`. At 1024x768, open `더보기` in the top bar and confirm the 1px popover edge is visible in both dark and light themes.

#### T-10 Section heading bottom gap at 12 (K-04)
- In `src/styles/board.css`, below `.sh { ... margin-bottom: var(--s3); }`, add `.stack > .sh { margin-bottom: calc(var(--s3) - var(--seam)); }` (total 12 with the stack's 2 gap) and `.stack > :is(h2, h3):first-child:not(.sh) { margin-bottom: calc(var(--s3) - var(--seam)); }` (raises bare stack headings from 2 to 12).
- In `src/styles/admin.css`, below `.ad-block { display: grid; gap: var(--s3); }`, add `.ad-block > .sh { margin-bottom: 0; }` (fixes 24 to 12).
- In `src/styles/records-board.css`, change `.rc-chapter` padding from `var(--s8) 0 var(--s3)` to `calc(var(--s8) - var(--seam)) 0 calc(var(--s3) - var(--seam))` (fixes 34 and 14 to 32 and 12).
- Verify heading bottom to first row top is 12 on: "1조" in group stage `?view=bracket&eventId=4379f233-b441-43ba-8c05-581d6c07af05`, round headers in bracket list view, "댓글 N" on board posts, season chapter headers on `?view=records&tab=tour` (with 32 between chapters), and admin section headings on `?view=admin`.

#### T-11 Controls blending into parent panels (K-11)
- At the end of `src/styles/news.css`, add `.nw-form .row .btn--second { --btn-bg: var(--panel-2); --btn-bg-hover: var(--rule); }`.
- In `src/styles/admin.css`, add `.fold` to the selector `.sheet :is(.fb-q, .ed-round, .tb-library-save, .bk-group) :is(input...` so it reads `.sheet :is(.fb-q, .ed-round, .tb-library-save, .bk-group, .fold) :is(...)`.
- Immediately below that rule in `src/styles/admin.css`, add `.sheet .fb-dot { background: var(--panel); }`.
- In `src/styles/records-board.css`, below `.rc-top-cell`, add `@media (hover: hover) { .rc-top.pn:hover .rc-top-cell { background: var(--rule); } }`.
- Verify that the "구글 로그인" button in the registration form (`?view=news`, open a notice, click `참가 신청`) contrasts with its row background. On the offline server, open notice creation, expand link attachment, and confirm inputs contrast with the fold background and multiple-choice option squares are visible. Confirm cells stay visible when hovering 2nd and 3rd place record panels.

At the end of Batch 1, re-capture `--set public,inner,sheet --vp core` and compare against `before`. Only the 11 items above should show differences.

---

### Batch 2. Width ranges and overflow

#### T-12 Top bar full-tab breakpoint (K-14)
- In `src/components/layout/Navigation.jsx`, change `const WIDE = "(min-width: 1100px)";` to `"(min-width: 1200px)"`.
- Fitting 12 tabs, the account control, live indicator, and theme toggle requires about 1160. Between 1100 and 1150, "명예의 전당", "팀 빌더", and "진행 중" wrap to two lines. 1200 is already an established breakpoint (`battle.css`).
- Verify by simulating tournament-day state via probe `--act`: add a live lamp to `.topbar` and set the account button (`.acct`) text to "가나다라마바사아자차". At 1100, 1160, 1199, 1200, and 1280, every `.navlink` must have height 64 with `scrollWidth <= clientWidth`. Viewports at 1199 or below show 5 tabs plus `더보기`.

#### T-13 Five-column bracket tree 8px overflow (C-02)
- Edit `.bk-tree > .bk-col2 { flex: 1 0 var(--bk-w); width: auto; }` inside `@media (min-width: 860px)` in `src/styles/brackets.css`.
- Currently 216x5 + 32x4 = 1208 exceeds 1200, so `.bk-scroll` has clientWidth 1200 and scrollWidth 1208, clipping the champion panel by 8.
- Change it to `.bk-tree > .bk-col2 { flex: 1 1 0; min-width: calc(var(--s21) * 2 + var(--s8)); width: auto; }` (min-width 200: 5 columns fit in 1128, and scrolling starts at 6 columns).
- Verify on `?view=bracket&eventId=17ffc2ab-5128-4af0-8a32-efb826372d10` (12-player single elimination) at 1280, 1440, and 1920: `.bk-scroll` must satisfy `scrollWidth === clientWidth`, and every `.bk-col2` left and width must be integers. Double elimination (`eventId=c34f3629-ad49-4d32-82fb-38d1f989fa13`) and 7-player single elimination (`927a1b9a-2ca7-431a-b71d-078ac9e5767b`) must keep their existing rows. Fractional column widths in double elimination (such as 378.67) are handled in T-75.

#### T-14 Champion panel clipped in single-round final tree (C-01)
- Target screen: `?view=bracket&eventId=4379f233-b441-43ba-8c05-581d6c07af05` (main bracket has only a final) at 1440 in dark and light themes.
- Currently `.bk-scroll` is 126 tall while `.bk-champ-pos` (180 tall) translates to center on the final, clipping 21 at the top and 33 at the bottom and covering the "우승" column header (`brackets.css`: `.bk-champ-pos`, `.bk-champ-col .bk-champ-node`, `.bk-scroll`).
- In `src/styles/brackets.css`, add `.bk-tree:has(> .bk-col2:nth-child(2):last-child) .bk-champ-node { height: var(--mb); }` and set `.bk-champ-pos { translate: none; }` under the same condition so the champion panel matches match card height `--mb` when only the final and champion columns exist. Confirm the exact direct-child count of `.bk-tree` with the probe before finalizing the `:has` selector.
- Done when `.bk-champ-pos` top is at or below `.bk-scroll` top plus header height, bottom is at or above `.bk-scroll` bottom, the "우승" column header is visible, and trees with 2 or more rounds (the 12-player and 7-player brackets above) are unchanged.

#### T-15 Light-theme winner strip (E-01)
- Edit `src/styles/battle.css`.
- Currently `:root[data-theme="light"] .bt-strip { background: var(--panel); }` (specificity 0,2,1) overrides `.bt-strip[data-won] { background: var(--lit); color: var(--ground); }` (0,2,0), rendering white text on a panel background in light mode.
- Change the first selector to `:root[data-theme="light"] .bt-strip:not([data-won])`.
- Verify by forfeiting a CPU battle in light mode at 390 and 1440 (block `battle` function requests). `.bt-strip[data-won]` must have background `--lit` and text `--ground`. Dark mode stays unchanged.

#### T-16 Live tournament strip during desktop battle (E-04)
- Edit `.ypl:has(.bt-match) .site-foot { display: none; }` inside `@media (min-width: 1200px)` in `src/styles/battle.css`.
- Change it to `.ypl:has(.bt-match) :is(.site-foot, .live-strip) { display: none; }`.
- The comment in that block notes that battle occupies a single viewport with nothing below, yet the strip (44 + 20) was omitted and causes 88 of vertical scroll on tournament days. The mobile block already hides `.live-strip`.
- Verify on tournament day at 1200x800 and 1440x900 that `document.documentElement.scrollHeight === innerHeight` during battle. If it is not tournament day, inject `<button class="pn live-strip">` before `#ypl-main` via probe `--act`.

#### T-17 Post-battle desktop button height (E-11)
- Edit `src/styles/battle.css` at the end of the `.bt-end-row` group inside `@media (min-width: 860px)`.
- Currently `.bt-end-row { min-height: var(--h-counter); }` and `.bt-end-keys > .btn { min-height: 100%; }` apply even when there is no result header beside the buttons, stretching rematch to 692x84 and exit to 74x84.
- Add `.bt-end-row:has(> :only-child) { min-height: 0; }` and `.bt-end-row:has(> :only-child) .bt-end-keys > .btn { min-height: var(--h-row); }`.
- Verify at 1440 after a standard CPU battle that both buttons are 52 tall. 도전의 탑 and relay views (which render a result header alongside) keep height 84.

#### T-18 Admin mobile section order (G-01)
- Edit `.ad-main > .ad-block:last-child { order: 2; }` inside `@media (max-width: 859px)` in `src/styles/admin.css`.
- Currently only export has order 2, live event (`.ad-side`) has order 1, and everything else has order 0, pushing live event below editing and recent changes even though the comment specifies tasks, live event, then editing.
- Change it to `.ad-main > :not(.ad-block:first-child) { order: 2; }` so only tasks stay at 0, live event at 1, and the rest at 2.
- Verify on `?view=admin` at 390 (offline server is enough). The `h2` order must be tasks, live event, editing, then recent changes, screen errors, reports, and finally export. Desktop 1440 stays unchanged.

#### T-19 Applicant sheet mobile overlap (G-04)
- In `src/styles/pages.css`, below `.fr-name { display: flex; align-items: baseline; gap: var(--s3); min-width: 0; }`, add `@media (max-width: 639px) { .fr-name { flex-wrap: wrap; row-gap: var(--s1); } }`.
- Currently `.fr-when` (`nowrap`) overflows at 390 and collides into "11.17 화 23미제출".
- Verify after admin sign-in on `ADM-NEWS-02` at 390: in every row, `.fr-when` right must be less than or equal to `.fr-actions` left. Desktop 1440 stays unchanged.

#### T-20 More page right column at 1440 (A-04)
- In `src/styles/more.css`, change `.more-side { grid-column: 2; grid-row: 2 / span 3; }` to `span 4` because the `내 계정` group makes four left-column groups.
- Verify on `?view=more` at 1440 that `.more-side` bottom and the last left group's bottom differ by at most 2, with the admin login row at the bottom of the right column. Also check the offline server (5182) where accounts are disabled; if the two column bottoms do not align there, report instead of explicitly declaring `.more` rows for `grid-row: 2 / -1`.

#### T-21 Hidden tab on mobile tab strip (B-14)
- In `src/styles/board.css`, below `.tabsline { display: flex; gap: var(--s8); ... }`, add `@media (max-width: 859px) { .tabsline { gap: var(--s5); } }`.
- Currently at 360 on the titles page, "파트너" ends cleanly at 344.9 and the next tab starts off-screen, hiding that more tabs exist.
- Verify on `?view=titles` at 360 and 390 that the next tab text is visibly clipped past the right edge. Records (4 tabs) and battle (5 tabs) still fit on one line, and the sliding underline works on tap.

At the end of Batch 2, re-run `--set public,inner --vp edges --theme dark` and confirm 0 `overflow` entries in `measure.jsonl`.

---

### Batch 3. Records, titles, and hall of fame

#### T-22 Dead selector in round detail (B-06b)
- In `src/styles/records-board.css`, change `.records-round-detail .row { background: var(--panel-2); }` to `.records-round-detail .rc-party-row`.
- Verify on `?view=records&tab=tour` by expanding "입상자별 공식 파티". Party rows must have `--panel-2` background distinct from the card background, with 2px seams between rows, in dark and light themes.

#### T-23 Right-aligned rank digits (B-02)
- In `src/styles/records-board.css`, change `.rc-tr-place { padding-left: var(--pad); color: var(--mute); }` to `.rc-tr-place { padding: 0 var(--s3) 0 var(--pad); text-align: right; color: var(--mute); }`. Right-aligning without right padding glues numbers to names ("4이병재" in the mockup), so include 12 of right padding. Confirm two-digit numbers fit inside the column (52 - 20 - 12 = 20, while "10" is about 19 wide). If any list reaches three-digit ranks, widen the column to `var(--h-row2)` (64).
- Verify on `?view=records` at 1440 and 390 after clicking `N명 전체 보기`. The text `Range` right edge of `.rc-tr-place` must match across all rows within 0.5, with a 12 gap between digit right and name left.

#### T-24 Fixed name column width (B-03)
- In `src/styles/records-board.css`, inside the 860+ rule `.rc-tr-main { grid-template-columns: auto minmax(0, 1fr); ... }`, change `auto` to `calc(var(--s21) * 2 + var(--s13))` (220). Check that the name element has `min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap` and add it if missing.
- Verify in expanded full-list view that the badge column's `left` matches across every row. Confirm the longest name plus league tag plus "나" tag fits inside 220; if not, report rather than picking a replacement width.

#### T-25 Ranking footnote max width (K-02)
- In `src/styles/records-board.css`, change `.rc-note { margin-top: var(--s8); }` to `.rc-note { margin-top: var(--s8); max-width: 709px; }`.
- Verify on `?view=records&tab=rank` at 1440 that footnote lines are 709 or narrower.

#### T-26 Records tab control spacing (part of K-01, mobile and shared)
- Edit `src/styles/records-board.css`.
- Currently the trainer tab stacks search, 12 gap, chips, 2 gap, and dropdown, gluing the 32-high chips and 52-high dropdown together by a seam.
- Set the gap between chips and dropdown inside `.rc-sort` to 12. If `.rc-sort` uses `.stack` (gap 2), give `.rc-sort { gap: var(--s3); }`.
- Verify at 390 and 1440 that chip bottom to dropdown top is 12. Putting all three controls on one desktop row is handled in T-60.

#### T-27 Title sheet heading for champions (B-19a)
- Edit the title passed to `<Modal title={title} ...>` in `TitleSheet` inside `src/pages/TitlesPage.jsx`.
- Currently champion medal sheets display raw `item.name` ("초대 챔피언"), while medals and trainer sheets show "1대 챔피언".
- Pass champion titles through the generation formatter (`generationText`) used in `src/pages/ChampionsPage.jsx` (locate it with `grep -rn "generationText" src`).
- Verify on `?view=titles` by clicking the 1st champion medal and confirming the sheet title reads "1대 챔피언".

#### T-28 Unowned title sheet heading (K-16)
- Edit the owner list in `TitleSheet` inside `src/pages/TitlesPage.jsx`.
- Currently unowned titles render "주인 0명" above "아직 주인이 없습니다.".
- Omit the "주인 0명" heading when owner count is 0 and render only the single empty-state line.
- Verify on `?view=titles&tab=type` by clicking an unlit medal.

#### T-29 Top margin of sheet share link (K-08)
- Edit `src/styles/titles.css` where `.tl-sheet-sec { margin-top: var(--s8); }` adds 32 above the share link, while trainer and Pokemon sheets use 20.
- Set `margin-top: var(--s5)` on the share-link wrapper in the title sheet (check the wrapper class around `<ShareHere>` in `TitlesPage.jsx`).
- Verify on a title sheet that last list bottom to share link top is 20.

At the end of Batch 3, re-capture `--only REC-02,REC-09,REC-10,REC-14,REC-05,TTL-01,TTL-04 --vp core`.

---

### Batch 4. Notices, board, brackets, home, about, and alerts

#### T-30 Free post body and comments at 709 (K-02)
- Edit `src/styles/posts.css` near `.bd-art.many .bd-cmts { max-width: 709px; }` inside `@media (min-width: 860px)`.
- Apply `max-width: 709px` to `.bd-body` and `.bd-cmts` on free posts (posts that are neither sample nor party posts). Check the `<article>` class in `PostView` inside `src/pages/BoardPage.jsx`, and leave sample (`.bd-art.one`) and party (`.bd-art.many`) layouts untouched.
- Verify on `?view=board` by opening a free post at 1440 and 1920: `.prose` is 709 wide, YouTube embeds are 709, comment panels are 709, and the comment submit button aligns with the 709 right edge. Mobile 390 stays unchanged.

#### T-31 Desktop comment action button width (K-15)
- In `src/styles/posts.css`, update `.bd-act { min-height: var(--h-control); ... padding: 0 var(--s1); ... }` by adding `min-width: var(--h-control);` (and `text-align: center` if needed).
- Verify at 1440 that reply, edit, delete, and report buttons are each at least 44 wide, and at 390 that comment header rows do not wrap more than before (C-05 is handled in T-78).

#### T-32 Board row author and date punctuation (C-15)
- Edit free-board list rows in `src/pages/BoardPage.jsx` and `.bd-day { margin-left: var(--s2); }` in `src/styles/posts.css`.
- Join author and date with a comma like notices ("고정, 11.16 월") and bracket rows: "트레이너, 11.22 일". Remove `margin-left` from `.bd-day`.
- Verify on `?view=board` at 390 and 1440.

#### T-33 Registration edit error placement (A-16)
- Edit the password `Question` in the registration edit step in `src/pages/NewsPage.jsx`, where a hint `<p>` passed as children renders ahead of the error message.
- Do not render the hint `<p>` when an error is present.
- Verify by opening a notice, clicking registration edit, and clicking `신청 불러오기` with both fields empty (empty submission does not hit the server). Both fields must show an 8 gap from input bottom to error top.

#### T-34 Empty notice search state (K-16, K-17)
- Edit the empty search `<Empty>` and "최근 공지" label in `src/pages/NewsPage.jsx`.
- Remove the second line of `Empty` ("'...'에 맞는 공지를 찾지 못했습니다."). Render "최근 공지" with `SectionHead` (`h2` 20) like other sections. Removing the segmented "0건" is handled in T-76.
- Verify on `?view=news` by searching "없는말" at 390 and 1440.

#### T-35 Last cell of alert type board (K-12)
- In `src/styles/board.css`, below `.push-board { grid-template-columns: 1fr 1fr; }`, add `.push-cell:last-child:nth-child(odd) { grid-column: 1 / -1; }` (confirm the cell class name in `PushBoard` inside `PushControl.jsx`).
- Verify on `?view=alerts` at 390 and 1440 that the board has no blank trailing cell.

#### T-36 Three links on 404 status page (K-12)
- In `src/styles/board.css`, edit `.status-links { grid-template-columns: repeat(2, minmax(0, 1fr)); }` and `.status-links > :first-child:nth-last-child(odd) { grid-column: 1 / -1; }`.
- Delete the second rule and change the first to `repeat(3, minmax(0, 1fr))`.
- Verify on `/?view=nothing-here` at 390 and 1440 that `공지`, `대진표`, and `기록` buttons have equal width. Check button count on the 500 screen in `StatusPage.jsx`, and split with `:has` so a two-button screen keeps `repeat(2, ...)`.

#### T-37 Bottom gap inside about lead panel (A-20a)
- Edit `.ab-lead { display: grid; gap: var(--s3); align-content: start; padding: var(--pad); }` in `src/styles/hall.css`.
- Add `.ab-lead > :last-child { margin-top: auto; }` and stretch `.ab-lead` vertically (for grid, make the last row `1fr` in `grid-template-rows` and set `align-self: end` on the last child) so the Discord button sits at the panel bottom.
- Verify on `?view=about` at 1440 that Discord button bottom to panel bottom is `--pad` (20).

#### T-38 Hanging indent on privacy numbered list (A-28)
- Check `.prose` list rules in `src/styles/pages.css`. If absent, inspect how `Prose.jsx` renders numbered lines; if numbered lines are `<p>` elements, leave them untouched and report.
- Verify on `?view=privacy` at 1440 that the second line of Article 1 item 5 starts at the same x as the first line's text.

At the end of Batch 4, re-capture `--only NEWS-01,NEWS-05,BOARD-01,BOARD-02,BOARD-09,ALERT,ABOUT-01,SHELL-10,PRIV-01 --vp core`.

---

### Batch 5. Team builder and calculator

#### T-39 Mobile stat slider row height (K-15)
- In `src/styles/builder.css`, below `.tb-stat-row { ... min-height: var(--h-strip); }`, add `@media (max-width: 859px) { .tb-stat-row { min-height: var(--h-control); } }`.
- Verify on `?view=builder` at 390 with a Pokemon selected in the editor: all six rows must be 44 tall with range input height at least 44, matching `.calc-stat-row` (44) in the calculator.

#### T-40 Move cell grey line styling (D-05)
- Edit the end of `src/styles/builder.css`.
- Currently `.tb-move-meta` (`t12 reg dim`) is overridden by `.cell > span:not(.cell-label)` (15/20/600 nowrap ellipsis) in `board.css`.
- Add `.cell > .tb-move-meta { font-size: var(--t12); line-height: var(--l12); font-weight: 400; white-space: normal; }`.
- Verify at 390 that selected move cells show 12/16/400 grey text without clipping "명중" or "PP". All four cells must keep matching height; if one cell wraps to two lines and changes height, report instead of adding `min-height`.

#### T-41 Pokedex base stat range wrapping (D-06)
- In `src/styles/calculator.css`, below `.calc-base-row { ... grid-template-columns: var(--s5) minmax(0, 1fr) var(--s8) calc(var(--s21) - var(--s5)); ... }`, add `@media (min-width: 860px) { .calc-base-row { grid-template-columns: var(--s5) minmax(0, 1fr) var(--s8) var(--s21); } .calc-base-row > :last-child { white-space: nowrap; } }`.
- Verify on `?view=calc&tab=dex` at 1440 and 1100 with a Pokemon selected: the range cell ("183 ~ 215") stays on one line and row height is 32.

#### T-42 Save dock placement (D-09)
- In the 860+ section of `src/styles/team-builder.css` (or `builder.css`), add `.tb-main-column > .dock { margin-top: 0; }`.
- Currently the gap is 52 from move cells to dock and 20 from dock to validation, making the dock look closer to the panel below than to the editor it saves.
- Verify at 1440 that move cell bottom to dock top is 20 and dock bottom to validation top is 20.

#### T-43 Three empty elements adding extra spacing (K-13)
- In `src/styles/builder.css` (860+), change `.tb-rules:not(:has(.tb-rule-group:nth-child(3))) { grid-template-columns: minmax(0, 1fr); }` to `{ display: none; }`. Verify at 1440 that rules row bottom to "포켓몬 선택" top is 20 (currently 40).
- In `src/pages/TeamBuilderPage.jsx`, render `<p className="tb-field-meta">` only when it has text. Verify at 390 and 1440 that ability, item, and nature cells to "능력 포인트" is 32 (currently 44).
- In `src/styles/team-builder.css`, add `.official-submission > ul { margin-top: 0; }`. Verify on `?view=builder&eventId=4379f233-b441-43ba-8c05-581d6c07af05` that name field to error line is 20 (currently 32).

#### T-44 Validation panel left alignment (D-10)
- Edit the `.tb-validation...` rules in `src/styles/team-builder.css`.
- Currently at 1440, the title sits at x = 172, violation text at x = 168, and iconless lines at x = 140.
- Set icon-to-text gap to `var(--s3)` in both places and give iconless `li` items `padding-left: calc(var(--s5) + var(--s3))`.
- Verify in a violation state (the extra report D scene: import text with `Rotom-Wash` and `어흥염` with `Knock Off`) at 390 and 1440 that all three line types share the same text `left`.

#### T-45 Rule-change confirm list styling (D-23)
- Edit `.tb-rule-confirm-list { margin: var(--s3) 0; padding: var(--s3) var(--s5) var(--s3) var(--s13); ... }` in `src/styles/team-builder.css`.
- Change it to `list-style: none; padding: var(--s3) var(--pad);`.
- Verify by switching rules to monotype with a team present: no bullets appear, and list text `left` matches other text in the sheet.

#### T-46 Calculator move cell 2px misalignment (D-14)
- Edit `.pick-type` (`height: 24px;`) in `src/styles/team-builder.css`.
- Add `.pick-field .pick-type { height: var(--l15); }` for tags inside pick fields while leaving picker sheet tags at 24.
- Verify on `?view=calc` at 1100 on a row with one move selected: the label `top` of filled and empty cells must match.

#### T-47 Matchup cell name line alignment (D-15)
- Edit `.calc-vs-band { display: grid; align-content: center; gap: var(--s1); padding: 0 var(--pad); }` in `src/styles/calculator.css`.
- Change it to `align-content: start; padding: var(--s2) var(--pad) 0;`.
- Verify at 390 and 1440 with only one side selected that both cells share the same first-line `top`. With both sides selected, confirm band height stays unchanged; if it shrinks, preserve the prior height with `min-height`.

#### T-48 Gap between two button rows in my teams sheet (D-22)
- In `src/styles/builder.css`, change `.tb-library-text { grid-template-columns: 1fr 1fr; margin-top: var(--s2); }` to `margin-top: var(--seam);`.
- Verify in the my teams sheet that the gap between the two button rows is 2.

At the end of Batch 5, re-capture `--only BLD,BLD-13,CALC-02,CALC-05,CALC-06 --vp core` plus 1099x900 and 1100x900.

---

### Batch 6. Admin

#### T-49 Points sheet spacing (K-13)
- In `src/styles/admin.css`, change `.ad-points { display: grid; gap: var(--s3); margin-top: var(--s5); }` to `gap: 0;` so only `Field`'s 20 bottom margin and `SectionHead`'s 12 remain.
- Verify on the offline server at `?view=admin` under points: input bottom to next label top is 20, and heading bottom to first label top is 12.

#### T-50 Empty state panel height (G-15)
- In `src/styles/admin.css`, below `.ad-event-head, .ad-none { display: grid; gap: var(--s1); padding: var(--s3) var(--pad); }`, add `.ad-none { min-height: var(--h-row); align-content: center; }`.
- Verify that the "지금 할 일이 없습니다." panel is 52 tall.

#### T-51 Standing editor table header alignment (G-18)
- In `src/styles/admin.css`, change `.ed-head span:first-child { text-align: left; }` to `.ed-head span:first-child { text-align: left; padding-left: var(--s3); }`.
- Verify that the "트레이너" header text and the input text below it share the same `left`.

#### T-52 Gap between two admin button rows on rankings tab (G-07)
- In `src/styles/records-board.css`, add `.rc-rank > .rc-admin { margin-top: var(--seam); }` while keeping the existing `margin-bottom: var(--s5)` on `.rc-admin`.
- Verify as admin on `?view=records&tab=rank` that the add-season/add-cumulative-tab row bottom to edit-standings row top is 2.

#### T-53 Bottom padding of tournament settings group (K-13)
- Edit the last `Field` inside the tournament settings group in `src/admin/editors/AdminEditors.jsx`, where omitting `flush` adds 20 bottom margin on top of group padding for 40 total.
- Pass `flush` to that last `Field` (confirm in `Field.jsx` that `flush` zeroes bottom margin).
- Verify in notice creation by enabling tournament registration and linking a tournament: top and bottom group padding are both 20.

At the end of Batch 6, capture admin screens at 390 and 1440 on the offline server, and run `--login --set admin --vp core` once with the user for production data.

---

### Batch 7. Motion and interaction

#### T-54 Leaving page dim transition (F-10)
- In `src/styles/shell.css`, change `.page.is-going { opacity: var(--opacity-disabled); transition: opacity var(--move-tone); pointer-events: none; }` to use `var(--move-leave)` (260ms ease-in, matching the `DESIGN.md` Motion table and `dimAway` in `motion.js`).
- Verify via probe that `main.page` has computed `transition-duration` of `0.26s` and `transition-timing-function` of `cubic-bezier(0.5, 0, 0.75, 0)`.

#### T-55 Word button press and segment background transition (F-09)
- In `src/styles/board.css`, change `.sh-link, .btn--link, .site-foot-dc, .site-foot-login, .site-foot-admin { transition: color var(--move-tone); }` to `transition: scale var(--move-press), color var(--move-tone);`.
- In `src/styles/components.css`, change `.seg-track > button`'s `transition: scale var(--move-press), color var(--move-tone);` to `transition: scale var(--move-press), background-color var(--move-tone), color var(--move-tone);`.
- Verify by pressing `전체 보기` on home: `scale` at 20ms, 60ms, and 110ms must progress smoothly toward .976 (already reaching .976 at 20ms fails). Switching a segment option must transition background color over 160ms.

#### T-56 Hover states on main buttons and standalone controls (F-08)
- In `src/styles/board.css`, change `.btn.btn--main`'s `--btn-bg-hover: var(--lit);` to `--btn-bg-hover: var(--dim);` (matching `:is(button, a).inv:hover:not(:disabled) { background: var(--dim); ... }` in the same file).
- In `src/styles/components.css`, after the `.dd-btn` rules, add `@media (hover: hover) { .dd-btn:hover:not(:disabled) { background: var(--panel-2); } }`. Confirm that the `.cell` rule in `board.css` still wins for dropdowns inside cells.
- In `src/styles/board.css`, after the `.search-in` rules, add `@media (hover: hover) { .pn.search-in:hover { background: var(--panel-2); } }` (`.sheet .pn.search-in:hover` in `components.css` already sets `--rule`).
- Verify at 1440 that actual mouse hover changes `background-color` on board `글쓰기`, the "모든 시즌" dropdown in records, and the notice search input, while `:disabled` buttons do not change. Confirm `--ground` text on `--dim` stays legible in light mode.
- Leave the top bar logo, my records, live indicator, and theme toggle untouched (T-97).

#### T-57 Tournament tab name link hit width (F-13)
- In `src/styles/records.css`, change `.rc-name-link::after { content: ""; position: absolute; inset: -12px -4px; }` to `inset: calc(var(--s3) * -1) calc(var(--s2) * -1);` (widens hit width from 42 to 50).
- Verify on `?view=records&tab=tour` at 390 that name link hit boxes are at least 44 wide. Check rows with multiple names on one line (semifinals) to make sure adjacent hit boxes do not overlap; if they overlap, revert and report.

#### T-58 Align DESIGN.md motion table with actual timing (F-12)
- In the `DESIGN.md` Motion table, change the `light` row's Length from `420 in all` to `420 a panel, about 680 until the last has lit` (the "First open" paragraph in the same chapter already says "38 apart (the stagger stops growing at 260), each rising 12 into place over 420"). Do not change code.
- Verify prose-only diff.

At the end of Batch 7, record a page navigation (`?view=news`, clicking `기록` in the top bar) with `node scripts/record-transition.cjs` using `--cpu 1 --every 40` and compare before and after frame sheets side by side. Confirm reduced motion (`scripts/visual-audit-probe.cjs ... --reduced`) still has 0 transform animations.

First-frame sheet entrance (F-02), first-visit home content swap (F-03), search input relighting on tab switch (F-04), fold exit animation (F-07), and dialog jump on form error (F-06) require structural changes and live in Section 5 Batch 14 (T-92 to T-96).

## 4. Full completion checklist

1. `npm test` passes and `npm run build` finishes with no warnings.
2. Re-run `node scripts/visual-audit.cjs --set public,inner,sheet --vp all` and `--vp edges --theme dark`, confirming 0 `overflow` entries in `measure.jsonl` and only the five Section 1 font sizes.
3. Review `before` and `after` screenshots side by side for every screen ID. Every visible difference must map to a task ID in this plan; revert any unexplained change.
4. No screen may change color, font, panel shape, or shadow.
5. Manual walkthrough by the user at mobile (390) and desktop (1440): home to notice to registration form, records to trainer sheet, bracket to match sheet, team builder save, and one CPU battle.

---

## 5. Judgment-based tasks (added 2026-11-23)

Finishing Section 3 yields a bug-free but mechanical site. Most audit findings were not wrong values; they came from carrying rules to the letter without judgment (stretching a 50px label dropdown across 1200, adding empty bands to force two columns to end on one line, or stacking four 52-high panels of equal weight). The user agreed with this diagnosis and approved all recommended options in `questions.md` ("너의 추천안대로 해줘"). Complete Section 3 before starting Section 5.

The four principles below were tested beforehand by overriding styles on the records trainer tab and notice detail page (`docs/visual-audit/shots/_drafts/*-pair.png`, current on the left and proposed on the right). Colors, fonts, and panel shapes stayed identical while control widths and action hierarchy changed. Those pairs define "the same site made tidier."

All Section 0 constraints still apply. Do not invent new colors, font sizes, or spacing values. JSX edits may change render order and classes only, never data or behavior. If a task's numeric completion criteria cannot be met, stop and report.

### Batch 8. DESIGN.md revision (before code, one commit)

#### T-59 Add rules 27 to 30 to "Composing a screen"
- In `DESIGN.md`, insert the following block verbatim right after paragraph 26 of "Composing a screen" and before `## Made by people`:

```markdown
**Judged, not only measured** (2026-11-23: a whole-site audit found the numbers kept everywhere and the screens still reading as machine-made, because rules were carried out to the letter where the content asked for less; the owner: "기계적으로 체계를 지키고 있기 때문이 아닐까")

27. **A control is as wide as what it holds.** On desktop a search field may take the room that is left, but a select, a row of chips or a key is as wide as its words (a select 220, a key its word and its padding, 44 or 52 high), and it stands beside what it acts on, never across the 1200 from it. The 1200 belongs to lists, boards and panels. A select of one short word stretched across the page, or a key 760 from the field it submits, is a phone layout stretched. Reading (a post, a note under a table) stays inside the 709.
28. **Actions are ranked on the screen as they are in use.** One main action (52, inverted) a screen. What is used next stands as second actions (52). What is used now and then (a share, a calendar file, a rare cancel) stands smaller: a 44 key in a row, or an underlined word. Keys of different rank never stack as equal planes, and the rarest act is never the widest key.
29. **Nothing is stretched to make a line meet.** Two columns end on one line when their content lets them. A panel is never lengthened into a band without ink, a grid is never padded with empty panels, and a row is never widened so that its end reaches an edge: the shorter thing ends short. (This is rule 26 read strictly; a medal board's columns follow the number of its medals.)
30. **The seam joins one kind.** 2 stands between panels of one kind (rows of a list, cells of a board, keys of one row). Two different kinds of thing (a row of chips and a select, a list and the key under it) stand 12 apart or more, even when both are panels.
```

- In the "Space" chapter of `DESIGN.md`, right after "A page of one list or one kind of panel (공지, 기록, 칭호, 명예의 전당, 게시판, 소개) uses the whole 1200, so its head's right end and every row end on the bar's right edge, a short bracket tree included.", append: `Its controls do not: a search, a select and a key follow Composing a screen 27.`
- In "Sheets, dialogs, toasts", right after "then its actions as planes along the bottom edge, a word action standing as a second action panel.", append: `On desktop a sheet's single utility key (링크 공유) is as wide as its word, at the sheet's end edge.`
- In "Hierarchy" under Actions, replace "a destructive confirm is the main action too, its sentence says what it destroys." with: `a destructive confirm is the main action too, without the ✓ (a ✓ says done; a delete is not a thing done well), its sentence says what it destroys, and the keyboard's focus starts on the way back.`
- Verify prose-only diff and run `npm test`.

### Batch 9. Control widths (principle 27)

#### T-60 Records trainer tab search, chips, and season on one row (K-01, Q-03)
- Edit the 860+ section of `src/styles/records-board.css`.
- Confirmed DOM structure: direct children of `.rc-list` are `.search`, `.stack.rc-sort` (holding `.chips` and `.dd`), `.rc-tops`, `.rc-legend`, `.rc-table`, and `.rc-more`.
- Add:

```css
@media (min-width: 860px) {
  .rc-list { display: grid; grid-template-columns: minmax(0, 1fr) auto; column-gap: var(--s3); }
  .rc-list > * { grid-column: 1 / -1; }
  .rc-list > .search { grid-column: 1; }
  .rc-list > .rc-sort { grid-column: 2; grid-row: 1; display: flex; align-items: center; gap: var(--s3); margin-top: 0; }
  .rc-sort .dd { width: calc(var(--s21) * 2 + var(--s13)); }
}
```

- Chips still sit to the right of search when only one season exists and no dropdown renders. On the tournament tab (`TournamentArchiveView`), chips precede search; give it the same single-row layout (search left, chips right), or leave chips on the row below with a 12 gap if too many tour chips overflow one line.
- On the rankings tab at 860+, give the season dropdown width 220 and left alignment (`.rc-season .dd { width: calc(var(--s21) * 2 + var(--s13)); }`), with `.dd-menu` matching the button width.
- Done at 1440 when search input, chip row, and dropdown share vertical center within 1, dropdown width is 220 with right edge at 1320, and search input stays 52 tall. Mobile 390 matches T-26 (three stacked rows, 12 gap). Reference mockup: `_drafts/rec-1440x900-pair.png`.

#### T-61 Private bracket tool buttons matching official brackets (K-01, C-03)
- Edit the private bracket tool group (`stack bk-actions`) in `src/pages/BracketsPage.jsx` and `src/styles/brackets.css`.
- At 860+, use the official bracket title-row structure (`.bk-tools` inside `.bk-open-row`, height 44, word-width buttons). Order buttons to match official brackets: `링크 공유`, QR (if present), champion image, bracket image, followed by private-only actions (score entry, edit, delete). Keep the 2-column grid on mobile.
- Done at 1440 when each private tool button is 44 tall, at most 120 wide, aligned to the right end of the title row, reducing group height from 160 to 44.

#### T-62 Admin entry buttons as title-row links (K-01, G-06, G-07)
- Targets: add title (`TitlesPage.jsx`), add past champion (`ChampionsPage.jsx`), edit round, add season, add cumulative tab, edit standings, and edit ranking (`RecordsPage.jsx`), and create first bracket (`BracketsPage.jsx`).
- Match the pattern already used by notice creation and new bracket: underlined links (`btn--link` or `sh-link`, step 12 weight 600) at the right end of the `h1` row or `SectionHead`, arranged side by side with `gap: var(--s5)` when multiple links exist, preserving a 44 hit height.
- For bracket delete (`bk-delete`, currently a 1200-wide single word), make it a right-aligned word-width + 20 horizontal padding second button (height 52) at 860+ using `justify-self: end; width: auto`.
- Done at 1440 (admin) when none of these buttons exceed 200 width, and the 1200x104 block above the rankings list disappears with links sharing the season dropdown row.

#### T-63 Desktop sheet bottom buttons (K-08, Q-06)
- Edit `src/pages/RecordsPage.jsx` (trainer and Pokemon sheet share links), `src/pages/TitlesPage.jsx`, `src/components/ShareHere.jsx`, and related CSS.
- At 860+, size sheet `링크 공유` buttons to word width plus 20 horizontal padding aligned to the sheet's inner right edge (`justify-self: end; width: auto`). Keep full width on mobile.
- Change "○○ 기록 보기" (`hof-sheet-act`) in the champion sheet to `.modal-actions` like the party sheet (a single main action sits as a docked plane).
- Done at 1440 when `링크 공유` is at most 160 wide, and "기록 보기" in the champion sheet matches the party sheet in position and width.

#### T-64 Bracket wizard and team builder rules bar (K-01, D-07)
- In `BracketWizard` step 1 (`BracketsPage.jsx`), narrow the input column to 709 at 860+ so cancel and next (439 column) sit beside it with a 52 gap, matching the 709 + 439 notice registration form.
- In `builder.css`, update `.tb-rules-line { grid-template-columns: repeat(2, minmax(0, 1fr)); }` at 1100+ to `minmax(0, 439fr) minmax(0, 709fr)` with `column-gap: var(--s13)` so it aligns with the two columns below.
- Done at 1440 on team builder when the boundary x of the two rule cells matches the two-column boundary below (559 / 611).

#### T-65 Calculator desktop layout (D-16, Q-15)
- On the speed tab at 860+, place the reference panel and conditions (Segmented, chips, description paragraph) in a `position: sticky` 439 column and the speed list in the 709 column. On the Pokedex tab, put base stats and type chart in 439 and the move table in 709.
- Done at 1440 when the blank gap between name and base stat in speed rows drops from 960 to 480 or less, and the gap between "기술" and "타입" in the move table drops from 394 to 200 or less.

### Batch 10. Action hierarchy (principle 28)

#### T-66 Destructive confirm dialog buttons (K-08, Q-01)
- Edit `src/components/common/SiteDialog.jsx`.
- Omit `icon="check"` on the confirm button when `current.danger` is true or `current.kind === "alert"`. When `danger` is true, move `autoFocus` from the confirm button to the cancel button. Keep `variant="main"`, copy, and button order unchanged.
- Do not touch `.bt-forfeit.btn { --btn-bg: #4A1820; --btn-bg-hover: #6A2230; --btn-fg: #FFFFFF; ... }` in `src/styles/battle.css` (adding a new token is outside this plan).
- Done when delete notice, reset team, and forfeit confirm dialogs have no checkmark on the confirm button and focus starts on cancel. Normal confirmations (save, approve) keep checkmark and focus as before.

#### T-67 Notice detail secondary buttons (A-10, Q-09)
- Edit `.nw-more` in `src/pages/NewsPage.jsx` and `src/styles/news.css`.
- Split buttons into two groups. The registration group (`신청 수정`, `파티 제출`, qualifier/main party submit) uses stacked 52-high second buttons. The utility group (`캘린더에 추가`, `링크 공유`, links 1 and 2, class `nw-utils`) sits on one row at height 44 with `grid-template-columns: repeat(auto-fit, minmax(0, 1fr))` and a 2 gap. Separate the two groups by 12 (principle 30).
- On mobile (859 or below), move only the registration group above the body directly below the spec rows (`.nw-more` `order` before body, 20 top margin). When two buttons are present, place them side by side in two columns at height 44. Leave the utility group after the body.
- Done at 1440 when the side column has at most three 52-high buttons including the main button (main, `신청 수정`, `파티 제출`), while calendar and share are 44. At 390, `파티 제출` top sits above the first body line. Reference mockups: `_drafts/news-1440x900-pair.png` and `_drafts/news-390x844-pair.png` (note that the mockups picked buttons by position rather than meaning and drew `파티 제출` small; follow the text spec above).

#### T-68 Edit and delete on sample and party board posts (C-12, Q-13)
- Edit `src/pages/BoardPage.jsx`.
- Move edit and delete to text buttons (`.bd-act`) on the metadata row just like free posts, leaving only image save and `링크 공유` in the large button grid (`.bd-bar`).
- Done when edit, delete, and report have identical placement and size across all three post types.

#### T-69 Admin live event panel and bracket operations row (G-03, G-13, Q-16)
- In `EventPanel` (`src/admin/AdminPage.jsx`), change cancel tournament to `variant="link"` at the bottom right of the panel (12 top margin). During registration, make `신청 현황` the main button (`variant="main"`) and `지금 마감` a second button, keeping the 1 (`지금 마감`) to 1.618 (`신청 현황`) width ratio.
- In `src/pages/BracketsPage.jsx`, place the post-recording row ("기록 반영됨" on the left, "칭호 다시 판정" and "반영 취소" links on the right with `gap: var(--s5)`) on a separate row from the image buttons using `display: flex; justify-content: space-between; align-items: baseline`.
- Done when `신청 현황` is the widest button in the live event panel and all three text items in the operations row share a baseline y within 1.

#### T-70 "내 기록 연결" placement in trainer sheet (B-18e, Q-14)
- In `src/pages/RecordsPage.jsx`, move the "내 기록 연결" section from between recent tournaments and used parties down to right above `링크 공유` at the bottom of the trainer sheet. Keep the top lead (`TrainerLink lead`) unchanged in find-my-record mode (`me=1`).

### Batch 11. No stretching (principle 29) and relational spacing (principle 30)

#### T-71 Last row of medal boards and hall of fame wall (K-12, Q-05)
- In `MedalBoard` (`src/components/TitleFaces.jsx`), remove the code that pads empty panels. In `COLS` (`src/pages/TitlesPage.jsx`), when the last row would have fewer medals than columns, set the column count to a divisor of the medal count or the medal count itself (7 partner medals become 7 desktop columns, 3 misc become 3 columns, 8 event become two rows of 4). Shrink board width to column count times cell width and left-align it without widening cells to fill 1200.
- In `.hof-wall` (`src/styles/hall.css`), render 5 champions in a single 5-column row (`repeat(5, ...)`) at 1440, and use 3 columns for 6 or more. Derive column count from champion count (pass `--n` from JSX and read it in CSS, as the home wall already does).
- Done when no titles tab contains blank panels that are neither `.off` nor medals, and the hall of fame wall has no empty cells at 1440 or 768.

#### T-72 Empty inverted panel in champion sheet (A-05, Q-14)
- In `src/components/common/ChampionSheet.jsx`, omit `className="wide"` from `Modal` when a championship has no `sets` so it opens at width 576 (fitting six sprites cleanly). Keep `wide` when `sets` exist, placing the seal (`.hof-seal`) in 439 and name, season, and "기록 보기" in 709 at 860+.
- Done at 1440 when no empty horizontal band inside `.hof-seal` exceeds 40.

#### T-73 About page two columns and lead panel (A-20)
- In `src/styles/hall.css`, match the lead panel split to home's `.ho-screen` formula (`minmax(0, 1fr) calc((100% - var(--s13)) * 439 / 1148)`). Do not stretch the "세 가지 대회" and "정규 리그" columns to align their bottoms (keep the 122 difference per principle 29).
- In `src/pages/AboutPage.jsx`, add step number "1" to the lead panel (Discord join), since only "2" and "3" exist now.

#### T-74 Home hero (A-02, A-13, Q-07, Q-08)
- Fix clock overflow at 360: in the tournament-day branch of `src/pages/HomePage.jsx`, render the "시작" unit (`.ho-unit`) on the label line above ("오늘 대회 진행 중") instead of beside the clock at 389 or below. A CSS-only equivalent is `@media (max-width: 389px) { .ho-board.today { flex-wrap: wrap; } .ho-board.today .ho-unit { order: -1; flex-basis: 100%; } }`. Keep the clock at height 84.
- Fix the 72 empty band at 1440: in `src/styles/home.css` (860+), change `.ho-display`'s `align-items: end` to `align-items: start`. Omit the date-and-time spec row on tournament day when `now.today` is true (it repeats the clock).
- Done when at 360 `.ho-board` right is within panel inner right with no horizontal overflow, at 390 the clock has at least 12 right padding, and at 1440 name block bottom to clock top is 20.

#### T-75 Group stage and double elimination (C-07, C-08, C-09, Q-12)
- In group stage (`GroupStageBoard` in `BracketsPage.jsx`, `brackets.css`), put 12 between the group standings rows and match rows (principle 30), and 12 below / 32 above the "본선" heading. At 860+, constrain group blocks to 709 so names and "본선 진출" do not sit 1100 apart.
- On mobile list view, move the champion panel to the top just like tree view: remove `:has(.bk-champ-node)` from `.bk-board:has(.bk-champ-node) .bk-result > .bk-winner { display: grid; order: -1; margin: 0; }` in `brackets.css` so it applies across all viewports at 859 or below. Set the desktop list view champion name to 32/40 as well.
- In double elimination, keep column widths as integers (do not switch `.bk-tree` to grid; give columns `flex: 1 1 0` with an integer `min-width`, letting the last column take any remainder when `.bk-scroll` width is not evenly divisible). Place grand finals and champion on a separate row below with their own "그랜드 파이널" header rather than under "패자조". Leave losers bracket without connector lines.
- Done at 1440 on double elimination (`eventId=c34f3629-ad49-4d32-82fb-38d1f989fa13`) when every `.bk-col2` left and width is an integer, and in group stage standings bottom to matches top is 12.

#### T-76 Unified empty search state (K-17, Q-11)
- Standardize on the board's single-line text panel. Remove `<Seg value={0} cells={2}/>` from `<Empty className="search-none">` in the private brackets tab (`BracketsPage.jsx`) and notice search (`NewsPage.jsx`), since T-06 already displays the count inside the search box.
- Done when empty search states across all three screens share the same height and structure.

#### T-77 Notice list search placement (K-03, Q-08)
- In `src/pages/NewsPage.jsx`, move the search box above the "다가오는 대회" section (directly below `h1`, spaced by T-79). Keep hiding "다가오는 대회" while a query is active.
- Done at 1440 and 390 when `.search-in` top stays identical before and after entering a search query.

#### T-78 Mobile comment header (C-05, Q-10)
- In `src/pages/BoardPage.jsx`, format comment and post header dates at 639 or below as "11.19 오후 3:12" (or "25.11.19 오후 3:12" for another year) with `white-space: nowrap`. Implement this formatter in the page layer without modifying existing functions in `src/services/dateFormat.js`.
- Done at 390 and 360 when every comment header stays on one line (height 16) and comment panel height does not vary with author name length.

#### T-79 Unified spacing below titles (K-05, Q-04)
- Below `h1`, use 32 (`--s8`, "between groups; a page title under the bar"). Update whichever of `.nw-upcoming, .nw-search, .nw-list` in `news.css` directly follows `h1`, `.alerts > h1 { margin-bottom: var(--s5); }` in `more.css`, and `.ab-screen { margin-top: var(--s5); }` in `hall.css` to `var(--s8)`. More and records already use 32.
- Below tab strips, use 20 (`--s5`). Change `.rc-body { margin-top: var(--s3); }` in `records-board.css` to `var(--s5)`. Titles already uses 20.
- Remove the three `... > .back:first-child { margin-top: calc(var(--s3) * -1 + (var(--l12) - var(--h-control)) / 2); }` rules from `news.css`, `brackets.css`, and `posts.css` so back links align with the side column top (matching the registration form) and stop overlapping `LiveStrip` by 6 on mobile.
- Done at 1440 when `h1` bottom to next element top is 32 on notices, alerts, about, more, and records; tab strip bottom to content top is 20 on records and titles; and the back link box top aligns with the side or body column top on notice detail, bracket, and board post pages.

#### T-80 Hint text sizing (G-12, Q-02)
- In `src/styles/components.css`, change `.bk-hint, .hint { font-size: var(--t15); line-height: var(--l-read); color: var(--dim); }` to `font-size: var(--t12); line-height: var(--l12);` (Hierarchy step 5: hints are 12/16 on mobile, 15/20 on desktop). Inspect every match of `grep -rn "className=\"hint\"\|bk-hint" src` and switch multi-line reading paragraphs to `prose` classes.
- Done at 390 when no hint is larger than its field label.

### Batch 12. Remaining records fixes (Q-14)

#### T-81 Top 3 panel counters
- In `src/styles/records-board.css`, remove the background from `.rc-top-cell { ... padding: var(--s2) var(--s3); background: var(--panel-2); }` and set `padding: var(--s2) var(--s3) var(--s2) 0;` so all three panels render without nested cells and labels align with the name's left edge. Delete the now-redundant `.inv .rc-top-cell { background: transparent; padding-left: 0; }` rule and the hover rule added in T-11. Reference mockup: `_drafts/rec-1440x900-pair.png`.

#### T-82 Tournament tab length
- In `TournamentArchiveView` (`RecordsPage.jsx`), render only the 20 most recent tournaments initially with a "N개 전체 보기" button below (matching "N명 전체 보기" on the trainer tab). Render all items while searching or when a tour chip is selected.
- Done on `?view=records&tab=tour` at 1440 when document height drops from 15,568 to 7,000 or less.

#### T-83 League tags
- Leave as is (no change). Column misalignment is solved by T-24.

#### T-84 Hall of fame crown six sprites
- In `src/styles/hall.css`, change mobile `.hof-crown-mon` from `--floor: var(--h-control)` to `--floor: var(--h-strip)` (shrinking the name strip from 44 to 32 so sprites grow). At 860+, change `.hof-crown` from `align-items: end` to `align-items: stretch`, and `.hof-crown-mon` from `aspect-ratio: auto; height: calc(var(--s21) * 2);` to `height: 100%; min-height: calc(var(--s21) * 2);`.
- Done when at 390 the current champion's sprites are at least 1.25x larger than past wall sprites, and at 1440 the blank band above the six sprites is at most 40.

#### T-85 Recent tournament date formatting
- When a trainer sheet's recent tournament list spans two or more years, show the year on every row. Do not modify `src/services/dateFormat.js`; pick a year-inclusive formatter in the sheet (reusing an existing one from `dateFormat.js` if available).

### Batch 13. Team builder and calculator (Q-15)

#### T-86 Candidate pool at 860 to 1099
- In `src/styles/team-builder.css` for the 860 to 1099 range, change `.tb-pool-panel { position: static; max-height: 576px; }` to `max-height: none;` and set `.tb-pokemon-list { max-height: none; overflow: visible; }` so the pool scrolls with the page like mobile.
- Done at 1099x900 and 860x900 when the candidate list has no internal scroll.

#### T-87 Desktop candidate row
- At 1100+, change the 3-line desktop row rule in `src/styles/team-builder.css` to a single 64-high row: 64 sprite cell, name and type tags on one line, and six stat cells plus total. Keep the type grid as is.
- Done at 1280x800 when visible candidate rows increase from 2.6 to at least 5, and at 1100 to 1199 the gap between stat numbers is at least 8 (D-25).

#### T-88 Calculator mobile stat rows
- In the mobile section of `src/styles/calculator.css`, change `.calc-stat-row { grid-template-columns: var(--s8) minmax(0, 1fr) var(--h-control) calc(var(--s21) + var(--s5)); }` using `grid-template-areas` to move the rank stepper onto a second line. The HP row has no rank and stays single-line.
- Done at 390 when bar width grows from 134 to at least 230.

#### T-89 Blocked official submission panel
- In `OfficialSubmissionPanel` (`TeamBuilderPage.jsx`), when `blocked` is true, display the reason right below the title and omit the step strip, name input, and applicant lookup. Replace the dropdown chevron on locked rule selects with a lock icon (matching `tb-locked-item` in the editor).

#### T-90 Remove plus sign on empty slots
- In `TeamBuilderPage.jsx`, remove the `+` from empty slots since they are not interactive; show only the dimmed slot number.

#### T-91 "최종" column header
- In `TeamBuilderPage.jsx`, stop repeating "최종" on every stat point row ("최종 185"). Show "최종" once at the right end of the stat points header row and right-align the numbers (`font-variant-numeric: tabular-nums` is already global).

### Batch 14. Structural motion (Q-18)

#### T-92 Relight only changed content on tab and chip switch (F-04, F-05)
- Update `lightAfter` in `src/components/common/motion.js` so it skips siblings marked with `[data-still]` instead of relighting every sibling after the control. Add `data-still` to the outer element of `ListSearch` and `Dock` so search inputs (`.search`) and main button docks (`.dock`) stay still. Remove `.swap` from containers already lit by `light` (`.rc-body`, title boards, `.bk-board`, `.bk-list`) to eliminate double fades.
- Done when clicking the "더블" chip on the board party tab leaves `.search-in` and `.btn--main` with empty `getAnimations()`, while list rows still light up over 420ms with 38ms stagger.

#### T-93 Fold close animation (F-07)
- Add exit animation to folds in `RecordsPage.jsx` (round official parties), `NewsPage.jsx` (registration status), and `BracketsPage.jsx` (party submission status) using the `useExitAnimation` pattern from `Modal.jsx`: fade content opacity to 0 over 160ms (`tone`, `ease-in`) before unmounting. Never animate height (only `transform` and `opacity` are allowed).
- Done when closing runs one 160ms opacity animation on the content and closes immediately under reduced motion.

#### T-94 Prevent desktop dialogs from jumping on errors (F-06)
- Desktop `.sheet` in `components.css` (860+) uses `top: 50%; bottom: auto; ... translate: -50% -50%;`. Right after `Modal.jsx` opens, measure `.sheet` top in pixels once, write it to `style.top`, and change `translate` to `-50% 0` so later height growth expands downward only (existing `max-height` still caps overflow).
- Done at 1440 when submitting an empty post sheet triggers validation errors without changing `.sheet` top (previously 54 to 26).

#### T-95 First-visit home layout stability (F-03)
- In `src/pages/HomePage.jsx`, while `last` (previous tournament) is still loading and there is no upcoming tournament, do not render the "다음 대회" layout or "공지 보기" button. Render an unlit panel matching the previous tournament panel's height (unlit segments, no button), then light it in place once data arrives.
- Done when recording a cold visit (no cached copy) at `--cpu 4` shows no frame where the main button label changes and 0 layout shift on the standings section top.

#### T-96 Heavy sheet first frame (F-02)
- Measure first on a production build (`npm run build && npx vite preview --port 4173`) using `scripts/record-transition.cjs` to record opening a trainer sheet at 390, `--cpu 4`, `--every 40`. If the sheet's top edge has already passed halfway from start (864) to end (52) on the first frame after click, delay the spring start in `Modal.jsx` until after the sheet's first paint (two `requestAnimationFrame` calls before `slide(0)`). If it has not passed halfway, close as no change and record the measurement.

#### T-97 Top bar hover (F-08, Q-17)
- Leave as is (no change). Dimming top bar words at rest alters the site's tone; keep existing `.navlink` hover only.

#### T-98 Pager (F-11)
- Leave as is (no change). Giving lists a minimum height creates an empty band on short last pages (principle 29).

### Batch 15. Battle (Q-19, Q-20)

Battle screens follow "Judging the play screen" in the "Battle" chapter of `DESIGN.md`. After edits, re-measure frames with `scripts/measure-frames.cjs` as documented in `docs/BATTLE_FRAMES.md`. Visual effects and behavior must stay intact.

#### T-99 Two-column battle from 860 to 1199 (E-02)
- Lower the `@media (min-width: 1200px)` block in `src/styles/battle.css` (two-column `grid-template-columns: minmax(0, 1fr) 400px`, stage `max-height`, sticky side column) and `WIDE = "(min-width: 1200px)"` in `src/pages/BattlePage.jsx` to 860. Narrow the side column to `calc(var(--s21) * 4)` (336) between 860 and 1199 (400 would leave only 420 for the stage at 860). Clean up existing `@media (min-width: 860px) and (max-width: 1199px)` rules (`max-width: 980`, etc.) in `battle.css` so they do not conflict.
- Done at 860x900, 1024x768, and 1199x800 when battle document height equals viewport height (no scroll), all four move buttons and bench fit inside the viewport, and `.bt-head` sits above the deck. Viewports at 1200+ must match pixel-for-pixel against `before`. `measure-frames.cjs lobby` and `replay-open` must pass.

#### T-100 Minor battle adjustments (E-05, E-07, E-08, E-09)
- In the desktop side column (`.bt-side` child order in `BattlePage.jsx`), place the menu (effects, sound, forfeit) directly below the header and the party panel beneath it.
- Dismiss the turn-1 guidance toast after 4.66 seconds (matching `Toaster.jsx`), keeping its position and appearance unchanged.
- In desktop doubles (860+ `.bt-hud-own` in `battle.css`), stack the player's two plates vertically on the right (`column` under `.two`) just like mobile.
- At 379 or below, reduce vertical padding on team-preview `.bt-card.short` from 12 to 8.
- Done when at 1440x900 the forfeit button stays inside the viewport during battle, in doubles player plates overlap player Pokemon boxes by at most 20% of box area, and at 375x667 team preview the third row card bottom is at or above dock top.

#### T-101 Battle items left unchanged
- No changes for the 140 gap above the post-battle mobile deck (preserves deck height), the 107 gap below the lobby court, turn counter label, three 0 counters in the room list, or extreme 390x480 height. Lobby-to-preview clipping (E-06) stays a separate task under `docs/BATTLE_TRANSITIONS.md`.

### Batch 16. Visible functional bug (Q-21)

#### T-102 Calculator "난수 5타 (NaN%)" (BUG-1)
- In `koLabel` (`src/services/calculatorCore.js`), omit the parenthetical percentage and return `난수 ${ko.n}타` when `ko.chance` is not a valid number. Add a test case if calculator tests exist under `tests/`. Although this is in service code, it only fixes one display string and leaves calculation logic untouched.

Deferred bugs not in this plan: empty info on random CPU battle parties (BUG-2) has an unknown root cause and needs `systematic-debugging`; BUG-3 and BUG-4 need reproduction and data verification first.

### Batch 17. Linked-account screens (added 2026-11-23)

The initial audit ran without Google account linking. These tasks come from 12 logged-in production screenshots captured by the user (report.md Section 11, `docs/visual-audit/shots/ACCT-*/`). Run this batch after Batch 16. Because only the user can sign in, verify structure and numbers from code and logged-out states as far as possible, and report linked-account screens as needing user verification.

#### T-103 Account keys group where logout is the largest button (H-01, principles 27 and 28)
- Edit `src/components/AccountKeys.jsx` and `src/styles/records-board.css` (or `more.css`).
- Currently `<div className="stack rc-more">` renders `<Button variant="second">로그아웃</Button>` (1156x52 on records, 709x52 on more, 1145x52 on my sheet) above two centered `variant="link"` items (`기록 연결 해제`, `계정 삭제`).
- Make all three actions `variant="link"` on a single left-aligned row: `로그아웃`, `기록 연결 해제`, `계정 삭제`. Rename the wrapper class to `acct-keys` with `.acct-keys { display: flex; flex-wrap: wrap; align-items: center; gap: 0 var(--s5); margin-top: var(--s3); }` and `min-height: var(--h-control)` (44) on each link. Place `FormError` full-width on the row below.
- Done on more, find-my-record (`?view=records&me=1`), and my trainer sheet when all three words share one baseline, align with the group's left text edge, and no button exceeds width 200.

#### T-104 Top connection banner and logout on my sheet (H-02, principle 28)
- Edit `TrainerLink`'s `lead` and the `AccountKeys` below it in the trainer sheet (`src/pages/RecordsPage.jsx`).
- Currently on a linked user's own sheet, an inverted strip "내 기록으로 연결되었습니다." (1145x44) and `로그아웃` button (1145x52) sit right below the counters ahead of "내 전적".
- Do not render that top lead on an already approved own sheet. Instead, place a single `Row` ("기록 연결됨") in the "내 기록 연결" section moved to the bottom by T-70, followed by T-103's account keys row. Keep the top lead ("○○ 님의 기록이라면", link button) when unlinked or viewing someone else's sheet in find-my-record mode.
- Done on a linked own sheet when the "내 전적" heading comes directly after the counters.

#### T-105 "내 전적" section (H-03, Composing a screen 22)
- Edit `MyRecord` in `src/pages/RecordsPage.jsx`.
- Currently an explanatory panel `<Row title="나에게만 보입니다." line="다른 사람의 시트에는 전적이 서지 않습니다." />` (height 64) sits under the heading, every opponent row repeats "자주 만난 상대" as its grey line, and win/loss counters repeat "승" / "패" as both label and unit.
- Replace the explanatory panel with one grey line (`t12 dim reg`, 4 below the title): "나에게만 보입니다.". Place a single label (`t12 dim`, 8 bottom margin) "자주 만난 상대" above the opponent rows, remove that phrase from individual row grey lines (showing only "게임 a:b" when game scores exist), and change win/loss counter units to "판" (label `승`, value 3, unit `판`).
- Done when "자주 만난 상대" appears once in the "내 전적" section.

#### T-106 Duplicate "알림" row on more page (H-04, K-16)
- Edit `src/pages/MorePage.jsx`.
- Currently when signed in, both the "내 계정" group ("이 기기에서 꺼짐") and the "함께하기" group ("새 알림" lamp) render an `알림` row.
- When signed in (when the `내 계정` group renders), omit `알림` from "함께하기" and move the "새 알림" lamp onto the `내 계정` group's `알림` row. Leave logged-out state unchanged.
- Done when a signed-in more page shows only one row starting with "알림".

#### T-107 Scrollbars inside sheets and menus (H-05)
- Edit `src/styles/tokens.css`.
- Currently `scrollbar-color: var(--mute) transparent; scrollbar-width: none;` on `html` inherits `scrollbar-color`, causing Chrome 121+ to ignore `::-webkit-scrollbar { width: 8px }` inside sheet and menu scrollers and draw native OS scrollbars with arrow buttons (visible on the right edge of headed capture `ACCT-my-sheet/1440x900-light.png`; headless captures hid it).
- Below the `::-webkit-scrollbar` rules, add `@supports selector(::-webkit-scrollbar) { body { scrollbar-color: auto; } }` so Chromium and Safari use the 8px scrollbar while Firefox keeps `scrollbar-color`.
- Done in headed Chrome (`scripts/visual-audit.cjs --headed`) when opening a trainer sheet gives `.modal` `offsetWidth - clientWidth` of at most 8, screenshots show no scrollbar arrow buttons, and the page (`html`) scrollbar remains hidden.

#### T-108 Verification-only items
- Confirm on the user's own row (`이제빈`) that T-24 (220 name column) fixes the 43 shift of the badge column caused by the "나" tag (x = 344 vs 301 on other rows; name + league tag + "나" tag is about 140 wide).
- Confirm that T-20 fixes admin login floating mid-column (y = 1160 vs left column bottom 1436) on the logged-in more page.
- Battle records and 도전의 탑 linked-account tabs did not load during that capture because `battle` function requests were blocked (reads also use POST); they were not evaluated.

### Batch 20. Test environment findings (added 2026-11-23, report.md Section 12)

These items come from testing states missed by the initial audit using `scripts/visual-audit-env/` (see its README). All items below were still present after Batches 1 to 19 (only P-01, the 24-too-tall battle screen, was resolved by another fix). Locate code by selector and string rather than line numbers. Verify in the same environment (5193 production read, 5194 + 54321 mock backend; the scripts restrict production traffic to GET only). Split this batch into four commits: 20a loading and errors, 20b account and home, 20c brackets and operations, and 20d battle and 도전의 탑.

Judgment calls are decided below per the user's delegation at the top of `questions.md`.

#### 20a. Loading, error, and empty states

##### T-109 Home error notice when site data fails (R-01)
- Edit `{factsFailed && <ErrorNote ... >리그 기록을 불러오지 못했습니다.</ErrorNote>}` in `src/pages/HomePage.jsx`.
- Render the same `ErrorNote` when `site_data` loading also fails and the page falls back to bundled `siteSeed`. Pass a source flag from `App.jsx` so home knows it fell back to bundled data, without altering how bundled champions and standings render.
- Verify in fail mode of `scripts/visual-audit-env/states/states.cjs` (all REST calls return 500) at 390 and 1440: one `.error-note` renders on home.

##### T-110 Notices and alerts error state vs empty state (R-02)
- Edit `<Empty title="등록된 공지가 없습니다."/>` in `src/pages/NewsPage.jsx` and `최근 7일의 알림이 없습니다.` in `src/pages/AlertsPage.jsx`.
- Distinguish list fetch failure (error return or exception from the service) from an empty result, rendering `<ErrorNote action="다시 불러오기" onRetry=...>` with `공지를 불러오지 못했습니다.` or `알림을 불러오지 못했습니다.` just like board and brackets. Show the empty state only when the fetch succeeds with 0 items.
- Verify in fail mode that notices and alerts display `.error-note` with no empty-state text, while normal mode stays unchanged.

##### T-111 Brackets not showing error and empty state together (R-03)
- In `src/pages/BracketsPage.jsx`, change `: list.length===0&&<Empty title="아직 만들어진 대진표가 없습니다.">` to `list.length===0&&!normalizedLoadError&&`.
- Verify in fail mode that only the error panel renders.

##### T-112 ErrorNote retry button width and top margin (R-07)
- In `src/styles/board.css`, below `.error-note { display: grid; gap: var(--s3); padding: var(--pad); }`, add `.error-note > .btn { justify-self: start; }` and `h1 + .error-note, .page-head + .error-note { margin-top: var(--s5); }` (check actual preceding elements in `LazyContent` and each page to match the right selectors).
- Verify at 1440 that `다시 불러오기` and `새로고침` buttons are word-width plus 20 horizontal padding (200 or less) and `h1` bottom to panel top is 20.

##### T-113 Unlit first row in home standings skeleton (R-06)
- In `src/components/common/StandTable.jsx`, change the skeleton's `<div className="inv ls-row ls-first" />` to `className="pn ls-row ls-first"` (same height, no inversion, per `DESIGN.md` "Loading": right size, nothing lit).
- Verify in `states.cjs` hold mode at 1500ms that no white bar appears in the standings area.

##### T-114 Reserve height for team builder data status line (R-13)
- Edit the line rendering `dataStatusText` in `src/pages/TeamBuilderPage.jsx`.
- Keep the element mounted with `min-height: var(--l12)` when empty so content below does not jump up. Remove the ellipsis from the copy so it reads "배틀 데이터 불러오는 중" (`DESIGN.md` Voice forbids `...`).
- Verify in hold mode at 390 that `.tb-search-row` top stays identical before and after data arrives.

##### T-115 Home main button in zero-data state (R-19)
- In `src/pages/HomePage.jsx`, where `primary` resolves to `["공지 보기", "news"]`, omit the main button if notice count is also 0.
- Verify in zero mode (`extremes.cjs zero`) that no white button renders on home.

#### 20b. Account and home

##### T-116 Reserve height while account resolves on find-my-record and more (R-08, R-09)
- Edit `FindMe` in `src/pages/RecordsPage.jsx` and the `내 계정` group in `src/pages/MorePage.jsx`.
- While `account === undefined`, reserve the resolved heights of `FindMe`'s account keys and "내 기록 보기" row with unlit panels. Keep "저장한 팀" and "내 배틀" rows on more at two-line height (`--h-row2`, 64) while loading their subtitle line, reserving an empty line slot until loaded and showing "불러오지 못했습니다." on failure.
- Verify with `states/account.cjs checking pending approved` at 390 that "72명 전체 보기" y stays within 2 across all three states, and with `account.cjs linesfail` that all more rows remain 64 tall.

##### T-117 No unlink button when link request is rejected (R-15)
- In `src/pages/RecordsPage.jsx` and `src/pages/MorePage.jsx`, pass `link={null}` to `AccountKeys` when `link?.status === "rejected"`.
- Verify with `account.cjs rejected` that "기록 연결 해제" does not appear.

##### T-118 Keep top bar account button clear of the wordmark (R-10)
- Edit `.acct` in `src/styles/shell.css`.
- At 859 or below, set `max-width: calc(var(--s21) * 2)` (168) with ellipsis on the account name element (confirm the class in `SiteHeader.jsx`).
- Verify with `account.cjs long` at 390 that wordmark right edge to account button left edge is at least 20.

##### T-119 도전의 탑 gate sheet copy (R-11)
- Edit `gateSheet` in `src/pages/battle/Streak.jsx`.
- When the user has no linked name, label the button "내 기록 찾기" (matching the destination). When `account?.status === "rejected"`, add the hint line "연결 요청이 거절되었습니다." (matching `LINK_STATE.rejected` in `RecordsPage.jsx`).
- Verify with `account.cjs none rejected` that sheet title and button label differ and the rejected state shows the hint.

##### T-120 Long current champion name in hall of fame (R-05)
- In `src/styles/hall.css`, change `.hof-crown-name { margin-top: var(--s2); }` to `.hof-crown-name { margin-top: var(--s2); min-width: 0; overflow-wrap: anywhere; }`.
- Verify with `extremes.cjs long 390 844 dark` on hall of fame that name right edge stays within panel inner right, while Korean names behave as before.

##### T-121 Home past champions row cap (R-04)
- Edit the past champions wall in `src/pages/HomePage.jsx` (leave `.ho-line` in `src/styles/home.css` unchanged).
- Show only the 5 most recent champions on home (the "명예의 전당" link sits directly above), setting `--n` to `min(championCount, 5)`.
- Verify with `node scripts/visual-audit-env/states/manyhome.cjs` (20 champions) at 1440: 5 cells render, each at least 200 wide.

##### T-122 Tournament-day home layout and live card (Q-11, Q-12, Q-13)
- In `src/styles/home.css` (860+), change `.ho-screen`'s `align-items: stretch` to `align-items: start`, and check that a shorter champion panel leaves an empty band of at most 40 below (if it exceeds 40, revert this line and report).
- In `primary` (`src/pages/HomePage.jsx`), when today is a tournament day and `myNext` exists, set the main button to "대진표 보기" (the "내 다음 경기" card directly below already links to the user's match).
- On the live match card, show the stage name of the displayed match (`liveMatch`) instead of a different match's `live.stage`.
- Verify with `scripts/visual-audit-env/admin/flow.cjs live HOME-08 1440x900 light visitor "/" wait:3000 full:mynext` that no empty surface appears from panel height mismatch and the progress line stage matches the card header.

#### 20c. Brackets and operations

##### T-123 Score entry width and buttons (Q-01)
- Edit `.bk-entry-row` and `.bk-entry-actions { grid-template-columns: minmax(0, 1fr); }` in `src/styles/bracket.css`.
- At 860+, constrain `.bk-entry` to width 709 and set `.bk-entry-actions` to `display: flex; flex-wrap: wrap; gap: var(--seam);` with word-width (`flex: 0 0 auto`), 44-high buttons.
- Verify with `admin/flow.cjs live ADM-BRK-04 1440x900 dark admin "/?view=bracket&eventId=c34f3629-ad49-4d32-82fb-38d1f989fa13" wait:2500 "M5" shot:decided`: gap between name and score stepper is at most 500, and no-show, forfeit, and DQ buttons are each at most 160 wide.

##### T-124 Show "테이블 미정" only on unplayed matches (Q-03)
- Edit `const stripOf=m=>{ ... "테이블 미정" ... }` in `src/pages/BracketsPage.jsx`.
- When a match already has a winner or a bye and no table is assigned, render an empty `.mb-strip` of the same height instead of "테이블 미정" so tree alignment stays intact.
- Verify with `live` data that finished match cards show no "테이블 미정" text while keeping their previous y positions.

##### T-125 Bye winner name color (Q-04)
- In `src/styles/brackets.css`, below `.mb-row.inv .mb-seed { color: var(--ground); }`, add `.mb-row.inv :is(.mb-name, .mb-name *) { color: var(--ground); }` (or, if cleaner, add `:not(.inv *)` to the rule causing grey text).
- Verify that the winner row name in a bye match renders in `rgb(8,28,61)` in dark mode or `--ground` in light mode.

##### T-126 Dismiss report action placement (Q-07)
- Edit `src/components/CommunityReports.jsx`.
- Place "신고 지우기" in the row's `value` slot (like "연결 해제" on link requests) instead of as a separate link between rows.
- Verify with `admin/flow.cjs live ADM-07 1440x900 dark admin "/?view=admin" wait:1500 full:rows` that no other element interrupts between report rows.

##### T-127 Bracket wizard tool buttons (Q-08)
- Edit `.bk-pin-keys { grid-template-columns: repeat(3, minmax(0, 1fr)); ... }` and `.bk-place-tools` in `src/styles/bracket.css`.
- At 860+, set `display: flex; flex-wrap: wrap; gap: var(--seam);` with word-width, 44-high buttons. Constrain participant lists and placement rows to 709 (aligning with T-64's 709 + 439).
- Verify on steps 2 and 3 at 1440 that each button is at most 200 wide.

##### T-128 Admin fields in trainer sheet (Q-10)
- Edit rename ("이름 저장") and merge controls in `src/pages/RecordsPage.jsx`.
- At 860+, place input and button on one row (`grid-template-columns: minmax(0, 439px) auto; gap: var(--seam)`) with 32 between the rename group and merge group.
- Verify by opening a sheet via `admin/flow.cjs plain` (see README): name input is 439 wide and "이름 저장" sits directly to its right.

##### T-129 "내 경기로" button on live bracket (Q-14)
- Edit `{myMatch&&<Button variant="second" icon="arrow" ...>내 경기로</Button>}` in `src/pages/BracketsPage.jsx`.
- On mobile (859 or below), move it above the share buttons and use `variant="main"`. Keep desktop in its current spot as `second`.
- Verify at 390 as a linked player in `live` data that "내 경기로" sits above the share buttons and is inverted.

#### 20d. Battle and 도전의 탑

##### T-130 Single card light-up when entering a tower game (P-02)
- Edit `useMatchLit` in `src/pages/BattlePage.jsx` at `if (!preview?.querySelector(".bt-card")) { light(main, DUR.leave); return; }`.
- Narrow the early return to when `.bt-preview` itself does not exist. When cards are not mounted yet, run `look()` to catch late-arriving cards and light them with `lineup(..., -wait)` (using `liftArrive`'s `wait`) the moment they appear.
- Verify in `scripts/visual-audit-env/streak/t6.cjs 390 844` logs that cards start near opacity 0 on their first frame and reach 1 after `.tw-veil` clears, including on the next game. Confirm `t4.cjs` frame sheets show no double light-up.

##### T-131 Keep site bar hidden between tower games (P-03)
- Edit `return () => page?.classList.remove("page--battle");` in `src/pages/BattlePage.jsx`.
- Remove `page--battle` only when leaving the battle screen (when battle ID clears in `BattlePage` or `BattlePage` itself unmounts), not when `Arena` unmounts.
- Verify in `t6.cjs` logs that `.topbar` height stays 0 while transitioning to the next game.

##### T-132 Code room waiting screen on mobile (P-04)
- Edit `<Counter label="기다린 시간" ... h={code && !rematch ? 84 : 40} />` in `src/pages/BattlePage.jsx`.
- Always use `h={40}` for `기다린 시간` (keep only the room code at 84). If cancel waiting still falls outside the viewport at 859 or below, place cancel waiting as the second button in the dock at a 1 (cancel waiting) to 1.618 (`링크 공유`) ratio, matching confirm dialogs.
- Verify on `streak/t8.cjs` code room wait at 390x844 that the `기다린 시간` counter bottom is at or above dock top and cancel waiting fits inside the viewport.

##### T-133 Tower party draft cards on mobile (P-05)
- Edit the draft card styles in `src/styles/tower-play.css` and the two-line ability/item markup in `src/pages/battle/Streak.jsx`.
- At 859 or below, combine ability and item onto one line ("특성, 도구", with ellipsis on overflow).
- Verify on the 3 draft cards in `t8.cjs` at 390x844 that `.streak-pick-stats` bottom is at or above dock top.

##### T-134 Desktop header game label (P-06)
- Edit the header tag `도전의 탑 ${gameWords(gameAt)}` in `src/pages/BattlePage.jsx`.
- Show only `gameWords(gameAt)` ("2층 두 번째 판") when game position is known, and show "도전의 탑" only when unknown.
- Verify on 1440 rest and end screens that the label satisfies `scrollWidth <= clientWidth`.

##### T-135 Relay tab chips on mobile (P-08)
- Edit the chip row in the relay list (`LiveHall`) in `src/styles/battle.css` (not `.bt-match .chips`).
- At 639 or below, add `flex-wrap: wrap` so it wraps to two lines like other chip rows on the site.
- Verify on `streak/t3b.cjs` relay list at 390 that the chip row right edge is at or below 370.

Items left unchanged in Batch 20: R-14 (solved by T-103), R-16 (32 shift, 0 at 1440), R-17 (busy cell), R-18 (single loading cell on blank screen, no motion), Q-02 (solved by T-62), Q-05 (T-18), Q-06 (T-69), Q-09 (link request button width reads as one unit with its card), Q-15 (match schedule sheet), and P-07 (single pause on swap-to-gate, about 60ms at real speed; keep measurement only).

At the end of Batch 20, re-run the scripts above to verify each task's numbers, then run `npm test` and `npm run build`. Compare normal logged-out production shots (`scripts/visual-audit.cjs --vp core`) against post-Batch-19 shots to confirm nothing else changed.

### Section 5 execution order and final check

Run Batches 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, and then 20 (Batches 18 and 19 were separate commits made during execution). Run the common per-batch checks from Section 3 after each batch. After finishing Batches 9 to 11, compare live screens side by side against the right half of `_drafts/*-pair.png`. After completing all of Section 5, run the full Section 4 checklist again.
