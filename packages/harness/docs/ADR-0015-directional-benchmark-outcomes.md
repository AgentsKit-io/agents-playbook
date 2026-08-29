# ADR-0015: Directional benchmark outcomes

## Context

The harness already reports raw deltas, but a negative duration delta is easy
to misread and non-comparable tasks can be mistaken for missing data. Operators
need a small, explicit interpretation layer for the measured resources.

## Decision

For comparable tasks, report a rate for duration, attempts, and human review:
`(baseline - harness) / baseline`. Positive means the harness used less of the
resource and is labelled `improved`; negative is `regressed`; zero is
`unchanged`. A missing value, zero baseline, or non-comparable task is labelled
`unavailable`. These are per-resource signals, not a composite productivity
score or a causal claim.

## Consequences

Benchmark consumers can read the direction without reimplementing arithmetic,
while trade-offs remain visible instead of being hidden in one score. A real
baseline with complete criterion evidence is still required before any outcome
is reported as comparable.
