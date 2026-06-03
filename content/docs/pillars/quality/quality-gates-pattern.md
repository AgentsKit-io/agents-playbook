---
title: 'Quality Gates Pattern'
description: 'How to bundle structural rules into one fast command an agent runs before every push.'
---

# Quality Gates Pattern

How to bundle structural rules into one fast command an agent runs before every push.

## TL;DR (human)

`pnpm check:quality-gates` (or your equivalent). Orchestrates the structural gates — file size, no `any`, named exports, raw-error scan, tokens, intl, secrets, completeness. Runs in parallel. Each gate is atomic and produces an actionable failure. Total runtime: target < 30s on a warm cache.

## For agents

### The gate set

A complete gate suite covers six concerns:

| Gate | Pillar | Enforces |
|---|---|---|
| file-size | architecture / quality | Per-extension line budget, shrink-only baseline |
| no-any | architecture | No `any` outside escape-hatched comments |
| named-exports | architecture | No `export default` outside framework-mandated files |
| raw-error | architecture | No `throw new Error(...)` in boundary files |
| tokens | ui-ux | No hex/rgb/hsl/oklch literals, no inline color styles |
| native-html | ui-ux | No bare `\<button\>`/`\<input\>`/etc. in shipped surfaces |
| intl | ui-ux | No hardcoded user-visible strings |
| secrets | security | No high-entropy strings / PEM blocks / key prefixes |
| completeness | quality | No `TODO`/`FIXME`/`throw new Error('not implemented')`/`disabled:true` in shipped surfaces |
| pr-intent | governance | Manifest matches diff (CI only; not pre-commit) |
| adr-numbering | architecture | ADR sequence integrity (CI only) |
| rfc-index | architecture | RFC promotion linkage (CI only) |

### Orchestrator script

A single entry: `pnpm check:quality-gates`. It:

1. Discovers the configured gates from a single config file (e.g. `.quality-gates.json`).
2. Runs them in parallel where possible.
3. Aggregates failures into one report with per-gate sections.
4. Exits 0 if all pass; non-zero with summary if any fail.
5. Has flags: `--gate=\<name\>` to run just one; `--explain` for fix recipes; `--baseline` to regenerate baselines.

Reference impl shape: [`../../scripts/README.md`](/docs/scripts).

### Parallelism

Most gates are CPU-bound and independent. Run them in parallel; on a typical dev machine, full suite finishes in 30s instead of 5 minutes serial.

The exceptions — gates that need a build output (e.g. bundle-size on `core` package) — depend on the build. Sequence: build first, then dependent gates.

### Configuration

One config file at repo root. Schema:

```json
{
  "gates": {
    "file-size": {
      "enabled": true,
      "budgets": { ".tsx": 300, ".ts": 500, ".test.ts": 800 },
      "baseline": ".file-size-baseline.json"
    },
    "no-any": { "enabled": true, "allowMatchRegex": "// allow-any:" },
    "named-exports": {
      "enabled": true,
      "exempt": [
        "apps/web/app/**/{page,layout,loading,error}.tsx",
        "**/{tailwind,next,vitest}.config.*"
      ]
    },
    "raw-error": {
      "enabled": true,
      "boundaryPaths": ["packages/*/src/methods/**", "packages/*/src/handlers/**"]
    }
  }
}
```

Why one file:

- Agents see all gate configs in one place.
- Reviewers see config changes in one diff.
- Disabling a gate is visible — no scattered overrides.

### Adding a new gate

1. Implement: stand-alone script in `scripts/check-\<name\>.mjs`. Exits 0/non-zero. Reads its config from `.quality-gates.json`.
2. Action message: when it fails, print file:line + rule + fix recipe.
3. Baseline (if applicable): generate baseline on first run; lock to shrink-only.
4. Register: add to `.quality-gates.json`.
5. Pre-commit: add to the hook if runtime < 1s.
6. Document: one row in [`../../scripts/README.md`](/docs/scripts).

### Disabling a gate

A failing gate is the gate working. If you need to disable it:

- File-level: code comment escape hatch (`// allow-any:`, `// allow-native:`). Counted by a separate gate that fails if the count grows.
- Repo-level: `enabled: false` in `.quality-gates.json`. This is a serious change — requires an ADR.

Never `eslint-disable-next-line` for structural-gate rules. Use the named escape hatch so the count is tracked.

### Local vs CI parity

Same gate, same config, same result locally as in CI. Achievable by:

- Pinning the Node / package-manager version (Volta / `.nvmrc` / `packageManager`).
- Running gates from the same `pnpm` script.
- Avoiding env-dependent behavior in gate scripts.

If local says green and CI says red, you have a parity bug. Fix the parity bug, not the gate.

### Performance budget

- Whole suite: < 30s on a warm dev machine.
- Each gate: < 5s individually.
- A gate that gets slow over time: profile it. Often it's reading too many files; cache or scope-narrow.

Agents tolerate fast gates and skip slow ones. Keep them fast.

### Common failure modes

- **Gate output is just "147 errors found".** Agent disables the gate. → Per-error file:line + rule + fix.
- **Composite gate enforcing 4 rules at once.** One rule fires; agent can't tell which. → One gate = one rule.
- **Gate config scattered across 6 files.** Disable one rule requires hunting. → One config file.
- **Pre-commit takes 15 seconds.** Agents bypass with `--no-verify`. → Move slow gates to pre-push or CI; keep pre-commit fast.
- **Gates pass locally, fail in CI.** Parity bug. → Pin versions; run gates from the same script.

### See also

- [`universal.md`](/docs/pillars/quality/universal) — Rule 1 (actionable), Rule 8 (one gate one rule).
- [`pre-push-pattern.md`](/docs/pillars/quality/pre-push-pattern) — where heavier gates run.
- [`../../scripts/README.md`](/docs/scripts) — gate reference impls.
