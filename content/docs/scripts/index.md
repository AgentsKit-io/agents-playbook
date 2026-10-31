---
type: Index
title: 'Reference gate scripts'
description: 'Drop-in reference implementations for the quality + structural gates the pillars rely on. Adapt to your stack; the contract each gate enforces is more important than the specific code.'
---

# Reference gate scripts

Drop-in reference implementations for the quality + structural gates the pillars rely on. Adapt to your stack; the contract each gate enforces is more important than the specific code.

Run any gate immediately without copying files:

```bash
npx @agentskit/playbook run no-any named-exports
npx @agentskit/playbook run --fast
```

Use `npx @agentskit/playbook list` to see every packaged gate. The source files below remain the canonical, copy-ready implementations; the npm package is synchronized from them and has zero runtime dependencies.

## pre-commit

Run the fast gate subset before every commit without copying scripts:

```yaml
repos:
  - repo: https://github.com/AgentsKit-io/agents-playbook
    rev: pre-commit-v0.1.0
    hooks:
      - id: agentskit-playbook
```

Save the configuration as `.pre-commit-config.yaml`, then enable it for commits:

```bash
pre-commit install
```

The provider pins `@agentskit/playbook@0.1.0`, checks a temporary snapshot of the staged repository, and requires pre-commit 4.4.0+ with Node.js 22+. Unstaged and untracked files cannot block the commit. Override `args` to select exact filesystem gates:

```yaml
      - id: agentskit-playbook
        args: [no-any, secrets, named-exports]
```

Run `pre-commit autoupdate` to adopt later provider tags, and `pre-commit run agentskit-playbook --all-files` to verify the staged snapshot immediately. The release process creates the documented `pre-commit-v0.1.0` provider tag before these instructions merge, so the reference is valid as soon as it becomes public.

## Status

✓ All 12 gate reference impls shipped + orchestrator. Pure Node 22 ESM, zero deps. Adapt the regexes / paths to your codebase.

Verified: every script `node --check`-clean. Orchestrator smoke-tested, gates exit 0 on a clean codebase (or produce actionable failures on a populated one).

## Index

| Script | Pillar | What it enforces | Run when |
|---|---|---|---|
| `check-file-size.example.mjs` | architecture / quality | `.tsx` ≤ 300 lines, `.ts` ≤ 500 (calibrate); shrink-only baseline at `.file-size-baseline.json` | pre-commit + CI |
| `check-named-exports.example.mjs` | architecture | No `export default` outside framework-mandated files | CI |
| `check-no-any.example.mjs` | architecture | No `any` outside `// allow-any: \<reason\>`; counts only grow on a sweep | CI |
| `check-error-raw.example.mjs` | architecture | No `throw new Error(...)` in boundary files (`methods/`, `handlers/`, `api/`) | CI |
| `check-pr-intent.example.mjs` | governance | PR description has well-formed intent block; `removes:` matches diff | CI on PR |
| `check-adr.example.mjs` | architecture | ADR sequence integrity; status values; superseder back-pointers | CI |
| `check-rfc.example.mjs` | architecture | RFC index; review window; promotion linkage | CI |
| `check-tokens.example.mjs` | ui-ux | No hex/rgb/hsl/oklch literals; no Tailwind arbitrary color classes; no inline color styles | CI |
| `check-native-html.example.mjs` | ui-ux | No native `\<button\>`, `\<input\>`, `\<select\>`, `\<dialog\>`, `\<form\>`, `\<table\>`, `\<a href\>` in shipped surfaces | CI |
| `check-intl.example.mjs` | ui-ux | No JSX string literals or hardcoded `aria-label`/`title`/`placeholder`/`alt` | CI |
| `check-secrets.example.mjs` | security / quality | No high-entropy strings, no PEM blocks, no API-key prefixes outside `ALLOW_FILES` | CI |
| `check-completeness.example.mjs` | ui-ux / quality | No `TODO`/`FIXME`/`disabled:true` tab/`throw new Error('not implemented')` in shipped surfaces | CI |
| `check-quality-gates.example.mjs` | quality | Orchestrator; runs the structural gates above in parallel | local + CI |
| `sanity.example.mjs` | quality / governance | Cross-cutting audit; generates `docs/audit/sanity-report.md` | weekly / on demand |

## Shape conventions

Every gate script:

1. Exits 0 on green, non-zero on fail.
2. Prints actionable messages: file path, line number, the rule, the fix.
3. Supports `--explain` to print the rationale and recovery pattern.
4. Supports `--baseline` to regenerate the baseline file (only for shrink-only gates).
5. Reads config from one file at repo root (e.g. `.quality-gates.json`) — not from scattered package configs.

## Wiring

Two integration points:

1. **Pre-commit hook** (pre-commit / Husky / lefthook) — runs the fastest subset (file-size, secrets, raw-error) against the staged repository snapshot.
2. **CI** — runs `pnpm check:quality-gates` on every PR; full sweep.

The pre-commit hook should be **fast** (<3s) so agents do not learn to bypass it. Anything slow runs in CI only.

## Pre-push hook (recommended)

A `pre-push` hook that runs:

- structural gates (this directory),
- ADR / RFC index integrity,
- typecheck,
- build,

— but **not** lint or the full test suite (those run in CI). The goal of pre-push is to catch structural drift before it hits CI, not to be CI.

## See also

- [`../pillars/quality/README.md`](/docs/pillars/quality)
- [`../pillars/governance/README.md`](/docs/pillars/governance)
- [`../templates/PR-intent.template.md`](/docs/templates/PR-intent.template)
