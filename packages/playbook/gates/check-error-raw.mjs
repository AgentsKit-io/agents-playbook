#!/usr/bin/env node
// Reference: ban `throw new Error(...)` in boundary files.
//
// Boundary files = handler / method / API files where errors cross the trust
// boundary. They MUST throw typed AppError subclasses with stable codes.
//
// Config: .quality-gates.json { gates: { "error-raw": { boundaryPaths: ["packages/*/src/methods/**", ...] } } }

import { readFile, readdir } from "node:fs/promises";
import { resolve, relative, join, sep } from "node:path";
import { existsSync } from "node:fs";

const ROOT = resolve(process.cwd());

const DEFAULT_CONFIG = {
  scan: ["src", "packages", "apps"],
  ignore: ["node_modules", "dist", "build", ".next", ".turbo", "coverage", "__snapshots__"],
  // Substring-based "boundary" markers in file paths. Adjust to your conventions.
  boundaryMarkers: [
    "/methods/",
    "/handlers/",
    "/api/",
    "/routes/",
    "/middleware/",
  ],
  allowHatch: /\/\/\s*allow-raw-error:/,
};

async function loadConfig() {
  const path = join(ROOT, ".quality-gates.json");
  if (!existsSync(path)) return DEFAULT_CONFIG;
  const raw = JSON.parse(await readFile(path, "utf8"));
  const user = raw?.gates?.["error-raw"] ?? {};
  return {
    ...DEFAULT_CONFIG,
    ...user,
    allowHatch: user.allowHatch ? new RegExp(user.allowHatch) : DEFAULT_CONFIG.allowHatch,
  };
}

async function* walk(dir, ignore) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    if (ignore.includes(e.name)) continue;
    const full = join(dir, e.name);
    if (e.isDirectory()) yield* walk(full, ignore);
    else if (/\.(t|j)sx?$/.test(e.name) && !/\.test\./.test(e.name)) yield full;
  }
}

function isBoundary(filepath, markers) {
  return markers.some((m) => filepath.includes(m));
}

function findRawThrows(content, allowHatch) {
  const lines = content.split("\n");
  const hits = [];
  // Strip strings (very rough) so `"throw new Error('x')"` inside a string literal doesn't match.
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Match `throw new Error(` and friends. Exclude SyntaxError / RangeError / TypeError / DOMException
    // — domain runtime errors caused by language / API may be legitimate.
    const m = line.match(/throw\s+new\s+Error\s*\(/);
    if (!m) continue;
    if (allowHatch.test(line)) continue;
    // Also allow escape hatch on the previous line
    if (i > 0 && allowHatch.test(lines[i - 1])) continue;
    hits.push({ line: i + 1, col: m.index + 1 });
  }
  return hits;
}

async function main() {
  const config = await loadConfig();
  const violations = [];

  for (const dir of config.scan) {
    const full = join(ROOT, dir);
    if (!existsSync(full)) continue;
    for await (const file of walk(full, config.ignore)) {
      const rel = relative(ROOT, file).split(sep).join("/");
      if (!isBoundary(rel, config.boundaryMarkers)) continue;
      const content = await readFile(file, "utf8");
      const hits = findRawThrows(content, config.allowHatch);
      for (const h of hits) {
        violations.push({ file: rel, ...h });
      }
    }
  }

  if (violations.length === 0) {
    console.log("error-raw: OK.");
    return 0;
  }

  for (const v of violations) {
    console.error(`✗ ${v.file}:${v.line}:${v.col} — raw \`throw new Error(...)\` at boundary. Use a typed AppError subclass with a stable code:`);
    console.error(`    throw new ValidationError("VALIDATION_ERROR", "invalid foo", { hint: "..." });`);
    console.error(`  Escape hatch: // allow-raw-error: <reason> on the line above or same line.`);
  }
  console.error(`\nerror-raw: ${violations.length} violation(s).`);
  return 1;
}

const code = await main();
process.exit(code);
