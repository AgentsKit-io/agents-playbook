# ADR-0011: Runtime attestation in tool evidence

## Status

Accepted

## Context

A sandbox result hash proves what the tool returned, but not which image or
limits produced it. Enterprise review needs to correlate terminal tool events
with the exact runtime profile used for that action.

## Decision

Runtime providers may attach typed runtime evidence to completed or failed tool
results. The Docker provider resolves the local image ID before execution,
hashes the effective profile plus that ID, and carries the attestation into the
terminal event. Missing images or an unavailable daemon fail before execution.

The evidence is descriptive and bound to the harness event's run, source
revision, and configuration hash; it is not a claim that the Docker daemon or
host kernel is trustworthy.

## Consequences

- Reviewers can identify the provider, image digest, security profile, and
  resource limits for each action without storing raw command output.
- Custom runtimes remain compatible because runtime evidence is optional.
- Future VM or remote providers can publish their own typed evidence without
  changing the session protocol.
