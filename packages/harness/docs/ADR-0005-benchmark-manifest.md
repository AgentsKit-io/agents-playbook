# ADR-0005: Use explicit benchmark manifests and task bindings

## Status

Accepted

## Context

Run IDs identify executions, not the task being measured. Comparing harness
performance requires a stable task corpus and an honest baseline. A missing
baseline must not be silently inferred from harness history.

## Decision

Add a versioned benchmark manifest containing task IDs, titles, acceptance
criteria, and optional baseline observations. Verification contracts may bind a
run to a suite and task ID. The benchmark report compares only bound harness runs
with explicit, non-`not-run` baseline observations and reports the rest as
non-comparable.

## Consequences

- Multiple runs can be grouped as attempts of one task.
- Baseline provenance is visible and reviewable.
- The first corpus can be committed without fabricating baseline data.
- Controlled task execution and baseline collection remain a later phase; this
  schema provides the stable seam now.
