# Screen state inventory (visual audit stage 1)

Written 2026-11-22. Every user-visible screen state extracted from the codebase. Each item ID (such as `HOME-03`) is used as the filename in the stage 2 capture script and as the reference in the diagnostic report.
Paths are relative to `src/`. Items marked `[write]` mutate server state or `site_data` and are captured only up to the state right before clicking.

## 0. Capture conditions

### Viewports (requested and code breakpoints)

| Group | Size | Reason |
|---|---|---|
| Mobile | 360x800, 390x844, 430x932 | Requested |
| Breakpoint 379/380 | 379x800, 380x800 | `battle.css:839` (max-width 379) |
| Breakpoint 600/601 | 600x900, 601x900 | 6 places in `battle.css` (max-width 600) |
| Breakpoint 639/640 | 639x900, 640x900 | 576 column starts (`tokens.css:128`), 14 places |
| Tablet | 768x1024 | Requested (within 640 to 859 range) |
| Breakpoint 859/860 | 859x900, 860x900 | Desktop switch, 100+ places (`tokens.css:129`) |
| Breakpoint 1099/1100 | 1099x900, 1100x900 | All tabs shown (`Navigation.jsx:14`), builder, calculator |
| Breakpoint 1199/1200 | 1199x900, 1200x900 | Battle side column (`battle.css`, `BattlePage.jsx:51-53`) |
| Desktop | 1280x800, 1440x900, 1920x1080 | Requested |
| Height breakpoints | 390x480, 390x760 | `max-height: 480`, `min-height: 760` (at 859 and below) |

- Themes cover dark (default) and light. Both high-contrast modes (`data-contrast=more`) are captured as a secondary check on home and a few representative screens.
- Motion recordings use `scripts/record-transition.cjs` (Chrome screencast, frame sheets) and `scripts/measure-frames.cjs` for battle, including reduced-motion comparisons.
- Data environments follow four setups:
  - Public screens run on `ypl-dev-prod-data` (5183, read-only production data) without triggering write actions.
  - Admin screens on production data reuse a session where the user logged in manually and stop right before any write. Alternatively, `ypl-dev-offline` (5182, no Supabase, accepts any login input, stores data in localStorage) allows running writes without touching production.
  - Extreme data (long names, 0 items, hundreds of items) is simulated by intercepting Supabase responses through Playwright routes without modifying real data.
  - CPU battles run offline to completion. Internal battle states are forced with `?view=lab` (dev server only). Real-time two-player states and `도전의 탑` progression states are listed under "Capture gaps" below.

## 1. Shared shell (all screens)

| ID | State | Location |
|---|---|---|
| SHELL-01 | Top bar: 5 tabs (under 1100) / all tabs (1100 and above), live lamp on and off, theme button (sun/moon) | `layout/SiteHeader.jsx:73-100`, `Navigation.jsx:14-18` |
| SHELL-02 | Top bar account button: hidden (accounts disabled) / "내 기록" / linked name (including long names) | `SiteHeader.jsx:48-68` |
| SHELL-03 | Mobile tab bar (859 and below): active tab, "더보기" active when inside a nested view, bracket live lamp | `Navigation.jsx:25-40` |
| SHELL-04 | "더보기" menu: desktop popover / mobile sheet | `common/Menu.jsx:45-62`, `App.jsx:296-301` |
| SHELL-05 | Footer: non-admin (admin login link) / admin | `layout/SiteFooter.jsx:12-42` |
| SHELL-06 | Tournament-day LiveStrip (all screens except home and brackets) | `App.jsx:312`, `Board.jsx:126-133` |
| SHELL-07 | Initial load: `page--wait` + Loader | `App.jsx:309-310`, `shell.css:79` |
| SHELL-08 | Page transition: previous screen dims to .382, centered busy cell appears after 260ms | `shell.css:102-103`, `App.jsx:331` |
| SHELL-09 | Lazy-loaded screen: loading / failed ("화면을 불러오지 못했습니다." + reload) / modal loading and failure | `common/LazyContent.jsx:117-139` |
| SHELL-10 | 404 ("페이지를 찾을 수 없습니다.", 404 segment at 120) | `pages/StatusPage.jsx`, `main.jsx:97-98` |
| SHELL-11 | 500 ("화면을 표시하지 못했습니다.", reload) | `main.jsx:68-87` |
| SHELL-12 | Toast: normal / error (`!` cell) / action word (undo) / multiple stacked / above admin dock / above page dock | `common/Toaster.jsx`, `components.css:166-179` |
| SHELL-13 | Confirmation dialog (SiteDialog): alert / confirm / danger confirm / prompt / password prompt | `common/SiteDialog.jsx:29-78` |
| SHELL-14 | Mobile sheet: open, dragging down, closed. 640 to 859 uses a 576 column | `common/Modal.jsx:114-156`, `components.css:230` |
| SHELL-15 | Desktop dialog: default width / `.wide` | `components.css:231-236` |
| SHELL-16 | Dropdown: desktop menu / mobile sheet / empty list ("항목 없음") / disabled item | `common/Dropdown.jsx` |
| SHELL-17 | PickerSheet: search, clear key, recent picks, group header, cursor, selected, disabled with reason, empty result | `common/PickerSheet.jsx:17-86` |
| SHELL-18 | Empty state (Empty), error message (ErrorNote + retry), Loader large / small | `common/Empty.jsx`, `ErrorNote.jsx`, `Loader.jsx` |
| SHELL-19 | Skip link (on keyboard focus) | `App.jsx:305`, `shell.css:9-14` |
| SHELL-20 | Interactive states: hover (70 blocks), focus-visible ring, `:active` press .976, disabled, `aria-busy` button | `tokens.css:175, 228-235` |

