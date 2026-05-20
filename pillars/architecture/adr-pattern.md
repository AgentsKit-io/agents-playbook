# ADR Pattern

How to record architecture decisions so future agents (and humans) can find them, trust them, and supersede them cleanly.

## TL;DR (human)

An **Architecture Decision Record** is a short, append-only document — usually 50–200 lines — that captures one decision: what changed, why, what was rejected, what becomes harder. Number them monotonically. Never delete; tombstone when superseded. The accepted ADR is the source of truth — the code implements it.

## For agents

### When to write an ADR

Write one when **any** of the following is true:

- The change crosses a package boundary or introduces a new package.
- The change introduces a new top-level concept (a new error namespace, a new lifecycle, a new persistence store).
- The change is reversible only at significant cost (>1 day to undo cleanly).
- A reviewer asks "why this and not the alternative?".
- The same question has come up twice.

If none of the above hold, do not write an ADR. ADRs are not a substitute for code comments.

### Numbering + filenames

- Zero-padded sequence: `0001-philosophy.md`, `0027-contract-registry.md`, `0055-file-size-budget.md`.
- Slug is kebab-case, descriptive in three words or fewer.
- Numbers are never reused. Tombstoned ADRs keep their number.

### Sections

Use [`../../templates/ADR.template.md`](../../templates/ADR.template.md). Required sections:

1. **Status** — Proposed / Accepted / Superseded by ADR-NNNN / Tombstoned.
2. **Context** — what is true today; what triggered the decision.
3. **Decision** — what we will do, in imperative voice ("we will...").
4. **Consequences** — what becomes easier, what becomes harder, what is now forbidden.
5. **Alternatives considered** — at least one. "We did not consider alternatives" is a yellow flag.
6. **Rollout** — how the codebase reaches the new state (codemod, gate, manual sweep, etc.).

Optional sections: open questions, related ADRs, related issues / PRs.

### Lifecycle

```
Proposed → (review window) → Accepted
                            ↘ Rejected → (kept on disk for record)

Accepted → Superseded by ADR-NNNN (when a later ADR replaces it)
       → Tombstoned (when the surface it describes is removed)
```

Rules:

- **Accepted** is the source of truth. If the code disagrees with an accepted ADR, the code is wrong (or the ADR needs a superseder).
- **Never edit an accepted ADR's Decision section.** Replace via a new ADR that supersedes it. The trail must be diff-friendly.
- **Tombstoned ADRs stay on disk.** Prepend a one-line tombstone notice; do not delete the body.

### Gate

Two automated checks pay off:

1. **Sequence integrity** — no gaps, no duplicates, no missing numbers.
2. **Status hygiene** — every ADR has a recognised Status value; "Superseded by ADR-NNNN" references a real file.

Reference impl: [`../../scripts/check-adr.example.mjs`](../../scripts/check-adr.example.mjs).

### Common failure modes (sourced from production)

- **"We'll add the ADR later".** Later never comes. The reviewer who needed the rationale moves on. Result: agents revert the change six months later because they cannot see why it was made. → Block PRs that change architecture without an ADR.
- **Editing the Decision of an accepted ADR.** Git history shows you reversed the rule, but the file reads as if the rule was always the new one. Future agents are confused. → Supersede via a new ADR.
- **One mega-ADR per quarter.** Covers ten decisions, three of which contradict. Cannot be referenced cleanly. → One decision per ADR.
- **No "Alternatives considered".** Agents propose the same alternative again next session, costing review cycles. → Always list at least one rejected alternative with the reason.

### See also

- [`rfc-pattern.md`](./rfc-pattern.md) — when an ADR is not enough.
- [`../governance/README.md`](../governance/README.md) — PR-intent manifests that reference ADRs.
- [`../../templates/ADR.template.md`](../../templates/ADR.template.md) — copy-paste skeleton.
