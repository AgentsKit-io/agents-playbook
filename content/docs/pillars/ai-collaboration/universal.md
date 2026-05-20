---
title: 'AI Collaboration — Universal Principles'
description: 'How to get production-grade work out of an AI coding agent, durably, across sessions and across multiple agents working in parallel.'
---

# AI Collaboration — Universal Principles

How to get production-grade work out of an AI coding agent, durably, across sessions and across multiple agents working in parallel.

## TL;DR (human)

Ten rules. They are stack-agnostic, model-agnostic (Claude / GPT / Gemini / open-weights), and tool-agnostic (Cursor / Copilot / Claude Code / Aider / Roo / your CLI). Adopt all ten or expect specific failure modes to repeat.

1. Bootstrap doc at the repo root, loaded every session.
2. Routing table that maps intent to file path.
3. Persistent memory as one-fact-per-file, not chat history.
4. Verify-first before any action.
5. One sub-unit per session.
6. Honest reporting — failures stated, not glossed.
7. Explicit goal, explicit exit condition.
8. Delegate fan-outs to scoped sub-agents.
9. Concurrent-agent awareness — your branch is not the only branch.
10. Lessons land in memory the moment they happen.

## For agents

### Rule 1 — Bootstrap doc at the repo root

A file named `CLAUDE.md`, `AGENTS.md`, or `.cursorrules` (per your toolchain) must exist at the repo root. It is the first thing the agent loads. It contains:

- the non-negotiables (the irreducible rules — see [`../../README.md`](../../README.md) for the eight-rule kernel),
- a one-paragraph "repo at a glance",
- a pointer to the routing table,
- the build / test / gate commands.

Keep it under 200 lines. Agents read the whole thing every session; long files dilute attention.

Template: [`../../templates/CLAUDE.md.template.md`](../../templates/CLAUDE.md.template.md).

**Failure mode prevented:** agents reinventing rules each session because the rules were "in the chat" of a previous session, which the agent does not see.

### Rule 2 — Routing table

A second file (`AGENTS.md` — separate from the non-negotiables doc) is a routing table. Two-column: "I want to change X" → "edit path Y". Rows are not for every file — they are for **every place an agent might plausibly land if they got it wrong**.

If two rows could plausibly apply to the same change, the boundary is wrong. Fix the boundary or merge the rows.

Template: [`../../templates/AGENTS.md.template.md`](../../templates/AGENTS.md.template.md).

**Failure mode prevented:** agents creating sibling packages because they did not know where the right one was; agents piling code into the largest file because no rule said where it went.

### Rule 3 — Persistent memory as one-fact-per-file

Memory is what survives between sessions. It is not chat history; it is curated.

- One memory = one file.
- Files have frontmatter (`name`, `description`, `type`).
- Types: `user`, `feedback`, `project`, `reference`.
- An index file (`MEMORY.md`) lists them one-line each; the index is what loads every session.
- Memories link to each other with `[[name]]`.

When a non-obvious lesson lands, write a memory **immediately** — not at session end. Session-end is too late; you have already forgotten the precise context.

Template: [`../../templates/MEMORY.md.template.md`](../../templates/MEMORY.md.template.md).

**Failure mode prevented:** agents repeating the same fixed mistake across sessions because the lesson lived only in the prior conversation.

### Rule 4 — Verify-first

Before any action, confirm state is what you think it is.

- Before opening an issue: search if it already exists.
- Before fixing an issue: confirm it is still open (`gh issue view \<n\> --json state`). Another agent may have closed it.
- Before pushing: `git fetch` and check if your branch is still up to date.
- Before claiming a file exists: read it. Memories may reference files that were since renamed.
- Before claiming duplication: pull the upstream `.d.ts` and read the real API. Naming similarity is not duplication.

Verify-first is cheap. The failures it prevents are expensive (dup PRs that get rejected; conflicts at merge; stale-state code review).

**Failure mode prevented:** agents grinding for hours on issues that were closed concurrently; agents proposing fixes to files that were since deleted; agents claiming duplication based on doc names instead of exported APIs.

### Rule 5 — One sub-unit per session

A sub-unit is one discrete, shippable change. Defined up front. No scope creep mid-session.

- If you discover a second issue while working, file it. Do not fix it now.
- If the work is bigger than a session, split it into phases, ship phase 1, continue in a fresh session.
- Quality over speed. A session that ships one clean sub-unit beats a session that ships three half-done ones.