### Shared motion

| ID | Transition | Values | Location |
|---|---|---|---|
| MOT-01 | First-entry light-up: panels staggered by 38, segments by 62, 12 rise over 420 | EASE_OUT | `motion.js:39-68`, `App.jsx:106` |
| MOT-02 | Page navigation (leave dim, then new screen light) / back navigation | leave 260, light 420 | `motion.js:121`, `App.jsx:150,191` |
| MOT-03 | Sub-views inside a page (notice post, board post, bracket, registration form, wizard) enter and exit | Same | `NewsPage.jsx:117-158`, `BoardPage.jsx:242-443`, `BracketsPage.jsx:2627-3076` |
| MOT-04 | Tab underline slide + new content light-up | 420 | `motion.js:77-92,154`, `Board.jsx:14-37` |
| MOT-05 | List light-up after changing chips, type grid, or pager | light | `Board.jsx:35-38,302-327`, `Pager.jsx:9` |
| MOT-06 | Late image batch light-up (waits up to 1200) | tone | `Board.jsx:138-154` |
| MOT-07 | Disclosure expand: rows rise staggered by 38, chevron rotates | 420 | `tokens.css:243-246` |
| MOT-08 | Sheet open (spring) and close (260 ease-in), drag velocity handoff | | `Modal.jsx:72-156` |
| MOT-09 | Desktop dialog open (12 rise over 420) and close (12 drop over 160) | | `Modal.jsx:75,113` |
| MOT-10 | Popover and dropdown fade 160 | | `Menu.jsx:55-62`, `Dropdown.jsx:11` |
| MOT-11 | Toast enter (12, 420) / exit (260) | | `Toaster.jsx:14-18` |
| MOT-12 | Error message and form error y-rise | | `tokens.css:248` |
| MOT-13 | Theme switch: old background fades from .618 to 0 over 260 + sun/moon rotation | | `motion.js:131-150`, `tokens.css:261-265` |
| MOT-14 | Busy cell rotation 840 | | `shell.css:90-100` |
| MOT-15 | Segment value change tone pulse | 160 | `Seg.jsx:19` |
| MOT-16 | `prefers-reduced-motion` across the site (9 CSS places + JS `reduced()`) | | `tokens.css:230,250-259`, `motion.js:11` |

## 2. Home (no `?view`)

