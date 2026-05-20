# Pillar — Quality

How to know the code works without manually reviewing every agent-produced diff.

## Status

◐ Scoped, not yet detailed.

## Scope

| Concern | Universal principle | Concrete pattern |
|---|---|---|
| Test pyramid | Unit > integration > E2E; cover the boundary contracts heavily | Vitest unit + Playwright E2E + contract-level params/result parse tests |
| Coverage target | >90% per shipped package, measured against statements | Per-package coverage threshold in CI; per-package, not whole-repo |
| Mutation testing | Beats coverage as a quality signal once unit suite is good | Stryker / mutation tool on stable utilities first |
| Hermetic tests | Component-level vitest preferred over live-app E2E | Reproduce + lock bugs via in-process tests, not Playwright |
| Verify-first close | Before reproducing an issue, check if it's already fixed | Default `gh issue view <n>` at session start |
| File-size gate | See [architecture pillar](../architecture/file-size-budget.md) | Baseline shrink-only |
| Lint gates | No `any`, no `console.log`, no default exports, no nested ternaries, no raw HTML | ESLint rule pack + per-file overrides |
| Quality-gates script | One `pnpm check:quality-gates` for fast structural checks | Parallel: lint + typecheck + secrets + size + intl + tokens |
| Sanity script | One `pnpm sanity` for cross-cutting rule audit | Generates `docs/audit/sanity-report.md`; CI fails on regressions |
| Pre-push hook | Runs structural gates + ADR/RFC checks; not full tests | Husky `pre-push`; tests on CI |
| Concurrency safety | Agents merge PRs against fast-moving main | Stash-verify red, rebase, retry; never `--theirs`/`--ours` blindly |

## Non-negotiables

1. **Tests are part of the diff.** No "tests next PR".
2. **Coverage is per package, not aggregate.** Aggregate hides which package is bad.
3. **Hermetic over E2E for bug repro.** Component tests fail in 2s; Playwright fails in 60s and lies more.
4. **Gates produce actionable messages.** "Lint failed" is not actionable. "src/x.ts:42 — no `any` in boundary file; use `unknown` and parse." is.
5. **Pre-push is the safety net, not the proof.** Run `check:all` before a release.

## See also

- [`../architecture/file-size-budget.md`](../architecture/file-size-budget.md)
- [`../governance/README.md`](../governance/README.md) — PR-intent ties tests to claims.
- [`../../scripts/`](../../scripts/) — gate reference impls.

## Documents in this pillar

| Doc | Read when |
|---|---|
| [`universal.md`](./universal.md) | First read; the 9 non-negotiables |
| [`test-pyramid.md`](./test-pyramid.md) | Test-tier distribution + escalation |
| [`quality-gates-pattern.md`](./quality-gates-pattern.md) | Structural gate suite + orchestrator |
| [`pre-push-pattern.md`](./pre-push-pattern.md) | Three-tier hook split |
| [`sanity-pattern.md`](./sanity-pattern.md) | Cross-cutting audit |
| [`mutation-testing-pattern.md`](./mutation-testing-pattern.md) | Beyond coverage |
| [`observability-pattern.md`](./observability-pattern.md) | Metrics / logs / traces / SLOs |
| [`performance-budgets-pattern.md`](./performance-budgets-pattern.md) | Bundle / latency / resource budgets |
| [`chaos-engineering-pattern.md`](./chaos-engineering-pattern.md) | Controlled fault injection |
