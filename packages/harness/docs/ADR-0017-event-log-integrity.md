# ADR-0017: Hash chained lifecycle event logs

## Context

The lifecycle log already preserves order and binds events to a run revision
and contract hash, but a later edit to an existing record would not be
detected. Enterprise review needs a deterministic integrity signal without
persisting prompts, tool arguments, or adding a remote service.

## Decision

New events include `previousHash` and `eventHash`. The hash covers the exact
serialized event body, including the preceding hash, so changing or reordering
records makes the chain invalid. `FileEventStore.read` validates the chain and
`FileEventStore.verify` exposes a typed `verified` or `legacy` result. Existing
logs without integrity fields remain readable and are never reported as
verified; appending to them preserves their legacy status.

## Consequences

The log is tamper-evident for new records and can be checked locally or through
`ak-harness events verify`. This is not a signature or external notarization:
an attacker able to rewrite both the log and its consumer can recompute the
chain. A future signed export can add that trust boundary without changing the
event lifecycle API.