| ID | State | Location |
|---|---|---|
| HOME-01 | No upcoming tournament + past tournament exists (winner row, first row inverted) | `HomePage.jsx:222-231` |
| HOME-02 | Neither upcoming nor past tournament (unlit segment) | `:238,246` |
| HOME-03 | Countdown (D-day 120, two digits / 100+ days three digits), title 32, date, registration deadline, format | `:238-250` |
| HOME-04 | Registration open (amber lamp, "이번 대회 신청") | `:213,236-237` |
| HOME-05 | Tournament day (clock segment, empty slot when no time is set) | `:234-245` |
| HOME-06 | Party submission counter (days / hours with amber) | `:253-256` |
| HOME-07 | Five primary button labels | `:213,257-259` |
| HOME-08 | Logged in + linked player on tournament day: "내 다음 경기" (opponent TBD / starting soon / live), before and after check-in | `:260-279` |
| HOME-09 | Live matches block (live matches, progress row, spectate row) | `:280-292` |
| HOME-10 | Champion panel: unlit to lit, when generation is 0 | `:215`, `Board.jsx:171-191` |
| HOME-11 | Records load failure (ErrorNote) | `:297` |
| HOME-12 | Season standings: skeleton / 5 rows / sole leader inverted / no season (hidden) | `:300-303`, `StandTable.jsx` |
| HOME-13 | Notices: lead + 2 rows, new post lamp, pinned / 0 items (hidden) | `:305-312` |
| HOME-14 | Past champions wall: 2 champions / many champions | `:315-323` |
| HOME-15 | Champion sheet (current champion / hall of fame, with and without sets) | `common/ChampionSheet.jsx` |
| HOME-M | First-visit light-up, late section light-up, no light-up on revisit | `:108-119` |

## 3. About (`?view=about`)

| ID | State | Location |
|---|---|---|
| ABOUT-01 | Full static screen (lead, stage doors, season flow, 4 milestones, three tournaments, regular league) | `AboutPage.jsx:46-95` |

## 4. Notices (`?view=news`)

| ID | State | Location |
|---|---|---|
| NEWS-01 | List: upcoming tournament section, lead + rows, pager (8 per page) | `NewsPage.jsx:266-287` |
| NEWS-02 | Typing search query (N results) / no results (0 results + recent notices) | `:279-284` |
| NEWS-03 | 0 notices | `:285` |
| NEWS-04 | Missing post (loading, then "공지를 찾을 수 없습니다.") | `:169-172` |
| NEWS-05 | Post: header, counter ("까지 N일" / "오늘 진행 중"), applicant count N명 (unlit to lit), spec rows, side buttons, other notices, body | `:205-240` |
| NEWS-06 | Post primary button: "참가 신청" / "파티 제출" / "신청 마감" (disabled) | `:191,233` |
| NEWS-07 | Applicant list collapsed / expanded (rows / "아직 신청자가 없습니다.") | `:293-327` |
| NEWS-08 | Share link copies URL ("주소를 복사했습니다.") | `:221-228` |
| NEWS-09 | Registration form: empty (Google row logged out / logged in and approved / checking) | `:481-490` |
| NEWS-10 | Registration form: typing, similar name, matching name record + identity confirmation | `:491-515` |
| NEWS-11 | Registration form: five question types (short, long, single choice, multiple choice, dropdown) / 0 questions | `:517-529` |
| NEWS-12 | Registration form: validation errors (all required fields at once) | `:491-529` |
| NEWS-13 | Registration form: submitting / failure toast (retry) / confirmation (inverted panel) | `:451-454,474-476` |
| NEWS-14 | Edit registration: name + password step, error, loading | `:455-469` |
| NEWS-15 | Registration form side facts (date, deadline, rookie and master combined) | `:439-446` |
| ADM-NEWS-01 | Admin: write notice link, view responses N, edit | `:229-232,266` |
| ADM-NEWS-02 | Applicants sheet: counter, league split, search, CSV, chips, rows, empty state | `:565-589` |
| ADM-NEWS-03 | Password reset / delete registration / delete response confirmation dialog `[write]` | `:130-138,584` |

## 5. Board (`?view=board`)

