# Battle transitions

This document logs how scenes change in battle and 도전의 탑 based on recorded frames. User feedback (2026-11-18): "내가 말한 버벅임은 지금 측정 중인 프레임만이 아니라, 화면 전환이 급작스럽거나 일관성 없이 물 흐르듯 자연스럽지 않은 것도 뜻해." Frame drops are tracked in `docs/BATTLE_FRAMES.md`; this file covers visual flow.

## 1. Inspection method

- Record with `node scripts/record-transition.cjs`, or a script that clicks through one full flow (start battle, pick three Pokémon, confirm team preview, pick one move) on production builds at mobile (390 px, 4x CPU throttle) and desktop (1440 px).
- Review contact sheets laid out every 250 to 500 ms.
- Gaps between recorded frames do not prove a freeze: the compositor emits no new frame when nothing changes (a 350 ms gap after clicking a team-preview card had only 10 ms of JS in the CPU profile). Measure freezes with `measure-frames`.

## 2. Findings (2026-11-18)

Recorded from one computer battle and one finished replay.

| # | Transition | Current behavior | Problem | Plan phase |
|---|---|---|---|---|
| T1 | Switching between 배틀 열기 and 도전의 탑 tabs | The lobby stage cuts out and the tower fades in from black (0.7 s). Returning to the lobby makes 폴리곤Z emerge from light every time. Buttons (컴퓨터, 배틀 시작) flash disabled gray before turning on. On desktop, the right column mounts empty segment boxes before filling in | Switching tabs replays full intro animations from scratch and flashes unready states (gray controls, empty boxes) | 3 |
| T2 | Battle start to team preview | 폴리곤Z returns and stage lights cut out (1.5 s). On mobile, the screen turns blank navy with a loader while the header and tab bar vanish, then preview cards build one by one. On desktop, the stage vanishes and becomes a separate card-grid page | The darkened stage is not the home of the next scene; three unrelated screens (stage, blank loader, card page) are stitched together | 3, 7 |
| T3 | Confirming team preview into battle | Scoreboard tiles flip over (0.9 s). On desktop, only the left side flips while the right column snaps to new content | Uses a motion language unrelated to the rest of the site (tab fades, stage lights, rising sheets) | 3, 6 |
| T4 | Battle opening | While the stage sits black for 0.6 s, all four move buttons already stand lit up. The header number (`00`) turns on separately | Controls look clickable before input is allowed, and elements appear backwards (should be stage, Pokémon, HUD plates, then controls) | 3, 6 |
| T5 | Ability and item reveals | `특성 통찰` and `도구 하양허브` float separately below the opponent's HP plate and blink in and out | Reads like a tacked-on badge rather than part of the HUD plate (same issue as the user's "난수 1타" critique) | 4 |
| T6 | Every turn | `"기술을 길게 누르면 설명을 볼 수 있습니다."` reappears every turn and covers the player's party strip for over 3 seconds | A one-time hint blocks the same region every turn | 4 |
| T7 | While a turn plays out | Move buttons stay bright | Cannot tell whether buttons are currently active | 4 |
| T8 | Opening a replay by link | Blank screen with loader for 3 seconds, then the whole battle view snaps in at once. The stage stays black for 2.5 s, the header title (성기성 대 컴퓨터) swaps into numbers that light up separately, and end-of-match UI (`다음 판을 기다리는 중…`, `나가기`) shows during the opening | The frame does not mount empty first, and end-state copy leaks into the opening | 3, 6 |
| T9 | End of live spectating | Spectator layout switched into player layout | Fixed 2026-11-18 (`358f22b`, before `0112a86`) | Done |

In-run 도전의 탑 flows (draft start, between-match to next match, floor transitions) needed server and DB state and were omitted from this first pass. They are recorded using the PGlite harness during phases 8 and 9.

## 3. Transition rules

Rules applied from phase 3 onward:

1. The stage is the screen. Scene changes on the battle page (lobby, team preview, opening, active match, finish, between-match, tower entry) happen on the stage without blank pages, page swaps, or off-stage tile flips. Once mounted, the stage keeps its position and dimensions.
2. Show only ready content. Never flash disabled gray controls, empty segment boxes, or incrementally built lists. Hold the current scene until the next one is ready, then swap cleanly.
3. Follow reading order: stage, Pokémon, plates, copy, then controls. Unavailable buttons stay dimmed and brighten when input opens.
4. Use one motion timing set (`DESIGN.md` "Battle" Time tokens) for entries, exits, and moves. Do not replay full intro choreography on a tab switch when returning to a scene already viewed.
5. Show one-time hints once, persist them on the device, and place them where they cover nothing.

## 4. Fixes (2026-11-18)

First batch for phases 3 and 4:

