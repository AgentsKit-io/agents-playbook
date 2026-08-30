# ADR-0004: Derive benchmark metrics from immutable run projections

## Status

Accepted

## Context

The harness needs to measure improvement across repeated development runs without
introducing a database or a remote telemetry service. Each run already stores its
source, contract, checks, evidence, lifecycle state, approval, retry lineage,
and duration.

## Decision

Expose `benchmarkRuns(stateDir)` and the `ak-harness benchmark` command. They
read the historical `run.json` projections, sort by run ID, and emit a versioned
JSON report with per-run facts and aggregate rates for checks, outcomes, evidence,
approvals, retries, stale runs, and duration.

## Consequences

- Metrics are local, reproducible, portable, and usable without a service.
- Historical reports can be committed or exported by CI when the project wants a
  trend record.
- The report measures harness execution and review friction; it does not claim
  developer productivity or causality without a controlled task benchmark.
- A future remote metrics store can consume this versioned report without changing
  the verification kernel.
