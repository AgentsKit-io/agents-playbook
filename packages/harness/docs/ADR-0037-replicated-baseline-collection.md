# ADR-0037: Replicated baseline collection

## Decision

The AgentsKit OS baseline runner accepts `--repeats N` and executes every task
in an independent disposable fixture. It records the measured durations as
`durationSamplesMs`, keeps the task failed when any sample fails, and can
replace the complete baseline observation set with `--record-manifest`.

The replacement is staged through the existing typed
`recordBenchmarkObservation` API and committed with one atomic rename. A
partial task selection cannot update a complete manifest. The benchmark report
then compares the median baseline duration with the median harness duration.

## Rationale

A single baseline run is not a fair comparator for three harness replicas.
Independent baseline samples reduce sensitivity to provider and machine
variance without misclassifying replicas as retries. Atomic recording prevents
an interrupted collection from leaving a partially refreshed manifest.

## Limits

This controls sample count and provenance, not all sources of variance. The
same provider, task corpus, pinned source revision, and comparable runtime
should be used. Three samples are the current minimum policy, not a universal
statistical guarantee; larger studies belong in a later benchmark program.
