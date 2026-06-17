---
title: 'Adversarial Bug-Hunt Pattern'
description: 'How to find real logic bugs with a find → refute → reproduce loop, instead of trusting a single agent that says "looks fine".'
---

# Adversarial Bug-Hunt Pattern

How to find real logic bugs with a find → refute → reproduce loop, instead of trusting a single agent that says "looks fine".

## TL;DR (human)

Coverage and mutation testing tell you whether your *tests* are good. They do not find logic bugs that no test was ever written for. To find those, run a deliberate hunt: assign each finder a single orthogonal bug-class lens, then make a second wave of agents try to *refute* every candidate, then require a failing reproduction before anything is called a bug. One agent asked to "find bugs" produces confident noise; an adversarial loop produces a short list of confirmed defects.

## For agents

### Why a single pass fails

Ask one agent "are there bugs in this module?" and you get one of two bad outcomes:

- **False confidence.** "No issues found" — because it read the happy path and stopped.
- **Plausible noise.** A list of ten "bugs", most of which are intended behavior, equivalent rewrites, or misreadings of the contract.

Neither is actionable. The fix is structure: orthogonal search, adversarial verification, and a reproduction bar.

### Stage 1 — Find (orthogonal lenses)

Do not ask N agents to "find bugs". They will all find the same shallow thing. Assign each finder **one** bug-class lens so coverage is orthogonal:

| Lens | What it hunts |
|---|---|
| Boundary / off-by-one | `<` vs `<=`, inclusive/exclusive ranges, empty and single-element inputs |
| Error-handling holes | swallowed errors, wrong error code, missing reject path, `catch {}` that hides, partial rollback |
| Async / race / idempotency | missing `await`, concurrent mutation, double-fire, retry-without-dedup, check-then-act (TOCTOU) |
| Security logic | authz allow/deny inversion, tenant-scope leak, egress/firewall bypass, skipped signature or expiry check, redaction gap — **highest priority** |
| State machine / invariants | illegal transition allowed, terminal-state mutation, lost update, stale cache |
| Input validation | schema boundary not enforced on the runtime path, unsanitised passthrough, type-coercion surprise |
| Resource / cleanup | unclosed handles, unbounded growth, leak, missing dispose / cancel |

Each finder returns candidates as `file:line — symptom — why it's wrong`.

Target the highest-yield code first: security and tenant-scoping, then runtime correctness (state machines, sync/conflict logic), then money and contracts, then app-level auth/billing. UI rendering is low-yield for this technique — leave it to visual and E2E tests.

### Stage 2 — Refute (adversarial verification)

This is the stage that kills noise. For each candidate, spawn **at least two independent skeptics** whose explicit job is to *refute* it. Prompt them to default to "not a bug" when uncertain. Majority-refute → drop the candidate.

Give the skeptics distinct angles rather than cloning one refuter — e.g. one checks the contract/docs, one checks whether a test already codifies the behavior as intended, one tries to construct an input where the code is actually correct. Diverse skeptics catch failure modes that identical ones miss.

A candidate that survives independent refutation is worth a reproduction. One that does not is discarded without ceremony — do not "soften" it into a medium-severity note to feel productive.

### Stage 3 — Reproduce + confirm

A survivor is not a bug until a **failing test reproduces wrong behavior against the documented or intended contract**. The repro is the proof and becomes the regression test once fixed.

For each confirmed bug record: `location — symptom — repro — severity (crit / high / med) — proposed fix`. Fix confirmed crit/high inline (one commit per fix, with the repro test). Batch medium findings for a follow-up.

### The intent-test guard

Before "fixing" a suspicious behavior, **search for a test that already codifies it as intended.** State-hygiene nits ("this stale field should be cleared", "this transition should throw") are frequently deliberate and pinned by an existing test. If such a test exists, the behavior is intended — you would be reverting a decision, not fixing a bug. No intent test + a failing contract repro = a real bug. See [`../ai-collaboration/verify-first-pattern.md`](/docs/pillars/ai-collaboration/verify-first-pattern).

### Loop until dry

Run the find → refute → confirm loop per module until **two consecutive rounds surface nothing new**. Dedup by `file:line + symptom` so the same finding doesn't re-enter every round. A fixed iteration count ("run it 3 times") misses the long tail; a dry-rounds counter converges honestly.

### When to use it

- Before a release of security-, money-, or correctness-critical code.
- After mutation testing and coverage are already good — this finds a *different* class of defect (real logic bugs, not weak tests).
- When a subsystem has had concurrency or state-machine churn.

Not worth it for: pure UI rendering, generated code, throwaway scripts.

### Complementary techniques

- [`property-fuzz-testing-pattern.md`](/docs/pillars/quality/property-fuzz-testing-pattern) — finds bugs the lenses miss by attacking invariants and parsers directly.
- Run the integration / E2E suites that CI skips when it is constrained — real wiring bugs hide in the layers unit tests never exercise.

### Common failure modes

- **"Find bugs" with no lens.** Every agent finds the same shallow thing. → Assign one orthogonal lens each.
- **No refutation stage.** Plausible-but-wrong findings ship as "bugs". → Always run independent skeptics; majority-refute drops.
- **No reproduction bar.** A claim becomes a "bug" without proof. → Require a failing test against the contract.
- **Fixing a pinned behavior.** You revert a deliberate decision. → Check for an intent test first.
- **Fixed round count.** The tail is missed. → Loop until two dry rounds.
- **Empty verdicts counted as "survived".** A verification pass that didn't actually run reads as "0 refuted" and inflates the confirmed list. → Treat a missing verdict as *unverified*, not as *survived*.

### See also

- [`mutation-testing-pattern.md`](/docs/pillars/quality/mutation-testing-pattern) — weak-test detection; run it first.
- [`property-fuzz-testing-pattern.md`](/docs/pillars/quality/property-fuzz-testing-pattern) — invariant + fuzz discovery.
- [`../ai-collaboration/verify-first-pattern.md`](/docs/pillars/ai-collaboration/verify-first-pattern) — the intent-test guard, generalised.
- [`../ai-collaboration/sub-agent-pattern.md`](/docs/pillars/ai-collaboration/sub-agent-pattern) — fan-out mechanics for the finder/skeptic waves.
