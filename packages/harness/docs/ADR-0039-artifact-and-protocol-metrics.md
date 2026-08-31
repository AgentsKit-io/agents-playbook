# ADR-0039: Separate artifact acceptance from protocol completion

## Decision

Repeated external benchmark samples record `artifactAcceptanceRate`: the
fraction whose task-specific artifact validation passed. The observation
`status` remains protocol-aware and only qualifies for comparable duration or
resource metrics when the baseline delivery and criterion evidence are
complete.

Harness runs may expose the same metric through structured check evidence. The
benchmark report aggregates the available run-level rates and reports their
sample count; missing evidence is not converted to an acceptance failure.

Baseline observations also record `protocolCompletionRate`: the fraction of
samples whose provider completed the verification protocol. Harness reports
expose the corresponding per-task rate and sample count. This makes protocol
reliability measurable without treating an incomplete baseline as comparable.

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
