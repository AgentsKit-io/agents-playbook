# ADR-0021: Explicit recovery for orphaned event-log locks

## Context

The per-run event-log lock prevents concurrent append and read operations from
duplicating sequence numbers or observing a partial write. A process can still
terminate after acquiring the lock, leaving a file that must not be removed
automatically because another writer may still own it.

## Decision

Write the owning process ID and creation timestamp into every lock. Expose lock
inspection and an explicit `human`-authorized recovery operation. Recovery is
allowed only when the lock is older than the requested threshold and its owner
process is no longer alive. Malformed, young, or live locks remain fail-closed.

The CLI exposes this maintenance operation as `events unlock`; it never runs as
part of normal status, verification, or append flows.

## Consequences

An interrupted local run can be recovered without manually deleting an audit
artifact, while active or ambiguous locks cannot be silently bypassed. A lock
owner PID is local-process evidence; distributed writers still require a shared
coordination primitive outside this file store.
