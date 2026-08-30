# ADR-0007: Gate tool actions with ordered deny-by-default policy

## Status

Accepted

## Context

The session protocol observes tool calls, but observation alone cannot prevent
an unsafe or out-of-scope action from reaching a runtime. The kernel needs a
portable control point that works before provider-specific tool execution.

## Decision

Require every `SessionRecorder` to receive a typed `PolicyGate`. The built-in
`createPolicyGate` evaluates ordered exact-tool rules, uses the first match,
and blocks by default when no rule allows the tool. Rules may allow, block, or
require human approval. Each decision is recorded; approval-required attempts
cannot enter the pending execution lifecycle until a human approves them.

The gate receives hashes and identifiers only. It does not execute tools,
inspect raw arguments, or approve the overall task.

## Consequences

- A tool cannot be requested through the public session API without a policy
  decision.
- Sensitive tools can pause for an explicit human decision before execution.
- Policy behavior is deterministic, inspectable, and provider-independent.
- Rejected or unresolved approvals remain fail-closed and generate an audit
  trail without storing raw prompts, arguments, or results.
- Existing integrations must provide an explicit allowlist or their tools are
  blocked by default.
