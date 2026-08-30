# ADR-0029: Separate CI preparation from human approval

## Context

The CI dogfood flow needs to create and verify a run, but CI cannot truthfully
act as the human who approved the task contract. Recording `--by human` in CI
would make the audit trail misleading.

## Decision

`plan prepared --by ci` creates a planned run with a `contractPreparation`
record. It may proceed through verification and produce evidence, but only the
existing human approval path can transition the run to `COMPLETE`. Human
planning continues to use `plan approved --by human`.

## Consequences

CI evidence is honest and reviewable without weakening the completion gate.
The run schema remains readable for older v1 records through the optional
legacy `contractApproval` field.
