# ADR-0001: Extensible kernel with append-only run events

- Status: accepted
- Date: 2026-08-29

## Context

The harness must work with different coding agents, repositories, browsers,
databases, documentation systems, and tracking providers without moving its
completion guarantees into optional integrations. A mutable summary alone is
also insufficient for diagnosing retries and stale evidence.

## Decision

Keep the contract, lifecycle transitions, evidence validation, source binding,
staleness rules, approval boundaries, and security checks in the kernel. Expose
an in-process, typed plugin registry for optional capabilities. Plugins declare
their API version and dependencies, contribute through named typed slots, and
are cleaned up deterministically.

Persist lifecycle facts as append-only NDJSON under each run. `run.json` remains
the compatible projection used by the current CLI; event records carry the run
ID, source revision, and contract hash so projections and diagnostics can be
checked against the same execution.

## Constraints

- No remote plugin installation, hot reload, marketplace, or distributed event
  store is part of this decision.
- A plugin cannot approve a run or bypass kernel evidence validation.
- Event records are appended by the harness and rejected when malformed or out
  of order.
- Doc Bridge, Playbook profiles, browser adapters, and SCM integrations are
  consumers of this seam, not kernel dependencies.

## Consequences

The public API can grow by adding typed slots and event payloads while the
existing CLI and JSON projection remain stable. The current event log records
run creation and state transitions; check-level event types and remote stores
can be added when a measured diagnostic need justifies them.
