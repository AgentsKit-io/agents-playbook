# The matrix — pillars × phases

This is the master content map. Each cell points to the practices that apply when **pillar** meets **SDLC phase**.

Cells marked `(stub)` are scaffold-only; content lands in subsequent sessions. Cells marked `✓` are shipped.

|  | 01 Discover | 02 Design | 03 Build | 04 Test | 05 Ship | 06 Operate |
|---|---|---|---|---|---|---|
| **Architecture** | Define mental map; pick 5–7 logical groups | ADR before structure change; RFC before breaking contract | Modular boundaries; named exports; Zod at every edge; sized files | Contract tests; cross-package import lints | Versioned releases; peer-dep compat matrix | Track tech debt against ADRs |
| **Security** | Threat model; data classification | Vault scope; RBAC roles; consent vs elevation | Sealed secrets; egress allowlist; signed audit ledger | Security review per PR; pen-test gates | Signed artifacts; key rotation runbook | Incident response; break-glass audit |
| **UI-UX** | Audience taxonomy; surface inventory | Design tokens; primitives catalog; motion budget | No raw `<button>`/`<input>`; intl on every string; `useT()` everywhere | Visual regression; a11y screen-reader pass | Brand-kit/whitelabel build matrix | A/B + delight loops; empty-state honesty |
| **Quality** | Define "done" per surface (completeness contract) | Test pyramid; coverage targets per package | File-size budgets; lint rules; hermetic tests | `check:all`, `sanity`, structural gates, e2e | Pre-push hooks; release gates | Bug-hunt cadence; mutation testing |
| **Governance** | Decision log culture; ADR/RFC processes | PR intent manifest schema; merge rules | Removes-list discipline; concurrent-agent awareness | Multi-agent review pipeline | Changesets; semver discipline | Postmortems; tombstone retired plans |
| **AI-collaboration** | CLAUDE.md, AGENTS.md, MEMORY.md bootstrap | Slash commands; sub-agent recipes; system prompts | Goal-mode loop; one-sub-unit-per-session rule | Verify-first close; duplication-claims-API-grounded | Phased PR + admin merge | Persistent memory; lessons graph |

## Reading order

If you adopt left-to-right (by phase), agents can ramp incrementally. If you adopt top-to-bottom (by pillar), you can roll out one concern across the whole SDLC.

| Adoption mode | Start at | Then |
|---|---|---|
| Greenfield project | `phases/01-discover/` | `templates/CLAUDE.md.template.md` → `pillars/architecture/universal.md` |
| Brownfield retrofit | `pillars/quality/README.md` (gates first) | `pillars/governance/README.md` (PR intent + merge rules) |
| Just need agent rules | `templates/CLAUDE.md.template.md` | `pillars/ai-collaboration/README.md` |
| Just need design system | `pillars/ui-ux/README.md` | `templates/` design-tokens recipe |

## Status legend

- ✓ Shipped (read it)
- ◐ Scaffolded with scope; content partial
- (stub) README placeholder only; no body content yet

## Current status (v0)

| | Universal | TS-concrete |
|---|---|---|
| architecture | ✓ | ✓ |
| security | ✓ | ✓ |
| ui-ux | ✓ | ✓ |
| quality | ✓ | ✓ |
| governance | ✓ | ✓ |
| ai-collaboration | ✓ | ✓ |

| Phase | Status |
|---|---|
| 01 discover | ◐ |
| 02 design | ◐ |
| 03 build | ◐ |
| 04 test | ◐ |
| 05 ship | ◐ |
| 06 operate | ◐ |

| Templates | Status |
|---|---|
| ADR / RFC | ✓ |
| PR intent | ✓ |
| CLAUDE.md / AGENTS.md / MEMORY.md | ✓ |
