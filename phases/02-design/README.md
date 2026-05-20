# Phase 02 — Design

Turn the discovery brief into ADRs, RFCs, and a contract package skeleton that the build phase can compose against.

## Status

◐ Scoped, not yet detailed.

## Outputs

- ADR-0001 (Philosophy) — what this codebase optimises for, what it does not.
- ADR-0002 (Composition rules) — what you depend on, what you do not duplicate.
- The first set of Zod schemas in `packages/core` (or your equivalent).
- The first set of error codes in `packages/core/errors/codes.ts`.
- Initial design tokens, locale skeleton, primitives catalog.

## Per pillar

| Pillar | What to do in Design |
|---|---|
| Architecture | Write ADRs 1, 2, 3 (philosophy, composition, contract registry). Stand up `core` package |
| Security | RFC the auth model. Decide vault provider. Decide audit-ledger signature |
| UI-UX | Pick design system. Define tokens. Build 5–10 primitives |
| Quality | Pick test stack. Define coverage targets per package. Write the first gate scripts |
| Governance | Write PR-intent gate. Write ADR / RFC index + check |
| AI-collaboration | Lock CLAUDE.md non-negotiables. Define sub-agent recipes |

## See also

- [`../../pillars/architecture/adr-pattern.md`](../../pillars/architecture/adr-pattern.md)
- [`../../pillars/architecture/rfc-pattern.md`](../../pillars/architecture/rfc-pattern.md)
- [`../../templates/ADR.template.md`](../../templates/ADR.template.md)
- [`../../templates/RFC.template.md`](../../templates/RFC.template.md)