| ID | State | Location |
|---|---|---|
| BOARD-01 | Free board list: loading / error / empty / empty search / rows (admin-only badge, N comments) / pager | `BoardPage.jsx:286-303` |
| BOARD-02 | Free board post: missing / body + YouTube, image, and link attachments / untitled | `:261-283` |
| BOARD-03 | Comments: one-level reply, edited badge, reply form open, posting with account name, error | `:175-219` |
| BOARD-04 | New post sheet: empty / filled / all errors / uploading and failed photo / private hint / draft passed from battle | `:64-98,238` |
| BOARD-05 | Edit post and edit comment sheet | `:149-172` |
| BOARD-06 | Report sheet (disabled before choosing a reason) | `:100-107` |
| BOARD-07 | Permissions: password prompt, wrong password, account post notice, passwordless post notice, admin delete confirm `[write]` | `:110-134` |
| BOARD-08 | Sample and party tab: single/double chips, loading, error, empty, cards (six / one) | `:501-519` |
| BOARD-09 | Sample and party post: six slots, open in team builder, save image, sets (loading / error), comments | `:465-498` |
| BOARD-10 | Pick team sheet (with teams / no teams) | `:342-355` |
| BOARD-11 | Write intro post sheet (format, body, pick sample, errors, disabled while data loads) | `:358-412` |

## 6. Records (`?view=records`)

| ID | State | Location |
|---|---|---|
| REC-01 | Header, official records load failure ErrorNote, loading | `RecordsPage.jsx:239-249` |
| REC-02 | Trainers tab: top 3 panels (first inverted), legend, rows (master/rookie, "나"), over 20 rows shows "전체 보기" | `:300-386` |
| REC-03 | Trainers tab: 3 sort chips, season dropdown, empty search, 0 records | `:300-386,325` |
| REC-04 | Find my record (`me=1`): logged out / checking / unlinked / approved / pending / rejected, "이름으로 시작" row | `:650-684` |
| REC-05 | Trainer sheet: counters, link lead (finder mode), "내 전적", season chips | `:493-502,390-407,612-627` |
| REC-06 | Trainer sheet: title board (shown after medals finish drawing), type and region lamps | `TitleFaces.jsx:66-116` |
| REC-07 | Trainer sheet: recent tournaments + pager 12 / empty, official battles N games, used parties 4 + all, frequent Pokemon / empty | `:45-65,510-555` |
| REC-08 | Trainer sheet: "내 기록 연결" section states, share link copies URL | `:629-643`, `ShareHere.jsx` |
| REC-09 | Tournaments tab: all chip + tour chips, season chapter header, round cards (standard / `포켓몬 챔피언스`), team rounds | `:773-909` |
| REC-10 | Tournaments tab: official parties collapsed to expanded (including unsubmitted parties), search N results / empty | `:831-852,869-888` |
| REC-11 | Pokemon tab: 24-card grid + "전체 보기", empty search, 0 items | `:917-952` |
| REC-12 | Pokemon sheet: rank 84, 4 counters, official matches, stat bars, builds (loading / error), 8 samples, trainer bars, teammates / empty, past champions | `:984-1098` |
| REC-13 | Party sheet: legacy party (six only) / detailed (loading / error / TeamSheet), narrow for sample and wide for party | `:121-139` |
| REC-14 | Rankings tab: season dropdown, sole leader 84, tied Nth place, over 12 rows, empty season, no rankings | `:1103-1183` |
| ADM-REC-01 | Trainers tab link requests block (approve, reject, unlink confirmation `[write]`) | `LinkRequests.jsx` |
| ADM-REC-02 | Trainer sheet admin tools: rename, merge preview, confirmation `[write]` | `:409-449` |
| ADM-REC-03 | Add season / add cumulative tab prompt `[write]`, edit round, edit rankings sheet | `:1118-1174,896` |

## 7. Brackets (`?view=bracket`)

