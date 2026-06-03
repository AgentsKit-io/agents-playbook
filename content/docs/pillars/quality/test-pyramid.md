---
title: 'Test Pyramid'
description: 'How to mix test types so the cheap ones catch most bugs and the expensive ones cover what only they can.'
---

# Test Pyramid

How to mix test types so the cheap ones catch most bugs and the expensive ones cover what only they can.

## TL;DR (human)

Five tiers, ordered by cost. Spend most of your budget on tiers 1–2. Reserve tier 5 for golden paths and cross-process boundaries. The pyramid is not dogma — it is **cost optimization for catch rate**.

## For agents

### Tiers

| Tier | Type | Runtime | What it catches |
|---|---|---|---|
| 1 | Schema parse / contract | <1 ms each | Wrong shapes, missing fields, type-vs-runtime drift |
| 2 | Unit (pure functions, single class) | <10 ms each | Logic errors, off-by-one, edge cases |
| 3 | Integration (handler + store + adapter, in-process) | <500 ms each | Boundary mismatches, transaction-ordering, missing wiring |
| 4 | Visual regression / a11y | seconds each | Token drift, component layout regressions, a11y violations |
| 5 | E2E (real app, real services) | minutes each | Cross-process bugs, real-world flow integrity |

### Where to spend

Rough budget for a healthy codebase:

- 70% of test count: tier 1–2.
- 25%: tier 3.
- 4%: tier 4.
- 1%: tier 5.

If your suite inverts this — 60% E2E, 10% unit — your runtime is long, your signal is flaky, and your debugging surface is huge.

### Which tier catches which bug

When a bug is reported, pick the *lowest* tier that can pin it:

1. Could a schema parse test reject the bad input? → Add tier 1 test.
2. Could a unit test fail on the wrong logic? → Add tier 2 test.
3. Does the bug appear only when handler + store interact? → Tier 3.
4. Does the bug show only in the rendered DOM? → Tier 4.
5. Does the bug live in cross-process handoff or browser-only behavior? → Tier 5.

Always escalate to the higher tier only after the lower tier cannot pin it.

### Test names

A test name reads like a sentence:

```
describe("users.list handler", () => {
  it("rejects missing workspaceId with VALIDATION_ERROR", ...)
  it("returns empty rows when no users in workspace", ...)
  it("respects limit and cursor for pagination", ...)
})
```

Anti-pattern: `it("works")`, `it("test 1")`. Agent-produced tests with these names are a smell — they tested the wrong thing.

### Determinism

Every test runs in isolation, in any order, in parallel, with no shared state.

- No file system writes outside a per-test temp dir.
- No network calls (mock the boundary).
- No timer / clock drift (inject the clock).
- No global module state.

If a test passes in isolation and fails in parallel, the test has hidden global state. Fix the test, not the order.

### Fixtures

Fixtures are data, not code. Keep them in `__fixtures__/` directories next to the tests that use them. One fixture per file; descriptive name.

When a fixture grows past ~50 lines, ask whether the underlying schema is too lenient. Fixtures that need to encode many edge cases hint at a schema that should reject the edge cases at parse time.

### Coverage interpretation

Coverage tells you which lines ran, not whether the tests are good. A 100% coverage suite that never asserts on outputs is worthless.

Use coverage to find untested *branches*, then ask: "is the untested branch reachable in production?" If yes, add a test. If no, the branch is dead code; delete it.

### Property-based testing

For pure functions with a clear input domain (parsers, serializers, math), add a few property-based tests. They catch edge cases unit tests miss.

```
property("any valid input round-trips through parse + serialize", ...)
```

One property test can replace fifty unit tests. Reserve for high-value boundaries.

### Mutation as a coverage backstop

After unit suite stabilises, mutation testing scores its real catch rate. See [`mutation-testing-pattern.md`](/docs/pillars/quality/mutation-testing-pattern).

### Common failure modes

- **Tests that only assert on rendered text.** Break on intl / copy changes. → Assert on structure or codes.
- **Tests that mock too deep.** End up testing the mocks. → Mock at the trust boundary only.
- **Tests that share fixtures via mutation.** Order-dependent. → Fresh fixtures per test, or immutable fixtures.
- **E2E flake "fixed" by a sleep.** Flake hidden, not fixed. → Find the deterministic signal; assert on that. `expect.poll()` / `waitFor()` over fixed sleeps.
- **Coverage 95% but error codes never asserted.** The error path is untested. → A separate gate scans tests for `code:` assertions; flags codes that are never asserted.

### See also

- [`universal.md`](/docs/pillars/quality/universal) — Rule 3 (hermetic before E2E), Rule 4 (assert on codes).
- [`mutation-testing-pattern.md`](/docs/pillars/quality/mutation-testing-pattern)
- [`../architecture/contracts-zod-pattern.md`](/docs/pillars/architecture/contracts-zod-pattern) — tier 1 lives here.
