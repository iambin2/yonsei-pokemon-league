# Notifications (Web Push)

On 2026-11-18, Web Push notifications were split from a single notice channel into separate kinds. Each device (subscription) toggles kinds individually, and personal alerts go only to devices linked to a Google account. The database definitions live in `docs/db/announcement_push.sql`, `docs/db/application_close.sql` (subscription cap), and `docs/db/push_kinds.sql`. Run the PGlite verification suite with `node scripts/verify-push-db.mjs <pglite dist/index.js>`.

## Kinds

| Kind | Label (alerts screen) | Recipients | Trigger | Target URL |
| --- | --- | --- | --- | --- |
| `notice` | `공지` | All subscribed | Right after an operator publishes a new notice | `?view=news&notice=…` |
| `schedule` | `대회 일정` | All subscribed | Within 24 hours before registration closes (once), when a tournament's first bracket is created, and after results are applied to records | Notice or tournament bracket |
| `match` | `내 경기` | Opponent entry's account (all team members for team events) | Right after the first player opens an official battle room and starts waiting | `?view=battle&event=…&match=…` (seat screen with submission password) |
| `match` | `내 경기` | Accounts of entries in that round | 30 minutes before round start (`bracket_runtimes.round_schedule`, checked every 10 minutes by pg_cron `push-bracket-steps` in `handover_features.sql`) | `?view=bracket&eventId=…` |
| `match` | `내 경기` | Accounts of registrants who have not submitted a team | Starting 24 hours before the team submission deadline (tournament start, same job) | `?view=builder&eventId=…` |
| `reply` | `내 글의 댓글` | Author of the account-linked post or comment | When a comment or reply is added to an account-linked post (to the post author), or a reply is added to an account-linked comment (to that comment's author). Self-replies do not notify, and secret-post alerts omit the body (`docs/db/community_accounts.sql`) | That post |
| `board` | `게시판 새 글` | All subscribed | When public posts (`자유`, `샘플`, `파티`; excludes secret posts, comments, and private brackets) are published after the previous board alert | Single post if one, or `?view=board` if multiple |
| `tower` | `도전의 탑 순위` | Overtaken account | When a run in the current month (excluding `오늘의 탑`) wins a match and passes an account that reached the same streak earlier (starting at 2 wins) | `?view=battle&tab=streak` |
| `record` | `도전의 탑 신기록` | All subscribed | When a run in the current month beats every other run's best streak (the moment it takes 1st place for the month, starting at 2 wins). Further wins by the existing 1st-place holder do not alert | `?view=battle&tab=streak` |
| `daily` | `오늘의 탑` (retired 2026-11-19, `docs/db/drop_daily_tower.sql`) | None | Cannot be enabled in the UI, and queued rows have no eligible devices | |

- Pre-existing subscriptions keep `notice` only (matching prior behavior). New subscriptions enable `notice`, `match`, and `reply` by default; the rest can be toggled on the alerts screen.
- `경기 결과 등록` maps to applying tournament results (`events.record_applied_at`). Per-match winners occur too frequently to broadcast to everyone.
- `내 글의 댓글` applies only to posts and comments written while signed in (2026-11-18, `docs/superpowers/specs/2026-11-18-board-account-replies-design.md`). Password-protected anonymous posts have no identifiable account to notify.

## Notification inbox

Added on 2026-11-19, the alerts screen (`?view=alerts`) displays notifications from the past 7 days via `push_inbox(p_kinds)` in `docs/db/push_inbox.sql`.

- No separate archive table exists. The inbox reads rows from `push_outbox` (purged after 7 days) alongside public board posts (one entry per post, excluding secret posts and comments).
- Anyone can read broadcast rows, while personal rows require signing in as that account. The screen queries the kinds enabled on the current device, or all kinds when push is off.
- The last-seen timestamp lives only in device `localStorage` (`ypl-alerts-seen`). Any row newer than that timestamp counts as unread and lights the indicator on the alerts row in `더보기`.
- Before the SQL is applied, the UI hides the inbox and shows only notification settings (when `push_inbox` is missing).
- To deploy, run `docs/db/push_inbox.sql` in the SQL Editor (safe to run multiple times), then deploy the site. Verify with `select proname from pg_proc where proname = 'push_inbox';`.

## Account linking

`save_push_subscription` records the current `auth.uid()` on the subscription. The client calls it with the Google session (`visitorAuth.js`) when signed in, or anonymously otherwise. Switching accounts updates the subscription on the next visit to the alerts screen, and signing out clears the link. A trainer link comes from an approved row in `player_accounts`: either matching `player_id`, or for a new trainer without a player record yet, matching the registration name to the account name.

## Delivery flow

```text
New notice saved ──(operator token)──▶ notify-announcement { id } ─▶ push_queue_notice ─┐
Official battle room created ─▶ trigger push_match_waiting ─▶ push_outbox ◀──────────────┤
  └ battle function immediately calls notify-announcement { }                            │
Tower streak +1 ─▶ triggers push_tower_passed, push_tower_record ─▶ push_outbox          │
Board comment ─▶ trigger push_community_reply (on commit) ─▶ push_outbox                 │
Every 1 min pg_cron push-sweep ─▶ notify-announcement { sweep } ─▶ push_take(true) ──────┘
                                         (queues schedule & daily, counts board posts)
push_take claims each row once ─▶ sends via VAPID to devices ─▶ deletes 404/410 subs
```

- `notify-announcement` is the sole sender, and the database decides what goes to whom. Claimed rows lock via `taken_at`, while board and `도전의 탑` alerts lock via each subscription's last-notified timestamp, so repeated calls never send duplicates. Because of this, the function accepts unauthenticated calls (only `notice` verifies an operator token).
- Triggers never block battle or tower writes. If queuing an alert fails, the trigger logs a warning and continues.
- Official match-room alerts are triggered immediately by the `battle` function. If that call fails, the next sweep picks it up within a minute.
- Database pg_cron drives the sweep (`docs/db/push_cron.sql`, via pg_net): within 1 minute when new rows arrive, and every 15 minutes otherwise (avoiding per-minute calls to stay within log limits). GitHub's `push-sweep.yml` was scheduled every 15 minutes, but between 2026-11-18 and 2026-11-24 it ran only every 6 to 8 hours, delaying or dropping board, reply, and round alerts. That workflow now remains only as a fallback if the database cron stops.

## Frequency limits

- During quiet hours (22:00 to 09:00 KST), only `notice` and `match` send. All other kinds wait for the first morning sweep.
- Rows older than 24 hours are skipped, and rows older than 7 days are deleted.
- Board alerts send at most once per hour per device. Posts published in between roll into the next alert (for example, `"첫 글 외 2개"`). Enabling board alerts starts counting from that moment.
- `도전의 탑` rank alerts send at most once every 6 hours per device. Being passed again in that window does not send another alert (check standings on the screen).
- Each fact notifies once: notice ID, registration form plus deadline, a tournament's first bracket, applying tournament results (still once even after undo and re-apply), daily tower per date, and battle plus recipient account.

## Deployment order

1. Run `docs/db/push_kinds.sql` in the Supabase SQL Editor (safe to re-run). Verify read-only:
   `select kinds, count(*) from public.push_subscriptions group by 1;` should return `{notice}` for all existing rows, and `select proname from pg_proc where proname like 'push_%';` should include `push_settings`, `push_take`, `push_queue_notice`, `push_match_waiting`, `push_tower_passed`, and `push_closes_at`.
   Next, run `docs/db/community_accounts.sql` (also safe to re-run) for account-linked board posts and reply alerts.
2. Deploy both Edge Functions:
   - `npx supabase functions deploy notify-announcement --use-api --no-verify-jwt --project-ref rqffrogcverfjqzjasax`
     (`--no-verify-jwt` is required; leave the `VAPID_KEYS` secret unchanged.)
   - Run `npm run build:battle`, then `npx supabase functions deploy battle --use-api --no-verify-jwt --project-ref rqffrogcverfjqzjasax`.
3. Deploy the site. The same push adds `.github/workflows/push-sweep.yml` to `main` so it runs every 15 minutes (no secrets needed; it uses the public key in `.env.production`).

Before the SQL runs, the site hides kind toggles and shows only the old single notice toggle (when `push_settings` is missing). Deploying the functions before the SQL breaks notice delivery, so follow this order.

## Open questions

- Delivery per kind on physical phones (Android Chrome and iOS home-screen web app) cannot be verified from this repository. Toggle each kind on the alerts screen after deployment and confirm on real devices.
- `push_take` is capped at the 1000 rows PostgREST returns per call. Once subscriptions grow past a few hundred, batching will be needed.
