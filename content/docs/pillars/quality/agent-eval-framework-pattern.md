---
title: 'Agent Eval Framework Pattern'
description: 'How to measure whether an AI agent is actually good — deterministic checks, LLM-as-judge, and production monitoring — so quality scales with the system instead of breaking as it grows.'
---

# Agent Eval Framework Pattern

How to measure whether an AI agent is actually good — deterministic checks, LLM-as-judge, and production monitoring — so quality scales with the system instead of breaking as it grows.

## TL;DR (human)

A correct generation cannot be a lucky one. Build a three-tier eval stack: **deterministic graders** (cheap, exact, in CI — schema/format/regex/tool-call assertions), **LLM-as-judge** (rubric-scored, for the subjective majority — relevance, faithfulness, tone), and **production monitoring** (online signals — thumbs, edits, regenerations, escalations). Every prompt or model change runs the offline suite *before* merge and is watched online *after* ship. The eval set is a versioned asset, graded against a rubric you wrote down, with the judge itself calibrated against human labels. No eval, no merge.

## For agents

### Why evals are the whole job

Models are non-deterministic; a prompt that "looks better" can silently regress 20% of cases you never re-read. Without a measurement harness you are tuning by vibes, and vibes do not survive a model upgrade, a prompt refactor, or a new teammate. The eval suite is what converts "I think this is better" into "this is +6% faithfulness, −3% verbosity, no format regressions, ship it."

The harness — orchestration, evals, guardrails, scaffolding — matters as much as the model. Evals are the part that lets you change everything else with confidence.

### The three tiers

| Tier | Grader | Cost | Runs | Answers |
|---|---|---|---|---|
| **Deterministic** | Code (assert/schema/regex/exact) | ~free | Every commit, in CI | "Did it obey the contract?" — valid JSON, required fields, correct tool called, no banned token, length budget |
| **LLM-as-judge** | A model scoring against a rubric | $ per case | Pre-merge on changed prompts; nightly full | "Is it *good*?" — relevance, faithfulness to source, instruction-following, tone, completeness |
| **Production monitoring** | Real user + implicit signals | live | Continuously | "Is it good *in the wild* on inputs we never imagined?" — accept/edit/regenerate/escalate rates, latency, cost |

You need all three. Deterministic alone misses quality; judge alone is expensive and drifts; production alone is too late and too noisy. They form a funnel: deterministic gates the cheap failures, the judge ranks the survivors, production catches the unknown unknowns and feeds new cases back into the offline set.

### Tier 1 — Deterministic graders (start here)

The cheapest, most reliable evals are plain code. Maximise what you can check without a model:

- **Structural.** Output parses against its schema (Zod/JSON-Schema). Required fields present. Enum values valid.
- **Tool-call assertions.** Given input X, the agent must call tool `T` with args matching a predicate — and must *not* call destructive tools it wasn't asked to.
- **Format/policy.** No banned phrases, no leaked system-prompt text, no PII echoed, within token/length budget, citations present when claims are made.
- **Golden trajectories.** For multi-step agents, assert the *sequence* of tool calls on a fixed scenario (with tolerant matching where order is free).

Anything a regex or a schema can decide should never go to a model. Push the boundary up: every failure mode you can encode deterministically is a failure mode that costs nothing to catch forever.

### Tier 2 — LLM-as-judge (the subjective majority)

Most "is this good?" questions are not codeable. Use a model as grader — but engineer the judge as carefully as the system under test:

