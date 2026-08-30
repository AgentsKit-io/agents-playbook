# ADR-0019: Record human decisions as attested lifecycle events

## Context

The verification result is now attested before approval, but the approval and
tracking authorization themselves only existed in the mutable `run.json`
projection. An audit consumer could see that a run reached `COMPLETE` without
an immutable record of which human decision accepted the exact evidence.

## Decision

Record `approval.recorded` and `authorization.recorded` events in the existing
hash-chained lifecycle log. Each event contains the decision, resulting state,
verification digest, source revision, contract hash, and human actor; tracking
authorization also contains its declared target. Rejections are recorded too,
so every human terminal decision is auditable.

The existing freshness and verification-attestation checks run before either
decision is accepted. The `run.json` fields remain a convenient projection,
but the event is the audit record.

## Consequences

Consumers can independently prove which verified result was approved and which
external tracking target was authorized. Legacy logs remain readable and are
reported as legacy until they contain the new hashed event protocol. This is an
audit attestation, not a digital signature or external notarization.
