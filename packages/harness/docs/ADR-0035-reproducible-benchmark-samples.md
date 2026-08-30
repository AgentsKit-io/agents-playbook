# ADR-0035: Use independent samples for benchmark confidence

## Context

A single provider run is too noisy to support a reliable performance claim.
Counting repeated measurements as retries also exaggerates delivery cost.

## Decision

The benchmark runner accepts `--repeats N` and creates an isolated contract and
state directory for each sample. Reports count `COMPLETE` samples toward
confidence, compare duration using their median, and count retries only from
superseded run lineages.

## Consequences

Three or more completed samples can reach reliable confidence when the manifest
policy requires it. Human approval remains required for every sample. A median
reduces the influence of one slow provider run but does not prove causality or
productivity improvement.
