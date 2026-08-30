# ADR-0033: Portable agent-side verification gate

## Status

Accepted for the benchmark pilot.

## Decision

Disposable coding-agent fixtures expose the built `ak-verify` command through a
fixture-local wrapper and PATH entry. The fixture contract is prepared with
`plan prepared --by ci` before the provider starts. The provider can therefore
run the same real verification command from inside its working directory.

The wrapper is a convenience for provider-side feedback, not the final trust
boundary. The outer harness still validates the provider report and acceptance
evidence, and only a human can move an outer run to `COMPLETE`.

## Consequences

- Missing `ak-verify` is observable as an environment/setup failure instead of
  an unexplained provider partial result.
- No human decision is fabricated inside the benchmark fixture.
- The wrapper executes the pinned local harness build; it does not install
  dependencies or grant network access.
- Provider status and artifact validation remain separate signals.