| # | Fix | Verification |
|---|---|---|
| T1 | Lobby Pokémon now emerges from light whenever the stage mounts (removed `courtShown`, which only played once per visit, after owner feedback "포켓몬이 등장하는 애니메이션이 없어"). The tower hall no longer redraws on state changes; the camera walks to the door instead (`tower.js standTower`). The gray button flash on tab switch turned out to be mid-fade opacity rather than disabled state, so it was left alone | Flow recording |
| T2 | Added an unlit stage battle frame (`BattlePage.jsx MatchWait`) while loading a match instead of the global site loader, keeping continuity from the darkened lobby stage | Mobile flow recording |
| T3 | Kept as-is because the user explicitly chose this transition on 2026-11-10. Will ask via mockups in the next phase whether to unify the full entry path | |
| T4, T7 | Locked buttons (opening and mid-turn) now dim to `.382` opacity. This rule had been dropped on Nov 16 when disabled styling switched to dimming text only | Flow recording: dim during opening and turn playback, bright on input turn |
| T5 | Kept as-is for now (ability and item plates attach to their owner's HP plate). Will review together with phase 4 plate layout mockups | |
| T6 | Long-press hint now shows only on the first move-selection turn. Also fixed team preview being counted as a selection turn, which had hidden the hint before turn 1 | Control screenshot on turn 1 |
| T8 | During replay playback from the start, end-state copy (`다음 판을 기다리는 중…`) and buttons stay hidden until the result appears, while reserving space invisibly so the mobile deck does not grow by one line and shift the stage up 52 px at the end. Direct replay links also wait inside the match frame instead of the site loader | Stage rect matches at mid-match, end, and rewind on both 390 and 1440 |

Shipped alongside these fixes: the damage helper became a textless bar along the bottom of move buttons (mockup A), and HUD stat changes now show stages (`방어 ▲1`) instead of multipliers.

## 5. Almanac motion (2026-11-24)

When the site switched to YPL League Almanac, battle transitions were rewritten using Almanac motion verbs (enter 420 ms, exit 260 ms, tone 160 ms, rule draw) based on recorded frames. Contact sheets are in scratchpad folders `motion-battle` (before) and `motion-battle-after` (after).

| Scene | New behavior |
|---|---|
| Start battle, rematch | Stage Pokémon return to their balls while the arena dims toward the page background via canvas opacity (no black or navy overlay). Everything else exits in 260 ms while the pressed button shows a busy line. Mobile top and bottom bars exit over the same 260 ms. The dimmed arena and match header remain until the next view mounts, leaving no blank frames. On rematch, the turn counter exits and header copy (`종료` to `선출 중`) transitions by tone. Computer battles open team preview on frame 1 using pre-fetched state |
| Team preview to battle (`changeover.js`, shared across 도전의 탑 matches) | Preview rows exit top to bottom in 38 ms steps over 260 ms (text and sprites first, rules after), along with the confirm button. The stage holds its box; once the battle frame mounts, a 2 px bright rule draws from the start edge across the top of the stage (420 ms) and both strips rise 12 px. The arena brightens from the background in one 420 ms pass (audio and ball throws unchanged) and the rule exits. Newly mounted pieces (side party, bottom controls) arrive in reading order, with locked buttons already dimmed to `.382`. Removed the tile grid |
| Opening | The header turn shows a dim dash before turn 1, then swaps to the turn number in place with a single brighten |
| Ability and item plates | Even when the owner's plate is absent, they rise 12 px on their own side instead of sliding in from off-stage, and exit by opacity only |
| Match end | One beat: a 2 px rule draws from the start edge beneath the winner's strip (420 ms), copy rises 12 px, the loser's side dims by tone, and the result band rises 12 px on the same beat (removed the end-line message delay that previously separated them by ~1.1 s) |
| Selections | The 2 px rule on saved teams, team-preview cards, the Mega button, and 도전의 탑 gatekeeper slots now draws from the start edge over 160 ms instead of snapping in one frame. Selected teams no longer invert colors |
| Lobby | Removed the pulsing floor ring. Waiting for an opponent is indicated by the strip's amber mark and text |
| HP bar | Depletes over a `--rule` track instead of raw background |
| 도전의 탑 tab | In dark theme, the tower container mounts with the page's navy background before frame 1 (no black flash) |

Remaining notes: the lilac tint seen on `다시하기` in dark theme was simply pointer hover (`--btn-bg-hover: var(--dim)`); moving the pointer off leaves it white (verified in recording). Real-device mobile runs and between-match 도전의 탑 flows (PGlite harness) were not recorded in this pass.

## 6. Between-match and run-end transitions in 도전의 탑 (2026-11-24)

User feedback: "다음 배틀을 할 때 굳이굳이 끝난 배틀 창으로 돌아와서 몬스터볼로 돌아오게 하는 연출이 부자연스럽던데" and "연승이 끝나서 로비로 나갈 때도 중간중간 화면이 부자연스럽더라고". Recorded between-match transitions for the first time at 390 px using the PGlite harness (real SQL and battle function, opponent HP 1).

| Scene | Before | After |
|---|---|---|
| Next match, continue | The tower on the door screen disappeared at 250 ms, the finished arena reappeared so Pokémon returned to their balls, the walk into the tower door played invisibly inside the exiting panel, and a headerless blank frame appeared at 2235 ms | When `.streak-break` already shows the tower, `goingIn` keeps that view mounted and skips mounting the arena. The door lights up orange on the live tower, the camera walks through it, and team preview fades in out of that darkness |
| Exit, retry (run end) | The battle view vanished in one frame, the tower rendered at battle width (390 px) before page margins returned (350 px), and the entrance camera computed from the initial width jumped to the new width at 1385 ms | The view exits over 260 ms before the tab appears (`leaveNow`, matching the header back button). Tower entrance and approach recalculate camera bounds against the current box every frame |

Remaining note: after walking into the tower door, about 500 ms of darkness (background with header only) sits before team preview fades in. Desktop 1440 px and real phones were not recorded in this pass.
