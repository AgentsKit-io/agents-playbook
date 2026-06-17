---
type: SDLC Phase
title: 'Phase 01 — Discover'
description: 'Define what you are building, who consumes it, and what success looks like — before agents touch the codebase.'
---

# Phase 01 — Discover

Define what you are building, who consumes it, and what success looks like — before agents touch the codebase.

## TL;DR (human)

The discover phase produces the artefacts agents need to be productive from PR #1: a product brief, a surface inventory, a draft threat model, a routing table, and a CLAUDE.md. Skip this phase and agents reinvent rules each session.

## For agents

### Outputs (must exist before moving to Design)

- [ ] **Product brief** — `docs/product/brief.md`. One paragraph: audience, problem, value, success metric.
- [ ] **Surface inventory** — `docs/product/surfaces.md`. Every screen / API / CLI / integration the product exposes (or will at MVP). Status column: planned / in-flight / shipped.
- [ ] **Threat model (draft)** — `docs/security/threat-model.md`. Assets, actors, attack surface. Empty threat-mitigations table is fine on day one; the structure is the asset.
- [ ] **Routing table skeleton** — `AGENTS.md`. Even if the packages do not exist yet, list the planned boundaries with "(planned)" markers.
- [ ] **Bootstrap doc** — `CLAUDE.md`. The non-negotiables you want agents to honour from PR #1.
- [ ] **Decision log** — `docs/adr/` directory exists, with ADR-0001 (Philosophy) drafted.

### Per pillar — Discover-phase checklist

**Architecture**
- [ ] Sketch 4–7 logical groups; do not design 30 packages on day one.
- [ ] Decide the contract package (`core` / `contracts`) and its hard size budget.
- [ ] Decide your runtime schema (Zod / Pydantic / Protobuf).

**Security**
- [ ] Classify the data the system touches (PII / sensitive / public).
- [ ] Pick the tenancy model (single-tenant / multi-tenant / multi-org).
- [ ] Pick the vault provider (in-process / Vault / cloud KMS).

**UI-UX**
- [ ] Identify the audience (technical / non-technical / mixed).
- [ ] Inventory surfaces.
- [ ] Pick the design language reference (Apple HIG / Material / custom).
- [ ] Pick the primitive library substrate (Radix / React Aria / Headless UI).

**Quality**
- [ ] Define "done" per surface (the completeness contract, kept simple early).
- [ ] Pick the test stack.
- [ ] Decide per-package coverage targets.

**Governance**
- [ ] Decide who accepts ADRs / RFCs (humans, named).
- [ ] Define review windows (e.g. 5 days minor, 10 days breaking).
- [ ] Decide branching model (trunk-based + short-lived feature branches recommended).

**AI-collaboration**
- [ ] Write `CLAUDE.md` (template in [`../../templates/CLAUDE.md.template.md`](/docs/templates/CLAUDE.md.template)).
- [ ] Write `AGENTS.md` skeleton.
- [ ] Decide agent toolchain (Claude Code / Cursor / Aider / your CLI).
- [ ] Bootstrap memory directory + index.

### Common failure modes

- **No surface inventory.** Agents invent surfaces; product surface drifts. → Inventory first.
- **No `CLAUDE.md`.** Agents reinvent rules every session. → Stand it up before the first feature PR.
- **30-package monorepo on day one.** Boundaries that haven't earned themselves. → Start with 4–7 logical groups; split when cohesion forces it.
- **Threat model deferred "until later".** Later never comes. → Empty structure on day one; fill iteratively.

### Exit criteria

You can leave Discover when:

1. A new agent can read `AGENTS.md` and know which package owns what (even if the packages are scaffolds).
2. A new agent can read `CLAUDE.md` and know what is non-negotiable.
3. The decision-log directory exists with at least ADR-0001 accepted.
4. The threat-model doc exists with assets + actors + surface enumerated (mitigations can be empty).

### See also

- [`../../templates/CLAUDE.md.template.md`](/docs/templates/CLAUDE.md.template)
- [`../../templates/AGENTS.md.template.md`](/docs/templates/AGENTS.md.template)
- [`../../pillars/architecture/universal.md`](/docs/pillars/architecture/universal)
- [`../../pillars/security/threat-model-template.md`](/docs/pillars/security/threat-model-template)
