# ADR-0003: Bind optional Doc Bridge context to a run

- Status: accepted
- Date: 2026-08-29

## Decision

The harness provides a dependency-free `createDocBridgeContextProvider` adapter
that reads the local `.doc-bridge/index.json` contract. It returns at most
eight deterministic references, carries the index `contentHash` as source
provenance, and computes a stable snapshot hash.

`planRun` accepts resolved context snapshots and freezes them into `run.json`
with a `contextHash`. The lifecycle log records one `context.attached` event per
snapshot. Resolution timestamps remain audit metadata and are excluded from the
reproducibility hash.

Shell-based agents use the same wire boundary with `context resolve` and
`plan --context-file`. A context file contains one snapshot or an array of
snapshots, allowing another provider to participate without a dynamic runtime
loader.

The file loader verifies the snapshot hash before planning. This makes the
portable handoff tamper-evident while leaving provider-specific source
provenance and authorization at the provider boundary.

## Boundaries

The adapter does not install or import Doc Bridge, access remote services, or
refresh context after planning. A caller owns query selection and must resolve
context before the contract is verified. Index schema validation and richer
semantic search remain responsibilities of Doc Bridge; malformed or missing
indexes fail the adapter closed.