- **Write the rubric first, as a contract.** Each dimension (faithfulness, relevance, completeness, tone) gets an explicit definition and a discrete scale (1–5 or pass/fail). "Good" is not a rubric; "every claim is supported by the provided source; unsupported claim = fail" is.
- **Prefer reference-based and pairwise.** Scoring against a reference answer, or A-vs-B pairwise ("which better follows the rubric?"), is far more stable than absolute 1–10 scoring, which drifts and clusters at 7.
- **Decompose.** One judge call per dimension beats one call rating everything — sharper, debuggable, parallelizable.
- **Force structured verdicts.** The judge returns `{score, reason}` via a schema; the reason is your audit trail and your debugging signal.
- **Calibrate the judge against humans.** Periodically hand-label a sample and measure judge↔human agreement (e.g. Cohen's κ). An uncalibrated judge is a confident liar. Re-calibrate when you change the judge model or rubric.
- **Mitigate known judge biases.** Position bias (swap A/B order and average), verbosity bias (longer ≠ better — control for it), self-preference (a model favors its own style — judge with a different model family than the one under test where feasible).

### Tier 3 — Production monitoring (online truth)

Offline evals approximate; production decides. Instrument the implicit signals users emit:

| Signal | Reads as | Quality proxy |
|---|---|---|
| Accepted as-is | strong positive | output was shippable |
| Edited before use | weak negative | close but wrong somewhere — *the diff is gold* |
| Regenerated | negative | first attempt failed |
| Escalated to human / abandoned | strong negative | agent could not do the job |
| 👍 / 👎 explicit | labeled | direct, but sparse and biased |

Per-output, attach a trace: prompt version, model, tools called, token + latency + cost, and the eval scores if it was sampled. Then production failures are *diagnosable*, not just countable. The **edit-distance between what the agent produced and what the user shipped** is one of the highest-signal metrics you have — it is a continuous quality gradient, free, and points straight at the failure.

### The eval set is a versioned asset

- **Seed from real failures.** Every production miss, every escalation, every bug becomes a frozen test case. The suite grows from reality, not imagination.
- **Cover the distribution, not just the happy path.** Easy / hard / adversarial / edge / known-past-failures. Track per-slice scores — an aggregate that hides a 40% regression on "long inputs" is worse than useless.
- **Version it alongside the prompts.** A score is only comparable against the same eval set; pin the set version with the result.
- **Guard against contamination.** Eval cases must not leak into prompts/few-shots, or you measure memorization. Keep a held-out slice.
- **Watch for saturation.** When a suite hits ~100%, it has stopped discriminating — mine production for harder cases.

### Wiring it into the loop

```
change a prompt / model / tool
   │
   ▼
deterministic suite (CI gate)  ──fail──▶ block
   │ pass
   ▼
LLM-as-judge on changed scope  ──regression──▶ block + diff the failures
   │ pass / improvement
   ▼
ship behind a prompt version flag
   │
   ▼
production monitoring (online)  ──drift──▶ alert → new eval cases → repeat
```

- **No eval, no merge.** A prompt change without an eval result is unreviewable — it is a claim with no evidence. Treat the eval result like a test result: it is part of the PR.
- **Regression budget.** Define acceptable trade-offs up front ("may lose ≤1% on tone to gain ≥5% on faithfulness"), so a mixed result is a decision, not a debate.
- **Ship behind a version flag** so a regression caught online is a flag flip, not a redeploy (see [`../ai-collaboration/prompt-versioning-pattern.md`](/docs/pillars/ai-collaboration/prompt-versioning-pattern)).

### Cost & latency are eval dimensions too

Quality at 10× the cost or 5× the latency may be a regression. Track tokens, dollars, and p95 latency per eval case and per production output, and put them in the rubric trade-off. A "better" answer the product can't afford is not better.

### Common failure modes

- **Vibes-based prompt tuning.** "Looks better" ships a silent regression on cases you didn't re-read. → Offline suite, every change.
- **Absolute 1–10 judge scores.** Drift, cluster at 7, incomparable across runs. → Pairwise or reference-based; discrete scales.
- **Uncalibrated judge.** Trusted blindly, disagrees with humans 30% of the time. → Periodic human-label calibration; track agreement.
- **Eval set = happy path.** 98% offline, on fire in production. → Seed from real failures; per-slice scores; adversarial cases.
- **Contaminated eval set.** Cases leaked into prompts → measuring memorization. → Held-out slice; no overlap.
- **Saturated suite read as "we're done".** 100% means it stopped measuring. → Mine production for harder cases.
- **Aggregate hides slice regression.** Mean up, worst-slice down. → Always report per-slice.
- **Offline-only.** Ships, never watched. → Production monitoring closes the loop; the edit/regenerate signal is the cheapest truth you have.

### See also

- [`../ai-collaboration/prompt-versioning-pattern.md`](/docs/pillars/ai-collaboration/prompt-versioning-pattern) — what you A/B and roll back; evals are how you decide.
- [`../ai-collaboration/hallucination-reduction-pattern.md`](/docs/pillars/ai-collaboration/hallucination-reduction-pattern) — faithfulness is the eval dimension that catches hallucination.
- [`../ai-collaboration/human-in-the-loop-pattern.md`](/docs/pillars/ai-collaboration/human-in-the-loop-pattern) — escalation + edit signals feed the eval set.
- [`observability-pattern.md`](/docs/pillars/quality/observability-pattern) — per-output traces are the substrate for online evals.
- [`product-analytics-experimentation-pattern.md`](/docs/pillars/quality/product-analytics-experimentation-pattern) — product A/B vs. prompt A/B; same statistics, different unit.
- [`mutation-testing-pattern.md`](/docs/pillars/quality/mutation-testing-pattern) — the eval-suite-quality analogue: does your suite catch injected regressions?
- [`../security/ai-llm-safety-pattern.md`](/docs/pillars/security/ai-llm-safety-pattern) — safety evals are a slice of this suite.
