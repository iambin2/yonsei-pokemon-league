// Read-only snapshot of every table the site keeps in Supabase, one JSON file a table.
// Run: node scripts/backup-data.mjs [outDir]
// With SUPABASE_SERVICE_ROLE_KEY in the environment it reads every row (the weekly backup workflow does this; the result holds
// private answers, PIN hashes and account links, so it is encrypted there and never committed). Without it, it uses the
// public key from .env.production and reports the tables RLS hides instead of skipping them silently.
// With the service key the tables are found from the API itself, so a new table is backed up without editing this file (views
// come along too); otherwise, or when that listing fails, KNOWN is used: every table the live database had on 2026-11-22.
// Restoring is a deliberate manual step: docs/RUNBOOK.md, "복구".
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const env = Object.fromEntries(readFileSync(".env.production", "utf8").split(/\r?\n/)
  .filter(line => /^[A-Z_]+=/.test(line)).map(line => [line.slice(0, line.indexOf("=")), line.slice(line.indexOf("=") + 1).trim()]));
const url = process.env.SUPABASE_URL || env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_ANON_KEY;
const full = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
const SCHEMAS = ["public", env.VITE_YPL_DATA_SCHEMA || "ypl_schema_validation"];
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const out = process.argv[2] || join("..", `ypl-backup-${stamp}`);
mkdirSync(out, { recursive: true });
const report = [];
const headers = profile => ({ apikey: key, Authorization: `Bearer ${key}`, "Accept-Profile": profile });

const KNOWN = {
  public: ["site_data", "account_teams", "battle_secrets", "battles", "client_errors", "community_authors", "community_items",
    "community_reports", "cpu_battles", "form_private_answers", "player_accounts", "push_outbox", "push_subscriptions",
    "streak_runs", "tower_archive", "tower_cup_players", "tower_cup_runs", "tower_cups", "visitor_pins"],
  data: ["seasons", "competition_editions", "league_intakes", "players", "player_partners", "events", "event_checkins",
    "event_registrations", "registration_submissions", "team_snapshots", "team_snapshot_members", "entries", "entry_departures",
    "entry_participants", "bracket_runtimes", "bracket_entry_slots", "bracket_identity_changes", "matches", "match_picks",
    "match_reports", "results", "ranking_awards", "ranking_baselines", "hall_of_fame_entries", "championship_advancements",
    "championship_qualifier_direct_selections", "title_definitions", "title_awards"],
};

async function tables(profile) {
  const known = KNOWN[profile === "public" ? "public" : "data"];
  if (!full) return known;
  const res = await fetch(`${url}/rest/v1/`, { headers: { ...headers(profile), Accept: "application/openapi+json" } });
  if (!res.ok) { report.push(`${profile}: table listing refused (${res.status}), the known list is used`); return known; }
  return [...new Set([...known, ...Object.keys((await res.json()).definitions || {})])];
}

async function dump(table, profile) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const res = await fetch(`${url}/rest/v1/${table}?select=*`, { headers: { ...headers(profile), Range: `${from}-${from + 999}`, "Range-Unit": "items" } });
    if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
    const page = await res.json();
    rows.push(...page);
    if (page.length < 1000) return rows;
  }
}

let failed = 0;
for (const profile of SCHEMAS) {
  for (const table of await tables(profile)) {
    try {
      const rows = await dump(table, profile);
      writeFileSync(join(out, `${profile}.${table}.json`), JSON.stringify(rows));
      report.push(`${profile}.${table}: ${rows.length} rows`);
    } catch (error) {
      failed++;
      report.push(`${profile}.${table}: NOT BACKED UP (${error.message.slice(0, 120)})`);
    }
  }
}
if (full) {
  // Optional audit schema (only succeeds if ypl_audit is exposed in PostgREST db_schemas).
  try {
    const auditRows = await dump("change_log", "ypl_audit");
    writeFileSync(join(out, "ypl_audit.change_log.json"), JSON.stringify(auditRows));
    report.push(`ypl_audit.change_log: ${auditRows.length} rows`);
  } catch {
    report.push("ypl_audit.change_log: skipped (schema not exposed over REST)");
  }
  // Storage manifest for uploaded board images (metadata list so operators know what exists in the bucket).
  try {
    const res = await fetch(`${url}/storage/v1/object/list/board`, {
      method: "POST",
      headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ prefix: "", limit: 1000, offset: 0 }),
    });
    if (res.ok) {
      const files = await res.json();
      writeFileSync(join(out, "storage.board.json"), JSON.stringify(files));
      report.push(`storage.board: ${Array.isArray(files) ? files.length : 0} objects`);
    } else {
      report.push(`storage.board: skipped (${res.status})`);
    }
  } catch {
    report.push("storage.board: skipped");
  }
}
writeFileSync(join(out, "README.txt"), `YPL data snapshot ${new Date().toISOString()} (${full ? "every row" : "public key: what RLS shows"})\n\n${report.join("\n")}\n`);
console.log(out + "\n" + report.join("\n"));
// with the service key nothing may be missing; a failure fails the workflow so it is reported
if (full && failed) process.exit(1);
