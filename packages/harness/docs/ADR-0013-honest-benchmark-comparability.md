# ADR-0013: Require completed evidence for benchmark comparability

## Context

An explicit baseline is necessary but not sufficient for a meaningful
comparison. A blocked or still-running harness attempt must not be presented as
an achieved result, and aggregate pass rates alone do not explain why a task is
or is not comparable.

## Decision

`benchmarkRuns` reports a task as comparable only when it has a baseline whose
status is not `not-run` and the latest bound harness run is `COMPLETE`. Every
other case has a typed reason: missing baseline, not-run baseline, harness not
run, or harness not complete.

The comparison also exposes the latest harness check, outcome, evidence,
duration, attempt, and human-review metrics. Human-review duration is derived
only when approval is recorded. The report remains descriptive; it does not
claim causality or productivity improvement.

## Consequences

- A blocked or partial attempt cannot inflate the comparison dataset.
- Reviewers can distinguish missing evidence from failed execution.
- Future statistical analysis has stable inputs without changing the run
  protocol.
