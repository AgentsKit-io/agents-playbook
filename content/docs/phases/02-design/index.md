---
type: SDLC Phase
title: 'Phase 02 — Design'
description: 'Turn the discover brief into ADRs, RFCs, and a contract package skeleton the build phase can compose against.'
---

# Phase 02 — Design

Turn the discover brief into ADRs, RFCs, and a contract package skeleton the build phase can compose against.

## TL;DR (human)

Design phase makes the implicit explicit. Every recurring decision becomes an ADR; every breaking-contract change becomes an RFC. The first set of schemas + error codes lands in the contract package. Tokens + primitives + locale skeletons land before any screen is built. Skip this phase and Build phase agents will design ad-hoc — which means inconsistently.

## For agents

### Outputs

- [ ] **ADR-0001 (Philosophy)** — what this codebase optimises for; what it does not.
- [ ] **ADR-0002 (Composition rules)** — what you depend on; what you do not duplicate.
- [ ] **ADR-0003 (Contract registry)** — how methods / schemas register; how the dispatcher enforces them.
- [ ] **First schemas + error codes** — landed in the contract package; tests assert parse + reject.
- [ ] **Design tokens** — primitive + semantic layers; default brand kit + test brand kit.
- [ ] **Locale skeleton** — at minimum `en.json`; the `useT()` hook works.
- [ ] **Primitives catalog (initial)** — 8–12 primitives sufficient to compose the first 3 screens.
- [ ] **Quality gates wired** — at least file-size, no-any, named-exports, raw-error, pr-intent scripts in CI.

### Per pillar

**Architecture**
- [ ] Stand up the contract package. Lock its size budget (CI gate).
- [ ] Stand up the runtime package skeleton (depends on contract).
- [ ] Stand up the storage package skeleton (depends on contract).
- [ ] Sub-path package layout decided (RFC if applicable).
- [ ] `AGENTS.md` routing table reflects real packages now.

**Security**
- [ ] RFC the auth model (sessions, principal shape, tenancy resolution).
- [ ] Decide vault provider; integrate the shim; first secret accessed via reference.
- [ ] Audit ledger skeleton: store + signer + verify utility.
- [ ] Egress allowlist shim (`safeFetch`) wired; default deny.
- [ ] Threat model populated with the first 5–10 threats × mitigations.

**UI-UX**
- [ ] Design tokens land in CSS variables + Tailwind config (or equivalent).
- [ ] Primitives catalog ship: Button, Input, Select, Dialog, Table, EmptyState, Skeleton, Toast.
- [ ] Locale infrastructure (`useT()` + `en.json` + parity gate).
- [ ] Whitelabel runtime stub (default brand + test brand).
- [ ] A11y baseline: axe wired in CI; baseline of existing violations captured.

**Quality**
- [ ] Test stack picked and wired (Vitest / Playwright equivalent).
- [ ] Per-package coverage thresholds in CI config.
- [ ] Quality-gates orchestrator script (`pnpm check:quality-gates`) live.
- [ ] Pre-push hook wired (structural gates + typecheck + build; no full tests).
- [ ] Sanity audit script + report path decided.

**Governance**
- [ ] PR-intent manifest format + gate.
- [ ] ADR + RFC index files; check-adr / check-rfc gates.
- [ ] Tombstone convention decided (the emoji block + back-ref sweep).
- [ ] Phased-PR convention documented in `CONTRIBUTING.md`.

**AI-collaboration**
- [ ] CLAUDE.md non-negotiables locked.
- [ ] Sub-agent recipes selected from [`../../prompts/`](/docs/prompts) — adapted to your toolchain.
- [ ] Slash commands (`/goal`, `/review`, `/sanity`) wired.
- [ ] Memory directory + `MEMORY.md` index established.

### Common failure modes

- **No initial ADRs.** Conventions are "in the chat"; agents reinvent them. → ADR-0001 / -0002 / -0003 minimum.
- **Tokens but no whitelabel test.** Tokens "work" in default brand only. → Ship a test brand kit; render against it in CI.
- **Quality gates land late.** "We'll add them after the first feature." Existing offenders accumulate; gate is too painful to turn on. → Land gates BEFORE the first feature PR.
- **Primitives catalog rolled into screen work.** Each screen invents a Button differently. → Catalog first; screens second.

### Exit criteria

You can leave Design when:

1. An implementer agent can pick up a feature ticket and compose against existing schemas, primitives, and gates — without inventing new ones.
2. The build phase has zero "where does X live?" questions left.
3. The first three feature ADRs land cleanly (proves the ADR pipeline works).
4. CI runs the quality gates and exits 0 on the empty / scaffold codebase.

### See also

- [`../../pillars/architecture/adr-pattern.md`](/docs/pillars/architecture/adr-pattern), [`../../pillars/architecture/rfc-pattern.md`](/docs/pillars/architecture/rfc-pattern)
- [`../../pillars/architecture/contracts-zod-pattern.md`](/docs/pillars/architecture/contracts-zod-pattern)
- [`../../templates/ADR.template.md`](/docs/templates/ADR.template), [`../../templates/RFC.template.md`](/docs/templates/RFC.template)
- [`../../pillars/ui-ux/design-tokens-pattern.md`](/docs/pillars/ui-ux/design-tokens-pattern)
- [`../../scripts/README.md`](/docs/scripts)
