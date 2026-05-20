---
title: 'API Versioning + Deprecation Pattern'
description: 'How to evolve public contracts without surprising consumers.'
---

# API Versioning + Deprecation Pattern

How to evolve public contracts without surprising consumers.

## TL;DR (human)

Public APIs follow semver per package. Non-breaking changes (add field, add method) are minor. Breaking changes (rename, remove, type change) are major and require an RFC, a deprecation window, and a migration guide. The wire stays stable longer than the code; clients trust this or they leave.

## For agents

### Three change categories

| Change | Semver | Process |
|---|---|---|
| Add a new method | minor | Free; new entry in registry |
| Add an optional field to params | minor | Default value handles old callers |
| Add a field to result | minor | Old clients ignore unknown fields |
| Tighten validation (was permissive) | major | Existing payloads may newly reject |
| Loosen validation | minor (usually) | Old clients still parse |
| Remove a method | major | Deprecation cycle |
| Rename a field | major | Deprecation cycle (keep both, then drop old) |
| Change a field's type | major | Deprecation cycle |
| Change an error code | major | Code is the contract; clients pattern-match |
| Change semantics of an existing method | major (always) | Even if shape unchanged |

### Deprecation lifecycle

A breaking change to a public surface follows:

1. **RFC.** Proposed change + migration plan. Review window per [`rfc-pattern.md`](./rfc-pattern.md).
2. **Implement the new shape alongside the old.** Both work. Both have tests.
3. **Mark the old as deprecated.** `@deprecated` JSDoc; `Deprecation` HTTP header; explicit log warning per use. Document migration in the deprecation message.
4. **Deprecation window**: at least one major version, or the documented period (commonly 90 / 180 / 365 days).
5. **Telemetry**: instrument old-shape usage. If usage drops to zero earlier, accelerate retirement.
6. **Retire.** Major bump. Old shape removed in the same release.

The window is the contract. Honor it even if internal usage is zero — external consumers may exist.

### `@deprecated` discipline

A deprecation comment must include:

- **What is deprecated** (the symbol / method / shape).
- **When it will be removed** (target version or date).
- **What to use instead** (the migration target, with a code example).
- **Why** (the rationale; usually a link to the RFC).

```ts
/**
 * @deprecated Since v2.3. Will be removed in v3.0.
 * Use `users.invite` instead, which carries explicit role assignment.
 * See RFC-0023 (https://...).
 *
 * @example
 *   // before
 *   await client.users.create({ email, defaultRole });
 *   // after
 *   await client.users.invite({ email, role });
 */
export function create(params: CreateParams) { ... }
```

A `@deprecated` with no migration path is debt, not deprecation.

### Migration guides

Per major release, a migration guide doc lives at `docs/migrations/v\<X\>.md`. Sections:

- **Summary** of breaking changes.
- **Per-change**: before / after code snippets, automated codemod (if any), test surface to verify.
- **Order of operations** for migrating a large consumer codebase.
- **Rollback procedure** if migration fails.

A migration guide that doesn't tell consumers the **order** to migrate ("update X first, then Y") is incomplete.

### Codemods for major bumps

For migrations that are mechanical (rename a field, restructure a call), ship a codemod:

```bash
npx @your-org/migrate --from v2 --to v3 --dry-run
```

Codemods transform source code on the consumer's repo. Standard tools: jscodeshift, ast-grep, ts-morph.

Even when the codemod doesn't cover 100% of cases, it covers the bulk; humans / agents handle the tail. The 80/20 rule: a codemod that handles 80% of call sites is worth shipping.

### Backwards-compat shims

When a breaking change is essentially "rename one field":

```ts
// Receive both old and new; emit only new.
const Params = z.object({
  email: z.string().email(),
  // old → new shim
  defaultRole: z.string().optional(),  // deprecated
  role: z.string().optional(),
}).transform((d) => ({
  email: d.email,
  role: d.role ?? d.defaultRole,
}));
```

The shim:

- Lives only during the deprecation window.
- Logs a deprecation warning when the old field is used.
- Has a removal date; removal PR is pre-scheduled.

Shims that outlive their deprecation window are debt.

### Wire format vs internal types

The wire format is the contract. Internal types can refactor freely as long as the wire is unchanged.

When agents look at the schema package and think "this is convoluted", check: is it convoluted because of *wire compatibility*? If so, leave it. Refactor the internal layer (the handler, the store) without touching the wire.

### Version negotiation

If you support multiple major versions concurrently:

- **URL-based**: `/v1/...` / `/v2/...` paths.
- **Header-based**: `Accept: application/vnd.api+json; version=2`.
- **Per-request**: the client sends its version; the server adapts.

URL-based is easiest to implement and discover. Header-based is cleaner conceptually but harder to debug.

### REST / RPC / GraphQL specifics

| Style | Versioning convention | Notes |
|---|---|---|
| REST | URL path segment | Most discoverable |
| JSON-RPC | Method name suffix or namespace | `users.list.v2` |
| GraphQL | Schema evolution (no versions); field-level `@deprecated` | The GraphQL way: deprecate fields, never remove silently |
| gRPC | `proto3` field reservation | Reserve removed field numbers to prevent reuse |

Pick one. Mixing styles confuses consumers.

### Stable error codes — the same rules

Error codes are part of the public contract. The same rules apply:

- Append-only.
- Rename = breaking → RFC.
- New codes are minor.
- Removed codes are major (clients pattern-match).

See [`error-hierarchy.md`](./error-hierarchy.md) for the error model.

### Common failure modes

- **Silent breaking change.** "Refactor" PR changes a wire field; clients break. → Gate detects schema diff; requires RFC reference.
- **Deprecation without migration path.** `@deprecated` says "use the new method" without examples. → Migration code required in the comment.
- **Removing on next release.** Same release deprecates AND removes. → Honor the window.
- **Two versions live forever.** v1 + v2 + v3 all maintained; engineering velocity craters. → Sunset old majors on a calendar.
- **Forgot to bump major.** Patch release breaks consumers. → Schema-diff gate (see [`contracts-zod-pattern.md`](./contracts-zod-pattern.md)) catches.

### See also

- [`rfc-pattern.md`](./rfc-pattern.md) — breaking changes require RFC.
- [`contracts-zod-pattern.md`](./contracts-zod-pattern.md) — schema gate detects breaking diffs.
- [`error-hierarchy.md`](./error-hierarchy.md) — error codes are contract.
- [`feature-flags-pattern.md`](./feature-flags-pattern.md) — flags ramp new behavior without breaking old.
