# ADR-0027: Verify signed evidence outside the source workspace

## Context

An evidence artifact is only useful to CI reviewers and release systems if it
does not depend on the original checkout. Existing bundle tests verified
signatures and trust, but did not prove path independence.

## Decision

The CLI flow copies the signed bundle and trust store into a separate temporary
directory and verifies them there. The bundle remains self-contained and the
existing trusted-key model is unchanged.

## Consequences

The portability guarantee is exercised without a new transport or dependency.
The probe remains local and deterministic; CI or a release system can upload
the same bundle as an artifact when its completed run is available.
