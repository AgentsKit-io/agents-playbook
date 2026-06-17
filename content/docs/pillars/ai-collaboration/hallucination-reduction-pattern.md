---
type: Playbook Pattern
title: 'Hallucination Reduction Pattern'
description: 'Make model output you can put your name on — grounding, constrained generation, verification, and abstention — so the system says "I don''t know" instead of confidently inventing.'
---

# Hallucination Reduction Pattern

Make model output you can put your name on — grounding, constrained generation, verification, and abstention — so the system says "I don't know" instead of confidently inventing.

## TL;DR (human)

A hallucination is a fluent, confident, unsupported claim. You cannot prompt it to zero, so build layers: **ground** the model in retrieved sources and tell it to answer only from them; **constrain** generation with schemas and enums so it can't invent shapes; **verify** the output against the sources (deterministic citation checks + an LLM faithfulness judge) before it ships; and give the model a real **abstention** path so "I don't know / insufficient information" is a first-class, rewarded answer. Then measure faithfulness as an eval dimension and watch it online. Confident wrongness is the failure mode that destroys trust — engineer against it explicitly.

## For agents

### What a hallucination actually is

The model is a fluency engine; correctness is not its objective, plausibility is. It will produce a confident citation, API, statistic, or name that does not exist, because that string was *likely*, not *true*. The danger is not that it is wrong — it is that it is wrong **and indistinguishable in tone from when it is right**. Trust dies when a user catches one invented fact in otherwise-polished output. Defense is layered, not a single prompt line.

### Layer 1 — Ground it (retrieval, not recall)

The single biggest lever: stop asking the model to recall, start asking it to read.

- **Provide the sources** in context and instruct: *answer only from the provided material; if it isn't there, say so.* Closed-book → open-book.
- **Demand citations.** Every claim names the source span it came from. A claim with no citation is, by policy, unsupported — and that is deterministically checkable.
- **Quote before you reason** for high-stakes facts: have the model extract the exact supporting quote, then answer from the quote. Forces grounding, exposes the gap when there is no quote.
- **Curate what you ground on.** Garbage sources → confidently grounded garbage. Retrieval quality is hallucination control (see [`context-management-pattern.md`](/docs/pillars/ai-collaboration/context-management-pattern)).

### Layer 2 — Constrain generation

Shrink the space in which the model can invent:

- **Schemas + enums.** If a field must be one of five values, make it an enum — it cannot hallucinate a sixth. Structured output via schema kills whole classes of made-up shapes.
- **Tools over freehand.** For anything checkable — math, current data, lookups — call a tool. A calculator does not hallucinate arithmetic; a database does not invent a row. Move facts out of the model's head and into systems of record.
- **Lower temperature for factual tasks.** Creativity settings are not factual settings.

### Layer 3 — Verify before shipping

Treat raw generation as a draft to be checked, not an answer:

- **Deterministic checks (free).** Every cited source exists and is in the provided set. Every claim has a citation. Numbers/IDs/quotes appear verbatim in a source. Links resolve. These catch a large fraction at zero model cost.
- **LLM faithfulness judge.** A separate model call scores: *is every statement supported by the cited source?* Unsupported span → flag. This is the faithfulness dimension of [`../quality/agent-eval-framework-pattern.md`](/docs/pillars/quality/agent-eval-framework-pattern). Use a different model family than the generator where feasible (a model is a weak judge of its own confident errors).
- **Self-consistency for high stakes.** Sample N times; claims that don't survive across samples are low-confidence. Disagreement is a hallucination smell.
- **Adversarial verification.** A skeptic pass prompted to *refute* each claim; majority-refuted claims are cut. Refutation surfaces what confirmation misses.

### Layer 4 — Make "I don't know" a first-class answer

Most hallucination is the model refusing to abstain. Engineer abstention in:

- **Explicitly permit and reward it.** "If the sources do not support an answer, respond exactly: *insufficient information* — this is correct, not failure." Without this, the model guesses to satisfy the instruction.
- **Confidence-gated escalation.** Low support / low self-consistency → route to a human rather than emit (see [`human-in-the-loop-pattern.md`](/docs/pillars/ai-collaboration/human-in-the-loop-pattern)). A handed-off uncertainty beats a confident fabrication.
- **Calibrate, don't suppress.** The goal is honest uncertainty, not a model too timid to ever answer. Tune abstention against the eval set so you trade off false-invents vs. false-abstains deliberately.

### Measure it, online and off

- **Faithfulness is an eval dimension**, scored per change and tracked per slice. A prompt that lifts tone but drops faithfulness is a regression.
- **Online:** track correction/edit rate on factual claims and user reports of wrong facts. A rising fact-edit rate is a hallucination regression even when offline looks fine.
- **Hallucination evals seed from caught cases.** Every invented fact a user catches becomes a frozen test case.

### Common failure modes

- **Closed-book on factual tasks.** Asked to recall → invents. → Ground in retrieved sources; answer only from them.
- **No citations.** Unsupported and unverifiable. → Mandate per-claim citations; gate on it.
- **Self-judging.** The generator rates its own confident error as fine. → Judge with a different model; adversarial refute pass.
- **No abstention path.** Forced to answer → guesses. → Make "insufficient information" explicit and rewarded; escalate low-confidence.
- **Freehand math/lookups.** Invents arithmetic and rows. → Tools + systems of record.
- **High temperature for facts.** Tuned for creativity, used for truth. → Lower it for factual generation.
- **Faithfulness untracked.** Regresses silently behind a tone improvement. → Eval dimension + online fact-edit rate.

### See also

- [`../quality/agent-eval-framework-pattern.md`](/docs/pillars/quality/agent-eval-framework-pattern) — faithfulness scoring + verification as evals.
- [`context-management-pattern.md`](/docs/pillars/ai-collaboration/context-management-pattern) — grounding quality = retrieval quality.
- [`human-in-the-loop-pattern.md`](/docs/pillars/ai-collaboration/human-in-the-loop-pattern) — where low-confidence output escalates.
- [`tool-design-pattern.md`](/docs/pillars/ai-collaboration/tool-design-pattern) — tools move facts out of the model's head.
- [`../security/ai-llm-safety-pattern.md`](/docs/pillars/security/ai-llm-safety-pattern) — adversarial inputs that induce confident error.
- [`../architecture/contracts-zod-pattern.md`](/docs/pillars/architecture/contracts-zod-pattern) — schemas/enums that constrain generation.
