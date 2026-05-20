#!/usr/bin/env node
// Reference: scan for high-entropy strings, PEM blocks, and known API-key prefixes
// outside an explicit allow-list.
//
// First-line defense; pair with a vault for secret storage and a logger
// redactor for runtime protection.

import { readFile, readdir } from "node:fs/promises";
import { resolve, relative, join } from "node:path";
import { existsSync } from "node:fs";

const ROOT = resolve(process.cwd());

const DEFAULT_CONFIG = {
  scan: ["src", "packages", "apps", "scripts", ".github"],
  ignore: ["node_modules", "dist", "build", ".next", ".turbo", "coverage", "__snapshots__"],
  allowFiles: [
    /\.lock$/,
    /package-lock\.json$/,
    /pnpm-lock\.yaml$/,
    /yarn\.lock$/,
    /\.env\.example$/,
    /\.test\./,
    /__tests__/,
    /__fixtures__/,
  ],
  allowHatch: /\/\/\s*allow-secret:|#\s*allow-secret:/,
};

// Well-known prefixes / patterns. Add per project.
const PATTERNS = [
  { re: /-----BEGIN (RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY-----/g, name: "PEM private key" },
  { re: /\bsk_(live|test)_[A-Za-z0-9]{20,}/g, name: "Stripe secret key" },
  { re: /\bxox[abps]-[A-Za-z0-9-]{10,}/g, name: "Slack token" },
  { re: /\bAKIA[0-9A-Z]{16}\b/g, name: "AWS access key id" },
  { re: /\bASIA[0-9A-Z]{16}\b/g, name: "AWS STS access key id" },
  { re: /\bAIza[0-9A-Za-z_-]{35}\b/g, name: "Google API key" },
  { re: /\bya29\.[0-9A-Za-z_-]+/g, name: "Google OAuth token" },
  { re: /\bgh[pousr]_[A-Za-z0-9]{36,}/g, name: "GitHub token" },
  { re: /\beyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/g, name: "JWT (likely)" },
  { re: /\b[A-Za-z0-9+/]{40,}={0,2}\b/g, name: "high-entropy base64 (≥ 40 chars)" }, // noisy; tune threshold
];

async function loadConfig() {
  const path = join(ROOT, ".quality-gates.json");
  if (!existsSync(path)) return DEFAULT_CONFIG;
  const raw = JSON.parse(await readFile(path, "utf8"));
  return { ...DEFAULT_CONFIG, ...(raw?.gates?.secrets ?? {}) };
}

async function* walk(dir, ignore) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    if (ignore.includes(e.name)) continue;
    if (e.name.startsWith(".") && !["github"].includes(e.name.slice(1))) continue;
    const full = join(dir, e.name);
    if (e.isDirectory()) yield* walk(full, ignore);
    else yield full;
  }
}

function isAllowFile(file, allow) {
  return allow.some((re) => re.test(file));
}

// Shannon entropy — used as a sanity gate for the noisy base64 pattern.
function entropy(s) {
  const counts = {};
  for (const c of s) counts[c] = (counts[c] ?? 0) + 1;
  let h = 0;
  for (const c in counts) {
    const p = counts[c] / s.length;
    h -= p * Math.log2(p);
  }
  return h;
}

function findSecrets(content, allowHatch) {
  const hits = [];
  const lines = content.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (allowHatch.test(line)) continue;
    for (const p of PATTERNS) {
      for (const m of line.matchAll(p.re)) {
        // Tune the noisy entropy pattern.
        if (p.name.startsWith("high-entropy") && entropy(m[0]) < 4.5) continue;
        hits.push({ line: i + 1, name: p.name, token: m[0].slice(0, 40) + (m[0].length > 40 ? "…" : "") });
      }
    }
  }
  return hits;
}

async function main() {
  const config = await loadConfig();
  const failures = [];
  for (const dir of config.scan) {
    const full = join(ROOT, dir);
    if (!existsSync(full)) continue;
    for await (const file of walk(full, config.ignore)) {
      const rel = relative(ROOT, file);
      if (isAllowFile(rel, config.allowFiles)) continue;
      let content;
      try {
        content = await readFile(file, "utf8");
      } catch {
        continue; // binary
      }
      const hits = findSecrets(content, config.allowHatch);
      for (const h of hits) failures.push({ file: rel, ...h });
    }
  }

  if (failures.length === 0) {
    console.log("secrets: OK.");
    return 0;
  }

  for (const f of failures) {
    console.error(`✗ ${f.file}:${f.line} — likely ${f.name}: ${f.token}. Replace with a vault reference; never commit raw secrets.`);
  }
  console.error(`\nsecrets: ${failures.length} suspect string(s).`);
  console.error(`  Escape hatch (test fixtures only): // allow-secret: <reason> on the same line.`);
  console.error(`  Allow file: add a regex to .quality-gates.json gates.secrets.allowFiles.`);
  return 1;
}

const code = await main();
process.exit(code);
