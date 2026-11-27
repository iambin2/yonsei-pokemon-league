// Handover & static safety guardrails:
// 1. No leftover debugger statements in src/
// 2. src/main.jsx keeps tokens.css first, admin.css last, and no duplicate CSS imports
// 3. scripts/backup-data.mjs KNOWN list stays in sync with tables created under docs/db/
// 4. Relative markdown links in core handover/developer docs point to existing files
import assert from "node:assert/strict";
import test from "node:test";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname.replace(/^\/(\w:)/, "$1");
const read = p => readFileSync(join(ROOT, p), "utf8");
const walk = dir => readdirSync(dir, { withFileTypes: true }).flatMap(e => (e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]));

test("no debugger statements remain in src/", () => {
  const files = walk(join(ROOT, "src")).filter(f => /\.(jsx?|mjs)$/.test(f));
  const hits = files.filter(f => /\bdebugger\b/.test(readFileSync(f, "utf8"))).map(f => relative(ROOT, f));
  assert.deepEqual(hits, []);
});

test("src/main.jsx imports tokens.css first, admin.css last, with no duplicate CSS imports", () => {
  const main = read("src/main.jsx");
  const cssImports = [...main.matchAll(/import\s+["'](\.\/styles\/[^"']+\.css)["']/g)].map(m => m[1]);
  assert.ok(cssImports.length >= 20, "expected full stylesheet list in src/main.jsx");
  assert.equal(cssImports[0], "./styles/tokens.css");
  assert.equal(cssImports[cssImports.length - 1], "./styles/admin.css");
  assert.equal(new Set(cssImports).size, cssImports.length, "duplicate CSS import found in src/main.jsx");
});

test("scripts/backup-data.mjs KNOWN list covers every table created in docs/db/", () => {
  const backupSrc = read("scripts/backup-data.mjs");
  const known = new Set([...backupSrc.matchAll(/"([a-z0-9_]+)"/g)].map(m => m[1]));
  const dbDir = join(ROOT, "docs/db");
  const missing = [];
  for (const f of readdirSync(dbDir).filter(x => x.endsWith(".sql") && !x.startsWith("schema_snapshot"))) {
    const sql = readFileSync(join(dbDir, f), "utf8");
    for (const m of sql.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?(?:([a-z0-9_]+)\.)?([a-z0-9_]+)\s*\(/gi)) {
      const schema = (m[1] || "public").toLowerCase();
      const table = m[2].toLowerCase();
      if (schema === "ypl_backup" || schema === "ypl_audit") continue;
      if (!known.has(table)) missing.push(`${f}: ${schema}.${table}`);
    }
  }
  assert.deepEqual(missing, [], `Add new tables to KNOWN in scripts/backup-data.mjs: ${missing.join(", ")}`);
});

test("relative markdown links in core handover docs point to existing files", () => {
  const docs = ["README.md", "docs/HANDOVER.md", "docs/OPERATOR.md", "docs/OPERATOR_KO.md", "docs/RUNBOOK.md", "docs/ADDING_A_FEATURE.md"];
  const broken = [];
  for (const doc of docs) {
    const abs = join(ROOT, doc);
    const text = readFileSync(abs, "utf8");
    for (const m of text.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)) {
      const target = m[1].split("#")[0].trim();
      if (!target || /^(https?:|mailto:|#)/.test(target)) continue;
      if (!existsSync(resolve(dirname(abs), target))) broken.push(`${doc} -> ${target}`);
    }
  }
  assert.deepEqual(broken, []);
});
