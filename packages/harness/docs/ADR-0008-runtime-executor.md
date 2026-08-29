# ADR-0008: Execute allowed actions through a bounded runtime seam

## Status

Accepted

## Context

The policy gate can decide whether a tool action is allowed, but the session
protocol still needs a portable way to execute that action and close it with
reproducible evidence. Tool providers differ widely, so the kernel must not
depend on a shell, MCP host, model SDK, or container runtime.

## Decision

Require every `SessionRecorder` to receive a `ToolRuntime`. The built-in
runtime dispatches to explicitly registered handlers, propagates an
`AbortSignal`, applies a timeout, hashes successful results, and returns
structured failures for missing tools, exceptions, and timeouts. The recorder
invokes it only after a policy allow decision and converts the result into the
existing `tool.completed` or `tool.failed` event.

The built-in runtime is in-process. It is an execution boundary, not a hard
security sandbox; isolated process or container runtimes remain provider
adapters for a later phase.

## Consequences

- Runtime handlers are portable and independently replaceable.
- Blocked actions cannot reach a handler through the public session API.
- Raw arguments and results remain in memory only; the event log stores hashes.
- Timeouts bound the recorder's wait, but a handler that ignores abort cannot be
  force-killed by an in-process runtime.
