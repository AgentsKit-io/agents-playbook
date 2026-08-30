# ADR-0022: Signed portable evidence bundles

## Context

Hash chaining protects the local event log from accidental or casual edits,
but a reviewer or CI system needs a portable artifact whose contents and
provenance can be checked outside the originating workspace.

## Decision

`exportEvidenceBundle` packages a reconciled `COMPLETE` run, its projection,
event log, and referenced check outputs. Each file is hashed with SHA-256 and
the canonical bundle payload is signed with an Ed25519 private key. The public
key and signature travel with the bundle; `verifyEvidenceBundle` independently
validates every file hash, the payload hash, and the signature.

The bundle contains check outputs as captured, so operators must treat it as a
potentially sensitive artifact and apply their existing retention controls.

## Consequences

Evidence can cross machine and CI boundaries without adding a remote service.
Key custody remains an operator responsibility; this is a signed artifact, not
a replacement for an enterprise KMS, certificate authority, or notarization
service.