| ID | State | Location |
|---|---|---|
| BRK-01 | Official list: loading / error / empty / lead + rows (live lamp, date) | `BracketsPage.jsx:3033-3048` |
| BRK-02 | Bracket header: back, title, tools (link, QR, winner and bracket images), live strip, mobile share | `:3049-3075` |
| BRK-03 | Results: inverted winner panel + placement rows (runner-up and top 4 / 3rd and 4th) | `:1885-1896` |
| BRK-04 | "내 경기로" button, party submission status collapsed / expanded / loading / error / empty | `:1472-1533,1897-1907` |
| BRK-05 | View tabs: bracket (tree) / list | `:1917-1926` |
| BRK-06 | Tree: single elimination 4, 8, 16, 32 players, 3rd-place match, double elimination (losers bracket, grand final, reset), champion slot unlit / lit, table TBD | `:1369-1462` |
| BRK-07 | Match card: winner inverted, loser dimmed, bye and waiting, seed, "나", score, forfeit, DQ, timeout, no-show, live lamp | `:963-991` |
| BRK-08 | List view: by round, win + score / live / before match | `:1317-1335` |
| BRK-09 | Match sheet: both side rows, start clock and table counter, all site battle states, best-of series, result report | `:995-1163` |
| BRK-10 | QR sheet | `:1307-1313` |
| BRK-11 | Group stage: group sections, standings rows, match panels, tiebreaker | `:1535-1575` |
| BRK-12 | Draw animation: name roll (70ms), locked in, skip | `:2461-2515`, `bracket.css:41-54` |
| BRK-13 | Private tab: info row, search, loading / error / empty / empty search, lead | `:2719-2734` |
| BRK-14 | Private bracket: missing / open (result entry locked / unlocked), winner panel | `:2681-2716` |
| BRK-15 | New private bracket sheet (empty, all errors, N participants, creating) / edit sheet | `:2537-2602` |
| BRK-16 | Private password prompt, wrong password, redraw and delete confirmation `[write]` | `:2652-2678` |
| ADM-BRK-01 | New bracket / create first bracket, record sync status tag | `:3031-3044` |
| ADM-BRK-02 | Bracket wizard 3 steps (tournament setup, confirm participants, place bracket), loading / empty / error `[write]` | `:270,632-872` |
| ADM-BRK-03 | Read-only notice, sync-to-records dock, synced, retry, cancel sync `[write]` | `:1866-1894` |
| ADM-BRK-04 | Result entry: score stepper, change result, undo winner, swap slots, password reset confirmation `[write]` | `:1207-1281,1610,1798,1859` |
| ADM-BRK-05 | Bye, void battle, re-enter `[write]`, team match sheet, match schedule sheet | `:918,1010-1071,1186` |
| ADM-BRK-06 | Groups: tiebreaker draw, reset, finals draw and cancel `[write]` | `:1560-1570` |
| ADM-BRK-07 | Qualifier status `[write]` | `ChampionsBracketControls.jsx:62-80` |
| ADM-BRK-08 | Sync-to-records sheet, pre-sync confirmation, title awarded / re-check loading `[write]` | `:2177-2270` |
| ADM-BRK-09 | Delete bracket: name input prompt, mismatch alert, cancel sync first alert `[write]` | `:2971-2981` |

## 8. Team builder (`?view=builder`)

| ID | State | Location |
|---|---|---|
| BLD-01 | Mobile 3 step tabs ("규정" / "포켓몬 선택" / "팀 구성") | `TeamBuilderPage.jsx:1445-1447` |
| BLD-02 | Rules: desktop dropdown / mobile OptionRows / monotype grid / locked to tournament rules | `:1450-1475` |
| BLD-03 | Official submission panel (`eventId`): steps 1 to 3, applicant check (busy / success / errors), password, submitting, submitted, submission history | `:308-425,792-840` |
| BLD-04 | Candidate list: 4 data status rows, search suggestion dropdown, chips, type grid, sort | `:1519-1564` |
| BLD-05 | Candidate list: monotype unselected / loading / failed / empty search / all 359 rows | `:1574-1582` |
| BLD-06 | Candidate row: add / already on team / replace | `:158-182` |
| BLD-07 | Team panel: new team / name, unsaved changes, autosave status, slots (empty / filled / active inverted / unverified), N/6 | `:186-204,1589` |
| BLD-08 | Editor: empty ("세팅할 포켓몬을 선택해 주세요."), ability, item (locked Mega item), nature, stat points over 66, 4 move slots / failed | `:1610-1694` |
| BLD-09 | Dock: save current team / save changes / saved, post to board | `:1696-1701` |
| BLD-10 | Rule check: incomplete / violations (8 + N more) / passed | `:267-303` |
| BLD-11 | Type chart: mobile defense/offense toggle, desktop shows both | `:210-265` |
| BLD-12 | Item and move picker sheet, rule change confirm, save before switching team, text import and export | `:1719-1758` |
| BLD-13 | My teams sheet: empty / multiple / open team inverted, save messages, upload to account | `:1760-1801` |
| BLD-14 | Toast "뺐습니다 / 되돌리기", delete and reset team confirmation, load failure alert | `:947,1140-1249` |
| BLD-M | Step switch places rows staggered by 38, added Pokemon rises into slot | `:488-493`, `board.css:341` |

