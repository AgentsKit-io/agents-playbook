# ADR-0023: Require human decisions for ambiguous action recovery

## Status

Accepted

## Context

Session recovery can identify a requested tool action from the event log, but a
process can stop after the runtime starts and before a terminal event is
persisted. Automatically retrying that action can duplicate an external side
effect.

## Decision

Record `tool.execution.started` immediately before entering a runtime. During
session recovery, such actions remain pending but fail closed. The public
session API exposes `recoverTool` with human-only `retry` and `abandon`
decisions. Retry clears the ambiguous marker and records the decision;
abandonment records the decision and blocks the action. Actions without an
execution-start event can resume normally, and terminal actions are never
replayed.

## Consequences

- Recovery is safe by default for side-effecting tools.
- Human review is required only when the event log cannot prove that execution
  never started.
- Runtime providers remain portable; idempotency and external transaction
  semantics remain provider responsibilities.
