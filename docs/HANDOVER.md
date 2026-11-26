# Handover

Read this document first when taking over the site. It lists where each component lives, whose accounts own them, and which tasks run on a schedule. See [OPERATOR.md](OPERATOR.md) for running a tournament and [RUNBOOK.md](RUNBOOK.md) for troubleshooting.

## 1. Components

| Component | Location | Deployment |
|---|---|---|
| Site | GitHub repo `iambin2/yonsei-pokemon-league`, GitHub Pages | Automatic on push to `main` (`deploy.yml`) |
| Database | Supabase project `rqffrogcverfjqzjasax` (PostgreSQL 17) | Manual via SQL Editor (`docs/db/README.md`) |
| `battle` function | Supabase Edge Function (battles, official matches, `도전의 탑`) | Automatic on push to `main` (`functions.yml`), requires token |
| `notify-announcement` function | Supabase Edge Function (Web Push delivery) | Same as above |
| Domain | `league.pokeyonsei.com`, Cloudflare DNS CNAME `league` pointing to `iambin2.github.io` (DNS only) | No regular changes |
| Google login | Google Cloud OAuth app, Supabase Auth Google provider | No regular changes |

## 2. Accounts and ownership

Fill in the blank cells below during handover. That information cannot be read from the repository.

| Account | Current owner | Transfer procedure |
|---|---|---|
| GitHub repository | Personal account `iambin2` | Create a club GitHub organization and use Settings, Transfer ownership. Moving to an org changes the Pages host, so update the Cloudflare CNAME to `<org>.github.io` and re-enter the custom domain in repo Settings, Pages |
| Supabase org and project | | Invite the successor as Owner under org Settings, Members, then remove yourself. No project transfer is needed |
| Cloudflare (`pokeyonsei.com`) | | Invite to account Members, or transfer domain ownership at the registrar |
| Domain registration (expiry:      ) | | Transfer ownership at the registrar and record the expiry date on a calendar |
| Google Cloud OAuth app | | Add the successor as Owner in IAM |
| Shared operator login | Single Supabase Auth user `yplofficial` | See section 4 |

The old Supabase project `fgjtph…` ("YPL") is abandoned. Ignore any pause warning emails about it.

## 3. Secrets

Do not write secret values into this file. Record only their names and storage locations.

As of 2026-11-22, the backup passphrase is stored in the owner's personal Google Password Manager (site `github.com/iambin2/ypl-site`, username `BACKUP_PASSPHRASE`). Before handover, create a free Bitwarden organization vault (free for up to 2 members), invite the successor, and move every value marked "shared password manager" below (backup passphrase, VAPID private key, operator password) into that vault. Handover then takes a single vault invitation.

| Name | Location | Purpose | If lost |
|---|---|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | GitHub repo Secrets | Weekly backup, CPU learning | Copy again from dashboard Settings, API |
| `BACKUP_PASSPHRASE` | GitHub repo Secrets, shared password manager | Weekly backup encryption | Without this value, existing backups cannot be decrypted. Always keep it in two places |
| `SUPABASE_ACCESS_TOKEN` | GitHub repo Secrets | Automatic function deployment | Issued 2026-11-22 as "ypl-site GitHub Actions", no expiry, scoped to Edge Functions read/write and Project Settings read on `YPL_DB`. During handover, have the successor issue a new token with the same scopes at supabase.com (Account, Access Tokens), replace the secret, and revoke the old token |
| `VAPID_KEYS` | Supabase function Secrets, shared password manager | Push notification signing | The public half is `VAPID_PUBLIC_KEY` in `src/services/announcementPush.js`. Rotating the key pair breaks all existing device subscriptions. The private half is also in the owner's local `.env.local`; move it to the shared password manager |
| Google OAuth client secret | Supabase dashboard Authentication, Providers, Google | Google login | Reissue in Google Cloud |
| Operator password | Supabase Auth | Admin screen | See section 4 |
| DB password | Supabase dashboard Settings, Database | Schema dump, recovery | Reset in the dashboard (unused by the site itself) |

The URL and anon public key in `.env.production` are meant to be committed to the repository because the site sends them to every visitor anyway.

## 4. Operator accounts

Only Supabase Auth users with `app_metadata.ypl_admin = true` can perform operator writes (enforced by the database). Operators currently share one account (`yplofficial`; typing it without `@` in the login box signs in as `yplofficial@ypl.invalid`).

- Password rotation is required during handover because this password was exposed in an older deployed file (see `docs/db-access-lockdown.md`, section 10). Open the user in the Supabase dashboard under Authentication, Users, and set a new password.
- To add an operator, create the user under Authentication, Users, Add user (mark email as confirmed), then run this query in the SQL Editor:
  ```sql
  update auth.users set raw_app_meta_data = raw_app_meta_data || '{"ypl_admin": true}'::jsonb where email = '<email>';
  ```
- To remove an operator, strip `'ypl_admin'` with `- 'ypl_admin'` in the same SQL statement or delete the user.
- Admin sessions expire when the browser tab closes.

## 5. Recurring tasks

When an automated workflow fails, it opens a GitHub issue titled `"자동 작업 실패: <name>"` and closes it automatically on the next successful run. Watch the repository to receive email alerts.

| Schedule | Task | Automation |
|---|---|---|
| Hourly (delayed by a few hours when GitHub is busy) | Checks that the site, battle function, and database respond (`uptime.yml`). Also prevents the database from pausing after 7 idle days and re-enables scheduled workflows so they do not disable after 60 days without commits | Automatic |
| Every 15 minutes | Sweeps pending push notifications (`push-sweep.yml`) | Automatic |
| Sundays at 03:00 | Exports all tables, encrypts the archive, and stores it for 90 days (`backup.yml`) | Automatic |
| Mondays | Opens PRs for Pokémon data refresh (`refresh-champions-data.yml`), CPU set learning (`learn-cpu-sets.yml`), and dependency updates (Dependabot) | PR creation is automatic; merging is manual (section 6) |
| Semi-annually | Season rollover | Automatic (determined by date in the database) |
| End of each `포켓몬 챔피언스` season | Update ranker teams by adding the new season number to `SEASONS` in `scripts/build-ranker-teams.mjs` and running it | Manual (see RUNBOOK "Ranker teams") |
| New regulation release | Follow RUNBOOK "Regulation updates" | Manual |
| Per tournament | Follow OPERATOR.md | Operator |
| Once per semester | Download and decrypt one backup as a recovery drill | Manual |

## 6. PR merges and branches

Development happens on `design/scoreboard`, and deployments push that branch to both `origin/design/scoreboard` and `origin/main`. Data PRs and Dependabot PRs target `main`. Because of this:

1. Merging a PR on GitHub moves `main` ahead of the working branch.
2. Before starting new work, run `git pull origin main` on the working branch. Skipping this causes the next deploy push to be rejected.

If the successor prefers a single-branch workflow, working directly on `main` is fine. Update the branch note in `CLAUDE.md` under Deployment to match.

## 7. First 30 minutes

1. Install Node 24, run `npm install`, and start the dev server with `npm run dev` (README section 1).
2. Confirm that `npm test` passes.
3. Sign in as an operator and open `?view=admin`.
4. Check the repository Actions tab for green runs and verify there are no open `"자동 작업 실패"` issues.
5. Fill in the blanks in sections 2 and 3, then rotate the operator password.
