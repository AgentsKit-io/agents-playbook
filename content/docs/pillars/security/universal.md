# Security — Universal Principles

How to bake security into the codebase from PR #1, when agents (not a hardened security team) write most of it.

## TL;DR (human)

Ten rules. Agents will not invent these on their own. Without them, the default behavior is permissive — exactly the wrong default. Adopt all ten before the first user touches the system; retrofitting is much harder than baselining.

1. Auth defaults to required.
2. Tenancy comes from the session, never from the body.
3. Egress is allowlist, never blocklist.
4. Secrets are vault refs, never literals.
5. Privileged actions audit-log before they execute.
6. Errors do not leak internals over the wire.
7. Consent (scoped, time-boxed) is distinct from elevation (role bump).
8. PII is classified, redacted, retention-bounded.
9. Keys rotate without downtime.
10. Threat model is a doc, revisited every release.

## For agents

### Rule 1 — Auth defaults to required

In a method registry: `requireAuth: true` is the **default**. The opt-out is `requireAuth: false`, present explicitly in source, reviewed in PR.

Why default-true:

- Permissive defaults leak. Adding auth later requires hunting every call site.
- A reviewer scanning a PR sees the *opt-out*, asks "why?", catches the unsafe ones.
- Agents copy-paste from neighbors. Default-secure neighbors produce secure copies.

**Failure mode prevented:** silently public endpoints; agent omits the flag; method ships unauthenticated.

### Rule 2 — Tenancy from the session, never from the body

The current `workspaceId` / `orgId` / `tenantId` is derived from the **verified session** of the caller. Never from a request body field the caller controls.

```ts
// ✗ wrong
async function handler({ workspaceId, ... }) { /* trust the body */ }

// ✓ right
async function handler(params, ctx) {
  const workspaceId = ctx.principal.activeWorkspaceId;
  // params is the validated body; it does NOT carry workspaceId
}
```

If a method genuinely needs cross-workspace access (admin tooling), it has an explicit `requireRole: 'admin'` flag + audit log + must derive the target workspace from the request *after* permission check.

**Failure mode prevented:** caller fabricates a tenant id; reads / writes cross tenants; horizontal privilege escalation.

### Rule 3 — Egress is allowlist, never blocklist

Outbound network access: default deny. Configurable allowlist per workspace. Every `fetch` / HTTP client goes through one shim that consults `firewall.evaluate(url, ctx)` before making the call.

Block lists fail because:

- New malicious destinations appear faster than they get added.
- One missed entry is a leak.

Allow lists fail more gracefully — a forgotten entry surfaces as a denied request, which is recoverable. Configure the allowlist via:

- A workspace setting (`workspace.egress.allow = ["api.openai.com", "api.github.com"]`).
- An admin-only override for short-term debugging (logged + audited).

**Failure mode prevented:** agent code exfiltrates data to an attacker-controlled host; agent-installed plugin pings home.

### Rule 4 — Secrets are vault refs, never literals

Source code, env files committed to git, logs — none of these contain raw secrets. They contain **vault references**: opaque ids that resolve via the vault at access time.

```
# .env (committed)
OPENAI_API_KEY=vault://prod/openai/api-key
```

The vault:

- Encrypts at rest with a rotatable sealer key.
- Logs access (which principal, when, which secret).
- Enforces per-secret RBAC.
- Supports rotation (write new version, dual-read window, retire old).

Logs redact known PII / secret key prefixes at the logger boundary. A bug that prints a secret to logs is contained by the redactor.

**Failure mode prevented:** secret in git history (essentially permanent leak); secret in CI logs; secret in error message echoed to user.

### Rule 5 — Privileged actions audit-log before they execute

Sequence for any privileged operation (role grant, secret access, data export, deletion, configuration change):

1. Authorize (RBAC check).
2. **Append a signed audit entry: "principal X requesting action Y on resource Z at time T".**
3. Execute the action.
4. Append the result entry (success / failure / what changed).

The ledger is:

- Append-only (no UPDATE / DELETE).
- Signed in batches with a rotatable key.
- Periodically Merkle-anchored (optional but recommended) so tampering is detectable.

Why log *before* execute: if the system crashes mid-execute, the audit trail shows intent. If you only log on success, attackers learn to crash you between "do it" and "log it".

**Failure mode prevented:** privileged actions with no trail; tampered audit logs; compliance auditor cannot prove who did what when.

