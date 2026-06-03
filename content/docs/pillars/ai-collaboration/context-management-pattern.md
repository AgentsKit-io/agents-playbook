---
title: 'Context Management Pattern'
description: 'Engineer what goes into the context window — selection, ordering, compaction, retention — because the context is the program the model runs.'
---

# Context Management Pattern

Engineer what goes into the context window — selection, ordering, compaction, retention — because the context is the program the model runs.

## TL;DR (human)

The context window is a scarce, attention-limited budget, not a bucket you fill. Quality and reliability depend more on *what you put in front of the model and where* than on the model itself. Engineer it deliberately: a fixed budget split across system/tools/retrieved/history/scratch; retrieve the few most relevant chunks, not everything; place the most important content at the edges (models attend least to the middle); compact long histories into running summaries before they overflow; and persist durable facts to external memory instead of re-stuffing them every turn. More tokens is not more intelligence — it is more noise and more cost.

## For agents

### The context is the program

A model has no state between calls except what you re-supply. Every turn, *you* assemble the program it executes: instructions, tools, retrieved knowledge, prior turns, and working notes. The model's output quality is bounded by the quality of that assembly. Most "the model isn't smart enough" problems are context problems — the right fact was absent, buried in the middle, or drowned by 50 irrelevant ones.

### Budget the window like memory

Treat the window as a fixed allocation, not a free pool. A typical split:

| Region | Holds | Discipline |
|---|---|---|
| System / instructions | Role, rules, output contract | Stable, versioned (see [`prompt-versioning-pattern.md`](./prompt-versioning-pattern.md)); keep tight |
| Tool definitions | Only the tools relevant to this task | Gate the toolset; 50 tool specs is noise and a latency tax |
| Retrieved knowledge | Top-k most relevant chunks | Few and on-target beats many and vague |
| Conversation history | Recent turns + compacted older summary | Compact, don't accumulate |
| Working scratch / artifacts | Current files, intermediate results | Reference by handle when large |

Reserve headroom for the output. Track utilization as a metric: an agent running at 95% of the window is one long input away from truncation failures.

### Relevance over volume — the retrieval discipline

Stuffing "everything that might help" actively degrades quality: it dilutes attention, raises cost and latency, and increases the chance the model fixates on an irrelevant passage.

- **Retrieve, rank, then trim to top-k.** Fewer, higher-precision chunks beat exhaustive recall.
- **Compress chunks** to the spans that matter; drop boilerplate.
- **Deduplicate.** Three paraphrases of the same fact waste budget and over-weight it.
- **Cite what you injected** so the output (and your faithfulness eval) can be traced to sources, not to the model's parametric guesses (see [`hallucination-reduction-pattern.md`](./hallucination-reduction-pattern.md)).

### Position matters — the lost-in-the-middle effect

Models attend most to the **start and end** of the context and least to the middle. Long-context capacity is not uniform recall. So:

- Put the **task instruction and the output contract at the end**, nearest the generation point.
- Put **critical constraints and the most important retrieved fact near the top or bottom**, never buried mid-stack.
- Don't assume "it's in the window" means "it will be used." If a fact is load-bearing, position it and, for the highest stakes, restate it.

### Compaction — surviving long sessions

A long-running agent will exceed any window. Compact instead of truncating blindly:

- **Running summary.** Periodically replace the oldest turns with a model-written summary that preserves decisions, open threads, and constraints — discard the verbatim chatter.
- **Summarize on a budget threshold, not a turn count**, so compaction fires when pressure is real.
- **Preserve the load-bearing, drop the transient.** Decisions, identifiers, user constraints survive; greetings and resolved tangents go.
- **Keep a pointer to the full record.** The compacted summary references where the detail lives (a log, a file) so nothing is irrecoverable — it is demoted, not deleted.
- **Pin anchors.** The original goal and hard constraints should never be summarized away; re-inject them verbatim each compaction.

### External memory — don't re-stuff durable facts

Anything that must persist across sessions does not belong in the rolling context — it belongs in durable memory the agent reads on demand:

- A facts store (one fact per record, retrieved by relevance) keeps the window lean and survives session ends.
- A bootstrap doc (`CLAUDE.md`/`AGENTS.md`) is the always-loaded slice; everything else is fetched when relevant.
- This is the difference between an agent that re-learns the project every turn and one that *remembers*.

See [`memory-pattern.md`](./memory-pattern.md) and [`bootstrap-doc-pattern.md`](./bootstrap-doc-pattern.md).

### Caching the stable prefix

If your stack supports prompt caching, **order context stable-first**: system + tools + long-lived context at the front (cache hit), volatile turn-specific content at the back. Reordering the stable prefix every turn throws the cache away — a silent latency and cost regression. Cache-awareness is a context-ordering decision.

### Context retention as an eval dimension

"Did the agent remember the constraint from 20 turns ago?" is measurable. Add retention cases to the eval suite: long inputs with a load-bearing fact early, then a question that needs it. Track the score per context-length slice — this is exactly where aggregate metrics hide regressions (see [`../quality/agent-eval-framework-pattern.md`](../quality/agent-eval-framework-pattern.md)).

### Common failure modes

- **Stuff-everything retrieval.** Dilutes attention, raises cost, invites fixation on noise. → Top-k, ranked, trimmed, deduped.
- **Load-bearing fact in the middle.** Present but ignored (lost-in-the-middle). → Position at edges; restate the critical ones.
- **Blind truncation at overflow.** Drops the goal or a key constraint silently. → Compact to a summary; pin anchors.
- **Re-stuffing durable facts every turn.** Burns budget, still forgets across sessions. → External memory, retrieve on demand.
- **Reordering the stable prefix each turn.** Kills the prompt cache; cost/latency regress invisibly. → Stable-first ordering.
- **Treating long-context models as infinite uniform recall.** Quality degrades with fill even under the limit. → Budget + measure utilization; retention evals per length slice.
- **Full toolset always in context.** 50 tool specs of noise + latency. → Gate tools to the task.

### See also

- [`memory-pattern.md`](./memory-pattern.md) — durable external memory the window pulls from.
- [`bootstrap-doc-pattern.md`](./bootstrap-doc-pattern.md) — the always-loaded context slice.
- [`prompt-versioning-pattern.md`](./prompt-versioning-pattern.md) — the system region is a versioned asset.
- [`hallucination-reduction-pattern.md`](./hallucination-reduction-pattern.md) — grounding the model in injected context, not parametric memory.
- [`../quality/agent-eval-framework-pattern.md`](../quality/agent-eval-framework-pattern.md) — retention + per-length-slice scoring.
- [`../../prompts/slash-clear.md`](../../prompts/slash-clear.md) — resetting context deliberately between tasks.
