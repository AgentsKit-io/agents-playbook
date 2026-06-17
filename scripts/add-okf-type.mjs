#!/usr/bin/env node
/**
 * Open Knowledge Format (OKF) typing pass.
 *
 * OKF (https://github.com/GoogleCloudPlatform/knowledge-catalog/tree/main/okf)
 * requires exactly one frontmatter field — `type` — on every document. This
 * script walks content/docs and inserts a `type:` derived from the file's path
 * into any doc that doesn't already have one. Idempotent: re-running only
 * touches docs that are still untyped, so it's safe to run after new docs land.
 *
 * Run: node scripts/add-okf-type.mjs   (add --check to fail if any doc is untyped)
 */
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const DOCS = join(ROOT, "content/docs");

/** Map a doc's path (relative to content/docs) to its OKF `type`. */
function typeFor(rel) {
  const base = rel.split("/").pop();
  const isIndex = base === "index.md" || base === "index.mdx";

  if (rel === "index.mdx") return "Index";
  if (rel === "getting-started.mdx" || rel === "onboard-your-agent.md") return "Guide";
  if (rel === "matrix.md" || rel === "glossary.md") return "Reference";

  if (rel.startsWith("pillars/")) return isIndex ? "Pillar" : "Playbook Pattern";
  if (rel.startsWith("phases/")) return "SDLC Phase";
  if (rel.startsWith("templates/")) return isIndex ? "Index" : "Template";
  if (rel.startsWith("scripts/")) return "Index";
  if (rel.startsWith("prompts/")) {
    if (isIndex) return "Index";
    if (base.startsWith("system-")) return "System Prompt";
    if (base.startsWith("subagent-")) return "Sub-agent Recipe";
    if (base.startsWith("slash-")) return "Slash Command";
    return "Prompt";
  }
  return "Document";
}

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else if (/\.mdx?$/.test(entry.name)) yield full;
  }
}

const check = process.argv.includes("--check");
let changed = 0;
const untyped = [];

for await (const file of walk(DOCS)) {
  const rel = relative(DOCS, file);
  const src = await readFile(file, "utf8");

  const m = src.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!m) {
    untyped.push(`${rel} (no frontmatter)`);
    continue;
  }
  if (/^type:\s*/m.test(m[1])) continue; // already typed

  untyped.push(rel);
  if (check) continue;

  const type = typeFor(rel);
  const next = src.replace(/^---\s*\n/, `---\ntype: ${type}\n`);
  await writeFile(file, next);
  changed++;
  console.log(`+ ${rel} → type: ${type}`);
}

if (check) {
  if (untyped.length) {
    console.error(`OKF: ${untyped.length} doc(s) missing \`type\`:\n  ${untyped.join("\n  ")}`);
    process.exit(1);
  }
  console.log("OKF: every doc has a `type`.");
} else {
  console.log(`OKF: typed ${changed} doc(s).`);
}
