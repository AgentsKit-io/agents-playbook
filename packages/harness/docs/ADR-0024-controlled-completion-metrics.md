# ADR-0024: Measure escaped incomplete delivery with controlled baselines

## Status

Accepted

## Context

Pass rates and duration do not prove that a harness reduces incomplete
deliveries. The benchmark needs an explicit baseline and a metric for work
that was reported complete despite missing acceptance evidence.

## Decision

Allow a baseline observation to record `escapedIncomplete`. A completed harness
run is projected as zero only when every check, outcome, and evidence slot
passes. Comparable reports expose `escapedIncompleteRate`, direction, and delta
alongside existing duration, attempt, and review metrics. A controlled fixture
must provide criterion-level evidence; missing baselines remain unavailable.

## Consequences

- Improvement claims are tied to an explicit baseline rather than historical
  averages or raw pass counts.
- A synthetic fixture can validate the metric pipeline, but it is not evidence
  of production causality; real task cohorts remain necessary for that claim.
- The metric remains provider-independent and requires no new runtime.
