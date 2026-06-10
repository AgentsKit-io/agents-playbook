---
title: 'Error Hierarchy'
description: 'How to design an error model that survives multi-agent development and client-side pattern matching.'
---

# Error Hierarchy

How to design an error model that survives multi-agent development and client-side pattern matching.

> **Reference implementation:** [`@agentskit/core`](https://www.agentskit.io/docs/reference/packages/core) ships this exact pattern — `AgentsKitError` with typed `code`, `hint`, and `docsUrl`, and never throws a bare `Error` at a boundary.

## TL;DR (human)

One base class. One file of codes. Subclasses per namespace. Codes are append-only. Never throw raw `Error` at a boundary. The dispatcher is the only thing allowed to turn unknown thrown values into a generic opaque error.

## For agents

### Class shape

```ts
// packages/core/src/errors/app-error.ts
export type ErrorOpts = {
  readonly hint?: string;
  readonly docsUrl?: string;
  readonly cause?: unknown;
};

export class AppError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly opts: ErrorOpts = {},
  ) {
    super(message, { cause: opts.cause });
    this.name = this.constructor.name;
  }

  serialize() {
    return {
      code: this.code,
      message: this.message,
      hint: this.opts.hint,
      docsUrl: this.opts.docsUrl,
    };
  }
}
```

### Subclasses

One subclass per namespace. They exist so callers can `instanceof`-check by namespace and so codes group together visually.

```ts
export class AuthError extends AppError {}        // AUTH_REQUIRED, AUTH_FORBIDDEN, AUTH_EXPIRED
export class ValidationError extends AppError {}  // VALIDATION_ERROR, VALIDATION_RANGE, ...
export class NotFoundError extends AppError {}    // NOT_FOUND, NOT_FOUND_AFTER_DELETE
export class ConflictError extends AppError {}    // CONFLICT_VERSION, CONFLICT_LOCKED
export class RateLimitError extends AppError {}   // RATE_LIMIT_EXCEEDED, RATE_LIMIT_BLOCKED
export class BillingError extends AppError {}     // BILLING_PAYLOAD_INVALID, BILLING_PROVIDER_DOWN
export class SecurityError extends AppError {}    // SECURITY_EGRESS_DENIED, SECURITY_FIREWALL_BLOCK
```

Subclasses **do not add methods**. They exist for type discrimination. Adding behavior makes them harder for agents to reason about.

### Codes

One file. Append-only.

```ts
// packages/core/src/errors/codes.ts
export const ERROR_CODES = {
  // auth
  AUTH_REQUIRED: "AUTH_REQUIRED",
  AUTH_FORBIDDEN: "AUTH_FORBIDDEN",
  AUTH_EXPIRED: "AUTH_EXPIRED",

  // validation
  VALIDATION_ERROR: "VALIDATION_ERROR",

  // existence
  NOT_FOUND: "NOT_FOUND",

  // conflict
  CONFLICT_VERSION: "CONFLICT_VERSION",

  // dispatcher synthetics
  METHOD_NOT_FOUND: "METHOD_NOT_FOUND",
  HANDLER_NOT_BOUND: "HANDLER_NOT_BOUND",
  HANDLER_THREW: "HANDLER_THREW",
  // ...
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];
```

Rules:

- Format: `\<NAMESPACE\>_\<REASON\>`, all caps, snake-case, ASCII.
- Append-only. **Never rename**; deprecate and add a new code.
- One source file. If you need categorization, use comments and grouping. Do not split across files.
- Every new code needs a one-line entry in `docs/errors/\<CODE\>.md` with: cause, hint, recovery, link to relevant ADR if any.

### When to throw what

| Situation | Class | Code |
|---|---|---|
| Schema parse failed | `ValidationError` | `VALIDATION_ERROR` |
| Unauthenticated caller hit auth-required method | `AuthError` | `AUTH_REQUIRED` |
| Authenticated caller lacks capability | `AuthError` | `AUTH_FORBIDDEN` |
| Resource id not in storage | `NotFoundError` | `NOT_FOUND` |
| Optimistic-lock version mismatch | `ConflictError` | `CONFLICT_VERSION` |
| Egress to non-allowlisted domain | `SecurityError` | `SECURITY_EGRESS_DENIED` |
| Method exists but handler not registered | `AppError` (dispatcher) | `HANDLER_NOT_BOUND` |
| Handler threw a non-AppError | `AppError` (dispatcher) | `HANDLER_THREW` |

### Lint rules

Ban `throw new Error(` in boundary files:

```js
// .eslintrc.cjs
{
  files: [
    "packages/*/src/methods/**",
    "packages/*/src/handlers/**",
    "packages/*/src/api/**",
  ],
  rules: {
    "no-restricted-syntax": ["error", {
      selector: "ThrowStatement > NewExpression[callee.name='Error']",
      message: "Throw a typed AppError subclass with a stable code instead.",
    }],
  },
}
```

Escape hatch: `// allow-raw-error: \<reason\>` on the line above; a gate counts these.

### Wire serialization rules

- The wire payload contains `code` + `message` + optional `hint` + optional `docsUrl` + `requestId`.
- Never serialize `cause`. It can contain stack traces, file paths, env values, or secrets.
- Log the `cause` server-side, tagged with the `requestId`, so support / on-call can correlate.
- Intl-resolve the `message` at the boundary if the caller is a UI surface; do not assume the client speaks English.

### Tests

Each method's contract test (per [`contracts-zod-pattern.md`](/docs/pillars/architecture/contracts-zod-pattern)) covers:

- Happy path: valid params, valid result.
- Reject path: invalid params produce a `ValidationError` with code `VALIDATION_ERROR`.
- Auth path: missing `principalId` produces `AUTH_REQUIRED`.

Plus, every error code is exercised somewhere in the test suite — a separate gate scans tests for `code: "\<CODE\>"` assertions and fails if any code in `ERROR_CODES` is never asserted.

### Common failure modes (sourced from production)

- **Agent throws `new Error("not authorized")`.** Client cannot pattern-match. → Lint blocks raw `Error` in boundary files.
- **Agent renames a code from `AUTH_FORBIDDEN` to `FORBIDDEN`.** Existing clients stop matching. → Codes are append-only; renames require an RFC + a deprecation cycle.
- **Codes drift in naming convention.** Some `AUTH_REQUIRED`, some `AuthRequired`. → One source file + a gate that asserts shape.
- **Stack trace in `error.data` over the wire.** Leaks `/Users/\<dev\>/.env` and the cwd. → Strip `cause` at serialization; log it server-side instead.
- **Error message changes break a client assertion.** Tests assert on `.message` instead of `.code`. → Tests assert on `.code`; messages are intl-resolved and may change.

### See also

- [`contracts-zod-pattern.md`](/docs/pillars/architecture/contracts-zod-pattern) — the dispatcher serializes these.
- [`../security/README.md`](/docs/pillars/security) — audit-ledger entries reference these codes.
- [`../../templates/ADR.template.md`](/docs/templates/ADR.template) — error-namespace renames go through an ADR.
