# ADR-0032: Harness-equivalent benchmark runs

## Status

Accepted for the benchmark pilot.

## Decision

Run the frozen benchmark corpus once per task with a task-specific harness
contract and `benchmark: { suiteId, taskId, mode: "harness" }` binding. Keep each
task's lifecycle state isolated so a blocked provider result cannot be mistaken
for another task's approval. Collection delegates directional calculations to
the existing `benchmarkRuns` implementation.

The runner prepares and executes plans but never records human approval. A task
is comparable only after the real checks pass and a human moves it to
`COMPLETE`; pending and blocked runs remain visible and non-comparable.

## Consequences

- Baseline and harness runs share task identity and provenance.
- Human approval remains an auditable gate rather than an automation shortcut.
- The first collection may report no improvement when the provider is blocked;
  that is a valid result, not missing data to be filled in.
- Temporary untracked directories no longer crash source freshness checks.
