# 등반전 implementation plan

> For agentic workers: use the required sub-skill `superpowers:executing-plans`. Steps use checkbox (`- [ ]`) syntax.

Goal: build timed, participant-scoped 도전의 탑 rankings (등반전) with a dedicated scoreboard and notifications for new 1st-place records.

Architecture: three tables and five RPCs that count standard runs (`streak_runs`) via trigger, leaving battle functions unchanged. The UI adds a list and creation sheet in the 도전의 탑 side column, plus an `&cup=` scoreboard view.

Tech stack: Postgres (Supabase), PGlite verification script, React 18.

Spec: `docs/BATTLE_STREAK.md` section 18, `DESIGN.md` "Battle" 등반전.

## Global constraints

- Copy uses polite formal style (합니다체) and noun labels, with no exclamation marks, middle dots, or em dashes, and no explanatory sentences ("Composing a screen" 22).
- Use only design tokens and Board components. Pass `tests/designLaw.test.mjs`.
- Fail closed: reject unapproved accounts, wrong codes, and ended 등반전 events.

## Review focus

- A win after the deadline must not change the rankings (verify in Task 1).
- A run started before joining must not count (Task 1).
- A run past the attempt limit must not count (Task 1).
- Tying the same streak must send the notification only once (Task 1).
- The site must not break before the SQL migration runs; hide 등반전 when `PGRST202` returns null (Task 2).

### Task 1 (SQL and verification)

Files: create `docs/db/tower_cups.sql` and `scripts/verify-tower-cups-db.mjs`.

- [ ] Write the verification script covering creation (approved accounts only, one active per user), public join, code join (reject wrong code), runs within the time window only, attempt cap, locking after deadline, tie-breaker order, single notification, immediate close, anonymous read blocked, and idempotent re-runs.
- [ ] Write the SQL until the verification script passes.

### Task 2 (service layer)

Files: modify `src/services/visitorAuth.js` to add `readTowerCups()`, `readTowerCup(id)`, `createTowerCup({title, startsAt, endsAt, room, limit})`, `joinTowerCup(id, code)`, and `closeTowerCup(id)`.

### Task 3 (UI)

Files: create `src/pages/battle/Cups.jsx`; modify `src/pages/battle/Streak.jsx`, `src/pages/BattlePage.jsx` (`cup` route), `src/styles/streak.css`, and `DESIGN.md`.

- [ ] Tab side column: 등반전 list (rows with live lamp), plus creation button and sheet.
- [ ] Scoreboard (`&cup=`): title at 32px, time remaining, rankings (`StandTable`), join and challenge buttons, entry code, and an immediate close button for the host. Poll every 15 seconds.
- [ ] Verify at 390 and 1440 in both themes.

### Task 4 (wrap-up)

- [ ] Run `npm test` and `npm run build` with no warnings, then commit.
