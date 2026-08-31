# ADR-0040: benchmark corpus surface coverage

## Status

Accepted — 2026-08-31

## Context

The AgentsKit OS bridge initially measured three real coding tasks, all backed
by a small logic fixture. That was enough to prove the protocol binding, but it
could not show that the harness preserved different delivery surfaces.

## Decision

Benchmark tasks may declare a typed `surfaces` list using the same surface names
as the verification contract. The phase-45 corpus remains anchored to the
AgentsKit OS benchmark definition and adds executable CLI and documentation
tasks. The runner validates the CLI through real child-process invocations and
validates the documentation contract against the resulting README.

The surface list is descriptive metadata. It does not make a task comparable,
complete, or human-approved; those claims still require the normal lifecycle,
criterion evidence, and current-source verification.

## Consequences

- Corpus validators can require coverage of named surfaces without guessing
  from file paths.
- The bridge now exercises logic, CLI, and documentation delivery shapes.
- Endpoint, database, MCP, and UI tasks remain future corpus additions and must
  bring their real runtime checks when introduced.
- No benchmark performance improvement is inferred from corpus expansion alone.
