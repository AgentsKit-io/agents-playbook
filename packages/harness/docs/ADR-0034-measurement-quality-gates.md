# ADR-0034: Make benchmark improvement claims fail closed

## Context

A benchmark can complete every acceptance criterion while still costing more
time or retries. Aggregate pass rates alone hide that trade-off, and a small
sample cannot support a reliable general claim.

## Decision

Benchmark manifests may declare a policy with `minComparableTasks`,
`maxDurationRegressionRate`, `minCompletedRunsPerTask`, and
`requireZeroEscapedIncomplete`.

Reports expose `retryCount`, `completedRuns`, per-task confidence, and a
`qualityGate`. The gate is `insufficient-data` when the task sample is too
small, `failed` when policy detects a regression, and `passed` only when all
configured quality conditions hold. Historical retries remain visible but do
not make a superseded run the effective result.

## Consequences

The harness shows quality/cost trade-offs instead of claiming that every
improvement is positive. Directional results support iteration; reliable
samples are required for release claims.
