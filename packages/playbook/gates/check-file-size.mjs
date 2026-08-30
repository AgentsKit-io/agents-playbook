#!/usr/bin/env node
// Reference implementation: per-extension line-count budget with shrink-only baseline.
//
// Usage:
//   node scripts/check-file-size.example.mjs           # check
//   node scripts/check-file-size.example.mjs --baseline # regenerate baseline (shrink-only)
//   node scripts/check-file-size.example.mjs --explain  # print rule + fix recipe
//
// Config: .quality-gates.json { gates: { "file-size": { budgets: {".tsx":300,".ts":500,".test.ts":800}, baseline: ".file-size-baseline.json" } } }
//
// Behavior: existing offenders are grandfathered (in baseline); new files must respect budget;
// baselined files must not grow. Pre-commit on changed files; CI on whole repo.

import { readFile, writeFile, readdir } from "node:fs/promises";
import { resolve, relative, join, extname, isAbsolute, sep } from "node:path";
import { existsSync } from "node:fs";

const ROOT = resolve(process.cwd());
const ARGS = new Set(process.argv.slice(2));

const DEFAULT_CONFIG = {
  budgets: { ".tsx": 300, ".ts": 500, ".test.ts": 800, ".test.tsx": 800 },
  baseline: ".file-size-baseline.json",
  scan: ["src", "packages", "apps"],
  ignore: ["node_modules", "dist", "build", ".next", ".turbo", "coverage", "__snapshots__"],
};

async function loadConfig() {
  const path = join(ROOT, ".quality-gates.json");
  if (!existsSync(path)) return DEFAULT_CONFIG;
  const raw = JSON.parse(await readFile(path, "utf8"));
  return { ...DEFAULT_CONFIG, ...(raw?.gates?.["file-size"] ?? {}) };
}

function pickBudget(file, budgets) {
  // longest matching extension wins (e.g. .test.ts beats .ts)
  const matches = Object.keys(budgets)
    .filter((ext) => file.endsWith(ext))
    .sort((a, b) => b.length - a.length);
  return matches.length ? budgets[matches[0]] : null;
}

async function* walk(dir, ignore) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    if (ignore.includes(e.name)) continue;
    const full = join(dir, e.name);
    if (e.isDirectory()) yield* walk(full, ignore);
    else yield full;
  }
}

async function countLines(file) {
  const content = await readFile(file, "utf8");
  if (content.length === 0) return 0;
  return content.split("\n").length - (content.endsWith("\n") ? 1 : 0);
}

function withinRoot(path, label) {
  const full = resolve(ROOT, path);
  const fromRoot = relative(ROOT, full);
  if (fromRoot === ".." || fromRoot.startsWith(`..${sep}`) || isAbsolute(fromRoot)) {
    throw new Error(`${label} path escapes the repository: ${path}`);
  }
  return full;
}

async function collectFiles(config) {
  const results = new Map();
  for (const dir of config.scan) {
    const full = withinRoot(dir, "gates.file-size.scan");
    if (!existsSync(full)) continue;
    for await (const file of walk(full, config.ignore)) {
      const budget = pickBudget(file, config.budgets);
      if (budget == null) continue;
      const lines = await countLines(file);
      results.set(relative(ROOT, file).split(sep).join("/"), { lines, budget });
    }
  }
  return results;
}

async function loadBaseline(path) {
  const full = withinRoot(path, "gates.file-size.baseline");
  if (!existsSync(full)) return {};
  return JSON.parse(await readFile(full, "utf8"));
}

async function saveBaseline(path, data) {
  const full = withinRoot(path, "gates.file-size.baseline");
  await writeFile(full, JSON.stringify(data, null, 2) + "\n");
}

function explain() {
  process.stdout.write(`
file-size gate
==============

Rule: .tsx ≤ 300 lines, .ts ≤ 500 lines, .test.{ts,tsx} ≤ 800 lines.
Mode: shrink-only baseline.

How to fix a violation:
  - Component over budget: extract sub-components into a sibling parts/ directory.
  - Logic file over budget: split by responsibility (one file per public function family).
  - Do NOT split into <file>-2.tsx. Do NOT lower the budget.

Baseline:
  - Existing offenders are grandfathered in .file-size-baseline.json.
  - They cannot grow; new files must respect the budget.
  - Regenerate (after intentional shrink sweep): node scripts/check-file-size.example.mjs --baseline

See: pillars/architecture/file-size-budget.md
`);
}

async function main() {
  if (ARGS.has("--explain")) {
    explain();
    return 0;
  }

  const config = await loadConfig();
  const files = await collectFiles(config);
  const baseline = await loadBaseline(config.baseline);

  if (ARGS.has("--baseline")) {
    const next = {};
    let shrunk = 0;
    let grew = 0;
    for (const [file, { lines, budget }] of files) {
      if (lines > budget) {
        const prev = baseline[file];
        if (prev != null && lines > prev) {
          console.error(`baseline GROWTH refused: ${file} ${prev} → ${lines}`);
          grew++;
        }
        next[file] = lines;
      } else if (baseline[file] != null) {
        shrunk++;
      }
    }
    if (grew > 0) {
      console.error(`\n${grew} file(s) grew. Baseline can only shrink. Fix or revert.`);
      return 1;
    }
    await saveBaseline(config.baseline, next);
    console.log(`baseline written: ${Object.keys(next).length} entries (${shrunk} shrunk-out).`);
    return 0;
  }

  const failures = [];
  for (const [file, { lines, budget }] of files) {
    const prev = baseline[file];
    if (prev != null) {
      // Baselined offender: only fail if it grew.
      if (lines > prev) {
        failures.push({ file, lines, budget, prev, kind: "grew" });
      }
    } else if (lines > budget) {
      failures.push({ file, lines, budget, kind: "new" });
    }
  }

  if (failures.length === 0) {
    console.log(`file-size: OK (${files.size} files scanned).`);
    return 0;
  }

  for (const f of failures) {
    if (f.kind === "grew") {
      console.error(`✗ ${f.file}:1 — baselined offender grew ${f.prev} → ${f.lines} (budget ${f.budget}). Shrink before merge.`);
    } else {
      console.error(`✗ ${f.file}:1 — ${f.lines} lines > ${f.budget} budget. Extract sub-components / split module. Do NOT lower the budget.`);
    }
  }
  console.error(`\nfile-size: ${failures.length} violation(s). Run with --explain for fix recipes.`);
  return 1;
}

const code = await main();
process.exit(code);
