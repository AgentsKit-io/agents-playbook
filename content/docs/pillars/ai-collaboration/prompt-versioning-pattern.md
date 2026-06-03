---
title: 'Prompt Versioning Pattern'
description: 'Treat prompts as versioned, tested, experimentable production assets — not strings buried in code — so you can A/B them, measure impact, and roll back instantly.'
---

# Prompt Versioning Pattern

Treat prompts as versioned, tested, experimentable production assets — not strings buried in code — so you can A/B them, measure impact, and roll back instantly.

## TL;DR (human)

A system prompt is production behavior. Pull prompts out of inline string literals into a registry where each is a named, versioned artifact with a content hash and an eval result attached. Ship changes behind a version flag, run A/B between the live and candidate version on real traffic, decide with the eval framework, and keep the previous version a flag-flip away. A prompt change is a deploy of behavior — give it the same versioning, review, experimentation, and rollback you give code.

## For agents

### Prompts are behavior, not configuration

The system prompt, tool descriptions, and few-shot exemplars determine what your agent *does* more than most of the surrounding code. Yet they are routinely buried as inline strings, edited without review, shipped without measurement, and impossible to roll back without a redeploy. A one-line prompt tweak can cascade into a measurable product regression — so it deserves the full lifecycle of a behavior change.

### The prompt registry

Lift every prompt into a registry — one source of truth the runtime reads from:

- **Named + namespaced.** `content.draft.system`, `review.judge.faithfulness` — stable IDs, not anonymous strings.
- **Versioned.** Each meaningful change is a new version (semver or monotonic), not an in-place mutation. Old versions stay resolvable.
- **Content-hashed.** A hash of the rendered prompt detects "did this actually change?" and ties an eval result to the exact bytes that produced it.
- **Templated explicitly.** Variable slots (`{context}`, `{tools}`) are declared, so you can lint that a render fills them all and injects nothing unescaped (see [`../security/ai-llm-safety-pattern.md`](../security/ai-llm-safety-pattern.md) — prompt injection).
- **Metadata.** Author, date, linked eval run, the model(s) it was tuned for, and a one-line "why this version."

A prompt change is now a diff a reviewer can read, a gate can check, and an experiment can target.

### Every prompt change carries an eval result

This is the non-negotiable link to [`../quality/agent-eval-framework-pattern.md`](../quality/agent-eval-framework-pattern.md): a new prompt version is unreviewable without its eval delta. The PR shows "v4 → v5: faithfulness +6%, verbosity −3%, 0 format regressions, cost +2%." Reviewers approve a *measured* change, not a hopeful one.

### Experimentation: A/B prompts on real traffic

Offline evals approximate; the population decides. Run candidate prompt versions against the incumbent online:

- **Assign by stable unit.** Hash a user/session/tenant ID to a bucket so the same unit sees a consistent version (avoids within-session flip-flop) — same discipline as product flags, different unit.
- **Pick the metric before you look.** Define the primary online metric (accept rate, edit-distance, escalation rate, task completion) and guardrail metrics (cost, latency, safety) up front.
- **Power the test.** LLM outputs are high-variance; under-powered tests "prove" noise. Size the sample, or use sequential/pairwise designs that need fewer observations.
- **Watch guardrails for the loser's harm.** A variant that lifts accept rate but doubles cost or trips a safety metric is not a winner.
- **Promote or kill explicitly.** The winning version becomes the new default; the experiment is recorded with its result so it isn't re-run blindly.

### Versioning discipline

- **Additive by default.** Adding a version is safe; clients/flags pin a version. Never silently mutate a deployed version's bytes — that invalidates every eval and trace tied to its hash.
- **Pin model + prompt together.** A prompt tuned for one model can regress on another. The version's metadata records the model family it was validated against; re-eval before repointing.
- **Deprecate, don't delete.** Traces and incidents reference old versions. Keep them resolvable; mark retired ones (see [`../governance/tombstone-pattern.md`](../governance/tombstone-pattern.md)).

### Instant rollback

Because the prior version is still in the registry and selection is a flag, a regression caught online is a **flag flip, not a redeploy**. This is the entire point of decoupling prompt-selection from deploys: the blast radius of a bad prompt is seconds, not a release cycle.

### Iteration loop

```
hypothesis ("more explicit refusal → fewer unsafe completions")
   │
   ▼
new prompt version in registry (hashed, metadata)
   │
   ▼
offline eval delta (gate)  ──regression──▶ revise
   │ improvement
   ▼
A/B on real traffic behind version flag
   │
   ▼
decide on pre-registered metric  ──win──▶ promote default
   │                                ──loss/harm──▶ flag-flip rollback
   ▼
record experiment + feed new failures into eval set
```

Each turn of this loop is a measured, reversible, reviewed behavior change. That is what "iterate on prompts" means in production.

### Common failure modes

- **Inline string prompts.** Unversioned, unreviewable, un-rollbackable, untestable. → Registry with named versions.
- **In-place edits to a deployed version.** Breaks every eval/trace tied to its hash; "which prompt produced this output?" becomes unanswerable. → New version per change; old bytes immutable.
- **Ship without an eval delta.** A hope, not a change. → Eval result is part of the PR.
- **A/B with no pre-registered metric.** Cherry-pick whatever moved → false wins. → Declare primary + guardrail metrics first; power the test.
- **Ignoring variance.** Tiny sample "proves" a 2% lift that is noise. → Size for the variance LLM outputs actually have.
- **Prompt repointed to a new model without re-eval.** Silent regression on the new model's quirks. → Pin + re-validate model with prompt.
- **No rollback path.** A bad prompt needs a full redeploy to undo. → Selection is a flag; prior version stays live.

### See also

- [`../quality/agent-eval-framework-pattern.md`](../quality/agent-eval-framework-pattern.md) — how you decide which version wins.
- [`../architecture/feature-flags-pattern.md`](../architecture/feature-flags-pattern.md) — the flag mechanism prompt-selection rides on.
- [`../quality/product-analytics-experimentation-pattern.md`](../quality/product-analytics-experimentation-pattern.md) — A/B statistics; prompts are just a different experimental unit.
- [`context-management-pattern.md`](./context-management-pattern.md) — what fills the template slots.
- [`../security/ai-llm-safety-pattern.md`](../security/ai-llm-safety-pattern.md) — template injection + safety on the prompt surface.
- [`../../prompts/README.md`](../../prompts/README.md) — the system/sub-agent prompts this pattern versions.
