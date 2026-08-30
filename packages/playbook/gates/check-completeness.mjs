#!/usr/bin/env node
// Reference: scan shipped surfaces for completeness violations — TODO, FIXME,
// `throw new Error("not implemented")`, `disabled: true` tabs, empty exported
// component bodies.

import { readFile, readdir } from "node:fs/promises";
import { resolve, relative, join, sep } from "node:path";
import { existsSync } from "node:fs";

const ROOT = resolve(process.cwd());

const DEFAULT_CONFIG = {
  scan: ["packages", "apps"],
  ignore: ["node_modules", "dist", "build", ".next", ".turbo", "coverage", "__snapshots__"],
  surfaceMarkers: ["/screens/", "/components/", "/pages/", "/app/", "/api/", "/methods/", "/handlers/"],
  exempt: [
    /\.test\.(t|j)sx?$/,
    /__tests__\//,
    /__fixtures__\//,
    /\.stories\.(t|j)sx?$/,
    /\.mdx?$/,
  ],
  allowHatch: /\/\/\s*allow-incomplete:/,
};

const PATTERNS = [
  { re: /\bTODO\b/g, name: "TODO marker" },
  { re: /\bFIXME\b/g, name: "FIXME marker" },
  { re: /\bXXX\b/g, name: "XXX marker" },
  { re: /\bHACK\b/g, name: "HACK marker" },
  { re: /throw\s+new\s+Error\s*\(\s*['"`]not\s+implemented['"`]/gi, name: "not-implemented throw" },
  { re: /throw\s+new\s+Error\s*\(\s*['"`]unimplemented['"`]/gi, name: "unimplemented throw" },
  { re: /disabled\s*:\s*true/g, name: "disabled:true (likely a nav/tab kill-switch)" },
];

async function loadConfig() {
  const path = join(ROOT, ".quality-gates.json");
  if (!existsSync(path)) return DEFAULT_CONFIG;
  const raw = JSON.parse(await readFile(path, "utf8"));
  const user = raw?.gates?.completeness ?? {};
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
    else if (/\.(t|j)sx?$/.test(e.name)) yield full;
  }
}

function inSurface(file, markers) {
  return markers.some((m) => file.includes(m));
}

function isExempt(file, exempt) {
  return exempt.some((re) => re.test(file));
}

function scan(content, allowHatch) {
  const hits = [];
  const lines = content.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (allowHatch.test(line)) continue;
    for (const p of PATTERNS) {
      for (const m of line.matchAll(p.re)) {
        hits.push({ line: i + 1, kind: p.name, col: m.index + 1 });
      }
    }
  }
  // Empty exported component body (heuristic).
  const emptyBody = /export\s+(?:async\s+)?function\s+[A-Z][A-Za-z0-9_]*\s*\([^)]*\)\s*\{\s*\}/g;
  for (const m of content.matchAll(emptyBody)) {
    // Compute line number of the match.
    const before = content.slice(0, m.index);
    const line = before.split("\n").length;
    hits.push({ line, kind: "empty exported component body", col: 1 });
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
      const rel = relative(ROOT, file).split(sep).join("/");
      if (!inSurface(rel, config.surfaceMarkers)) continue;
      if (isExempt(rel, config.exempt)) continue;
      const content = await readFile(file, "utf8");
      const hits = scan(content, config.allowHatch);
      for (const h of hits) failures.push({ file: rel, ...h });
    }
  }

  if (failures.length === 0) {
    console.log("completeness: OK.");
    return 0;
  }

  for (const f of failures) {
    console.error(`✗ ${f.file}:${f.line}:${f.col} — ${f.kind}. Ship complete or do not ship; gate out the feature flag if not ready.`);
  }
  console.error(`\ncompleteness: ${failures.length} violation(s).`);
  console.error(`  Escape hatch (with tracked issue + target release): // allow-incomplete: <issue#>.`);
  return 1;
}

const code = await main();
process.exit(code);