**Failure mode prevented:** large PRs that combine unrelated changes; reviewers unable to verify intent; later-session agents reverting one part of the work because they only saw the related part.

### Rule 6 — Honest reporting

When the agent reports state at the end of a turn, the report must match reality.

- "Tests passed" only if all tests in scope passed. If 12 of 13 passed, say so, and quote the failure.
- "Quality gates green" only if gates ran and exited 0.
- "Step was skipped" rather than burying it.
- "I could not verify X" rather than asserting X.

Production agents that report optimistically erode trust fastest. Once the reviewer cannot believe the agent's report, every PR needs full re-verification — which defeats the productivity gain.

**Failure mode prevented:** silent regressions; PRs landing red because the agent claimed green; reviewer fatigue forcing manual verification of every claim.

### Rule 7 — Explicit goal, explicit exit condition

A session has a goal. The goal is stated, not implied. The agent works toward the goal until an exit condition holds.

- "Add login flow" is not a goal. "Add OAuth login with Google + GitHub providers, tested against the mock IdP, behind a feature flag" is a goal.
- "Until the user says stop" is not an exit condition. "When the test passes and the PR is open" is an exit condition.

Toolchains expose this as "goal mode" or "stop hooks". Use them. The agent's heuristic to stop is unreliable; the explicit condition is reliable.

**Failure mode prevented:** agents stopping mid-task because the conversation turn felt like a stopping point; agents over-iterating on a task that was actually done.

### Rule 8 — Delegate fan-outs to scoped sub-agents

A sub-agent is a scoped specialist: it gets a narrow task, a narrow toolset, and its result is returned as a summary.

Sub-agent types worth defining:

| Type | Tools | Use when |
|---|---|---|
| `explore` | read + grep + glob | Searching across many files; you only need the conclusion |
| `plan` | read + web fetch | Designing a step-by-step approach before implementing |
| `code-reviewer` | read + git diff | Confidence-filtered review pass |
| `implementer` | read + edit + bash | Building a sub-unit against a finalised plan |

Tier the model by task complexity: light tools / search → haiku-tier; documentation, unit tests, code review → sonnet-tier; complex reasoning → opus-tier. Reserve the largest model for what truly needs it.

**Failure mode prevented:** one agent context bloating with file dumps from a search; one agent context losing focus by interleaving planning with implementation.

### Rule 9 — Concurrent-agent awareness

Your branch is not the only branch. Another agent may be:

- editing the same file in a parallel worktree,
- closing the issue you are about to fix,
- merging a PR that conflicts with yours,
- pushing to main while you rebase.

Defensive practices:

- `git fetch` at session start.
- `gh pr list --search "is:open \<path-fragment\>"` to detect parallel work touching the same files.
- Rebase, don't merge, when integrating main into a feature branch.
- Stash + verify red on a clean `origin/main` before "fixing" a CI failure — the failure may be pre-existing, not your fault.

**Failure mode prevented:** PRs that conflict catastrophically with parallel work; agents shipping fixes for already-fixed bugs; agents accidentally reverting peer work via `--theirs`/`--ours`.

### Rule 10 — Lessons land in memory the moment they happen

When you discover a fact that future sessions will need, write a memory. Not at session end. Not "if I have time". Now.

Triggers to write a memory:

- The user corrected you on a non-obvious point.
- You discovered a failure mode that took >15 minutes to debug.
- You found a non-obvious convention by reading code.
- You confirmed something that contradicts what a doc says.

What does **not** trigger a memory:

- Information already in `CLAUDE.md` or `AGENTS.md`.
- Information derivable from `git log` or `gh issue view`.
- One-time facts that will not recur (a specific bug fix unrelated to a pattern).

The memory is a fact + how to apply it + why. Three lines minimum. If you cannot write three lines, the lesson is not yet learned.

**Failure mode prevented:** the same lesson re-discovered every quarter; memory bloating with chat-scoped facts; new agents getting no benefit from prior sessions.

## See also

- [`../../templates/CLAUDE.md.template.md`](../../templates/CLAUDE.md.template.md), [`../../templates/AGENTS.md.template.md`](../../templates/AGENTS.md.template.md), [`../../templates/MEMORY.md.template.md`](../../templates/MEMORY.md.template.md).
- [`../governance/README.md`](../governance/README.md) — PR-intent + merge rules that operationalize rules 5, 6, 9.
- [`../../prompts/README.md`](../../prompts/README.md) — system prompts + sub-agent recipes for rule 8.