### Rule 6 — Errors do not leak internals over the wire

The wire payload of an error has:

- `code` (stable, namespaced string).
- `message` (intl-resolved, sanitized).
- `hint` (optional, sanitized).
- `docsUrl` (optional).
- `requestId` (for correlation).

The wire payload of an error **does not** have:

- Stack traces.
- File paths.
- Raw exception causes (`cause` chain).
- Internal IDs the caller did not create.
- Schema fragments revealing internal structure.

The cause is logged server-side, tagged with the `requestId`, so on-call can correlate without exposing internals to clients.

**Failure mode prevented:** stack traces revealing file paths; error messages echoing user input back unsanitised (XSS); internal IDs revealing existence of records.

### Rule 7 — Consent ≠ elevation

Two separate primitives, often conflated:

| Consent | Elevation |
|---|---|
| Scoped to a specific action / resource | Bumps the caller's role |
| Granted by the subject (the user being acted on) | Granted by an admin |
| Time-boxed at the action level | Time-boxed at the role level |
| `consent.grant({ subject, scope, reason, expiresAt })` | `access.breakGlass.request({ targetRole, reason, expiresAt })` |
| Cannot escalate privilege | Can grant temporary admin |

They use separate stores, separate contracts, separate audit prefixes. Mixing them in one primitive collapses two very different security models into one fuzzy one.

**Failure mode prevented:** an action that should require user consent gets gated on a role check (so admin can do it without asking the user); an action that needs admin elevation gets gated on consent (so any user with consent gets admin-equivalent power for that action).

### Rule 8 — PII is classified, redacted, retention-bounded

For every data field in the system:

1. **Classify**: PII / sensitive / public.
2. **Redact**: the logger redacts known PII fields by name (and known PII patterns by regex) before writing.
3. **Retention**: each class has a default retention window. Storage layer GCs records past the window.
4. **DSAR**: any classified-PII field is exportable on request (Data Subject Access Request) and deletable on request.
5. **Legal hold**: a flag that suspends retention GC for a subject under investigation.

The classification lives in the schema — Zod metadata, decorator, or annotation. Not in a separate spreadsheet.

**Failure mode prevented:** PII in logs forever; user requests deletion, agent cannot find every place it lived; GDPR / LGPD / CCPA non-compliance.

### Rule 9 — Keys rotate without downtime

For every key in the system (sealer, signer, connector OAuth tokens):

- **Versioned.** Keys have id + version. Active version is current.
- **Dual-read window.** When rotating: write new version, keep old version available for reads, retire old after a defined window.
- **Audited.** Rotation event itself is audit-logged.
- **Automated.** Scheduled rotation cadence; manual rotation is the exception.

If a key compromise is suspected: rotation is immediate. The dual-read window collapses to "old version revoked now"; in-flight requests using the old key fail and retry.

**Failure mode prevented:** key compromise requires service downtime; ancient keys hanging around because rotation was hard; no audit of who rotated when.

### Rule 10 — Threat model is a doc, revisited every release

A threat-model doc lives in `docs/security/threat-model.md` (or equivalent). It enumerates:

- **Assets**: what is valuable (data classes, code, infrastructure).
- **Actors**: who attacks (script kiddies, insiders, nation-state — pick the relevant tiers).
- **Attack surface**: where the system meets untrusted input.
- **Threats**: per (asset, actor, surface), what could go wrong.
- **Mitigations**: how each threat is addressed (with links to ADRs / RFCs).
- **Residual risks**: what is accepted as residual, with sign-off.

Per release, walk the doc. Add new threats from new surfaces; close threats whose mitigations shipped; record residual decisions.

**Failure mode prevented:** new surfaces with no threat consideration; old mitigations rotted out; auditor / customer asks "what is your threat model?" and you have no answer.

## See also

- [`../architecture/error-hierarchy.md`](../architecture/error-hierarchy.md) — error class hierarchy underpins Rule 6.
- [`../governance/universal.md`](../governance/universal.md) — audit trail discipline.
- [`rbac-pattern.md`](./rbac-pattern.md), [`vault-pattern.md`](./vault-pattern.md), [`audit-ledger-pattern.md`](./audit-ledger-pattern.md), [`egress-firewall-pattern.md`](./egress-firewall-pattern.md)
- [`threat-model-template.md`](./threat-model-template.md)
