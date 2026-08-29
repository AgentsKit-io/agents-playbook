# ADR-0014: Criterion-level benchmark evidence

## Context

Scalar baseline numbers do not prove that a benchmark task exercised its
acceptance criteria. Treating those numbers as comparable can make an
incomplete delivery look like an improvement.

## Decision

Baseline observations may include an `evidence` array. Each entry names one
acceptance criterion exactly, records its status, and points to a source. The
manifest validator rejects unknown or duplicate criteria and invalid evidence
metadata. A comparison is `comparable` only when every criterion is covered,
the baseline is not `not-run`, and the latest bound harness run is `COMPLETE`.
The report exposes `baselineEvidenceCoverageRate` and returns
`baseline-evidence-missing` when coverage is incomplete.

## Consequences

Baseline collection has a small additional input requirement, but benchmark
reports can distinguish missing proof from a real completed comparison. The
evidence source remains a reference; this phase does not claim causality or
replace criterion-level harness evidence for the current run.
