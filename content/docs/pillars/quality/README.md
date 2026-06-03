---
title: 'Pillar — Quality'
description: 'How to know the code works without manually reviewing every agent-produced diff.'
---

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
| Verify-first close | Before reproducing an issue, check if it's already fixed | Default `gh issue view \<n\>` at session start |
| File-size gate | See [architecture pillar](/docs/pillars/architecture/file-size-budget) | Baseline shrink-only |
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

- [`../architecture/file-size-budget.md`](/docs/pillars/architecture/file-size-budget)
- [`../governance/README.md`](/docs/pillars/governance) — PR-intent ties tests to claims.
- [`../../scripts/`](/docs/scripts) — gate reference impls.

## Documents in this pillar

| Doc | Read when |
|---|---|
| [`universal.md`](/docs/pillars/quality/universal) | First read; the 9 non-negotiables |
| [`test-pyramid.md`](/docs/pillars/quality/test-pyramid) | Test-tier distribution + escalation |
| [`quality-gates-pattern.md`](/docs/pillars/quality/quality-gates-pattern) | Structural gate suite + orchestrator |
| [`pre-push-pattern.md`](/docs/pillars/quality/pre-push-pattern) | Three-tier hook split |
| [`sanity-pattern.md`](/docs/pillars/quality/sanity-pattern) | Cross-cutting audit |
| [`mutation-testing-pattern.md`](/docs/pillars/quality/mutation-testing-pattern) | Beyond coverage |
| [`observability-pattern.md`](/docs/pillars/quality/observability-pattern) | Metrics / logs / traces / SLOs |
| [`performance-budgets-pattern.md`](/docs/pillars/quality/performance-budgets-pattern) | Bundle / latency / resource budgets |
| [`chaos-engineering-pattern.md`](/docs/pillars/quality/chaos-engineering-pattern) | Controlled fault injection |
| [`ci-cd-pipeline-pattern.md`](/docs/pillars/quality/ci-cd-pipeline-pattern) | Commit → prod pipeline; caching; deploy patterns; DB migrations |
| [`alerting-runbooks-pattern.md`](/docs/pillars/quality/alerting-runbooks-pattern) | SLO burn-rate alerts; runbook 5-section template; tuning loop |
| [`cost-optimization-pattern.md`](/docs/pillars/quality/cost-optimization-pattern) | FinOps; per-tenant attribution; right-sizing; commitments + spot |
| [`contract-testing-pattern.md`](/docs/pillars/quality/contract-testing-pattern) | Pact + schema-first; consumer-driven contracts; broker; can-i-deploy |
| [`product-analytics-experimentation-pattern.md`](/docs/pillars/quality/product-analytics-experimentation-pattern) | Event tracking; funnels + cohorts; A/B experiments; holdouts |
| [`agent-eval-framework-pattern.md`](/docs/pillars/quality/agent-eval-framework-pattern) | Measuring AI agent quality: deterministic graders + LLM-as-judge + production monitoring; eval set as a versioned asset |
