# ADR-0012: Record controlled baseline observations through the public interface

## Context

The harness already aggregates run history, but a benchmark comparison is only
meaningful when the baseline is real, attributable, and tied to the same task
identity. Manual JSON editing is easy to get wrong and makes the measurement
process hard to reproduce.

## Decision

Expose `recordBenchmarkObservation` and `ak-harness benchmark baseline` as the
single supported write path for one baseline observation per task. The API
validates the manifest and observation, rejects unknown tasks and duplicates,
and writes through a temporary file followed by an atomic rename. It also
checks that the source manifest did not change during the operation.

`not-run` remains an explicit non-comparable status. The benchmark report must
not infer a baseline from harness history or report improvement without both a
valid baseline and a bound harness run.

## Consequences

- Baselines have a reproducible CLI/API entry point and visible provenance.
- Concurrent or stale writes fail instead of silently overwriting newer data.
- A controlled task run is still required; this API records evidence but does
  not manufacture experimental results.
