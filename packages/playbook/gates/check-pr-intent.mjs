#!/usr/bin/env node
// Reference: parse PR-intent manifest + cross-check against the diff.
//
// Reads the manifest from one of:
//   - `pr-intent.yaml` at repo root.
//   - PR description (when running in CI; pass via --description-file=<path>).
//
// Cross-checks:
//   - YAML is well-formed and has required fields.
//   - Every exported-symbol removal in the diff is listed in `removes:`.
//   - Every newly-exported symbol is in `adds:`.
//   - `merge-override:` annotation present if --theirs / --ours flags were used (heuristic).
//
// Usage:
//   node scripts/check-pr-intent.example.mjs                       # uses pr-intent.yaml
//   node scripts/check-pr-intent.example.mjs --description-file=PR # uses PR body file
//   node scripts/check-pr-intent.example.mjs --base=origin/main    # diff base

import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve, join } from "node:path";

const ROOT = resolve(process.cwd());

const ARGS = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.split("=");
    return [k.replace(/^--/, ""), v ?? true];
  })
);

const REQUIRED_FIELDS = ["summary", "pillar", "phase", "sub-unit", "type"];

// --- Minimal YAML subset parser (good enough for the manifest schema) ---
function parseManifestYaml(raw) {
  const lines = raw.split("\n");
  const stack = [{ indent: -1, obj: {} }];
  let currentList = null;

  for (const original of lines) {
    if (/^\s*#/.test(original) || !original.trim()) continue;
    const indent = original.length - original.trimStart().length;
    const line = original.trim();

    // pop stack to current indent
    while (stack.length > 1 && indent <= stack[stack.length - 1].indent) {
      stack.pop();
    }
    const parent = stack[stack.length - 1].obj;

    // List item
    if (line.startsWith("- ")) {
      const item = line.slice(2);
      if (!Array.isArray(currentList)) {
        throw new Error(`Unexpected list item: ${original}`);
      }
      if (item.includes(":")) {
        const subObj = {};
        const [k, ...rest] = item.split(":");
        subObj[k.trim()] = rest.join(":").trim() || null;
        currentList.push(subObj);
      } else {
        currentList.push(item);
      }
      continue;
    }

    // key: value or key: (start of nested)
    const colon = line.indexOf(":");
    if (colon === -1) continue;
    const key = line.slice(0, colon).trim();
    const value = line.slice(colon + 1).trim();

    if (value === "") {
      // Could be an object or a list — peek next non-empty line
      // For simplicity, assume list iff next non-empty line starts with `-`
      const idx = lines.indexOf(original);
      let nextNonEmpty;
      for (let j = idx + 1; j < lines.length; j++) {
        if (lines[j].trim() && !/^\s*#/.test(lines[j])) {
          nextNonEmpty = lines[j];
          break;
        }
      }
      if (nextNonEmpty && nextNonEmpty.trimStart().startsWith("- ")) {
        const list = [];
        parent[key] = list;
        currentList = list;
      } else {
        const obj = {};
        parent[key] = obj;
        stack.push({ indent, obj });
        currentList = null;
      }
    } else if (value.startsWith("|") || value.startsWith(">")) {
      // Block scalar — collect indented lines (simplified)
      const blockLines = [];
      const idx = lines.indexOf(original);
      for (let j = idx + 1; j < lines.length; j++) {
        const l = lines[j];
        const ind = l.length - l.trimStart().length;
        if (l.trim() === "") { blockLines.push(""); continue; }
        if (ind <= indent) break;
        blockLines.push(l.slice(indent + 2));
      }
      parent[key] = blockLines.join("\n").trim();
      currentList = null;
    } else {
      parent[key] = value.replace(/^["']|["']$/g, "");
      currentList = null;
    }
  }

  return stack[0].obj;
}

async function loadManifest() {
  if (ARGS["description-file"]) {
    const body = await readFile(ARGS["description-file"], "utf8");
    const match = body.match(/```yaml\s+([\s\S]*?)\s+```/);
    if (!match) throw new Error("No yaml block in PR description.");
    return parseManifestYaml(match[1]);
  }
  const path = join(ROOT, "pr-intent.yaml");
  if (!existsSync(path)) throw new Error("pr-intent.yaml not found at repo root.");
  return parseManifestYaml(await readFile(path, "utf8"));
}

function git(args) {
  const r = spawnSync("git", args, { encoding: "utf8" });
  if (r.status !== 0) throw new Error(`git ${args.join(" ")} failed: ${r.stderr}`);
  return r.stdout;
}

function getDiffStatus(base) {
  return git(["diff", "--name-status", `${base}...HEAD`]).trim().split("\n").filter(Boolean);
}

function getDiffContent(base) {
  return git(["diff", `${base}...HEAD`]);
}

// Heuristic export extraction: lines that match `export <kind> <name>`.
const EXPORT_RE = /^[+\-]\s*export\s+(?:async\s+)?(?:function|const|let|var|class|interface|type|enum)\s+([A-Za-z_$][A-Za-z0-9_$]*)/gm;

function extractAddedRemovedSymbols(diff) {
  const added = new Set();
  const removed = new Set();
  for (const line of diff.split("\n")) {
    const m = line.match(/^([+\-])\s*export\s+(?:async\s+)?(?:function|const|let|var|class|interface|type|enum)\s+([A-Za-z_$][A-Za-z0-9_$]*)/);
    if (!m) continue;
    if (m[1] === "+") added.add(m[2]);
    else removed.add(m[2]);
  }
  // Symbols that appear on both sides are edits, not adds/removes.
  for (const s of added) if (removed.has(s)) { added.delete(s); removed.delete(s); }
  return { added: [...added], removed: [...removed] };
}

async function main() {
  const base = ARGS.base ?? "origin/main";
  let manifest;
  try {
    manifest = await loadManifest();
  } catch (e) {
    console.error(`✗ ${e.message}`);
    return 1;
  }

  const intent = manifest.intent ?? manifest;

  // Required fields
  const missing = REQUIRED_FIELDS.filter((f) => intent[f] == null);
  if (missing.length > 0) {
    console.error(`✗ Manifest missing required fields: ${missing.join(", ")}`);
    return 1;
  }

  // Cross-check against diff
  let diff;
  try {
    diff = getDiffContent(base);
  } catch (e) {
    console.error(`✗ Could not run git diff (${e.message}).`);
    console.error("pr-intent: diff verification is required. Fetch the base ref or pass --base=<ref>.");
    return 1;
  }

  const { added: addedSymbols, removed: removedSymbols } = extractAddedRemovedSymbols(diff);
  const claimedAdds = new Set((manifest.adds ?? []).map((s) => typeof s === "string" ? s.split(/\s/)[0] : (s.symbol ?? s)));
  const claimedRemoves = new Set((manifest.removes ?? []).map((s) => typeof s === "string" ? s.split(/\s/)[0] : (s.symbol ?? s)));

  const failures = [];

  for (const sym of removedSymbols) {
    if (!claimedRemoves.has(sym)) {
      failures.push(`✗ Diff removes exported symbol "${sym}" but manifest \`removes:\` does not list it. Add an entry with justification.`);
    }
  }
  for (const sym of addedSymbols) {
    if (!claimedAdds.has(sym)) {
      failures.push(`⚠ Diff adds exported symbol "${sym}" but manifest \`adds:\` does not list it. (Warning; add for completeness.)`);
    }
  }

  // Merge-override heuristic: presence of "---ours" / "---theirs" markers in diff (very rare; real signal lives in commit-msg).
  if (/\bgit checkout --(ours|theirs)\b/.test(diff) && !manifest["merge-override"]) {
    failures.push("✗ Diff appears to use --ours/--theirs without a `merge-override:` annotation. Add one explaining why dropping the other side was correct.");
  }

  if (failures.length === 0) {
    console.log(`pr-intent: OK. ${addedSymbols.length} added, ${removedSymbols.length} removed; all accounted for.`);
    return 0;
  }
  for (const f of failures) console.error(f);
  console.error(`\npr-intent: ${failures.filter((s) => s.startsWith("✗")).length} blocking failure(s).`);
  return failures.some((s) => s.startsWith("✗")) ? 1 : 0;
}

const code = await main();
process.exit(code);
