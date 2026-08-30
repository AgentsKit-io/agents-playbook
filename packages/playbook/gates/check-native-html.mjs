#!/usr/bin/env node
// Reference: ban native HTML interactive elements in shipped surfaces.
// Use shared primitives instead (Button, Input, Select, Dialog, Form, Table, Link).

import { readFile, readdir } from "node:fs/promises";
import { resolve, relative, join, sep } from "node:path";
import { existsSync } from "node:fs";

const ROOT = resolve(process.cwd());

const DEFAULT_CONFIG = {
  scan: ["packages", "apps"],
  ignore: ["node_modules", "dist", "build", ".next", ".turbo", "coverage", "__snapshots__"],
  // Restrict to "shipped surfaces" — adjust per your repo conventions.
  surfaceMarkers: ["/screens/", "/components/", "/pages/", "/app/"],
  // Native elements forbidden in shipped surfaces.
  forbidden: ["button", "input", "select", "textarea", "dialog", "form", "table", "a"],
  allowHatch: /\/\/\s*allow-native:/,
  // Files known to legitimately use native HTML.
  exempt: [
    /\.stories\.(t|j)sx?$/,
    /__tests__\//,
    /\.test\.(t|j)sx?$/,
    /\.mdx?$/,
    // The UI primitives package itself must use native HTML under the hood.
    // Adjust this regex to match your primitives package path.
    /packages\/ui\//,
  ],
};

async function loadConfig() {
  const path = join(ROOT, ".quality-gates.json");
  if (!existsSync(path)) return DEFAULT_CONFIG;
  const raw = JSON.parse(await readFile(path, "utf8"));
  const user = raw?.gates?.["native-html"] ?? {};
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
    else if (/\.(t|j)sx$/.test(e.name)) yield full;
  }
}

function inSurface(file, markers) {
  return markers.some((m) => file.includes(m));
}

function isExempt(file, exempt) {
  return exempt.some((re) => re.test(file));
}

function findNative(content, forbidden, allowHatch) {
  const hits = [];
  const lines = content.split("\n");
  const tagPattern = new RegExp(`<(${forbidden.join("|")})(\\s|>|/)`, "g");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (allowHatch.test(line)) continue;
    for (const m of line.matchAll(tagPattern)) {
      // Skip <a> without href (likely a navigational anchor) — heuristic.
      if (m[1] === "a" && !/<a\s[^>]*\bhref=/.test(line)) continue;
      hits.push({ line: i + 1, tag: m[1] });
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
      if (!inSurface(rel, config.surfaceMarkers)) continue;
      if (isExempt(rel, config.exempt)) continue;
      const content = await readFile(file, "utf8");
      const hits = findNative(content, config.forbidden, config.allowHatch);
      for (const h of hits) failures.push({ file: rel, ...h });
    }
  }

  if (failures.length === 0) {
    console.log("native-html: OK.");
    return 0;
  }

  for (const f of failures) {
    console.error(`✗ ${f.file}:${f.line} — native <${f.tag}>. Use the shared primitive (Button / Input / Select / Dialog / Form / Table / Link).`);
  }
  console.error(`\nnative-html: ${failures.length} violation(s).`);
  console.error(`  Escape hatch: // allow-native: <reason> on the same line.`);
  return 1;
}

const code = await main();
process.exit(code);
