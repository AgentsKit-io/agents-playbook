# Mutation Testing Pattern

How to score whether your unit tests actually catch bugs, beyond what coverage tells you.

## TL;DR (human)

After the unit suite stabilises, run a mutation tool (Stryker for JS/TS, mutmut for Python, similar for other langs). It introduces small bugs ("mutants") into the source and re-runs the tests; surviving mutants reveal tests that pass on bad code. Kill survivors by adding the missing assertion. Use on stable utility modules first; not the whole repo.

## For agents

### Why mutation

Coverage tells you which lines ran. It does not tell you whether the test would catch a bug in those lines.

Example: a test that calls a function and never asserts on the return value has 100% coverage of the function's lines but catches zero bugs in them. Mutation testing surfaces this.

Mutation introduces typed bugs (mutants):

- `>` becomes `>=`
- `+` becomes `-`
- `if (x)` becomes `if (!x)`
- `return foo` becomes `return null`
- a string literal changes
- a function body is replaced with `return undefined`

Each mutant is then evaluated: does the test suite catch it? If yes, **killed**. If no, **survived** — a real gap.

### When to introduce mutation

Not on day one. Mutation is expensive (runtime: minutes to hours) and produces noise on a young codebase. Introduce when:

- Unit suite is stable (passes consistently, no flakes).
- Coverage is already high (≥ 80% per package).
- The code under test is *production-critical* — security, billing, audit, contracts.

### Scope, not whole-repo

Run mutation on one package or one module at a time. Whole-repo mutation runs are usually impractical (hours of runtime; result fatigue).

Pick targets in this order:

1. Contract / schema packages.
2. Error-model code.
3. Auth / security guards.
4. Billing / cost calculations.
5. Audit ledger / append-only stores.

UI components are usually not worth mutating — their behavior is verified by E2E and visual regression at lower cost.

### Reading the report

Output: a mutation score (killed / total) per file + the surviving mutants with diff snippets.

Interpret:

- **High score (≥ 80%)**: tests catch most bugs in this code. Good.
- **Low score (< 60%)**: tests run the code but do not assert on its behavior. Add assertions.
- **Survivors clustered in one function**: that function is undertested. Add targeted tests.
- **Survivors at error paths**: the error-path tests don't assert on the error code. See [`universal.md`](./universal.md) Rule 4.
- **Equivalent mutants** (mutants that produce identical observable behavior): cannot be killed by definition. Mark and move on.

### Killing survivors

For each surviving mutant:

1. Read the diff. Understand the bug.
2. Identify the test that should have caught it.
3. Add the missing assertion. Often: assert on the *return value*, not just that the function was called.
4. Re-run mutation; confirm killed.

Do not add tests *to kill the mutant for its own sake*. The goal is "the test now asserts on real behavior that matters". A test added solely to kill a mutant, with no real behavioral claim, is noise.

### Equivalent mutants

Some mutants are semantically equivalent to the original. Example: `const a = b; return a` → `return b`. They cannot be killed by any test.

The mutation tool may flag many of these. Maintain an allowlist file mapping `<file>:<line>: <reason>` → ignored. Treat allowlist growth as a code smell — sometimes the code itself can be simplified to avoid the equivalence.

### Performance discipline

- Cache mutation results between runs where source has not changed.
- Run mutation on changed files in CI, full sweep nightly / weekly.
- Mutation does not gate PRs; it gates *releases* — fail release if mutation score regressed > N%.

### Common failure modes

- **Mutation on day one.** Score is meaningless because the suite is incomplete. → Stabilise the suite first.
- **Whole-repo mutation.** Run takes 6 hours; report is fatigue. → Scope.
- **"Killing the mutant" instead of "asserting on real behavior".** Adds noise. → If the kill requires a contorted assertion, the bug the mutant simulates is probably not worth catching.
- **Equivalent mutants treated as real survivors.** Inflated score. → Allowlist, with reason.
- **Mutation report nobody reads.** Score drifts down. → Make the score visible in the release-gate report.

### Tools by language

| Language | Tool |
|---|---|
| JS / TS | Stryker, StrykerJS |
| Python | mutmut, cosmic-ray |
| Java / Kotlin | PIT (PITest) |
| C# | Stryker.NET |
| Rust | cargo-mutants |
| Go | go-mutesting |

### See also

- [`universal.md`](./universal.md) — Rule 2 (per-package coverage), Rule 4 (codes not messages).
- [`test-pyramid.md`](./test-pyramid.md) — coverage as a precondition.
- [`sanity-pattern.md`](./sanity-pattern.md) — mutation score is a sanity metric.
