# ADR-0038: Use an end-to-end benchmark boundary

## Decision

Baseline samples measure elapsed time from disposable fixture setup through
provider execution, artifact validation, and the end of the sample. Harness
comparisons continue to use the elapsed duration of the configured real check.
The provider-reported duration is retained as diagnostic data, not as the
comparable duration.

## Rationale

Comparing provider-only baseline time with the harness check time mixes two
different scopes and can manufacture a regression. A common boundary measures
the delivery workflow the human actually waits for. It also exposes whether a
slow result comes from the provider or from validation overhead.

## Limits

The boundary does not remove provider, machine, network, or human-approval
variance. Independent samples and median aggregation remain required; deeper
latency decomposition is a later optimization if the comparable end-to-end
measurement still regresses.
