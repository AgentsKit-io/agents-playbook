---
title: 'Phase 04 — Test'
description: 'How ''tests pass'' stops being a feeling and starts being a contract.'
---

# Phase 04 — Test

How "tests pass" stops being a feeling and starts being a contract.

## TL;DR (human)

Five tiers of tests, ordered by cost. Spend most budget on tiers 1–2 (schema parse + unit). Reserve E2E for golden paths. Tests assert on codes / structure, not rendered text. Hermetic over E2E for bug repro. Verify-first before "fixing" a flaky test.

## For agents

### Test layers (target distribution)

| Tier | Type | Runtime | % of suite |
|---|---|---|---|
| 1 | Schema parse / contract | <1 ms | ~30% |
| 2 | Unit (pure functions, single class) | <10 ms | ~40% |
| 3 | Integration (handler + store + adapter, in-process) | <500 ms | ~25% |
| 4 | Visual regression / a11y | seconds | ~4% |
| 5 | E2E (real app, real services) | minutes | ~1% |

Inverted pyramids (mostly E2E) produce flaky, slow suites with poor signal.

### Per pillar — Test-phase discipline

**Architecture**
- [ ] Every contract has a parse test (happy + reject).
- [ ] Every error code is asserted somewhere in the suite (a separate gate scans for `code: "\<CODE\>"` assertions).
- [ ] Handler return values are parsed by the result schema (catches handler bugs at boundary).

**Security**
- [ ] Auth tests: missing `principalId` → `AUTH_REQUIRED`.
- [ ] Tenancy tests: caller cannot access other-workspace data.
- [ ] Egress tests: blocked host produces `SECURITY_EGRESS_DENIED`.
- [ ] Audit tests: privileged action writes intent before execute.
- [ ] Secrets tests: logger redaction works on known patterns.

**UI-UX**
- [ ] A11y: axe scan on every changed screen (`@axe-core` in CI).
- [ ] Visual regression: per-primitive snapshot in default + test brand kit.
- [ ] Intl parity: every key exists in every shipped locale.
- [ ] Empty-state coverage: every list surface has at least one empty-state test.

**Quality**
- [ ] Per-package coverage hits its threshold.
- [ ] Mutation testing on stable utility modules.
- [ ] Property-based tests for parsers / serializers / math.
- [ ] No `it("works")` / `it("test 1")` — names read like sentences.

**Governance**
- [ ] PR-intent gate passes (manifest matches diff).
- [ ] ADR / RFC integrity gate passes.

**AI-collaboration**
- [ ] Verify-first before "fixing" a red signal.
- [ ] Honest test reporting (failed tests quoted, skipped tests stated).

### Triage protocol — when a test fails

1. **Reproduce locally.** Confirm the failure on your machine.
2. **Stash + verify red on `origin/main`.** If main is red, the failure is pre-existing — file an issue; do not "fix" it in your branch.
3. **Determine tier.** Could a lower-tier test pin this? If yes, add the lower-tier test, fix the bug, both turn green.
4. **Fix.** The fix is the smallest diff that flips the test from red to green without changing other behavior.
5. **Add a regression test if missing.** If the failure was a real bug not previously tested.

### Hermetic over E2E for bug repro

When a bug is reported:

1. Try to reproduce in a unit test against the suspect module. Pin it.
2. If that's not enough, integration test wiring stores + handlers in-process.
3. E2E only if cross-process / browser-only behavior.

A 2-second unit test that fails reliably beats a 60-second E2E that flakes.

### Tests assert on codes, not messages

```ts
// ✗ wrong — breaks on intl / copy change
expect(err.message).toContain("not authorized");

// ✓ right
expect(err.code).toBe("AUTH_FORBIDDEN");
```

```tsx
// ✗ wrong — breaks on intl / copy change
expect(screen.getByText("Save")).toBeInTheDocument();

// ✓ right
expect(screen.getByRole("button", { name: /save/i })).toBeInTheDocument();
```

### Determinism

- No file system writes outside per-test temp dirs.
- No network calls (mock the boundary).
- No clock drift (inject the clock).
- No global module state.

A test that passes in isolation and fails in parallel has hidden global state. Fix the test, not the order.

### Common failure modes

- **Inverted pyramid.** Mostly E2E. Slow + flaky. → Push to lower tiers.
- **Flake "fixed" by `setTimeout`.** Hidden flake. → Find the deterministic signal; `expect.poll()` / `waitFor()`.
- **Coverage 95% but error codes never asserted.** → Separate gate scans for asserted codes.
- **Tests share fixtures via mutation.** Order-dependent. → Fresh fixtures per test.
- **Mock at every layer.** End up testing the mocks. → Mock at the trust boundary.

### Exit criteria

Test is continuous, like Build. Each cycle exits when:

1. New behavior has its test in the same PR.
2. Coverage thresholds hold.
3. Suite runs deterministically in CI.

Pre-release adds: full mutation pass, full a11y pass, cold-prod walk of the demo script.

### See also

- [`../../pillars/quality/test-pyramid.md`](/docs/pillars/quality/test-pyramid)
- [`../../pillars/quality/mutation-testing-pattern.md`](/docs/pillars/quality/mutation-testing-pattern)
- [`../../pillars/architecture/error-hierarchy.md`](/docs/pillars/architecture/error-hierarchy)
- [`../../pillars/ui-ux/a11y-checklist.md`](/docs/pillars/ui-ux/a11y-checklist)
