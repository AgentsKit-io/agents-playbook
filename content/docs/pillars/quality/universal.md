---
title: 'Quality — Universal Principles'
description: 'How to know agent-produced code works without manually reading every diff.'
---

# Quality — Universal Principles

How to know agent-produced code works without manually reading every diff.

## TL;DR (human)

Nine rules. The goal is **trust the green signal** — when the gates say green, you can ship without re-reading the diff. Agents will produce more code than you can review; the gates are the only thing that scales.

1. Gates produce actionable messages, not boolean failures.
2. Per-package coverage targets, not aggregate.
3. Hermetic tests before E2E.
4. Tests assert on codes, not messages.
5. Pre-commit fast, pre-push thorough, CI complete.
6. Shrink-only baselines for legacy debt.
7. Verify-first before "fixing" a flaky / red signal.
8. One gate = one rule = one fix recipe.
9. Sanity audit cross-cuts what individual gates miss.

## For agents

### Rule 1 — Gates produce actionable messages

A failing gate must answer:

- Which file, which line.
- Which rule was broken.
- What the fix looks like.
- The escape hatch, if one exists.

"Lint failed (147 errors)" is not actionable. "src/api/users.ts:42 — boundary file may not throw raw `Error`; use a typed `AppError` subclass with a stable code. Escape hatch: `// allow-raw-error: \<reason\>`." is actionable.

Agents act on actionable signals. Agents disable or bypass non-actionable ones.

**Failure mode prevented:** agents adding broad `// eslint-disable` comments because they could not figure out which specific rule fired.

### Rule 2 — Per-package coverage targets, not aggregate

Aggregate coverage hides which packages are well-tested and which are not. Set a coverage threshold per package:

- Foundation / contract packages: 95%+ (small surface, high blast radius if broken).
- Logic packages: 85%+.
- UI / integration packages: 70%+ (some surfaces resist unit testing).

CI fails if any package drops below its target. Aggregate is computed for reporting, not for gating.

**Failure mode prevented:** a 90% aggregate that hides one package at 30%; agents adding to the strong package because that is where green commits are easy.

### Rule 3 — Hermetic tests before E2E

Reproduce bugs in component-level / in-process tests first. E2E only for golden paths.

- A failing in-process test takes seconds to run and stays deterministic.
- A failing E2E test takes minutes, flakes, and gives you no signal about *where* the failure is.

When triaging a bug:

1. Try to reproduce in a unit test against the suspect module.
2. If that's not enough, an integration test wiring stores + handlers in-process.
3. E2E only if the bug is genuinely cross-process (sidecar handoff, network boundary).

**Failure mode prevented:** "flaky E2E test" turning into a 4-hour debugging session for something a 30-second component test would have pinned exactly.

### Rule 4 — Tests assert on codes, not messages

For typed errors:

```
expect(err.code).toBe("AUTH_REQUIRED");  // ✓
expect(err.message).toContain("Auth");    // ✗
```

Messages get intl-resolved, get reworded for clarity, drift over releases. Codes are stable contracts.

For non-error assertions: prefer asserting structural shape over rendered text where intl is involved. Asserting `<button aria-label="Save">` survives translation; asserting `\<button\>Save\</button\>` does not.

**Failure mode prevented:** tests breaking when copy is improved; agents discouraged from fixing user-facing wording because tests depend on it.

### Rule 5 — Pre-commit fast, pre-push thorough, CI complete

Three tiers:

| Tier | Runtime budget | What runs |
|---|---|---|
| pre-commit hook | ≤ 3s | File-size, secrets scan, raw-error scan, on changed files only |
| pre-push hook | ≤ 30s | Structural gates, ADR/RFC integrity, typecheck, build, **not** lint or full tests |
| CI | minutes | Everything: lint, tests (all tiers), gates, sanity, mutation (periodic) |

Why this split: pre-commit must be fast or agents bypass it (`git commit --no-verify`); pre-push is the durable safety net; CI is the proof.

**Failure mode prevented:** slow pre-commit → agents skip it → bad code lands → CI red → wasted cycles.

### Rule 6 — Shrink-only baselines for legacy debt

When introducing a new gate against an existing codebase, do not block on the existing offenders. Instead:

1. Generate a baseline file listing every offender + their measurement (line count, error count, etc.).
2. Gate config: existing baselined offenders are grandfathered, but they cannot grow.
3. New offenders fail. Period.

Baseline can only shrink. A PR that removes an offender from the baseline is welcome; a PR that grows a baselined offender fails.

This lets you turn on new gates the day you write them, without a 200-PR cleanup blocking the team.

**Failure mode prevented:** new rules getting watered down because day-one adoption was painful; or new rules deferred forever because the cleanup is too big.

### Rule 7 — Verify-first before "fixing" a red signal

When CI / a gate fails on your branch:

1. Stash your changes.
2. Check out clean `origin/main`.
3. Re-run the failing job.
4. If it fails on clean main: the failure is pre-existing. **Do not blame your branch.** File an issue; fix separately.
5. If it passes on clean main: the failure is yours; restore stash and fix.

Production multi-agent work failed this discipline repeatedly: agents "fixing" failures that were already in main, ending up with diffs that masked the real issue.

**Failure mode prevented:** agents grinding on imaginary failures; agents shipping fixes that "make CI green" without resolving the underlying bug.

### Rule 8 — One gate = one rule = one fix recipe

A good gate enforces exactly one rule. Its failure message names the rule. The fix is the same every time.

Bad gate: "Quality check failed — see report." Composite. No fix recipe.

Good gate: "no-default-export — `src/foo.ts:1` exports default. Convert to a named export: `export function foo()`." Atomic. One fix.

When you find a gate enforcing multiple rules, split it.

**Failure mode prevented:** gates that scare reviewers into rubber-stamping because the failure is opaque; agents disabling whole gate suites because one sub-rule fired.

### Rule 9 — Sanity audit cross-cuts what individual gates miss

Each gate sees one slice. Some failures only show up when you cross-cut: "this package has 100% coverage but never asserts on the error codes it defines"; "this screen has no empty state but its data source can return empty".

Periodic sanity audit (`pnpm sanity` or equivalent) runs a battery of cross-cutting checks and produces a report. CI fails if the report shows regressions vs the last release.

The sanity audit complements gates; it does not replace them.

**Failure mode prevented:** code that passes every individual gate but fails the implicit "is this trustworthy" check.

## See also

- [`test-pyramid.md`](./test-pyramid.md)
- [`quality-gates-pattern.md`](./quality-gates-pattern.md)
- [`sanity-pattern.md`](./sanity-pattern.md)
- [`pre-push-pattern.md`](./pre-push-pattern.md)
- [`mutation-testing-pattern.md`](./mutation-testing-pattern.md)
- [`../../scripts/README.md`](../../scripts/README.md)
