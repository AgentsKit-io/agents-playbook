# ADR-0039: Separate artifact acceptance from protocol completion

## Decision

Repeated external benchmark samples record `artifactAcceptanceRate`: the
fraction whose task-specific artifact validation passed. The observation
`status` remains protocol-aware and only qualifies for comparable duration or
resource metrics when the baseline delivery and criterion evidence are
complete.

## Rationale

An agent can produce a correct artifact while failing to provide the required
verification protocol, for example because the verifier is unavailable. That
is valuable evidence about task outcome and protocol reliability, but treating
it as a complete baseline would make timing and resource comparisons unsafe.
Keeping the dimensions separate makes the failure visible without converting
partial evidence into a completion claim.

## Limits

Artifact acceptance is only as strong as the real task validator supplied by
the benchmark. It does not prove human approval, protocol compliance, or
enterprise readiness. A future benchmark schema may add criterion-level sample
rates when the corpus needs per-criterion variance rather than one aggregate
rate.