## 9. Titles (`?view=titles`)

| ID | State | Location |
|---|---|---|
| TTL-01 | 6 tabs ("챔피언", "타입", "지방", "파트너", "기타 칭호", etc.) | `TitlesPage.jsx:82-87,121` |
| TTL-02 | Condition panel + medal board (lit / unlit / xN / current champion), rectangle padded with empty panels | `TitleFaces.jsx:66-85` |
| TTL-03 | "그 밖" board | `:128` |
| TTL-04 | Title sheet: with holders (N호 rows) / no holders (unlit medal + empty) | `:60-78` |
| ADM-TTL-01 | Add and edit title sheet (holder chips, shape picker, preview, missing color alert), delete confirm `[write]` | `AdminEditors.jsx:75-139` |

## 10. Hall of fame (`?view=champions`)

| ID | State | Location |
|---|---|---|
| CHAMP-01 | Error / loading / empty | `ChampionsPage.jsx:88-89` |
| CHAMP-02 | Crown panel (generation 84 / generation 0 text), six Pokemon, view records and party | `:90-104` |
| CHAMP-03 | Past champions wall (2 or more) | `:108-121` |
| CHAMP-04 | Champion sheet (`gen=`) | `:123-126` |
| ADM-CHAMP-01 | Add and edit past champion sheet (6 slots, no image), empty name alert, delete confirm `[write]` | `AdminEditors.jsx:53` |

## 11. Calculator (`?view=calc`)

| ID | State | Location |
|---|---|---|
| CALC-01 | Loading / data failure | `CalculatorPage.jsx:688-697` |
| CALC-02 | Damage: both empty / one side / both sides, speed line, swap sides | `:334-352` |
| CALC-03 | Result board: % range, HP bar, KO, expand rolls, status move / non-calculable row | `:128-208` |
| CALC-04 | Battle conditions (single and double, weather, terrain, toggles), detailed settings (mine / opponent, stepper, over 66) | `:210-317,365-377` |
| CALC-05 | Speed: no reference / with reference (segment, scroll to my position), roughly 350 rows | `:382-463` |
| CALC-06 | Pokedex: empty / Pokemon (base stats, defensive matchups, move table + filter, empty result) | `:465-574` |
| CALC-07 | Pokemon, move, and item picker sheet ("내 팀" group, recent) | `:183-185,298,700-703` |

## 12. More (`?view=more`), alerts (`?view=alerts`), privacy (`?view=privacy`)

| ID | State | Location |
|---|---|---|
| MORE-01 | My account: hidden / logged out / logged in (linked inverted, checking, rejected, unlinked), sub-rows | `MorePage.jsx:39-72` |
| MORE-02 | Account buttons: logout, unlink and delete account confirmation `[write]`, failure | `AccountKeys.jsx` |
| MORE-03 | Group rows (new alert lamp), 4 theme choices, admin login and logout rows | `:80-104` |
| ALERT-01 | Push unsupported / iOS install required / available / permission denied | `PushControl.jsx:12-64` |
| ALERT-02 | Received alerts: loading / hidden (before SQL) / empty / rows by date (unread bright, read dim) | `AlertsPage.jsx:28-57` |
| ALERT-03 | This-device notification switch, alert category cells (on inverted), personal alert notice | `PushControl.jsx:76-96` |
| ALERT-04 | Enable notifications sheet (install / blocked / failure guide) | `:50-62` |
| PRIV-01 | 11 articles + article table of contents | `PrivacyPage.jsx:77-94` |

## 13. Admin (`?view=admin` and shared chrome)

