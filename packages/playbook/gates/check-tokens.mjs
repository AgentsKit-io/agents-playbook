#!/usr/bin/env node
// Reference: ban raw color literals (hex / rgb / hsl / oklch), Tailwind arbitrary
// color/spacing class values (bg-[#fff]), and inline color/spacing styles in JSX.

import { readFile, readdir } from "node:fs/promises";
import { resolve, relative, join, sep } from "node:path";
import { existsSync } from "node:fs";

const ROOT = resolve(process.cwd());

const DEFAULT_CONFIG = {
  scan: ["src", "packages", "apps"],
  ignore: ["node_modules", "dist", "build", ".next", ".turbo", "coverage", "__snapshots__"],
  exempt: [
    /tokens\.css$/,
    /tailwind\.config\./,
    /brand-kit.*\.(json|ts)$/,
  ],
  allowHatch: /\/\/\s*allow-color-literal:/,
};

const HEX_RE = /(#[0-9a-fA-F]{3,8})\b/g;
const COLOR_FN_RE = /\b(rgba?|hsla?|oklch|oklab|lab|lch|color)\s*\(/g;
const ARBITRARY_CLASS_RE = /\b(?:bg|text|border|ring|fill|stroke|p|m|w|h|gap|rounded)-\[[^\]]*(#|rgb|hsl|oklch)[^\]]*\]/g;
const INLINE_STYLE_RE = /style\s*=\s*\{\{[^}]*\b(color|background(Color)?|borderColor|fill|stroke)\s*:\s*['"]/g;

async function loadConfig() {
  const path = join(ROOT, ".quality-gates.json");
  if (!existsSync(path)) return DEFAULT_CONFIG;
  const raw = JSON.parse(await readFile(path, "utf8"));
  const user = raw?.gates?.tokens ?? {};
  return {
    ...DEFAULT_CONFIG,
    ...user,
    exempt: user.exempt?.map((value) => new RegExp(value)) ?? DEFAULT_CONFIG.exempt,
    allowHatch: user.allowHatch ? new RegExp(user.allowHatch) : DEFAULT_CONFIG.allowHatch,
  };
}

async function* walk(dir, ignore) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    if (ignore.includes(e.name)) continue;
    const full = join(dir, e.name);
    if (e.isDirectory()) yield* walk(full, ignore);
    else if (/\.(t|j)sx?$|\.css$|\.scss$/.test(e.name)) yield full;
  }
}

function isExempt(file, exempt) {
  return exempt.some((re) => re.test(file));
}

function scanLine(line) {
  const hits = [];
  for (const m of line.matchAll(HEX_RE)) {
    if (m[1].length < 4) continue;
    hits.push({ kind: "hex", token: m[1] });
  }
  for (const m of line.matchAll(COLOR_FN_RE)) {
    hits.push({ kind: `${m[1]}()`, token: m[0] });
  }
  for (const m of line.matchAll(ARBITRARY_CLASS_RE)) {
    hits.push({ kind: "arbitrary-class", token: m[0] });
  }
  for (const m of line.matchAll(INLINE_STYLE_RE)) {
    hits.push({ kind: "inline-style", token: m[0] });
  }
  return hits;
}

function scan(content, allowHatch) {
  const out = [];
  const lines = content.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (allowHatch.test(line)) continue;
    const hits = scanLine(line);
    for (const h of hits) out.push({ line: i + 1, ...h });
  }
  return out;
}

async function main() {
  const config = await loadConfig();
  const failures = [];
  for (const dir of config.scan) {
    const full = join(ROOT, dir);
    if (!existsSync(full)) continue;
    for await (const file of walk(full, config.ignore)) {
      const rel = relative(ROOT, file).split(sep).join("/");
      if (isExempt(rel, config.exempt)) continue;
      const content = await readFile(file, "utf8");
      const hits = scan(content, config.allowHatch);
      for (const h of hits) failures.push({ file: rel, ...h });
    }
  }

  if (failures.length === 0) {
    console.log("tokens: OK.");
    return 0;
  }

  for (const f of failures) {
    console.error(`✗ ${f.file}:${f.line} — ${f.kind} (${f.token}). Use a design token: var(--surface-1), bg-surface-1, etc.`);
  }
  console.error(`\ntokens: ${failures.length} violation(s).`);
  console.error(`  Escape hatch: // allow-color-literal: <reason> on the same line.`);
  return 1;
}

const code = await main();
process.exit(code);
