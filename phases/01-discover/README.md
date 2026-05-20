# Phase 01 — Discover

Define what you are building, who consumes it, and what success looks like — before you write a line of code.

## Status

◐ Scoped, not yet detailed.

## Outputs of this phase

- A **product brief**: one paragraph, audience-named, success-metric stated.
- A **surface inventory**: every screen / API / CLI / integration the product exposes, even at MVP.
- A **threat model draft**: data classes, trust boundaries, hostile actors. Iterated each release.
- An **AGENTS.md routing table** (skeleton): even if the packages don't exist yet, list the planned boundaries.
- A **CLAUDE.md** (or equivalent): non-negotiables you want agents to honor from PR #1.

## Per pillar

| Pillar | What to do in Discover |
|---|---|
| Architecture | Sketch 4–7 logical groups. Don't design 30 packages day one — let them emerge from real cohesion |
| Security | Draft threat model. Pick data classes. Decide tenancy model |
| UI-UX | Define audience. Inventory surfaces. Pick design language reference |
| Quality | Write "what does done look like" per surface (completeness contract) |
| Governance | Decide who can accept ADRs / RFCs. Define review windows |
| AI-collaboration | Write CLAUDE.md. Write AGENTS.md. Pick agent toolchain |

## See also

- [`../../templates/CLAUDE.md.template.md`](../../templates/CLAUDE.md.template.md)
- [`../../templates/AGENTS.md.template.md`](../../templates/AGENTS.md.template.md)
