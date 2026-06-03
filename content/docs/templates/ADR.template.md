---
title: 'ADR Template'
description: 'Skeleton for an Architecture Decision Record. Copy the block below into docs/adr/NNNN-<slug>.md and fill the bracketed parts.'
---

# ADR Template

Skeleton for an Architecture Decision Record — the durable record of *why* a structural decision was made, so future agents inherit the reasoning, not just the result.

## TL;DR (human)

One ADR per architecture decision. Write it *before* the change. Keep Context tight, make the Decision imperative and precise (agents read it as instructions), and list the Consequences honestly — including what becomes forbidden. Supersede with a new ADR; never silently edit an accepted one.

## Template body

Copy the below into `docs/adr/NNNN-<slug>.md` and fill the bracketed parts.

```markdown
# ADR-NNNN — <Short Title>

- **Status:** Proposed | Accepted | Superseded by ADR-NNNN | Tombstoned
- **Date:** YYYY-MM-DD
- **Deciders:** @name, @name
- **Supersedes:** ADR-NNNN (if any)
- **Related:** RFC-NNNN (if any), issue/PR refs

## Context

What is true today. What triggered this decision. Cite measurements, incident reports, or repeated questions if they motivated this. Two or three paragraphs maximum.

## Decision

We will **<verb> <object>** (imperative voice).

Followed by the specific rules that implement this decision. Be precise — agents will read this as instructions. List paths, names, gates.

## Consequences

What becomes easier:

- …

What becomes harder:

- …

What is now forbidden:

- …

## Alternatives considered

### Alternative A — <name>

What it would do. Why we did not pick it (one or two sentences).

### Alternative B — <name>

Same.

## Rollout

How the codebase reaches the new state:

- [ ] Codemod that converts existing call sites.
- [ ] CI gate that blocks regressions.
- [ ] Doc update.
- [ ] Communication to affected agents (CLAUDE.md / AGENTS.md update).
- [ ] Tombstone of any superseded ADR.

## Open questions

- …

## See also

- ADR-NNNN
- RFC-NNNN
- `docs/for-agents/...`
```

## See also

- [`RFC.template.md`](/docs/templates/RFC.template) — propose a breaking-contract change before promoting it to an ADR.
- [`adr-pattern`](/docs/pillars/architecture/adr-pattern) — when to write one, status lifecycle, supersession.
- [`tombstone-pattern`](/docs/pillars/governance/tombstone-pattern) — how to retire a superseded ADR.
