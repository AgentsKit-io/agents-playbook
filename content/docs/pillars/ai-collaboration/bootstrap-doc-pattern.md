---
title: 'Bootstrap Doc Pattern'
description: 'The file an agent reads first, every session. Two files together: one for non-negotiables, one for routing.'
---

# Bootstrap Doc Pattern

The file an agent reads first, every session. Two files together: one for non-negotiables, one for routing.

## TL;DR (human)

`CLAUDE.md` (or `AGENTS.md` per your toolchain) at the repo root, loaded automatically. It carries the eight non-negotiables, the build commands, and a pointer to a separate `AGENTS.md` (routing table). Under 200 lines. Updated only when the rules change.

## For agents

### Why two files

`CLAUDE.md`: non-negotiables. Stable. Mirror of the rules in [`../../README.md`](../../README.md). Updated rarely.

`AGENTS.md` (or equivalent): routing. Volatile. Updated when packages get added, renamed, merged. Lists every package + which surface it owns.

Why separate: the routing changes far more often than the rules. Keeping them in one file forces a rule re-read every time a package is renamed, which is wasteful. Keeping them separate lets the rules cache in the agent's working memory across sessions while routing stays current.

### `CLAUDE.md` shape

Six sections, in order:

1. **Title + one-paragraph repo at a glance.** Stack, package count, app count, top-level layout.
2. **Pointer to the canonical doc.** "`AGENTS.md` is the routing table — read it first when you don't know which package to touch."
3. **Non-negotiables.** The eight-rule kernel (see [`../../README.md`](../../README.md)) trimmed to what applies to this codebase, numbered.
4. **Before you ship.** The exact commands (lint, test, gate). Per-package versus whole-repo distinction.
5. **Where to look next.** Five-row table mapping intent to doc path.
6. **When a doc contradicts the code.** "The code wins. Update or remove the doc."

Template: [`../../templates/CLAUDE.md.template.md`](../../templates/CLAUDE.md.template.md).

### `AGENTS.md` shape

1. **TL;DR philosophy** — 3–5 numbered statements. Why this codebase looks the way it does.
2. **Mental map** — 4–7 logical groups, each with the packages in that group and the concern they own. Agents triage faster by group than by alphabetical name.
3. **Routing table** — two-column: "I want to change…" → "Edit…".
4. **Workflow** — verify-first; one sub-unit; intent manifest; self-review.
5. **When something is unclear** — escalation path (read for-agents doc → ADR → code → open `discuss:` issue).

Template: [`../../templates/AGENTS.md.template.md`](../../templates/AGENTS.md.template.md).

### Length discipline

- `CLAUDE.md`: ≤ 200 lines (the agent reads it whole every session).
- `AGENTS.md`: ≤ 400 lines; if it grows past that, split per-package detail into `docs/for-agents/packages/\<pkg\>.md` and link.

If either file is over budget, agents skim instead of read. Skim defeats the purpose.

### Versioning

These files are part of the code. They go through PR review. Changes to the non-negotiables require an ADR (the rule change IS an architecture decision).

Routing-table changes do not require an ADR — they reflect the codebase, which itself went through ADRs.

### Gate

Recommended automated checks:

1. **Existence** — `CLAUDE.md` (or `AGENTS.md`) must exist at the repo root. CI fails otherwise.
2. **Size budget** — `CLAUDE.md` ≤ 200 lines.
3. **Routing currency** — every package in the workspace appears at least once in `AGENTS.md`'s mental map or routing table. Stale entries (referring to deleted packages) fail.

Reference impl: a `check-agent-docs.example.mjs` in [`../../scripts/`](../../scripts/) (ship in a future session).

### Common failure modes

- **One mega-file.** Non-negotiables + routing + per-package detail all in one place; 1500 lines; agents read the first 300 and miss the rest. → Split into the two-file pattern.
- **Routing table out of date.** Lists a package that was renamed 3 weeks ago. Agents follow it, fail. → Make routing currency a gate.
- **Non-negotiables marketed as "guidelines".** Hedged language ("try to", "prefer"). Agents treat hedged rules as optional. → Imperative voice. "No `any`." not "Avoid `any` when possible."
- **`CLAUDE.md` references files that no longer exist.** → Gate that resolves every relative link.

### See also

- [`memory-pattern.md`](./memory-pattern.md) — `MEMORY.md` index loads alongside `CLAUDE.md`.
- [`../architecture/universal.md`](../architecture/universal.md) — the non-negotiables come from here.
- [`../../templates/CLAUDE.md.template.md`](../../templates/CLAUDE.md.template.md), [`../../templates/AGENTS.md.template.md`](../../templates/AGENTS.md.template.md).
