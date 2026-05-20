---
title: 'Tombstone Pattern'
description: 'How to retire a doc, plan, ADR, screen, or package without losing the trail.'
---

# Tombstone Pattern

How to retire a doc, plan, ADR, screen, or package without losing the trail.

## TL;DR (human)

Retired content keeps its file but gets a 🪦 status block prepended. Back-references are updated to mark it retired without removing the link. The historical record stays intact; the agent reading the file knows immediately it is no longer active.

## For agents

### Why not delete

Deletion loses three things:

1. **The decision trail.** Future agents need to know that something *was* the answer, *why* it was, and *why it changed*. The file is the evidence.
2. **Back-references.** Other docs / ADRs / commit messages link to it. Hard links break; agents follow broken links and waste a turn.
3. **Audit history.** Compliance / governance / security reviews need to see what existed and when.

Git history preserves *some* of this, but git history is hard to discover. The file at its path with a clear retirement marker is discoverable in one read.

### Tombstone block format

Prepend to the top of the file, **above the original title**:

```markdown
> 🪦 **TOMBSTONED YYYY-MM-DD** — <one-line reason: what replaced it, or why retired>.
> Kept for trail; do not treat as active.

# <original title kept>

<original body kept verbatim>
```

Required fields:

- `🪦` emoji — visual signal.
- `TOMBSTONED` — the keyword.
- `YYYY-MM-DD` — when it was retired. ISO date.
- Reason — one line.
- Pointer to the replacement (if any).

### When to tombstone

| Situation | Action |
|---|---|
| A plan / initiative is complete | Tombstone with status summary |
| An ADR is superseded by a new ADR | Change Status to "Superseded by ADR-NNNN"; that is the tombstone form for ADRs |
| A doc describes a removed surface | Tombstone with link to whatever replaced it |
| A doc is wrong and the correct content lives elsewhere | Tombstone, do not edit in place — preserves the wrong-but-historical content |

### When **not** to tombstone

| Situation | Action |
|---|---|
| Build artefact / generated file | Just delete |
| Pure typo / formatting fix | Edit in place |
| Doc that was never published / never linked | Edit or delete; there is no trail to preserve |
| ADR that was rejected (never accepted) | Leave Status: Rejected; do not tombstone — it has historical value as-is |

### Back-reference sweep

When you tombstone, sweep references:

1. `grep -r "path/to/tombstoned.md"` — every other doc that links here.
2. Update each linking doc to either:
   - Update the link target to the replacement, **or**
   - Leave the link but add a parenthetical "(🪦 retired)".
3. Update top-level indexes (`README.md`, `docs/README.md`, `INDEX.md`) — the file may still appear, but its row says "🪦 retired".

Goal: no surprise. A reader landing on a back-reference learns immediately that the target is retired.

### Tombstones are immutable

Once a file is tombstoned, do not edit its body. The body is the historical record. The only allowed edit is to update the tombstone block itself (e.g. fix a typo, add a more current replacement link).

If the body needs to be updated to "be correct again", you do not want a tombstone — you want an edit.

### Rolling up tombstones

After a long campaign of work, many tombstoned files accumulate. They are still discoverable and that is good. But indexes can get noisy.

Periodic clean-up:

1. Move tombstoned files into a sibling `_archive/` directory.
2. Update back-references to the new path.
3. Index file lists archived items at the bottom in a collapsed section.

This is **not deletion**. It is *demotion in discoverability*, with the trail intact.

### Common failure modes

- **Tombstone without back-reference sweep.** Other docs still treat the retired file as authoritative. → Always sweep. A `check:back-refs` gate helps.
- **Tombstone followed by "actually let me edit this".** Confuses readers — is it retired or not? → Decide first; if you edit, it's not a tombstone.
- **Delete + new file with same name.** Loses the trail entirely. → Tombstone the old, new file goes by a new name (or same name with a clear `### Replaces tombstoned \<old\>` block at top).
- **Tombstone with no reason.** Reader has no idea why it was retired. → One-line reason is mandatory.

### See also

- [`universal.md`](./universal.md) — Rule 4.
- [`../architecture/adr-pattern.md`](./../architecture/adr-pattern.md) — Status: Superseded is the ADR-specific tombstone.