| ID | State | Location |
|---|---|---|
| ADM-01 | Admin login sheet: empty / 2 error types / logging in | `AdminEditors.jsx:26-39`, `storage.js:59-62` |
| ADM-02 | Login success toast, unsynced past tournament toast, session expired toast | `AdminModalHost.jsx:30`, `App.jsx:194,209-215` |
| ADM-03 | Admin dock (admin / N link requests / hidden on admin screen), toast and page margin offset | `AdminModeBar.jsx`, `shell.css:80,106-115` |
| ADM-04 | Admin page: login required / loading / status load failure | `AdminPage.jsx:163-184` |
| ADM-05 | 4 counters (lamp on and off), to-do list / empty, tower title row `[write]` | `:175-193` |
| ADM-06 | Edit doors, points sheet `[write]` | `:26-33,66-87` |
| ADM-07 | Recent changes (show more), client errors, reports (clear `[write]`), 5 export rows (downloading) | `ChangeLog.jsx`, `ClientErrors.jsx`, `CommunityReports.jsx`, `AdminPage.jsx:36-62` |
| ADM-08 | Tournament progress side column: steps 1 to 4, close now `[write]`, cancel tournament confirm `[write]` / no active tournament | `:95-121,147-162,209` |
| ADM-09 | Notice write and edit sheet: registration enabled, import from past tournament, tournament link slot, `포켓몬 챔피언스` variant, question card, collapsed link attachment, schedule, pin, and edit alerts, missing time alert, delete `[write]` | `AdminEditors.jsx:205-317`, `AdminModalHost.jsx:171` |
| ADM-10 | Edit rankings / edit scores / edit rounds sheet `[write]` | `AdminEditors.jsx:326-377` |
| ADM-11 | Edit sheet lazy loading / failure | `LazyContent.jsx:117-126` |

## 14. Battle (`?view=battle`)

Battle follows separate screen rules (DESIGN.md "Battle": game screen, excluded from designLaw tests, shares only color and tone). Sheets, dialogs, toasts, and `streak.css` follow standard site rules.

| ID | State | Location |
|---|---|---|
| BTL-01 | 5 tabs: "배틀 열기" / "도전의 탑" / "방 목록" N / "중계" N / "기록" | `BattlePage.jsx:551-573` |
| BTL-02 | Lobby: desktop side column / mobile "상대" and "파티" sheets, rule and party picker (saved teams / none), random party | `:211-290` |
| BTL-03 | Opponent sheet: CPU (difficulty) / create room (public and private, single and double), empty name error, create error, busy | `:595-646` |
| BTL-04 | Resume CPU battle row, start-new confirmation | `:598,630` |
| BTL-05 | Room list: counters, search, filter chips, loading / error / empty / empty filter, private room lock, 30-item pager | `:498-541` |
| BTL-06 | Join (opponent side): 4-digit room code, error, join | `:937-981` |
| BTL-07 | Waiting for opponent: 84 room code counter, wait timer, share link, cancel wait confirmation | `:814-850,777` |
| BTL-08 | Missing battle / disconnected / setup failure / 3-conflict error | `:137-175,771-772` |
| BTL-09 | Official match seat: loading / missing / already decided / pick player / password / wrong password / spectate | `:876-935` |
| BTL-10 | Team preview: opponent six, pokeball court, order cells, cards, `i` button, gatekeeper inverted, stakes strip | `Sets.jsx:146-199` |
| BTL-11 | Team preview dock: pick N more, confirm lineup, locked and busy (bottom under 1200 / side at 1200+) | `:1644-1646,1742,1762` |
| BTL-12 | Move selection: 4 buttons (type color, effectiveness chip, power, PP, damage gauge), off, long-press tip toast, expanded card | `:1863-2003,1493-1516,1749` |
| BTL-13 | Locked buttons (turn running / opponent choosing), forced switch, revive, switch bench (fainted) | `:1752-1753,1907-1957,2090-2159` |
| BTL-14 | Doubles target selection, restart turn choice, Mega button (on / off / absent) | `:2074-2123` |
| BTL-15 | Timer: normal / 30s or less / 10s or less / paused / my turn | `Stage.jsx:646-655`, `battle.css:560-566` |
| BTL-16 | Stage HUD: plates, field chips, message box, ability and item popups, Pokemon info sheet | `Stage.jsx:414-415,659-713,823-840` |
| BTL-17 | Side column (desktop): header, party chips, menu, other live streams, full log | `:1758-1773,1014-1020` |
| BTL-18 | Menu (mobile sheet): animation speed, sound sheet, perspective, share links, forfeit confirm, leave confirm | `:1322-1323,1622,1664-1683,995-1012` |
| BTL-19 | My party / opponent party / help sheet | `:1776-1783` |
| BTL-20 | Fullscreen (controls hide after 2600ms) | `:1226-1257`, `battle.css:1007-1021` |
| BTL-21 | Result strip: win (inverted) / loss / draw / void / spectator "X 승리", 4 subtitle lines | `Stage.jsx:631-637`, `:1614-1660` |
| BTL-22 | 5 official sync lines, rematch / accept / bracket / leave, rematch offer lamp | `:1274-1279,1729-1739` |
| BTL-23 | Replay bar: start, prev, play, next, end, KO and Mega markers, unmute, fullscreen (end button hidden at 600 and below) | `Replay.jsx:29-62`, `battle.css:280` |
| BTL-24 | Live stream: real-time button (live / behind), mobile log strip, tower next-match wait | `:1159-1163,1585-1718` |
| BTL-25 | Live list: counters, filters, official lead card, loading / empty / empty filter / error | `Live.jsx:84-127` |
| BTL-26 | History list: loading / error / empty (account / device), rows by result, select mode, delete confirm | `Replay.jsx:121-184` |
| BTL-27 | 3 CPU battle errors, CPU replay error | `:414-466` |
| BTL-28 | Climb cups: list (loading / error / empty / hidden), open sheet (2 errors), code entry, cup board (pre-start / active / closed, close-now confirm) | `Cups.jsx:45-207` |
| TWR-01 | `도전의 탑` tab: tower scene / draft board, doors, buttons, side column (run log, monthly rankings, my runs) | `Streak.jsx:374-589` |
| TWR-02 | Button states: checking account / logged out or unapproved / drafting / in progress / other | `:490-495` |
| TWR-03 | Gate sheet: Google login / checking name / set trainer name, restart run confirm | `:463,501-508` |
| TWR-04 | Monthly rankings: skeleton / error / empty, switch to last month | `:553-557` |
| TWR-05 | Draft: 6-slot strip (empty / filled / current / upcoming), 3 candidate card flips, Mega badge | `:158-244` |
| TWR-06 | Three doors: normal / strong / gatekeeper | `:254-277` |
| TWR-07 | Break screen: result beat (84 count-up), swap beat, door beat, buttons | `:682-818` |
| TWR-08 | Defeat and run end: counters, monthly rankings, climbed tower floors, retry | `:774-813` |
| BTL-M | Lobby to battle dim (1100), team preview lineup arrival, board changeover, opening lamp (680), lead throw (260 stagger), faint, end strip, all tower scenes (entry 1780, arrival, steps, floor climb, dive, elevator) | `stageFx.js:788-856`, `changeover.js:15-69`, `tower.js:33-575`, `docs/BATTLE_TRANSITIONS.md` |

