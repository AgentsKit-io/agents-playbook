#!/usr/bin/env node
// Reference orchestrator: runs the structural quality gates in parallel,
// aggregates results, exits 0/1.
//
// Usage:
//   node scripts/check-quality-gates.example.mjs           # run all enabled gates
//   node scripts/check-quality-gates.example.mjs --gate=file-size
//   node scripts/check-quality-gates.example.mjs --fast    # subset used by pre-push
//   node scripts/check-quality-gates.example.mjs --explain # print fix recipes

import { spawnSync } from "node:child_process";
import { resolve, join } from "node:path";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";

const ROOT = resolve(process.cwd());
const ARGS = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.split("=");
    return [k.replace(/^--/, ""), v ?? true];
  })
);

const GATES = [
  { name: "file-size",      script: "scripts/check-file-size.example.mjs",      fast: true  },
  { name: "named-exports",  script: "scripts/check-named-exports.example.mjs",  fast: false },
  { name: "no-any",         script: "scripts/check-no-any.example.mjs",         fast: false },
  { name: "error-raw",      script: "scripts/check-error-raw.example.mjs",      fast: true  },
  { name: "pr-intent",      script: "scripts/check-pr-intent.example.mjs",      fast: false },
  // Future gates: tokens, native-html, intl, secrets, completeness, adr, rfc.
];

async function loadConfig() {
  const path = join(ROOT, ".quality-gates.json");
  if (!existsSync(path)) return { gates: {} };
  return JSON.parse(await readFile(path, "utf8"));
}

function isEnabled(name, config) {
  const cfg = config.gates?.[name];
  if (cfg == null) return true; // default ON
  return cfg.enabled !== false;
}

function runGate(name, script) {
  const start = Date.now();
  const r = spawnSync("node", [join(ROOT, script)], { encoding: "utf8" });
  return {
    name,
    code: r.status ?? 1,
    stdout: r.stdout ?? "",
    stderr: r.stderr ?? "",
    durationMs: Date.now() - start,
  };
}

function explain() {
  process.stdout.write(`
quality-gates orchestrator
==========================

Runs each structural gate in parallel. Each gate enforces one rule and produces
an actionable failure message. To run individually for fix-fast workflow:
  node scripts/check-<gate>.example.mjs --explain

To regenerate a baseline (after intentional shrink sweep):
  node scripts/check-<gate>.example.mjs --baseline

Subsets:
  --fast        Run only the pre-commit / pre-push subset.
  --gate=<name> Run a single gate.

See: pillars/quality/quality-gates-pattern.md
`);
}

async function main() {
  if (ARGS.explain) {
    explain();
    return 0;
  }

  const config = await loadConfig();
  let plan = GATES;
  if (ARGS.gate) plan = GATES.filter((g) => g.name === ARGS.gate);
  if (ARGS.fast) plan = plan.filter((g) => g.fast);
  plan = plan.filter((g) => isEnabled(g.name, config));

  if (plan.length === 0) {
    console.log("quality-gates: nothing to run.");
    return 0;
  }

  console.log(`quality-gates: running ${plan.length} gate(s) in parallel...`);
  const results = await Promise.all(plan.map((g) => Promise.resolve(runGate(g.name, g.script))));

  let failed = 0;
  for (const r of results) {
    const status = r.code === 0 ? "✓" : "✗";
    console.log(`\n[${r.durationMs}ms] ${status} ${r.name}`);
    if (r.code !== 0) {
      failed++;
      if (r.stdout) process.stdout.write(r.stdout);
      if (r.stderr) process.stderr.write(r.stderr);
    }
  }

  console.log(`\nquality-gates: ${results.length - failed}/${results.length} passed.`);
  return failed > 0 ? 1 : 0;
}

const code = await main();
process.exit(code);
