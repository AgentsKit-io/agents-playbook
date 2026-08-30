# ADR-0018: Attest verification projections before approval

## Context

`run.json` is a convenient projection of checks and outcomes, but it is not
itself an immutable store. Approval must not trust a projection that was
changed after verification while the source and contract remain unchanged.

## Decision

After every verification pass, the harness hashes the checks, outcomes, and
metrics projection, persists that `verificationDigest` in `run.json`, and
appends a `verification.completed` event carrying the same digest. Human
approval recomputes the digest, verifies the audit log, and requires the latest
completion event to match it.

## Consequences

Manual edits to the verification projection are rejected before approval while
the existing source and contract freshness checks remain in force. The digest
protects the local projection through the audit log; it is not a digital
signature or external notarization. Dogfood uses the public API, and prior
Docker sandbox evidence remains covered by the earlier runtime phase.
