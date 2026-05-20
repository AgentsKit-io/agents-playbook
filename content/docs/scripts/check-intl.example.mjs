#!/usr/bin/env node
// Reference: detect hardcoded user-visible strings in JSX (text content + a11y attributes).
//
// Strict AST-based detection lives in ESLint. This script is a fast pre-commit
// approximation using line-level regexes — good signal-to-noise on most repos.

import { readFile, readdir } from "node:fs/promises";
import { resolve, relative, join } from "node:path";
import { existsSync } from "node:fs";

const ROOT = resolve(process.cwd());

const DEFAULT_CONFIG = {
  scan: ["packages", "apps"],
  ignore: ["node_modules", "dist", "build", ".next", ".turbo", "coverage", "__snapshots__"],
  surfaceMarkers: ["/screens/", "/components/", "/pages/", "/app/"],
  exempt: [
    /\.stories\.(t|j)sx?$/,
    /__tests__\//,
    /\.test\.(t|j)sx?$/,
    /\.mdx?$/,
  ],
  allowHatch: /\/\/\s*allow-hardcoded:/,
  // Allowed brand tokens (typically product / company name).
  brandAllowlist: [],
  // Allowed tags whose text content is technical, not user-visible.
  technicalTags: ["code", "pre", "kbd", "samp", "var"],
};

async function loadConfig() {
  const path = join(ROOT, ".quality-gates.json");
  if (!existsSync(path)) return DEFAULT_CONFIG;
  const raw = JSON.parse(await readFile(path, "utf8"));
  return { ...DEFAULT_CONFIG, ...(raw?.gates?.intl ?? {}) };
}

async function* walk(dir, ignore) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    if (ignore.includes(e.name)) continue;
    const full = join(dir, e.name);
    if (e.isDirectory()) yield* walk(full, ignore);
    else if (/\.(t|j)sx$/.test(e.name)) yield full;
  }
}

function inSurface(file, markers) {
  return markers.some((m) => file.includes(m));
}

function isExempt(file, exempt) {
  return exempt.some((re) => re.test(file));
}

// JSX text content with letters between `>` and `<` (rough).
const JSX_TEXT_RE = />[^<>{}\n]*[A-Za-z][A-Za-z\s,.!?:;/'-]*</g;
// Hardcoded a11y / placeholder / alt attribute.
const A11Y_ATTR_RE = /\b(aria-label|aria-description|title|placeholder|alt)\s*=\s*['"]([^'"]+)['"]/g;

function isAllowedText(text, brandAllowlist) {
  const trimmed = text.replace(/^>|<$/g, "").trim();
  if (trimmed.length === 0) return true;
  if (brandAllowlist.includes(trimmed)) return true;
  // Pure punctuation or numbers
  if (!/[A-Za-z]{2,}/.test(trimmed)) return true;
  // JS-looking expressions (only happens if regex over-matched)
  if (/^\{/.test(trimmed)) return true;
  return false;
}

function scan(content, config) {
  const hits = [];
  const lines = content.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (config.allowHatch.test(line)) continue;
    // Skip lines that are inside a technical-tag context. Heuristic only.
    const isTechnical = config.technicalTags.some((tag) => new RegExp(`<${tag}[\\s>]`).test(line));
    if (!isTechnical) {
      for (const m of line.matchAll(JSX_TEXT_RE)) {
        if (isAllowedText(m[0], config.brandAllowlist)) continue;
        hits.push({ line: i + 1, kind: "jsx-text", token: m[0].slice(0, 60) });
      }
    }
    for (const m of line.matchAll(A11Y_ATTR_RE)) {
      if (config.brandAllowlist.includes(m[2])) continue;
      if (m[2].length === 0) continue;
      hits.push({ line: i + 1, kind: m[1], token: m[2] });
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
      if (!inSurface(rel, config.surfaceMarkers)) continue;
      if (isExempt(rel, config.exempt)) continue;
      const content = await readFile(file, "utf8");
      const hits = scan(content, config);
      for (const h of hits) failures.push({ file: rel, ...h });
    }
  }

  if (failures.length === 0) {
    console.log("intl: OK.");
    return 0;
  }

  for (const f of failures) {
    console.error(`✗ ${f.file}:${f.line} — hardcoded ${f.kind}: "${f.token}". Replace with t("<key>") and add the key to locales/.`);
  }
  console.error(`\nintl: ${failures.length} violation(s).`);
  console.error(`  Escape hatch: // allow-hardcoded: <reason> on the same line.`);
  return 1;
}

const code = await main();
process.exit(code);
