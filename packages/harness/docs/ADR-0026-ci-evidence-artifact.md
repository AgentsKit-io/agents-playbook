# ADR-0026: Preserve CI harness evidence for human review

## Context

Running checks in CI without retaining the harness run leaves reviewers with
only a green job and no portable evidence bundle to inspect. The harness still
requires human approval, so the CI result must remain reviewable rather than
being treated as completion.

## Decision

The Playbook quality job runs the current harness contract, keeps its
`.codex/verification/harness-phase-24` directory, and uploads it as a
short-lived artifact. The run must reach `AWAITING_HUMAN_APPROVAL`; approval is
still a separate human action.

## Consequences

Reviewers can inspect the run projection, event log, and check outputs from the
same CI execution. Artifact retention is limited to 14 days; long-term audit
retention belongs to the release or compliance system that consumes the
artifact.
