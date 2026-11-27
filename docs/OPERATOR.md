# Tournament operations guide

This guide walks through running a single tournament from start to finish in screen order. No coding knowledge is required. Every operator action begins on the `운영` screen (`?view=admin`) after signing in from the admin login row on the `더보기` screen.

Features added on 2026-11-22 (`턴 시간`, `게시 예약`, `체크인`, `자리 교체`, `기권` and `실격`, `선출`, result reporting, clock controls, `칭호 다시 판정`, renaming, `화면 오류`, and `신고`) appear only after `docs/db/handover_features.sql` is run in production (see `docs/db/README.md`).

The `운영` screen displays counters for pending tasks, registrations, remaining matches, and account link requests, along with four stages per tournament (registration, bracket, matches, records). Each tournament's action button jumps straight to the next required step.

## 1. Announcements and registration forms

1. Open `운영`, go to editing, and click `공지 쓰기`.
2. Enter the title and body. Attach a registration form to fill in the tournament settings: competition type, intake division (`마스터`, `루키`, or combined), entry unit (individual or team), battle format, match mode (in-game, site battle, or random battle), regulation, tournament date and start time, registration deadline, and title rewards.
3. If the setup matches a past event, use `지난 대회에서 불러오기` to copy its settings.
4. For site battles, pick a `턴 시간` (60, 90, 120, or 180 seconds).
5. To draft an announcement ahead of time, set a time in `게시 예약`. Visitors will not see it until that time, when the notification goes out automatically. To notify visitors about an edited notice, turn on `수정 알림 보내기` before saving.
6. Saving creates the tournament and sends a new-notice alert to subscribed devices. Combined intake creates `마스터` and `루키` events together, and Champions creates the qualifier and final together.

## 2. Registration

- Registrations sort into `마스터` and `루키` automatically, and the server blocks duplicates and late submissions. A reminder notification goes out one day before the deadline.
- View registration counts on the `공지` screen and export responses as CSV if needed.
- To close registration early, click `지금 마감` on the `운영` screen. If clicked by mistake, use the undo button on the toast banner.
- When a player signs in with Google and submits an ownership claim ("이 기록이 내 것"), approve or reject it under `연결 요청` at the top of the `운영` screen.

## 3. Team submission

- Players submit official parties in the team builder using their name and a submission password. Resubmitting adds a new revision without deleting earlier submissions.
- Check submission status on the `대진표` screen. Late submissions after the deadline are still accepted, with the count displayed.
- If a player forgets their submission password, click `비밀번호 초기화` in the submission status view. Their existing team stays intact, and they set a new password on their next submission.

## 4. Bracket creation

1. Open the tournament on the `운영` screen and click `대진표 만들기`.
2. Pick the format (single elimination, double elimination, or group stage into knockout for individual events).
3. Check off participating players. Unchecking a player marks them as `불참`. Add unregistered walk-ins by name. If players checked in from the home screen on event day, click `체크인한 N명` to select only checked-in players.
4. For a Champions Qualifier, select direct-entry players (the top 4 in season rankings are recommended automatically).
5. For team events, enter team names and rosters. `팀 나누기` splits registrants evenly by current season ranking points and fills the slots (clicking again generates a different split).
6. Click `다시 추첨` to reshuffle seeds, or click two slots in sequence to swap them.
7. Confirming the bracket generates the opening matches and sends a bracket-published alert.

Participant count cannot be changed after creating a bracket. For an individual event, you can replace a player in a slot with no recorded results by clicking `OO 자리 교체` in result entry. Brackets whose results have been applied to records cannot be deleted.

## 5. Match play

- Click a match to open the match sheet, then click the winner to generate the next match. Use the toast undo button if you clicked the wrong player.
- If you change a winner after downstream matches have already been played, the dialog tells you how many downstream results will be cleared before confirming.
- Individual events (elimination, group stage, and group-to-knockout) accept game scores (0 to 9) and `불참`. Team events accept `불참`. For mid-tournament drops, click `기권 처리`; for rule violations, click `실격 처리`. Both record the match as `불참` and attach the reason to the entry.
- For in-game matches, record the winner first, then click each player's team slot to record `선출` (brought Pokémon).
- Players can self-report results in the match sheet. When both players report the same winner, single elimination records it automatically, while double elimination and group stages show `보고대로 OO 승리` in result entry. Conflicting reports trigger an indicator for operators to resolve.
- Entering round start times and table numbers displays them on the participant view.
- In site-battle tournaments, players launch matches from the match sheet and winners record automatically when a battle ends. If auto-recording fails, the sheet shows the reason and provides `다시 넣기`. For broken matches, use `배틀 무효` to void the battle, then enter the winner manually or replay.
- During a live site battle, use `시계 멈춤`, `시계 다시`, and `1분 연장` to manage the turn clock. If only one player joins and waits, `OO 부전승` closes the battle and records a win with the opponent marked `불참`.
- On the `대진표` screen, the `목록` tab lists matches by round and `QR` displays a QR code for the venue screen.
- In team matches, record each bout's winner and add an ace match if tied.

## 6. Recording results

1. Once all matches finish, the tournament card on the `운영` screen points to `기록에 반영`.
2. Verify the champion, runner-up, semifinalists, and points in the preview, then click `이대로 반영`.
3. A single step records placements, ranking points, locked public final teams, tournament completion, and Hall of Fame entry for Champions events. A results notification goes out within a day.
4. Title candidates appear next. Check the valid ones and click `칭호에 반영`.
5. If something was recorded incorrectly, click `반영 취소` on the `대진표` screen. Everything reverts together, including titles granted by that event. Fix the mistake and apply again.
6. After adding a new title or editing title criteria, `칭호 다시 판정` surfaces only unclaimed titles.
7. Placements below 5th (quarterfinals, round of 16, tied Nth) are recorded as placements without points. Adjust point payouts per placement under `운영`, editing, `포인트` (applies to future events).

Champions Qualifiers use a separate `선발전 기록 반영` action.

## 7. Post-tournament tasks

- Download winner graphics and bracket images from the `대진표` screen.
- All records back up automatically every Sunday (see RUNBOOK "Backups"). For spreadsheet copies, use `내보내기` on the `운영` screen (full JSON, plus CSVs for results, matches, rankings, and rosters).
- Check `화면 오류` on the `운영` screen for client errors reported from visitor browsers (click any row to inspect the full message, stack trace, and browser info), and `신고` for flagged board posts.
- To update the Discord invite URL, the club timeline on the `소개` screen, the privacy policy effective date, or the founded year without editing code, open `운영`, editing, `사이트 설정`.
- If one person appears under two names or needs a name change, open their trainer sheet, scroll to `운영` at the bottom, and use rename or merge (merging cannot be undone).

## Frequently asked questions

| Situation | Action |
|---|---|
| Player forgot submission password | Section 3, `비밀번호 초기화` |
| Closed registration by mistake | Click undo on the toast right away. If it disappeared, edit the notice and set a new deadline |
| Entered the wrong match winner | Open the match sheet and click the correct winner |
| Found an error after applying records | Click `반영 취소`, fix the result, and apply again |
| Site battle froze | Click `시계 멈춤`, or use `배틀 무효` and either replay or enter the winner manually |
| No-show after bracket creation | Use `자리 교체` in result entry, or mark `불참` if no replacement is available |
| Site will not load or saves fail | See `RUNBOOK.md` |
