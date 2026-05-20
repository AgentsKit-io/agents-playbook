# Reference gate scripts

Drop-in reference implementations for the quality + structural gates the pillars rely on. Adapt to your stack; the contract each gate enforces is more important than the specific code.

## Status

◐ 6 reference impls shipped (file-size, named-exports, no-any, error-raw, pr-intent, orchestrator). Remaining gates (tokens, native-html, intl, secrets, completeness, adr, rfc) described in this index for spec-based implementation.

Shipped scripts are pure Node 22 ESM, zero deps. Adapt the regexes / paths to your codebase.

## Index

| Script | Pillar | What it enforces | Run when |
|---|---|---|---|
| `check-file-size.example.mjs` | architecture / quality | `.tsx` ≤ 300 lines, `.ts` ≤ 500 (calibrate); shrink-only baseline at `.file-size-baseline.json` | pre-commit + CI |
| `check-named-exports.example.mjs` | architecture | No `export default` outside framework-mandated files | CI |
| `check-no-any.example.mjs` | architecture | No `any` outside `// allow-any: <reason>`; counts only grow on a sweep | CI |
| `check-error-raw.example.mjs` | architecture | No `throw new Error(...)` in boundary files (`methods/`, `handlers/`, `api/`) | CI |
| `check-pr-intent.example.mjs` | governance | PR description has well-formed intent block; `removes:` matches diff | CI on PR |
| `check-adr.example.mjs` | architecture | ADR sequence integrity; status values; superseder back-pointers | CI |
| `check-rfc.example.mjs` | architecture | RFC index; review window; promotion linkage | CI |
| `check-tokens.example.mjs` | ui-ux | No hex/rgb/hsl/oklch literals; no Tailwind arbitrary color classes; no inline color styles | CI |
| `check-native-html.example.mjs` | ui-ux | No native `<button>`, `<input>`, `<select>`, `<dialog>`, `<form>`, `<table>`, `<a href>` in shipped surfaces | CI |
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

1. **Pre-commit hook** (Husky / lefthook) — runs the fastest subset (file-size, secrets, raw-error, intl spot-check) on the changed files only.
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

- [`../pillars/quality/README.md`](../pillars/quality/README.md)
- [`../pillars/governance/README.md`](../pillars/governance/README.md)
- [`../templates/PR-intent.template.md`](../templates/PR-intent.template.md)
