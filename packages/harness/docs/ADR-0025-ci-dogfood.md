# ADR-0025: Dogfood the harness in Playbook CI

## Context

The package can validate itself locally, but the Playbook CI previously ran
repository checks without explicitly building, invoking, or installing the
harness as a consumer. A release could therefore regress the harness path
without failing the repository gate.

## Decision

Run `harness:test`, `harness:cli`, and the clean packed-consumer probe in the
quality job immediately after dependency installation. Keep the checks
explicit and local; the harness lifecycle still owns human approval for
task-level completion.

## Consequences

The Playbook continuously exercises the package and both CLI entrypoints in
the same Node 22 environment used by CI. The CI job does a small amount of
duplicate work with package-level checks, which is intentional release-path
coverage.
