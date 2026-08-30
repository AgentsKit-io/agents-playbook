# ADR-0006: Record agent sessions through a protocol-first seam

## Status

Accepted

## Context

The harness must make agent work observable without coupling the kernel to a
specific model, runtime, tool host, or provider. It also must not turn prompts,
tool arguments, results, or chain-of-thought into persisted application data.

## Decision

Expose a small `AgentAdapter` descriptor and `createSessionRecorder` API. The
recorder accepts hashes and metadata, writes correlated session, turn, and tool
events to the existing append-only run log, and rejects invalid local ordering.
It can start only from `IMPLEMENTING`; with `resume: true`, it reconstructs
unfinished actions from the event log and emits a `session.resumed` event. A
persisted `tool.execution.started` event marks an unfinished action as
ambiguous; resumption requires an explicit human `retry` or `abandon` decision
through `recoverTool` before the runtime can be entered again. It does not
execute tools or make policy decisions.

## Consequences

- Any coding agent can implement the descriptor without importing an agent SDK.
- Session evidence is reproducible and correlated by run, session, turn, and
  action IDs.
- Raw content stays outside the harness event log.
- An interrupted process can resume pending approvals and actions without
  replaying completed tools or bypassing the policy gate.
- An interrupted action that may have reached an external runtime is fail-closed
  until a human explicitly chooses retry or abandonment.
- A later policy gate or runtime adapter can consume this protocol without
  changing the verification kernel.
