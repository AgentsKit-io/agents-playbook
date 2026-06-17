---
type: Playbook Pattern
title: 'Honest Confidence Pattern'
description: 'How to report done-ness so a human can trust it — separating what was automatically verified from what was merely claimed.'
---

# Honest Confidence Pattern

How to report done-ness so a human can trust it — separating what was automatically verified from what was merely claimed.

## TL;DR (human)

"Done" is not a boolean. An agent should report *which parts were proven, how, and which were not.* The single most useful habit: separate **automated-verified** (a test ran and passed, a build succeeded, a repro is green) from **claimed** (it should work; I read the code and it looks right; I didn't run it). A handoff that says "server logic ~95% proven by tests; UI 0% automatically verified — needs a manual pass" is worth more than a confident "all done" that hides the gap.

## For agents

### Why optimistic reporting destroys trust

A human gates their next action on your report. If you say "tests pass" when you mean "the tests I ran pass and I skipped the slow suite", they ship a regression on your word. One inflated "done" costs more trust than ten honest "not yet"s. Faithful state beats optimistic state, every time.

### The two-bucket rule

Every claim of completion falls into one of two buckets. Label which:

| Bucket | Means | Example phrasing |
|---|---|---|
| **Automated-verified** | A check ran and passed: test green, build clean, repro reproduces, gate satisfied | "147 tests pass; build clean; the bug's repro is now green." |
| **Claimed / unverified** | Believed correct but not mechanically proven | "Reads correct; **not run** — no device to exercise the native path." |

Never let a claimed item wear automated-verified language. "It works" must mean something ran.

### The verification ledger

For any non-trivial deliverable, end with an explicit ledger:

```
Verified (ran + passed):
  - unit suite (147 tests)
  - typecheck, build
  - repro test for the reported bug
Not verified (no automated proof):
  - end-to-end UI flow — needs a manual click-through
  - live integration against the real datastore — no credentials in this env
Known-not-done:
  - the deferred follow-up X (out of scope, flagged)
```

A reviewer reads this in ten seconds and knows exactly where to spend their attention. The ledger is also honest about *confidence asymmetry*: it is normal to be 95% confident in the layer you tested and ~0% confident in the layer you couldn't.

### Report failures and skips faithfully

- A test that failed is reported **failed**, with the output — not "passes after I fix an unrelated thing".
- A step you skipped is reported **skipped** — not silently omitted.
- A check you couldn't run (no network, no credentials, billing constrained) is reported **could-not-run** — not assumed-green.
- A pre-existing failure you did not introduce is labeled **pre-existing**, with evidence — so it isn't mistaken for your regression, and isn't quietly inherited as your problem.

### Calibrate the number, don't inflate it

If you give a percentage, it must mean something: proportion of the contract that has a passing check behind it. "~90% done" with no ledger is noise. "~90%: all server paths tested; the remaining 10% is the UI, untested" is a calibrated estimate a human can act on. When you don't know, say "unknown — not measured" rather than inventing a figure.

### Common failure modes

- **"All done" hiding an unrun suite.** Reviewer ships a regression. → Two-bucket the claim; say what ran.
- **Silent skip.** A step was dropped and never mentioned. → Skips are reported, not omitted.
- **Optimistic percentage.** "95%" with nothing behind it. → Tie any number to passing checks, or say "unknown".
- **Inheriting pre-existing failures as your own — or disowning real regressions.** Both mislead. → Label pre-existing vs introduced, with evidence.
- **Equal confidence across unequal verification.** "Works" applied to a tested layer and an untested one alike. → State the confidence asymmetry explicitly.

### See also

- [`verify-first-pattern.md`](/docs/pillars/ai-collaboration/verify-first-pattern) — verify before you claim; this pattern is how you report what you found.
- [`human-in-the-loop-pattern.md`](/docs/pillars/ai-collaboration/human-in-the-loop-pattern) — the human gates on your report; honesty earns autonomy.
- [`hallucination-reduction-pattern.md`](/docs/pillars/ai-collaboration/hallucination-reduction-pattern) — abstention as a first-class outcome.
