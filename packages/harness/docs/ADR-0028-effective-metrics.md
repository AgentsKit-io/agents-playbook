# ADR-0028: Separate effective delivery metrics from retry history

## Context

Aggregate pass rates include blocked or stale attempts that were later
superseded. Those facts are useful for measuring friction, but they can make a
successful current delivery look like a failed one.

## Decision

Keep historical attempt metrics unchanged and add `effective*` summary metrics
computed from runs that are not superseded by another run in the same local
history. Report effective run count, completion count/rate, and check,
outcome, and evidence rates.

## Consequences

Reviewers can distinguish process friction from the current delivery state
without losing retry history. The lineage rule is local and deterministic; a
future remote aggregation system must preserve `supersedes` relationships.
