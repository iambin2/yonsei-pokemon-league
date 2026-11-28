# Database scripts

These SQL files build and maintain the production Supabase database (project `rqffrogcverfjqzjasax`). Instead of a migration runner, the owner executes each file manually in the Supabase SQL Editor. Track which files are live using the ledger below and `scripts/db-ledger.mjs`.

## Rules

- Write any new SQL into a file in this folder first, validate it locally with `npm run verify:db` (runs against PGlite without connecting to Supabase), and then execute it in production.
- Follow the deployment order in `CLAUDE.md` under Deployment: SQL first, then Edge Functions, then the site. The client hides new features until their SQL has run.
- Record the execution date in the ledger below.
- If a function is edited directly in production, export its definition with `pg_get_functiondef` and save it as a file here (see `live_drift_2026_11_22.sql`).
- Use read-only Supabase MCP or `select` queries in the SQL Editor for verification.

## Checking the ledger

```powershell
node scripts/db-ledger.mjs > ledger.sql
```

Paste and run `ledger.sql` in the SQL Editor to see how many functions in each file match production. Output marked `"→ otherfile.sql"` means a later file replaced that function (expected), while `"≠"` means the live body matches no file in the repository (edited directly in production).

## Ledger (verified 2026-11-22)

Function bodies were compared ignoring whitespace, and table-only files were checked by table and column existence. The 7 functions that previously showed `"≠"` were captured into `live_drift_2026_11_22.sql`, so every live function now matches a committed file.

| File | First committed | Status |
|---|---|---|
| `normalized_schema_v1.sql` | 2026-10-16 | Applied (tables present). "DRAFT" in header is outdated |
| `normalized_bracket_runtime.sql` | 2026-10-16 | Applied (tables present) |
| `normalized_bracket_runtime_grants.sql` | 2026-10-16 | Applied (grants) |
| `normalized_bracket_runtime_rpc.sql` | 2026-10-16 | Applied |
| `normalized_bracket_runtime_elimination_rpc.sql` | 2026-10-16 | Applied; `delete_normalized_bracket_runtime` was edited live (drift file) |
| `normalized_bracket_winner_rpc.sql` | 2026-10-16 | Later overwritten with identical body by `match_outcome.sql` |
| `ypl_season_rollover.sql` | 2026-10-16 | Applied; `ensure_current_ypl_season` replaced by `player_accounts.sql` |
| `event_name_constraint.sql` | 2026-10-16 | Applied (constraint) |
| `champions_*` (4 files) | 2026-10-16 | Applied; some functions edited live (drift file) |
| `access_lockdown.sql` | 2026-10-16 | Applied |
| `team_submission_rpc.sql` | 2026-10-16 | Applied |
| `legacy_normalized_migration.sql` | 2026-10-16 | One-time only. Migrated old `site_data` records to normalized tables; do not re-run |
| `announcement_push.sql` | 2026-11-01 | Applied; later files replaced functions |
| `visitor_gates.sql`, `visitor_gates_close.sql` | 2026-11-02 | Applied. `close` is one-time only |
| `record_apply_rpc.sql`, `competition_editions.sql`, `league_intake.sql`, `private_bracket_conflict_guard.sql`, `backend_hardening.sql` | 2026-11-02 | Applied |
| `match_outcome.sql` | 2026-11-02 | Applied (scores, `불참`) |
| `application_close.sql`, `player_name_unique.sql`, `private_answers.sql`, `champions_direct_recommendation.sql` | 2026-11-03 | Applied |
| `move_seminar_brackets_to_private.sql` | 2026-11-03 | One-time only. Data move |
| `application_edit.sql`, `battles.sql` | 2026-11-04 | Applied |
| `battle_links.sql`, `battle_random_seat.sql`, `battle_integration.sql`, `battle_timer.sql` | 2026-11-05 | Applied; `battle_official_seat` edited live (drift file) |
| `player_accounts.sql`, `battle_rematch.sql`, `battle_column_grants.sql`, `cpu_battles.sql` | 2026-11-06 | Applied |
| `notice_copy_cleanup.sql` | 2026-11-06 | One-time only. Notice text cleanup |
| `battle_rooms.sql`, `streak_runs.sql` | 2026-11-07 | Applied |
| `championship_single_qualifier_battle_guard.sql`, `battle_team_bouts.sql`, `bracket_format_at_creation.sql`, `bracket_manual_registration.sql` | 2026-11-08 | Applied |
| `streak_reset_2026_11.sql` | 2026-11-11 | One-time only, destructive. Deletes all `도전의 탑` records |
| `group_brackets_and_rookie_candidates.sql` | 2026-11-13 | Applied |
| `account_teams.sql`, `match_schedule.sql` | 2026-11-16 | Applied |
| `push_kinds.sql`, `community_accounts.sql`, `tower_cups.sql`, `push_inbox.sql` | 2026-11-18 to 19 | Applied |
| `drop_daily_tower.sql` | 2026-11-19 | One-time only. Cleaned up `오늘의 탑` notification kind |
| `live_drift_2026_11_22.sql` | 2026-11-22 | Exported from production; re-running in production is a no-op |

