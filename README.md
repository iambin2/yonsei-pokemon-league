# YPL (Yonsei Pokémon League)

This is the official battle league records site for Pokémon Center Yonsei. It is a static React 18 and Vite single-page app deployed automatically to GitHub Pages.

- Production URL: https://league.pokeyonsei.com/
- Data backend: Supabase (normalized schema and legacy key-value table)

If you are taking over the site, read these guides in order: [`docs/HANDOVER.md`](docs/HANDOVER.md) for accounts, secrets, and recurring tasks, [`docs/OPERATOR.md`](docs/OPERATOR.md) (or Korean quick guide [`docs/OPERATOR_KO.md`](docs/OPERATOR_KO.md)) for running a tournament screen by screen, and [`docs/RUNBOOK.md`](docs/RUNBOOK.md) for incidents, backups, and recovery.

---

## 0. Prerequisites

- Node.js 24 or later (https://nodejs.org). The repository `.nvmrc` pins the version, and CI reads that file.
- Verify the installation by checking that `node -v` prints the version in your terminal.

---

## 1. Local setup

```bash
npm install      # First time only
npm run dev      # Dev server → http://localhost:5173
```

Press `Ctrl + C` to stop the server.

```bash
npm run build    # Build dist/ (production bundle)
npm run preview  # Preview the built bundle
npm test         # Run the full regression test suite
npm run data:champions  # Rebuild src/data/champions-data.json for the team builder and calculator
```

To run a single test file, execute it directly with Node. Each test is a standalone `node:test` module with no runner configuration.

```bash
node tests/championsCore.test.mjs
```

---

## 2. Environment variables

Create a `.env` file in the project root (see `.env.example`) and fill in these three variables.

| Variable | Description |
| --- | --- |
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Anon public key |
| `VITE_YPL_DATA_SCHEMA` | Normalized data schema name (production value: `ypl_schema_validation`) |

Copy the values from the Supabase dashboard under Project Settings, then API. Production build values live in `.env.production` in the repository.

If you leave `VITE_SUPABASE_*` empty, the site falls back to `localStorage` mode. In that mode, admin edits save only to that browser and are invisible to other users. You can check the active mode via `STORAGE_MODE` (`artifact`, `supabase`, or `local`) in `src/storage.js`.

---

## 3. Deployment

Pushing to `main` triggers `.github/workflows/deploy.yml`, which runs tests, checks SQL, builds the app, and deploys to GitHub Pages. When Edge Function code changes, `functions.yml` deploys both Edge Functions (requires the `SUPABASE_ACCESS_TOKEN` repository secret). The owner runs any new SQL files in the Supabase SQL Editor first (see `docs/db/README.md`). Pushing to any other branch triggers `ci.yml`, which runs the same checks without deploying.

Keep two details in mind:

- The site is served at the root of the custom domain `league.pokeyonsei.com`, so `vite.config.js` sets `base: "/"`. If you drop the custom domain, change it back to `"/yonsei-pokemon-league/"` so links and static asset paths keep working.
- Each build generates `version.json`, and an injected script in `index.html` checks it so the page reloads automatically when a new deployment goes live. This keeps visitors off stale cached builds, so check this script whenever you edit `index.html` head tags or `base`.

---

## 4. Supabase

### Data sources

Two data sources coexist in Supabase:

- The normalized schema (`ypl_schema_validation`) is the canonical source for all active tournaments. Seasons, notices, registrations, official team submissions, participants, bracket runtimes, matches, results, and rankings all live here.
- Legacy `public.site_data` holds site-level data and read-only historical records of completed brackets from before normalization. Never write a new bracket here.

Read [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the full rules and invariants before editing any data code.

### Fresh environment setup

`docs/db/README.md` tracks the SQL ledger, execution order, and how to dump the production schema. The old root `supabase_setup.sql` was deleted on 2026-11-22 because it left write access open to visitors.

### Security

Row Level Security (RLS) is enabled on every table in `public` and `ypl_schema_validation`, and the anon key cannot write directly to tables. Visitor writes (board posts, registrations, team submissions) go through server-validated RPCs, while operator writes require an account with `app_metadata.ypl_admin`. All SQL sources live in `docs/db/`.

---

## 5. Admin login

- Open the `더보기` screen and select the admin login row (on wide desktop screens, click `관리자 로그인` at the end of the footer).
- Sign in with the shared operator username and password. Keep the password among operators and never commit it to the repository.
- Accounts live in Supabase Auth. A username without `@` is converted to `<username>@ypl.invalid` during sign-in (`src/storage.js`), and only accounts with `app_metadata.ypl_admin = true` can write to the database. Public sign-up is disabled.
- Sessions persist in `sessionStorage` across reloads and expire when the browser tab closes.

> Database permissions and RLS form the real write boundary. Follow [`docs/db-access-lockdown.md`](docs/db-access-lockdown.md) for the lockdown plan and order.

---

## 6. Directory structure

```
yonsei-pokemon-league/
├─ index.html                 # Entry HTML
├─ vite.config.js             # Base path and auto-reload version plugin
├─ .github/workflows/         # Deploy, CI, function deploy, weekly backup, uptime, push sweep, data refresh (opens an issue on failure)
├─ docs/
│  ├─ ARCHITECTURE.md         # Data model and invariants (canonical)
│  ├─ brand/                  # App icon and link preview sources, Wing Y notes
│  └─ db/                     # Supabase SQL and ledger (README.md)
├─ scripts/                   # Operations scripts (section 7)
├─ tests/                     # node:test regression tests
├─ public/
└─ src/
   ├─ main.jsx                # React entry point
   ├─ App.jsx                 # App shell (view state, site data, admin mode)
   ├─ storage.js              # Storage adapter (artifact → Supabase → localStorage)
   ├─ pages/                  # Views (홈, 기록, 대진표, 칭호, 팀 빌더, 계산기 ...)
   ├─ components/             # Shared UI (common/Board.jsx Almanac parts re-exported via components/index.js, layout/ top bar and tab bar)
   ├─ admin/                  # Admin mode (editors, modals, mode bar)
   ├─ services/               # Domain logic (bracket lifecycle, projection, records, champions)
   ├─ data/                   # Team builder and calculator data
   └─ styles/                 # tokens.css (tokens), board.css (shared parts), per-screen CSS
```

Navigation uses `?view=` query strings with no router library (`src/services/appRouting.js`).

### Design system

The site uses the **YPL League Almanac** visual system (which replaced YPL Scoreboard on 2026-11-24). Nothing stands on a box or surface: entries are set directly on the navy ground in type, closed by 1px `--rule` hairlines, and each section opens with a 2px `--lit` rule. Big numbers render as thin Albert Sans figures (`Fig`), and a single 8px amber mark signals anything live right now. Emphasis is expressed through size, weight, and the 2px rule rather than color or frames, and spacing, type sizes, heights, and durations derive from one golden ratio.

[`DESIGN.md`](DESIGN.md) is the sole authority for visual rules and rationale, and [`PRODUCT.md`](PRODUCT.md) defines product and brand rules. Token values live in `src/styles/tokens.css`, shared Almanac parts live in `src/components/common/Board.jsx` (re-exported from `src/components/index.js`) and `src/styles/board.css`, and `tests/designLaw.test.mjs` checks all CSS against these rules. Both light and dark themes (plus high contrast) run on `<html data-theme>`, so hardcoding colors breaks themes silently. See [`docs/ADDING_A_FEATURE.md`](docs/ADDING_A_FEATURE.md) for a step-by-step recipe when adding a new page or UI element.

---

## 7. Operations scripts

```bash
npm run backup -- [output-dir]            # Read-only Supabase snapshot (one JSON per table)
npm run verify:db                         # Validate docs/db SQL in disposable PostgreSQL (PGlite), no Supabase connection
node scripts/db-ledger.mjs > ledger.sql   # Read-only query checking which SQL files are applied in production
node scripts/class-coverage.mjs           # Find className references with no matching CSS rule
```

When `SUPABASE_SERVICE_ROLE_KEY` is set, `backup` exports every row. Without it, the script uses the public key in `.env.production`, exports only what RLS allows, and reports skipped tables. Every Sunday, `backup.yml` runs a full backup with the service key, encrypts it, and keeps it for 90 days. For restoration steps, see the Recovery section of [`docs/RUNBOOK.md`](docs/RUNBOOK.md).

Unmatched results from `class-coverage.mjs` include dynamic classes and JavaScript-only hooks. Check whether your change added new unmatched names.

`scripts/generate-normalized-migration.mjs` is a one-off migration tool that converts legacy CSV data into normalized SQL.
