---
title: "Egress Firewall Pattern"
description: "Default-deny outbound network access, configurable per workspace, evaluable at every call site."
---

# Egress Firewall Pattern

Default-deny outbound network access, configurable per workspace, evaluable at every call site.

## TL;DR (human)

Every outbound HTTP call routes through one shim. The shim consults `firewall.evaluate(url, ctx)`. Allowlist comes from workspace config + admin override. Denials are audit-logged. Override flows exist for legitimate one-off needs (recorded + time-boxed).

## For agents

### Why allowlist

Blocklist failure modes:

- New attacker-controlled hosts appear constantly; you cannot enumerate them.
- One missed entry = an exfiltration path.
- Maintenance burden grows linearly with the threat landscape.

Allowlist failure mode is recoverable: a missing entry surfaces as a denied call, which a user can request an override for. Friction trades for safety.

### The shim

One outbound call surface across the entire codebase:

```ts
// in a shared module
export async function safeFetch(url: string, init: RequestInit, ctx: CallContext) {
  const decision = await firewall.evaluate(url, ctx);
  if (decision.allow === false) {
    auditLog.append({ action: "egress.denied", target: { url }, ctx, outcome: "failure", metadata: { reason: decision.reason } });
    throw new SecurityError("SECURITY_EGRESS_DENIED", "Egress to this host is not allowed", {
      hint: `Add ${decision.host} to workspace egress.allow, or use an admin override.`,
    });
  }
  return fetch(url, init);
}
```

Lint enforces that bare `fetch` is forbidden in shipped code; everything uses `safeFetch`.

### The decision

`firewall.evaluate(url, ctx)` consults:

1. **Workspace allowlist** — list of host patterns the workspace admin configured.
2. **Built-in allowlist** — hosts the product itself needs (e.g. license server, telemetry endpoint). Compiled-in, not user-editable.
3. **Active override** — temporary, time-boxed, audit-logged allow grants from an admin.

Returns:

```ts
{
  allow: boolean;
  reason: "workspace-allow" | "builtin-allow" | "override" | "not-allowlisted" | "explicit-deny";
  host: string;
}
```

### Allowlist shape

Host patterns, not full URLs:

```
api.openai.com
*.googleapis.com
api.github.com
hooks.slack.com
```

Patterns:

- Exact host: matches that hostname.
- `*.domain.tld`: matches one-level subdomain.
- `**.domain.tld`: matches any depth subdomain (use sparingly).

Avoid full-URL allowlist (path-level allow). Attackers control redirects; an allowed `api.example.com/safe` redirects to `api.example.com/exfiltrate`. Match the host, not the path.

### Override flow

Legitimate one-off needs (debugging, a one-time data sync):

1. Admin requests an override: `firewall.override.request({ host, reason, expiresAt })`.
2. The request itself is audit-logged.
3. While active: `firewall.evaluate` returns `allow: true, reason: "override"` for that host.
4. The override expires at `expiresAt`; or admin revokes early via `firewall.override.revoke`.
5. Override usage is audit-logged per call.

Overrides are visible in an admin UI alongside the audit trail.

### Connection-bound egress

Some egress is bound to a connector (OAuth integration with GitHub, Slack, etc.). The connection itself implies the allowlisted host:

- When a workspace connects to GitHub, `api.github.com` is implicitly allowed for that workspace.
- When the connection is removed, the implicit allowance disappears (unless explicitly allowlisted elsewhere).

The connection's vault credentials and the firewall allowance are tied — disconnecting cleanly removes both.

### Denial messaging

A denied call surfaces to the agent / user with:

- Code: `SECURITY_EGRESS_DENIED`.
- Hint: how to fix ("Add to workspace allow", "Request admin override").
- The host that was denied (so the user can decide).

Never silently drop. The agent must know why its fetch failed.

### Performance

The firewall check is on every outbound call. Cache aggressively:

- Decision per `(workspaceId, host)` cached in-memory with short TTL (seconds).
- Override expiry invalidates the cache entry.
- Allowlist edits invalidate the cache for that workspace.

A check should add < 1 ms in steady state.

### Sandbox interplay

Code-execution sandboxes (agent-run shell, agent-run code) have their own network policies — typically *no* network access by default, with optional egress through the firewall. The sandbox layer enforces; the firewall is consulted on a per-call basis when the sandbox does allow network.

### Common failure modes

- **Bare `fetch` in shipped code.** Bypasses the shim. → Lint blocks; CI gate catches.
- **Allowlist by full URL with paths.** Redirect-bypass. → Match host only.
- **Override with no expiry.** Permanent allow accumulates. → `expiresAt` required.
- **Allowlist edit not audit-logged.** Admins silently widen surface. → Mutation is an audited event.
- **No connector ↔ allowlist linkage.** Disconnecting a connector leaves stale allowance. → Connection lifecycle drives implicit allowlist.

### See also

- [`universal.md`](./universal.md) — Rule 3 (egress allowlist).
- [`audit-ledger-pattern.md`](./audit-ledger-pattern.md) — denial / override events log here.
- [`rbac-pattern.md`](./rbac-pattern.md) — `firewall:override` is a sensitive capability.
