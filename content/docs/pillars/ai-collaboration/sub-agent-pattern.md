---
title: "Sub-agent Pattern"
description: "How to delegate scoped tasks to specialist agents so the orchestrator stays focused."
---

# Sub-agent Pattern

How to delegate scoped tasks to specialist agents so the orchestrator stays focused.

## TL;DR (human)

Sub-agents are scoped specialists. Each gets a narrow task, a narrow toolset, and returns a summary, not a file dump. Use them for searches, plans, reviews, and parallel implementations. Tier the model size by task complexity.

## For agents

### When to delegate

Delegate when **any** of the following is true:

- The task means reading across many files and you only need the conclusion.
- The task is independent of what you are doing now (can run in parallel).
- The task fits a recurring shape (search, plan, review, implement) you already have a recipe for.
- Your context is filling and the task does not need your conversation history.

Do **not** delegate when:

- You already know the answer (a single grep).
- The task requires your conversation history (sub-agents do not see it).
- The task is destructive or hard to reverse (you want it on your own conscience).

### Recipe shape

A sub-agent recipe specifies:

1. **Role.** One sentence: what kind of agent this is.
2. **Tools.** The minimum tool set. Less is more — narrow tools force focus.
3. **Inputs.** What the orchestrator must pass.
4. **Outputs.** The exact shape of the summary returned to the orchestrator.
5. **Stop condition.** When the sub-agent is done.

### Canonical recipes

| Recipe | Role | Tools | Stop when |
|---|---|---|---|
| `explore` | Read-only search across files | read, grep, glob, ls | Found the file / symbol asked for, returns excerpts + paths |
| `plan` | Step-by-step implementation plan | read, web fetch | Plan written; orchestrator owns execution |
| `code-explorer` | Trace execution paths, map dependencies | read, grep, glob | Diagram + dependency list returned |
| `code-reviewer` | Confidence-filtered review pass | read, git diff | Issues returned with confidence scores; orchestrator decides which to fix |
| `implementer` | Build a sub-unit against a finalised plan | read, edit, write, bash | PR-ready diff, tests green |
| `security-reviewer` | Security review of pending changes | read, git diff | Findings + severity list |

### Model tiering

Smaller models on smaller tasks. Reserve the largest model for what needs deep reasoning.

| Task complexity | Model tier | Examples |
|---|---|---|
| Trivial | small (haiku-class) | Find a file by name; grep for a symbol; list a directory |
| Simple | medium (sonnet-class) | Write documentation; write unit tests; review code |
| Complex | large (opus-class) | Architect a feature; design a contract; resolve a tricky merge |

Mis-tiering hurts both directions. Putting a small model on architecture wastes time. Putting a large model on a `grep` wastes money.

### Outputs are summaries

A sub-agent returns a **summary to the orchestrator**, not a file dump. The orchestrator pastes the summary to the user / next agent — the sub-agent's full transcript is invisible.

This means:

- The sub-agent's last message must be self-contained.
- It cites file paths + line numbers in clickable form (`path:line`).
- It does not include long excerpts unless asked.
- It explicitly says "done" or "blocked on X" — no ambiguity.

### Parallelism

Independent sub-agents run in parallel. The orchestrator launches all of them in one batch, waits for results, then proceeds.

Rule: if N tasks share no data dependency, launch all N at once. Sequential launch wastes wall-clock time.

### Continuation vs new spawn

Two ways to talk to a sub-agent again:

- **Continue** the existing one (your toolchain has a "send message to agent \<id\>") — preserves its context.
- **Spawn a new one** — fresh context, no recall.

Continue when the task is an extension of the prior one. Spawn fresh when the task is unrelated; carrying old context bloats the new task.

### Common failure modes

- **Sub-agent that needed orchestrator context.** "Implementer" launched without the plan; produces something off-spec. → Pass the plan as input.
- **Orchestrator re-runs a search the sub-agent already did.** Wastes time. → Trust the sub-agent's summary; ask follow-ups if needed.
- **Sub-agent given every tool "just in case".** Wanders. → Narrow toolset.
- **Mis-tiered model.** Opus on a grep; haiku on architecture. → Tier by task class, not by "best available".
- **Sub-agent transcript leaked to user as primary output.** User now sees raw exploration noise. → Orchestrator distills the summary; transcript is internal.

### See also

- [`../../prompts/README.md`](../../prompts/README.md) — recipe index (bodies in a future session).
- [`slash-commands-pattern.md`](./slash-commands-pattern.md) — slash commands often wrap a sub-agent.
- [`universal.md`](./universal.md) — Rule 8.
