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
