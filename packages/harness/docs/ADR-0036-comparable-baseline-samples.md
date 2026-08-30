# ADR-0036: Require comparable baseline samples

## Context

Comparing three harness samples with one baseline observation makes the
performance result look more certain than it is. Provider latency can vary
between runs, so the baseline needs the same replication discipline.

## Decision

Benchmark policy includes `minBaselineSamplesPerTask`. Baseline observations
can carry `durationSamplesMs`; reports use their median and keep a legacy
single `durationMs` as one sample. A task is non-comparable until both the
baseline and harness meet their configured sample minimums.

## Consequences

The quality gate becomes `insufficient-data` until a fair baseline exists.
This delays performance claims but prevents a replicated harness result from
being presented as a reliable improvement against a one-off baseline.
