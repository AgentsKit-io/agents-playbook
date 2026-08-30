# ADR-0009: Add a bounded shell-free process runtime

## Status

Accepted

## Context

An in-process handler is useful for adapters, but it cannot be killed if it
ignores abort and is not an isolation boundary for untrusted code. The harness
needs a portable process seam for commands that require stronger lifecycle
control without pretending that every host has a container runtime.

## Decision

Expose `createProcessToolRuntime`. Each tool has a fixed executable, argument
list, optional working directory, and explicit environment. The runtime uses
`spawn` with `shell: false`, sends one JSON request over stdin, kills timed-out
or oversized children, and returns only hashed stdout or structured failure
metadata.

Recovery closes the failed action and requires a fresh policy-approved action;
the harness does not automatically replay potentially side-effecting tools.

This is a bounded child-process boundary, not a complete security sandbox.
Container, OS policy, filesystem, network, and credential isolation remain
provider-specific responsibilities.

## Consequences

- Shell interpolation is removed from the portable process path.
- Timeouts and output limits prevent common runaway-process failures.
- Explicit environments reduce accidental secret inheritance.
- Hard isolation and resource quotas require a later sandbox provider.
