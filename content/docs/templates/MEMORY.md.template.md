---
title: "MEMORY pattern"
description: "Persistent agent memory survives between sessions. The pattern: **one fact per file**, plus an index file."
---

# MEMORY pattern

Persistent agent memory survives between sessions. The pattern: **one fact per file**, plus an index file.

## Layout

```
.agent-memory/
  MEMORY.md            # index: one line per memory, no frontmatter, never holds content
  user_<slug>.md       # who the user is (role, expertise, preferences)
  feedback_<slug>.md   # guidance the user has given on how the agent should work
  project_<slug>.md    # ongoing work, goals, constraints not derivable from code
  reference_<slug>.md  # pointers to external resources (URLs, dashboards, tickets)
```

## File frontmatter

Each memory file has:

```markdown
---
name: <short-kebab-case-slug>
description: <one-line summary — used to decide relevance during recall>
metadata:
  type: user | feedback | project | reference
---

<the fact; for feedback/project, follow with **Why:** and **How to apply:** lines.
Link related memories with [[their-name]].>
```

## Index file

`MEMORY.md` is the only file loaded into context every session. One line per memory:

```markdown
- [Short title](file.md) — one-line hook
```

No frontmatter. No body content. Just the index.

## Type semantics

- **user** — facts about the human you're collaborating with. Role, expertise, preferences. Rarely changes.
- **feedback** — guidance the user has given on how to work. Corrections AND confirmed approaches. Include the why.
- **project** — ongoing work, goals, or constraints not derivable from the code or git history. Convert relative dates to absolute.
- **reference** — pointers to external resources (URLs, dashboards, tickets).

## Rules

1. **One fact per file.** If a memory has two unrelated parts, split it.
2. **Don't save what the repo already records.** Code structure, past fixes, git history, CLAUDE.md content — do not duplicate.
3. **Don't save chat-scoped facts.** "We just decided X in this conversation" belongs in the PR, not memory.
4. **Convert dates to absolute.** "Last week" today is "two weeks ago" next month.
5. **Link liberally.** Use `[[other-memory-name]]`; an unresolved link marks a future memory worth writing.
6. **Verify before recommending.** When recalled, memories appear in `\<system-reminder\>` blocks — they reflect what was true when written. If one names a file/function/flag, confirm it still exists before acting.

## Lifecycle

- **Add** when a non-obvious lesson lands. Not at session end as a chore.
- **Update** rather than duplicate. Check for an existing file covering the topic first.
- **Delete** memories that turn out to be wrong. Wrong memory > worse than no memory.

## Example

`feedback_no_nested_ternary.md`:

```markdown
---
name: no-nested-ternary
description: User insists no nested ternaries; use if/else or lookup tables
metadata:
  type: feedback
---

Never nest `?:` inside another `?:`. Use if/else, early return, or a lookup map.

**Why:** Nested ternaries are unreviewable; agents misread the precedence.

**How to apply:** When tempted to nest, extract to a `const x = (() => { if (...) return ... })()` IIFE or a lookup map.

See also [[file-size-budget]] — long ternaries also bust the line budget.
```

`MEMORY.md` index entry:

```markdown
- [No nested ternaries](feedback_no_nested_ternary.md) — never nest `?:`; use if/else or lookup
```

## See also

- [`../pillars/ai-collaboration/README.md`](../pillars/ai-collaboration/README.md)
- [`CLAUDE.md.template.md`](./CLAUDE.md.template.md) — the bootstrap doc loads MEMORY.md every session.
