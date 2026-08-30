# ADR-0020: Reconcile terminal projections before reporting completion

## Context

The event log and human decision attestations protect the audit trail, but
`run.json` is still a mutable projection. Reading it directly after approval
could report `COMPLETE` even if its digest, decision projection, or decision
event had been removed or changed.

## Decision

Expose `reconcileRun` in the public API and `ak-harness audit` in the CLI. The
reconciliation verifies the event hash chain, event-to-run binding, current
verification digest, and the required approval/authorization event and
projection for terminal states. `ak-harness status` uses this same gate.

## Consequences

Post-approval projection tampering and removal of a decision event fail closed
with a harness error. Historical non-terminal projections remain inspectable;
terminal runs from before the attestation protocol must be reverified rather
than being treated as enterprise-grade evidence.
