# Troubleshooting and operations

Work through these checks from top to bottom by symptom. Account owners and secret locations are listed in [HANDOVER.md](HANDOVER.md).

## Initial checks

1. Check repository Issues for `"자동 작업 실패: ..."` (hourly uptime monitoring checks the site, battle function, and database).
2. Check recent runs in the repository Actions tab.
3. Open the Supabase dashboard and check whether the project is Paused, storage usage under Database, Reports, and Edge Functions, Logs.

## Site unreachable

| Check | Action |
|---|---|
| Does `https://league.pokeyonsei.com/version.json` load? | If not, check GitHub Pages or DNS. Verify the custom domain and "DNS check successful" under repo Settings, Pages, and confirm the `league` CNAME in Cloudflare is intact |
| Did the last deployment fail? | Check "Deploy to GitHub Pages" in Actions. Failed tests block deployment and leave the previous site running |
| Loads as a blank white screen | If a recent deployment caused it, follow Rollback below |

## Save failures and missing records

| Check | Action |
|---|---|
| Supabase project is Paused | Click Restore in the dashboard. Hourly uptime checks normally prevent this |
| Operator session expired | Sessions end when the tab closes. Sign in again |
| `"다른 곳에서 먼저 저장했습니다"` | Another operator edited the same record first. Refresh and retry |
| `site_data` save fails | The database rejects rows over 512KB or containing embedded images. Link images instead |

## Notifications not arriving

1. Check whether "Push sweep" in Actions succeeds every 15 minutes.
2. Check Logs for `notify-announcement` under Supabase Edge Functions.
3. Verify the device has notifications enabled on the alerts screen. On iOS, push works only inside the web app added to the home screen.
4. Confirm `VAPID_KEYS` was not rotated. Rotating it forces every device to re-subscribe.

## Frozen battles and missing official results

- If the match sheet shows a recording failure reason, click `다시 넣기`. If that still fails, click `배틀 무효` and enter the winner manually (OPERATOR.md section 5).
- If the function itself is down, inspect `battle` under Supabase Edge Functions, Logs. For a broken deploy, re-run "Deploy functions" via Run workflow in Actions.
- If `"배틀 저장 공간이 가득 찼습니다"` appears, finished friendly battles have hit the 5000-game limit. Delete old completed friendly battles:
  ```sql
  -- Only friendly battles ended more than 30 days ago. Leaves official, tower, and active games untouched.
  delete from public.battles where kind = 'friendly' and status = 'ended' and updated_at < now() - interval '30 days';
  ```
  Run `select count(*)` with the same `where` clause first to verify how many rows will be deleted.

## Rollback

- Site: revert the offending commit with `git revert <commit>` and push. GitHub Pages has no button to roll back to an earlier build.
- Functions: pushing that revert to `main` makes "Deploy functions" redeploy the previous code. In an emergency, click Re-run on the prior successful run in Actions.
- SQL: database changes do not roll back automatically. Find the previous function definition in an earlier file under `docs/db` or via `git log -p -- docs/db/<file>`, then run that definition again.

## Backups

- Every Sunday at 03:00 KST, `backup.yml` exports all tables, encrypts them with `BACKUP_PASSPHRASE`, and keeps the archive in workflow Artifacts for 90 days.
- To run a backup immediately, open Actions, "Weekly backup", and click Run workflow.
- For archives you want to keep longer than 90 days (end of semester or before handover), download the encrypted file and store it in the club's shared drive.

## Recovery

1. Download and unzip the `ypl-backup` artifact from the desired "Weekly backup" run in Actions.
2. Decrypt and unpack: `gpg --decrypt ypl-backup-YYYYMMDD.tar.gz.gpg > backup.tar.gz` (enter `BACKUP_PASSPHRASE`), then `tar -xzf backup.tar.gz`.
3. Each `backup/<schema>.<table>.json` file holds every row of one table. `README.txt` lists row counts per table.
4. Restoration is intentionally manual. Most recoveries restore a handful of deleted rows, so extract the needed rows from JSON and insert them in the SQL Editor:
   ```sql
   insert into ypl_schema_validation.matches select * from jsonb_populate_recordset(null::ypl_schema_validation.matches, '<JSON array>'::jsonb);
   ```
   To restore an entire table, take a fresh backup of the current state first, clear the table, and re-insert the same way. Insert parent tables (`seasons`, `players`, `events`) first to satisfy foreign keys.
5. Backups exclude `auth.users` (login accounts). Supabase manages auth separately, so you only need it if the entire project is lost.

