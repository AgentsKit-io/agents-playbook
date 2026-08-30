#!/usr/bin/env node
// Reference: verify RFC index integrity + promotion linkage to ADRs.

import { readFile, readdir } from "node:fs/promises";
import { resolve, join } from "node:path";
import { existsSync } from "node:fs";

const ROOT = resolve(process.cwd());

const DEFAULT_CONFIG = {
  rfcDir: "docs/rfc",
  adrDir: "docs/adr",
  validStatuses: ["Draft", "Open", "Final-Comment-Period", "Accepted", "Rejected", "Withdrawn"],
};

async function loadConfig() {
  const path = join(ROOT, ".quality-gates.json");
  if (!existsSync(path)) return DEFAULT_CONFIG;
  const raw = JSON.parse(await readFile(path, "utf8"));
  return { ...DEFAULT_CONFIG, ...(raw?.gates?.rfc ?? {}) };
}

async function readAdrNumbers(adrDir) {
  const path = join(ROOT, adrDir);
  if (!existsSync(path)) return new Set();
  const entries = await readdir(path);
  const out = new Set();
  for (const f of entries) {
    const m = f.match(/^(\d{4})-/);
    if (m) out.add(parseInt(m[1], 10));
  }
  return out;
}

async function main() {
  const config = await loadConfig();
  const rfcPath = join(ROOT, config.rfcDir);
  if (!existsSync(rfcPath)) {
    console.warn("rfc: directory not found; that's fine if you have no RFCs yet.");
    return 0;
  }

  const adrNumbers = await readAdrNumbers(config.adrDir);
  const entries = await readdir(rfcPath);
  const rfcFiles = entries.filter((f) => /^\d{4}-.+\.md$/.test(f)).sort();

  if (rfcFiles.length === 0) {
    console.log("rfc: no RFC files. OK.");
    return 0;
  }

  const failures = [];
  const numbers = new Set();

  for (const file of rfcFiles) {
    const m = file.match(/^(\d{4})-/);
    if (!m) continue;
    const num = parseInt(m[1], 10);
    if (numbers.has(num)) {
      failures.push(`✗ ${file} — duplicate RFC number ${m[1]}`);
      continue;
    }
    numbers.add(num);

    const content = await readFile(join(rfcPath, file), "utf8");
    const statusMatch = content.match(/^\*?\*?-?\s*\*?\*?Status:?\*?\*?\s*([^\n]+)/m);
    const status = statusMatch ? statusMatch[1].trim() : null;
    if (!status) {
      failures.push(`✗ ${file} — missing Status field`);
      continue;
    }
    const baseStatus = status.split(/[;,]/)[0].trim();
    if (!config.validStatuses.includes(baseStatus)) {
      failures.push(`✗ ${file} — invalid Status "${baseStatus}" (allowed: ${config.validStatuses.join(", ")})`);
    }

    // Accepted RFC must reference a promoted ADR.
    if (/Accepted/.test(status)) {
      const promoteMatch = content.match(/Promotes? to ADR[-\s]?(\d{4})/i) || content.match(/ADR-(\d{4})/);
      if (!promoteMatch) {
        failures.push(`✗ ${file} — Accepted RFC without ADR promotion reference`);
      } else {
        const adrNum = parseInt(promoteMatch[1], 10);
        if (!adrNumbers.has(adrNum)) {
          failures.push(`✗ ${file} — references ADR-${promoteMatch[1]} but that ADR does not exist`);
        }
      }
    }
  }

  if (failures.length === 0) {
    console.log(`rfc: OK. ${rfcFiles.length} RFC(s); linkage intact.`);
    return 0;
  }
  for (const f of failures) console.error(f);
  console.error(`\nrfc: ${failures.length} integrity issue(s).`);
  return 1;
}

const code = await main();
process.exit(code);
