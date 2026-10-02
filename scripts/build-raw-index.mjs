#!/usr/bin/env node
// Bundles content/docs (*.md, *.mdx, *.mjs) into lib/raw-index.generated.json so the
// /raw/<path> route can answer without a filesystem (Cloudflare Workers via OpenNext).
// On Vercel the route still reads the files directly; this index is the fallback.
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { relativePosix } from "@agentskit/cross-platform";

const ROOT = join(process.cwd(), "content", "docs");
const OUT = join(process.cwd(), "lib", "raw-index.generated.json");
const files = {};
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full);
    else if (/\.(mdx?|mjs)$/.test(name)) files[relativePosix(ROOT, full)] = readFileSync(full, "utf8");
  }
};
walk(ROOT);
writeFileSync(OUT, JSON.stringify(files));
console.log(`raw index: ${Object.keys(files).length} files → ${relative(process.cwd(), OUT)}`);
