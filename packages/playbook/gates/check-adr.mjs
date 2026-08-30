#!/usr/bin/env node
// Reference: verify ADR sequence integrity, status hygiene, superseder linkage.

import { readFile, readdir } from "node:fs/promises";
import { resolve, relative, join } from "node:path";
import { existsSync } from "node:fs";

const ROOT = resolve(process.cwd());

const DEFAULT_CONFIG = {
  adrDir: "docs/adr",
  validStatuses: ["Proposed", "Accepted", "Superseded", "Rejected", "Tombstoned"],
};

async function loadConfig() {
  const path = join(ROOT, ".quality-gates.json");
  if (!existsSync(path)) return DEFAULT_CONFIG;
  const raw = JSON.parse(await readFile(path, "utf8"));
  return { ...DEFAULT_CONFIG, ...(raw?.gates?.adr ?? {}) };
}

async function main() {
  const config = await loadConfig();
  const adrPath = join(ROOT, config.adrDir);
  if (!existsSync(adrPath)) {
    console.error(`adr: directory not found: ${config.adrDir}`);
    return 1;
  }

  const entries = await readdir(adrPath);
  const adrFiles = entries.filter((f) => /^\d{4}-.+\.md$/.test(f)).sort();

  if (adrFiles.length === 0) {
    console.warn("adr: no ADR files found; that's fine for a new repo.");
    return 0;
  }

  const failures = [];
  const numbers = new Set();
  const adrs = new Map(); // number → { file, status, supersededBy }

  for (const file of adrFiles) {
    const m = file.match(/^(\d{4})-/);
    if (!m) continue;
    const num = parseInt(m[1], 10);
    if (numbers.has(num)) {
      failures.push(`✗ ${file} — duplicate ADR number ${m[1]}`);
      continue;
    }
    numbers.add(num);

    const content = await readFile(join(adrPath, file), "utf8");
    const statusMatch = content.match(/^\*?\*?-?\s*\*?\*?Status:?\*?\*?\s*([^\n]+)/m);
    let status = statusMatch ? statusMatch[1].trim() : null;
    let supersededBy = null;
    if (status) {
      const sm = status.match(/^Superseded\s+by\s+ADR-(\d{4})/i);
      if (sm) {
        status = "Superseded";
        supersededBy = parseInt(sm[1], 10);
      }
    }
    if (!status) {
      failures.push(`✗ ${file} — missing Status field`);
    } else if (!config.validStatuses.includes(status)) {
      failures.push(`✗ ${file} — invalid Status "${status}" (allowed: ${config.validStatuses.join(", ")})`);
    }
    adrs.set(num, { file, status, supersededBy });
  }

  // Sequence integrity — no gaps allowed.
  const sorted = [...numbers].sort((a, b) => a - b);
  let last = 0;
  for (const n of sorted) {
    if (n !== last + 1) {
      failures.push(`✗ sequence gap: missing ADR number ${last + 1} (next found: ${n})`);
    }
    last = n;
  }

  // Superseder linkage — supersededBy points to a real ADR.
  for (const [num, info] of adrs) {
    if (info.supersededBy != null && !numbers.has(info.supersededBy)) {
      failures.push(`✗ ${info.file} — Superseded by ADR-${String(info.supersededBy).padStart(4, "0")} but that ADR does not exist`);
    }
  }

  if (failures.length === 0) {
    console.log(`adr: OK. ${adrs.size} ADR(s); sequence intact.`);
    return 0;
  }
  for (const f of failures) console.error(f);
  console.error(`\nadr: ${failures.length} integrity issue(s).`);
  return 1;
}

const code = await main();
process.exit(code);
