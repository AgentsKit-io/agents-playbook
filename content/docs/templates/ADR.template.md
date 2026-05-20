---
title: 'ADR-NNNN — <Short Title>'
description: '- **Status:** Proposed | Accepted | Superseded by ADR-NNNN | Tombstoned'
---

# ADR-NNNN — \<Short Title\>

- **Status:** Proposed | Accepted | Superseded by ADR-NNNN | Tombstoned
- **Date:** YYYY-MM-DD
- **Deciders:** @name, @name
- **Supersedes:** ADR-NNNN (if any)
- **Related:** RFC-NNNN (if any), issue/PR refs

## Context

What is true today. What triggered this decision. Cite measurements, incident reports, or repeated questions if they motivated this. Two or three paragraphs maximum.

## Decision

We will **\<verb\> \<object\>** (imperative voice).

Followed by the specific rules that implement this decision. Be precise — agents will read this as instructions. List paths, names, gates.

## Consequences

What becomes easier:

- …

What becomes harder:

- …

What is now forbidden:

- …

## Alternatives considered

### Alternative A — \<name\>

What it would do. Why we did not pick it (one or two sentences).

### Alternative B — \<name\>

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
