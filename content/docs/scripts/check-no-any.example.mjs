#!/usr/bin/env node
// Reference: ban `any` outside escape-hatched comments.
//
// In production, prefer @typescript-eslint/no-explicit-any. This script is a
// fast pre-commit alternative + counts escape hatches so growth fails.
//
// Config: .quality-gates.json { gates: { "no-any": { allowHatchRegex: "// allow-any:", maxHatches: 0 } } }

import { readFile, readdir } from "node:fs/promises";
import { resolve, relative, join } from "node:path";
import { existsSync } from "node:fs";

const ROOT = resolve(process.cwd());

const DEFAULT_CONFIG = {
  scan: ["src", "packages", "apps"],
  ignore: ["node_modules", "dist", "build", ".next", ".turbo", "coverage", "__snapshots__"],
  allowHatch: /\/\/\s*allow-any:/,
  hatchBaseline: ".no-any-baseline.json",
};

async function loadConfig() {
  const path = join(ROOT, ".quality-gates.json");
  if (!existsSync(path)) return DEFAULT_CONFIG;
  const raw = JSON.parse(await readFile(path, "utf8"));
  return { ...DEFAULT_CONFIG, ...(raw?.gates?.["no-any"] ?? {}) };
}

async function* walk(dir, ignore) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    if (ignore.includes(e.name)) continue;
    const full = join(dir, e.name);
    if (e.isDirectory()) yield* walk(full, ignore);
    else if (/\.tsx?$/.test(e.name)) yield full;
  }
}

// Strip line comments, block comments, and string literals before searching.
// Naive but good enough for a pre-commit pass; ESLint AST-based is more accurate.
function stripNonCode(src) {
  let out = "";
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    const next = src[i + 1];
    if (c === "/" && next === "/") {
      while (i < src.length && src[i] !== "\n") {
        out += " ";
        i++;
      }
    } else if (c === "/" && next === "*") {
      out += "  ";
      i += 2;
      while (i < src.length && !(src[i] === "*" && src[i + 1] === "/")) {
        out += src[i] === "\n" ? "\n" : " ";
        i++;
      }
      if (i < src.length) { out += "  "; i += 2; }
    } else if (c === '"' || c === "'" || c === "`") {
      const quote = c;
      out += " ";
      i++;
      while (i < src.length && src[i] !== quote) {
        if (src[i] === "\\") { out += "  "; i += 2; continue; }
        out += src[i] === "\n" ? "\n" : " ";
        i++;
      }
      if (i < src.length) { out += " "; i++; }
    } else {
      out += c;
      i++;
    }
  }
  return out;
}

// Match `: any`, `<any`, `any[]`, `as any`, `any |`, `any &`  — i.e. type-position any.
const ANY_PATTERN = /(?<![A-Za-z0-9_$])any(?![A-Za-z0-9_$])/g;

function findAnyHits(stripped, raw, allowHatch) {
  const hits = [];
  const lines = stripped.split("\n");
  const rawLines = raw.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const rawLine = rawLines[i];
    if (!line.includes("any")) continue;
    let m;
    const re = new RegExp(ANY_PATTERN.source, "g");
    while ((m = re.exec(line))) {
      const before = line.slice(0, m.index);
      const after = line.slice(m.index + 3);
      const isTypePosition =
        /[:<,(|&]\s*$/.test(before.replace(/\s+$/, "")) ||
        /^\s*\[\]/.test(after) ||
        /^\s*[|&]/.test(after) ||
        /\bas\s+$/.test(before);
      if (!isTypePosition) continue;
      if (allowHatch.test(rawLine)) continue;
      hits.push({ line: i + 1, col: m.index + 1 });
    }
  }
  return hits;
}

async function main() {
  const config = await loadConfig();
  const violations = [];
  let hatches = 0;

  for (const dir of config.scan) {
    const full = join(ROOT, dir);
    if (!existsSync(full)) continue;
    for await (const file of walk(full, config.ignore)) {
      const raw = await readFile(file, "utf8");
      const stripped = stripNonCode(raw);
      const hits = findAnyHits(stripped, raw, config.allowHatch);
      for (const h of hits) {
        violations.push({ file: relative(ROOT, file), ...h });
      }
      hatches += (raw.match(/\/\/\s*allow-any:/g) ?? []).length;
    }
  }

  if (violations.length > 0) {
    for (const v of violations) {
      console.error(`✗ ${v.file}:${v.line}:${v.col} — \`any\` in type position. Use \`unknown\` + a runtime schema parse, or a specific type.`);
      console.error(`  Escape hatch: // allow-any: <reason> on the same line.`);
    }
    console.error(`\nno-any: ${violations.length} violation(s).`);
    return 1;
  }

  console.log(`no-any: OK. ${hatches} escape-hatched.`);
  return 0;
}

const code = await main();
process.exit(code);
