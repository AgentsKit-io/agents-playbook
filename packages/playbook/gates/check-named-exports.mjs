#!/usr/bin/env node
// Reference: ban `export default` outside framework-mandated files.
//
// Use ESLint's `import/no-default-export` for production. This script is a
// fast pre-commit alternative when ESLint is too slow or unavailable.
//
// Config: .quality-gates.json { gates: { "named-exports": { exempt: ["apps/web/app/**/page.tsx", ...] } } }

import { readFile, readdir } from "node:fs/promises";
import { resolve, relative, join, sep } from "node:path";
import { existsSync } from "node:fs";

const ROOT = resolve(process.cwd());

const DEFAULT_CONFIG = {
  scan: ["src", "packages", "apps"],
  ignore: ["node_modules", "dist", "build", ".next", ".turbo", "coverage"],
  exempt: [
    // Next.js App Router framework requirements
    /apps\/web\/app\/.*\/(page|layout|loading|error|not-found|template|default|head)\.tsx?$/,
    /apps\/web\/app\/.*\/route\.ts$/,
    // Config files
    /\/(tailwind|next|vitest|vite|playwright|jest|webpack|rollup|tsup|drizzle)\.config\.(c?[jt]s|mjs)$/,
    // MDX / docs
    /\.mdx?$/,
  ],
};

async function loadConfig() {
  const path = join(ROOT, ".quality-gates.json");
  if (!existsSync(path)) return DEFAULT_CONFIG;
  const raw = JSON.parse(await readFile(path, "utf8"));
  const userExempt = (raw?.gates?.["named-exports"]?.exempt ?? []).map((s) => new RegExp(s));
  return {
    ...DEFAULT_CONFIG,
    ...raw?.gates?.["named-exports"],
    exempt: [...DEFAULT_CONFIG.exempt, ...userExempt],
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

function isExempt(file, exempt) {
  return exempt.some((re) => re.test(file));
}

function findDefaultExports(content) {
  // Matches: `export default ...`, with optional comment escape hatch.
  const lines = content.split("\n");
  const hits = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^\s*export\s+default\s/.test(line) || /^\s*export\s*\{[^}]*\bdefault\b[^}]*\}/.test(line)) {
      // Escape hatch: `// allow-default-export: <reason>` on previous line.
      const prev = i > 0 ? lines[i - 1] : "";
      if (/\/\/\s*allow-default-export:/.test(prev)) continue;
      hits.push(i + 1);
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
      const rel = relative(ROOT, file).split(sep).join("/");
      if (isExempt(rel, config.exempt)) continue;
      const content = await readFile(file, "utf8");
      const hits = findDefaultExports(content);
      for (const line of hits) {
        failures.push({ file: rel, line });
      }
    }
  }

  if (failures.length === 0) {
    console.log("named-exports: OK.");
    return 0;
  }

  for (const f of failures) {
    console.error(`✗ ${f.file}:${f.line} — default export. Use a named export: export function X() {} / export const X = ...`);
    console.error(`  Escape hatch: prefix with // allow-default-export: <reason> if framework-required.`);
  }
  console.error(`\nnamed-exports: ${failures.length} violation(s).`);
  return 1;
}

const code = await main();
process.exit(code);
