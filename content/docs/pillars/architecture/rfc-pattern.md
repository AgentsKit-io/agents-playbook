---
type: Playbook Pattern
title: 'RFC Pattern'
description: 'When the decision is bigger than your team. Used for changes to public contracts, wire formats, plugin protocols, and any breaking change a consumer outside this repo would notice.'
---

# RFC Pattern

When the decision is bigger than your team. Used for changes to **public contracts**, wire formats, plugin protocols, and any breaking change a consumer outside this repo would notice.

## TL;DR (human)

An RFC is an ADR with a **review window** and a **migration plan**. You publish the proposal, collect feedback for N days, decide, and on acceptance promote it to an ADR. The RFC is the *negotiation*; the ADR is the *contract*.

## For agents

### When to write an RFC (instead of an ADR)

Write an RFC when **any** of the following is true:

- The change breaks an existing public method signature, schema, wire format, or stable error code.
- The change adds a new top-level config field consumers must set.
- The change adds a new package that other repos / plugins are expected to depend on.
- The change modifies the plugin / extension protocol.
- The change requires a versioned migration in consumer code.

Internal-only refactors → ADR is enough. Anything a consumer can observe → RFC.

### Sections

Use [`../../templates/RFC.template.md`](/docs/templates/RFC.template). Required:

1. **Summary** — one paragraph; what changes.
2. **Motivation** — what is the problem; what use cases motivate this.
3. **Detailed design** — the proposal in enough detail that a reviewer can spot pitfalls.
4. **Backwards compatibility** — what breaks; what migration path consumers have; deprecation window if any.
5. **Migration plan** — for the codebase itself: codemod, sweep, gates flipped on.
6. **Drawbacks** — what is worse after.
7. **Alternatives** — at least two non-trivial alternatives.
8. **Unresolved questions** — closes before acceptance.

### Lifecycle

```
Draft → Open (review window starts) → Final-Comment-Period →
   ↘ Accepted → promoted to ADR → implementation
   ↘ Rejected → kept on disk for record
   ↘ Withdrawn → kept on disk
```

Conventions that worked in production:

- **Review window**: 5 business days minimum for "minor" RFCs, 10 for breaking changes.
- **Final-Comment-Period**: a 48-hour signal that no further changes are expected. Started by an explicit comment on the RFC PR.
- **Acceptance** requires the maintainer of every affected package to thumbs-up. Agents can collect the thumbs-ups; only a human can be the final acceptor on a breaking change.

### Promotion to ADR

On acceptance:

1. Open a PR that promotes the RFC to a numbered ADR.
2. The ADR's "Decision" section is the RFC's "Detailed design", trimmed of negotiation.
3. The ADR's "Rollout" section is the RFC's "Migration plan".
4. Link both ways: ADR cites the originating RFC; RFC's Status becomes "Accepted; promoted to ADR-NNNN".

### Gate

Recommended automated checks:

1. **Index integrity** — `docs/rfc/README.md` lists every RFC with current status.
2. **Promotion linkage** — every accepted RFC has a matching ADR with the back-pointer.
3. **No orphan breakers** — no PR is allowed to change a method's params/result schema without referencing an accepted RFC (or an explicit `removes:` justification if the method is being deleted).

Reference impl: [`../../scripts/check-rfc.example.mjs`](/docs/scripts).

### Common failure modes (sourced from production)

- **Agent ships breaking change in a "small refactor" PR.** The schema is now incompatible; downstream consumers break in production. → Block any PR that mutates a method schema without an RFC reference.
- **RFC merged the same day it was opened.** No time for cross-package review; surprises land a week later. → Enforce a minimum review window in the gate.
- **RFC accepted but no ADR promotion.** Six months later, the RFC is buried; future agents miss it during retrieval. → Promotion is part of acceptance, not a follow-up.
- **Multiple RFCs editing the same surface in parallel.** Conflicts surface only in implementation. → A "currently open RFCs touching X" map in the index lets agents notice the collision before drafting.

### See also

- [`adr-pattern.md`](/docs/pillars/architecture/adr-pattern) — the destination format.
- [`../governance/README.md`](/docs/pillars/governance) — merge rules for breaking changes.
- [`../../templates/RFC.template.md`](/docs/templates/RFC.template) — copy-paste skeleton.
