---
title: 'RFC Template'
description: 'Skeleton for a Request for Comments. Copy the block below into docs/rfc/NNNN-<slug>.md and fill the bracketed parts.'
---

# RFC Template

Skeleton for a Request for Comments — the proposal you open *before* breaking a public contract, so affected consumers can weigh in and the migration is concrete before any code moves.

## TL;DR (human)

Write an RFC before a breaking-contract change. Lead with a one-paragraph Summary, ground it in real Motivation, show before→after for every breaking call site, and make the Migration plan concrete enough that any agent could execute it. On acceptance it promotes to an ADR.

## Template body

Copy the below into `docs/rfc/NNNN-<slug>.md` and fill the bracketed parts.

```markdown
# RFC-NNNN — <Short Title>

- **Status:** Draft | Open | Final-Comment-Period | Accepted | Rejected | Withdrawn
- **Author(s):** @name
- **Reviewers:** @name, @name
- **Opened:** YYYY-MM-DD
- **Closes:** YYYY-MM-DD (review window end)
- **Promotes to ADR:** ADR-NNNN (on acceptance)

## Summary

One paragraph. What this changes for consumers.

## Motivation

What problem does this solve? What use cases motivate it? Cite real evidence (incident, request, support tickets) where possible.

## Detailed design

The proposal. Include:

- Method / schema / wire changes (before → after).
- Code samples for every breaking call site.
- New types / classes / packages introduced.
- Deprecation tags applied.

## Backwards compatibility

What breaks. Who is affected (which consumers, which versions).

Migration path:

- For internal callers: …
- For external plugin authors: …
- Deprecation window: <N versions / months>.

## Migration plan (for this codebase)

How the repo moves to the new state:

- [ ] Add the new shape behind a flag.
- [ ] Codemod the call sites.
- [ ] Flip the default.
- [ ] Remove the old shape after one major version.

## Drawbacks

What is worse after this lands?

## Alternatives

### Alternative A — <name>

…

### Alternative B — <name>

…

## Unresolved questions

These must close before acceptance.

- …

## Acceptance criteria

This RFC is Accepted when:

- [ ] Maintainer of every affected package has thumbs-up.
- [ ] Final-Comment-Period (48h) has elapsed without new objections.
- [ ] Migration plan is concrete enough that any agent could execute it.
- [ ] ADR promotion PR is open and references this RFC.

## See also

- ADR-NNNN
- Issue / PR refs
```

## See also

- [`ADR.template.md`](/docs/templates/ADR.template) — the decision record this RFC promotes to on acceptance.
- [`rfc-pattern`](/docs/pillars/architecture/rfc-pattern) — status lifecycle, review window, when an RFC is required.
