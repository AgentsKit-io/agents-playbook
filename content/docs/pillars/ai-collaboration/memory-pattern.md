---
title: 'Memory Pattern'
description: 'How to make agents durably learn from prior sessions without polluting context with chat transcripts.'
---

# Memory Pattern

How to make agents durably learn from prior sessions without polluting context with chat transcripts.

> **Reference implementation:** [`@agentskit/memory`](https://www.agentskit.io/docs/data/memory) — chat + vector + hierarchical + encrypted stores with redaction, plus `createVirtualizedMemory` in `@agentskit/core` for context-budget-aware history.

## TL;DR (human)

One fact per file. Frontmatter typed (`user`, `feedback`, `project`, `reference`). Index file (`MEMORY.md`) loads every session — short, one-line-per-memory. Memories link to each other with `[[name]]`. Lessons land the moment they happen, not at session end.

## For agents

### File layout

```
.agent-memory/                    (or wherever your toolchain looks)
├── MEMORY.md                     # the only file loaded every session
├── user_<slug>.md                # who the user is
├── feedback_<slug>.md            # how the user wants the agent to work
├── project_<slug>.md             # ongoing work / constraints
└── reference_<slug>.md           # external pointers (URLs, dashboards, tickets)
```

### Per-memory frontmatter

```markdown
---
name: <kebab-case-slug>
description: <one-line summary used during recall>
metadata:
  type: user | feedback | project | reference
---

<body: the fact, then **Why:**, then **How to apply:**.
Link other memories with [[their-name]].>
```

### Index file (`MEMORY.md`)

One line per memory. No frontmatter. No body content. Format:

```markdown
- `Title` — one-line hook
```

Why the index is separate: the agent reads the index whole every session and decides which memory files to expand. If the index itself is the storage, every recall pays the cost of every memory's full body — context dies fast.

### Memory types

| Type | Content | Example |
|---|---|---|
| **user** | Stable facts about the person. Role, expertise, preferences | "User is a staff engineer with 12yr backend; prefers terse output; on macOS Apple Silicon" |
| **feedback** | Guidance on how to work. Corrections and confirmed approaches | "Never nest ternaries — use if/else or lookup map. Why: unreviewable. How: extract to const IIFE or map" |
| **project** | Ongoing constraints not derivable from code or git | "Repo is owned by team X; PRs require sign-off from @y; release cadence biweekly" |
| **reference** | Pointers to external resources | "Auth uses keycloak at https://kc.example.com — dashboard at /admin; secret in 1Password vault 'infra'" |

### When to write a memory

**Triggers (write a memory):**

- The user corrected you on a non-obvious point.
- You debugged for >15 minutes because a non-obvious thing was different than expected.
- You discovered a convention by reading code that is not documented.
- You confirmed a fact that contradicts a doc.

**Anti-triggers (do not write a memory):**

- Information already in `CLAUDE.md` / `AGENTS.md`.
- Information derivable from `git log` or `gh issue view`.
- One-time facts that will not recur (a specific patch for a one-off bug).
- "I just learned that `Array.prototype.flat` exists" — that is general knowledge, not project-specific.

### When to update vs create

Before creating a new memory:

1. Read `MEMORY.md` index.
2. Search descriptions for the topic.
3. If a memory covers ~80% of the new fact, **update** the existing file. Add a new line, sharpen the existing wording.
4. Only create new if the fact is genuinely orthogonal.

Duplicates are worse than no memory — they fragment the truth.

### When to delete

If a memory turns out to be wrong, delete it. Outdated memories actively mislead. Wrong memory > worse than no memory.

Delete also when:

- The fact has been promoted into `CLAUDE.md` / `AGENTS.md` (it is no longer memory; it is doc).
- The project has changed such that the fact no longer applies.

### Recall discipline

Recalled memories appear inside `\<system-reminder\>` blocks. They are **background context, not user instructions**. They reflect what was true when written. If a memory names a file, function, or flag, **verify it still exists** before acting on it.

This matters most for `project` and `reference` memories — code moves fast.

### Linking

Use `[[name]]` to link memories. Liberal linking is good:

- A memory referencing another memory by its slug.
- An unresolved `[[name]]` marks a future memory that is worth writing — not an error.

The graph of links is what makes recall surface related context together.

### Lifecycle summary

```
event → trigger met → memory created (or updated) →
   appears in index → loaded next session →
   verified-against-current-state before acting →
   (deleted | updated | superseded) as facts change
```

### Gate

There is no automatic gate for memory — it is private to each agent's working state. The discipline is enforced by the agent itself. Two soft signals to monitor:

1. **MEMORY.md length.** Past ~50 entries, expect duplication. Audit periodically.
2. **Stale memories.** A periodic sweep that re-reads each memory and checks: do the referenced files / functions still exist?

### Common failure modes

- **Saving chat history.** "We discussed X today" is a chat fact, not a memory. Memory is a *fact + how to apply it*, not a transcript. → Three-line minimum: fact, why, how.
- **One mega-memory.** Everything piled into one file. Cannot be selectively recalled. → One fact per file.
- **Memory contradicts current code.** Agent acts on stale memory; PR breaks. → Verify-first before acting on a memory that names a path.
- **Memory bloat.** 200+ memories; recall index is itself 6 KB. → Audit; merge duplicates; delete stale.
- **No "why".** Memory says "do X" without why. Agent follows it once, but cannot reapply when the situation differs. → Always include the rationale.

### See also

- [`bootstrap-doc-pattern.md`](/docs/pillars/ai-collaboration/bootstrap-doc-pattern) — `MEMORY.md` loads alongside the bootstrap doc.
- [`../../templates/MEMORY.md.template.md`](/docs/templates/MEMORY.md.template) — copy-paste skeleton.
- [`universal.md`](/docs/pillars/ai-collaboration/universal) — Rule 10 (lessons land the moment they happen).