## 15. Data extremes (simulated via route interception)

| ID | Case | Screens to check |
|---|---|---|
| EXT-01 | Very long trainer names (16 Korean characters, 24 Latin characters, no spaces) | Top bar account button, record rows and sheet, bracket match cards and tree, home champion, battle plates, room list |
| EXT-02 | Very long notice and board titles, long tournament names | Notice lead and rows, home countdown title, bracket header, LiveStrip |
| EXT-03 | 0 items | Empty states across each screen above |
| EXT-04 | High volume: 100 notices, 200 board posts, 150 trainers, 64-player bracket, 20 champions, 60 rooms | Pagers, show-all controls, tree horizontal width, champion wall |
| EXT-05 | Mixed digit counts (1st and 100th, 9th and 120th, 10:9 score) | Standings tables, counters, segments |

## Capture gaps (states not directly launchable from this repo alone)

1. Real-time two-player states (BTL-06, opponent join in BTL-07, rematch offer in BTL-22, live stream in BTL-24) need two browsers and a backend. Creating a real room on production generates live data, so these must either be mocked by intercepting Supabase responses or tested in a single friendly room with user approval.
2. `도전의 탑` draft, break, and defeat states (TWR-05 to TWR-08) rely on a PGlite server (`:54321`) mentioned in docs that is not in this repository. They are reproduced by seeding localStorage `ypl-battle:streak*` and intercepting function responses.
3. Post-write admin screens (synced state, title awarded, etc.) are never clicked on production and are captured by running them on `ypl-dev-offline`.
4. Google account states (approved, pending, rejected) cannot all appear under a single real login session. The remaining states are simulated by intercepting account responses.
