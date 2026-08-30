# ADR-0002: Profiles and optional context providers

- Status: accepted
- Date: 2026-08-29

## Decision

Verification contracts may define named profiles. A selected profile resolves
its parent chain deterministically, then overlays budgets, cleanup roots, and
existing checks by ID before validation and contract hashing. Missing profiles,
cycles, and unknown check IDs fail closed.

Context retrieval is an optional typed plugin slot. A provider returns a query,
references, content provenance, and a snapshot hash. Doc Bridge and Playbook
adapters can use the seam without becoming kernel dependencies.

## Boundaries

Profiles cannot bypass required checks or human approval. Providers cannot
approve runs, alter evidence validation, or silently replace the frozen
contract. Remote provider discovery, credential management, and context cache
policy remain integration concerns.