Once per semester, practice steps 1 through 3 and verify the row counts.

## Audit log and restoring deleted notices

Since `docs/db/change_log.sql` was applied, every write to tournament records and `site_data` (notices, titles, Hall of Fame) is logged in `ypl_audit.change_log`. Check recent entries under `최근 변경` at the bottom of the `운영` screen, or inspect full details in the SQL Editor.

```sql
-- All changes to a single match (winner entry, edits, deletes)
select at, actor_email, op, old, new from ypl_audit.change_log where table_name = 'matches' and row_id = '<match id>' order by at;
-- Deleted notices: prior notice arrays from saves that modified notices
select id, at, actor_email, jsonb_array_length(old -> 'announcements') from ypl_audit.change_log
 where table_name = 'site_data' and old ? 'announcements' order by at desc limit 20;
```

The deleted notice lives in `old -> 'announcements'` from that save. Pull that single notice out and append it back to the current list:

```sql
update public.site_data set value = jsonb_set(value, '{announcements}', (value -> 'announcements') || (
  select a from ypl_audit.change_log c, jsonb_array_elements(c.old -> 'announcements') a where c.id = <log id> and a ->> 'id' = '<notice id>'))
 where key = 'ypl_data_v4';
```

Refresh the site to confirm restoration. Titles (`titleGroups`) and Hall of Fame (`champions`) restore the same way.

## Ranker teams

Run this after a `포켓몬 챔피언스` season ends to update the top-team data used by `도전의 탑` opponent builders:

```powershell
node scripts/build-ranker-teams.mjs
```

The script automatically fetches published season files within `SEASON_RANGE` and skips unreleased seasons. It updates `src/data/ranker-teams.json` and `src/data/tower-tiers.json`; run tests, commit, and deploy. If the upstream site disappears, the site continues running on the committed data.

## Regulation updates

Switching to a new regulation takes several steps:

1. Refresh Pokémon data with `npm run data:champions` (the weekly PR also runs this).
2. If an engine upgrade is needed, follow Engine upgrades below.
3. Rebuild regulation pools and sample sets using `tune-sets`, `curate-sets`, `render-sample-sets`, and `rate-species` in the order listed at the top of `CLAUDE.md`. Replace `"m-c"` in those scripts with the new regulation code.
4. Update `SEASON_RANGE` and `FORMAT` in `scripts/build-ranker-teams.mjs`.
5. Update any tests with `RegulationMC` in their names to match the new regulation.

## Engine upgrades

Dependabot skips `@pkmn/sim` and `@pkmn/mods`. To upgrade them manually:

1. Bump both versions together in `package.json` and run `npm install`.
2. Run `npm test` and `npm run build:battle` (the build script verifies the bundle loads cleanly).
3. Run `npm run bench:cpu -- --games 300` to confirm CPU strength has not regressed (see `docs/BATTLE_COMPUTER.md`).
4. Deploy on a day with no active tournament, since in-progress battles replay logs written by the older engine.

## External data sources

| Source | Used by | If unavailable |
|---|---|---|
| Showdown, PokeAPI | `npm run data:champions` (weekly) | The weekly PR fails and alerts; the site keeps running on committed data |
| champs.pokedb.tokyo | Ranker teams | Same as above |
| PokeOS sprites and cries | `scripts/build-sprites.py`, `build-cries.py` | Generated assets are committed in `public/`, so the site is unaffected. Only new Pokémon assets cannot be generated until another source URL is wired into the scripts |

## Personal data deletion requests

With `docs/db/account_self.sql` applied, users can run `기록 연결 해제` and `계정 삭제` themselves under `내 기록 찾기` on the `기록` screen. Operators can undo a wrongly approved link under `연결된 계정` on the `운영` screen. For requests a user cannot complete themselves (such as name-only registrations without an account):

1. Delete the Google account under Supabase Authentication, Users. This cascades to account links (`player_accounts`), saved teams (`account_teams`), and board authorship links (`community_authors`), and clears the account column on battle records.
2. Delete remaining name-based board posts from the UI, and let operators clean up registrations.
3. Because tournament results (placements and brackets) are competition records, operators decide whether to rename the player to a placeholder such as `"탈퇴한 트레이너"`.
4. Notify the requester of the completion date.

## Project storage

Monitor database size under Database, Reports (28MB as of 2026-11-22, against a 500MB free-tier limit). `battles` and `battle_secrets` grow fastest, followed by `cpu_battles`.