Log every file added after 2026-11-22 in the table below.

| File | Applied in prod | Verification |
|---|---|---|
| `backup_grants.sql` | 2026-11-22 | Verified `service_role` reads all 41 tables across both schemas (check query returned 0). Subsequent weekly backup exported all 41 tables cleanly (1.8MB encrypted, retained until 2027-02-20) |
| `account_self.sql` | 2026-11-22 | Verified read-only: 3 functions, `authenticated`-only execute grants, and `postgres` owner delete privilege on `auth.users`. `anon` calls rejected |
| `tower_history.sql` | 2026-11-22 | Verified `streak_my_runs`, `streak_month_tops` (callable by visitors, no prior-month records yet), `tower_archive` table, and archive trigger |
| `change_log.sql` | 2026-11-22 | Verified `ypl_audit` schema, `log_change` triggers on 20 tables, and `admin_change_log` (operators only). `anon` calls rejected |
| `battle_records.sql` | 2026-11-22 | Verified read-only: 4 columns, 2 triggers, cleanup function, pg_cron job (daily 04:10 KST), 30-day limit, and difficulty column. Backfilled end timestamps on 824 finished games out of 827 |
| `match_outcome_more.sql` | 2026-11-22 | Verified read-only: team-match handling in `set_normalized_match_outcome`, `match_outcome_more_ready` (`authenticated` execute), and `battle_applied_mark_forfeit` trigger |
| `handover_features.sql` | 2026-11-22 | Verified 15 functions, 6 tables (`entry_departures`, `client_errors`, `match_picks`, `event_checkins`, `match_reports`, `community_reports`), 5 policies, `battles.paused_left`, updated `battle_set_deadline(turnSeconds)`, pg_cron `push-bracket-steps` (every 10 min), and storage bucket `board` (public, 512KB). Confirmed `set_match_picks` blocks `anon`, while `report_community_item` and `handover_features_ready` allow `anon` as intended |
| `third_place_best_of.sql` | 2026-11-22 | Verified read-only: 3 columns on `bracket_runtimes`, 4 functions (`set_bracket_rules`, `sync_third_place_match`, `set_third_place_winner`, `bracket_rules_ready`), 3rd-place sync in single-elim winner RPC, 3rd-place keys in both delete functions and group-record apply check, wins-required check in score RPC, and best-of battle score trigger |
| `community_secret_read.sql` | 2026-11-22 | Verified read-only: `community_secret_read` (`security definer`) and `anon` execute grant |
| `push_all_default.sql` | 2026-11-22 | Verified `push_subscriptions.kinds` default set to all seven kinds; 7 notice-only devices upgraded to all (10 total on all), 1 manually disabled device stayed empty |
| `tower_cups_guest.sql` | 2026-11-28 | Owner-applied in prod; verified locally via `verify-tower-cups-db.mjs` (guest nickname join, guest cup climb, monthly board isolation) |

## Schema snapshot

`schema_snapshot_2026_11_22.sql` is a read-only catalog dump of production tables, columns, constraints, indexes, RLS policies, triggers, grants, function signatures, extensions, and cron jobs (reference only, do not execute; contains no function bodies or row data). It reflects production before `match_outcome_more.sql` and `handover_features.sql` were applied.

## Rebuilding from an empty project

Running every file in order from scratch has never been tested. The commit dates above approximate the actual execution order, skipping one-time files. The most reliable way to recreate the schema is a dump from production:

```powershell
npx supabase db dump --db-url "<prod DB URL>" -f schema.sql
```

Find the DB URL (including password) in the Supabase dashboard under Settings, Database, and never commit it to the repository. For data restoration, see Recovery in `docs/RUNBOOK.md`.

## Production-only objects

- `ypl_backup` schema: one-off table copies taken before running SQL scripts (`site_data_20261005`, `site_data_20261103`, `site_data_20261104`, `event_registrations_20261104`, `site_data_20261106_notice_copy`). The site never reads them, and they can be dropped once weekly backups (`.github/workflows/backup.yml`) are established.
- `ypl_schema_validation.title_definitions` and `title_awards`: tables created by the normalized schema draft; the live site reads titles from `site_data`.
- `public.rls_auto_enable`: Supabase-managed helper function.
