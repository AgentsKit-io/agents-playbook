# RBAC Pattern

How to model "who can do what" so the checks survive multi-agent edits.

## TL;DR (human)

Three nouns: principal, role, capability. Principals (users / agents / service accounts) have roles; roles grant capabilities; capabilities authorize actions. The handler entry-point checks capabilities, never roles directly. Persistent store; audited mutations.

## For agents

### Why not role-based-everywhere

Putting role checks inline at every handler is the failure mode:

```ts
// ✗ wrong
if (ctx.principal.role !== "admin" && ctx.principal.role !== "owner") throw new AuthError(...)
```

Problems:

- Role names drift; every handler hand-maintains its own role allowlist.
- New roles (e.g. `auditor`) require touching every handler.
- A typo in a role name silently grants access.

Capability-based check delegates the decision:

```ts
// ✓ right
if (!ctx.principal.can("users:write")) throw new AuthError("AUTH_FORBIDDEN");
```

`can()` consults the role → capability mapping, which lives in one place.

### Model

Three primary entities:

1. **Principal** — a user, an agent, a service account. Identified by stable id. Has a list of role assignments.
2. **Role** — a named bundle. Has a list of capabilities. Roles are *not hierarchical* by default (no inheritance) — explicit is safer than implicit.
3. **Capability** — a fine-grained verb on a resource. `users:read`, `users:write`, `users:invite`, `secrets:read`, `flows:run`. Format: `<resource>:<verb>`.

Optional fourth:

4. **Scope** — a binding of the role assignment to a tenant / workspace / project. So a principal can be "admin in workspace A" + "member in workspace B".

### Storage

Persistent, audited:

```
roles(id, name, description)
role_capabilities(role_id, capability)
principal_role_assignments(principal_id, role_id, scope_id, expires_at)
capability_definitions(capability, description, sensitivity)
```

Mutations to any of these go through `rbac.*` contracts, audit-logged.

### Check at the boundary

The dispatcher / handler entry point performs the check. Not inside business logic.

```ts
async function dispatch(method, params, ctx) {
  const entry = REGISTRY[method];
  if (entry.requireCapability && !ctx.principal.can(entry.requireCapability)) {
    throw new AuthError("AUTH_FORBIDDEN", undefined, {
      hint: `Requires capability '${entry.requireCapability}'`,
    });
  }
  // ... continue
}
```

Why at the boundary: business logic gets dozens of agent-authored edits; capability checks belong somewhere stable.

### Role + capability lifecycle

| Operation | Contract | Auditable |
|---|---|---|
| Define a new capability | `rbac.capability.upsert` | ✓ |
| Define a new role | `rbac.role.upsert` | ✓ |
| Add a capability to a role | `rbac.role.grant` | ✓ |
| Remove a capability from a role | `rbac.role.revoke` | ✓ |
| Assign a role to a principal | `roles.assign` | ✓ |
| Revoke a role from a principal | `roles.revoke` | ✓ |
| List active assignments | `roles.list` | (read; logged if sensitive) |

Mutations go through the audit ledger before they execute (see [`audit-ledger-pattern.md`](./audit-ledger-pattern.md)).

### Capability naming

`<resource>:<verb>` keeps the namespace clean.

- `users:read`, `users:write`, `users:delete`.
- `flows:create`, `flows:edit`, `flows:run`, `flows:delete`.
- `secrets:read`, `secrets:write`.
- `audit:read`, `audit:export`.

Avoid:

- Mega-capabilities like `admin` (too broad; mapped to "all" by accident).
- Verb-only capabilities like `read` (no resource scope).

### Sensitive capabilities

Some capabilities require additional protection:

- **Step-up auth**: re-prompt for password / 2FA before granting.
- **Time-boxed elevation**: granted only via break-glass (see Rule 7 in [`universal.md`](./universal.md)).
- **Consent-gated**: require subject consent in addition to caller capability (see [Rule 7](./universal.md)).

The capability definition itself carries metadata flagging it sensitive; the dispatcher / handler honors the metadata.

### Bootstrap problem

First principal of a fresh install: who creates it? Pattern:

- Install-time seed creates an `owner` role + assigns it to the first user that completes onboarding.
- The seed is one-shot — once any principal has the `owner` role, the seed is inert.
- The bootstrap action is itself audit-logged.

### Common failure modes

- **Inline role checks.** Drift; typos. → Capability check at boundary.
- **No scope.** "admin" globally instead of "admin in workspace X". → Scope every assignment.
- **No expiry.** Permanent role grants accumulate. → `expires_at` on every assignment; long-lived defaults to "until revoked" but visible in `roles.list`.
- **Self-grant.** Principal grants themselves a role. → `rbac.role.grant` requires `rbac:manage` capability the principal does not have on themselves.
- **Role-grant audit log omits scope.** Cannot tell *where* the grant applied. → Audit entry includes principal, role, scope, granter, time.

### See also

- [`universal.md`](./universal.md) — Rule 7 (consent vs elevation), Rule 5 (audit before).
- [`audit-ledger-pattern.md`](./audit-ledger-pattern.md)
- [`vault-pattern.md`](./vault-pattern.md) — capability check gates vault reads.
