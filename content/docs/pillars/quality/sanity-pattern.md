---
title: 'Sanity Pattern'
description: 'The cross-cutting audit that catches what individual gates miss.'
---

# Sanity Pattern

The cross-cutting audit that catches what individual gates miss.

## TL;DR (human)

A periodic batch of checks that span concerns — coverage AND honesty AND completeness AND drift — produces one report. CI fails if the report regresses against the last release. Run it on a schedule (nightly), on demand (`pnpm sanity`), and before every release.

## For agents

### Why sanity is separate from gates

Gates are atomic, fast, blocking. Each enforces one rule. They run on every commit.

Sanity is composite, slower, periodic. It asks questions a single gate cannot:

- "Does this package have 95% coverage AND every error code asserted somewhere?"
- "Is every screen in the nav covered by at least one E2E test?"
- "Does every ADR have a corresponding code surface, or is it tombstoned?"
- "Does the for-agents doc for each package mention all its exported methods?"
- "Are there any RPC methods registered but not handler-bound?"

Each is a *cohesion* check. None of them is a single-rule violation; all of them indicate quiet drift.

### Output

The sanity audit produces a single report — `docs/audit/sanity-report.md` or equivalent. Sections:

1. **Per-package coverage cohesion** — coverage % + code-asserted % + uncovered branches.
2. **Per-screen completeness** — E2E ref count + a11y status + intl coverage.
3. **Doc-vs-code drift** — for-agents files that reference removed symbols; symbols with no doc.
4. **Contract-vs-handler completeness** — methods in the registry without a bound handler; handlers without a registry entry.
5. **ADR-vs-code surface** — accepted ADRs whose described surface no longer exists.
6. **Baseline trend** — file-size baseline shrinking? Growing? Stagnant?
7. **Honesty smells** — `TODO`/`FIXME` count, `disabled:true` count, stub-returning methods.

### Cadence

- **On demand**: `pnpm sanity` (or equivalent). Any agent / human can run.
- **Scheduled**: nightly CI job. Posts the report to a known location.
- **Pre-release**: required. The release-gate checklist verifies the report has no regressions.

### Regression detection

Each section produces a numeric metric. The report compares to the previous run; CI fails if any metric regressed beyond a threshold.

Example metrics:

- "Methods registered without handlers": should be 0; if > 0, fail.
- "Stub-returning methods in shipped surfaces": baseline N; fail if > N.
- "Screens without E2E": baseline M; fail if > M.

Like file-size budgets, sanity uses shrink-only baselines. Existing drift is grandfathered; new drift fails.

### Per-pillar sections

Each pillar can contribute a section:

| Pillar | Sanity contribution |
|---|---|
| architecture | ADR-vs-surface, contract-vs-handler, package-vs-routing-table drift |
| security | un-audit-logged privileged ops, secrets in source, RBAC roles without capabilities |
| ui-ux | screens without empty state, intl coverage per locale, token drift |
| quality | per-package coverage trend, mutation score trend, flake rate |
| governance | tombstoned docs still referenced as active, ADRs with no Status |
| ai-collaboration | memories referencing removed paths, slash commands without bodies |

### Implementation shape

```
scripts/
├── sanity/
│   ├── architecture.mjs    # produces sections 4, 5
│   ├── security.mjs        # produces honesty smells + RBAC checks
│   ├── ui-ux.mjs           # screens, intl, tokens
│   ├── quality.mjs         # coverage cohesion, baseline trends
│   ├── governance.mjs      # tombstone & ADR cohesion
│   └── ai-collab.mjs       # memory & slash cohesion
└── sanity.mjs              # orchestrator, runs in parallel, aggregates report
```

### Report consumption

The report is markdown. It is committed to the repo (or posted as a CI artefact). Readers:

- Developers, before opening a PR: are there any easy wins to address?
- Reviewers: does the PR fix or worsen drift?
- Release managers: is the report clean enough to ship?

### Common failure modes

- **Sanity audit nobody reads.** Drift accumulates silently. → Make CI fail on regressions; force a read.
- **Sanity audit blocks every PR.** Friction; agents bypass. → Sanity is periodic + pre-release, not per-PR. Per-PR gates are the structural gates.
- **One huge report with no per-pillar split.** Cannot triage. → Section per pillar; section per concern.
- **Metrics that always say "0" or always say "stable".** Useless signal. → Calibrate; pick metrics that move.
- **No baseline; first run fails on accumulated debt.** → Capture baseline on first run; gate to shrink-only.

### See also

- [`universal.md`](/docs/pillars/quality/universal) — Rule 9 (sanity cross-cuts).
- [`quality-gates-pattern.md`](/docs/pillars/quality/quality-gates-pattern) — per-PR enforcement.
- [`../../scripts/README.md`](/docs/scripts) — gate + sanity reference impls.
