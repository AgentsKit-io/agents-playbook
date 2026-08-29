# ADR-0016: Baseline evidence digests

## Context

Criterion coverage and directional metrics can still be detached from the
exact JSON input used during baseline collection. Without a digest, a later
review cannot distinguish the recorded evidence file from a changed copy.

## Decision

When `ak-harness benchmark baseline` reads `--evidence-file`, it computes and
stores the file's lowercase SHA-256 digest in `evidenceDigest`. Manifest
validation accepts only a 64-character lowercase SHA-256 value. The digest is
of the evidence file content, not of the external artifact named by each
criterion source.

## Consequences

The baseline record is tamper-evident with respect to its input file and can be
replayed from the same bytes. External systems remain an explicit integration
boundary; their content verification is not claimed by the local harness.
