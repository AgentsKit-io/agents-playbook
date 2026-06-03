---
title: 'Audit Ledger Pattern'
description: 'How to prove who did what when, in a way that survives compromise.'
---

# Audit Ledger Pattern

How to prove who did what when, in a way that survives compromise.

## TL;DR (human)

Append-only ledger. Every privileged action writes one entry. Entries are signed in batches with a rotatable key. Periodic Merkle-anchoring makes tampering detectable. Reads / writes are themselves audited. The ledger is the truth.

## For agents

### What gets logged

| Event class | Examples |
|---|---|
| Authentication | Login, logout, session refresh, failed login |
| Authorization | Role grant, role revoke, capability change, break-glass elevation |
| Vault | Secret read, secret write, secret rotation, vault unlock |
| Data | Privileged read (export), bulk write, deletion |
| Configuration | RBAC rule change, allowlist edit, retention policy change |
| Compliance | DSAR (export, delete), legal-hold set/clear |
| System | Database migration, key rotation, schema upgrade |

What does **not** get logged:

- Routine read operations (every `users.list` would flood the ledger).
- Unauthenticated 401s (high volume, low signal — log to metrics instead).
- Health checks.

Calibration: any action whose outcome a compliance audit might need to prove. If a regulator asks "who exported customer data on day X", the ledger answers.

### Entry shape

```ts
type AuditEntry = {
  id: string;            // ULID; lexicographically sortable
  ts: string;            // ISO-8601 UTC
  actor: {
    type: "user" | "agent" | "service";
    id: string;
    role?: string;       // role at the time of action
  };
  action: string;        // "vault.read", "rbac.role.grant", "compliance.dsar.export"
  target?: {
    type: string;        // "secret", "user", "workspace"
    id: string;
  };
  outcome: "intent" | "success" | "failure";
  context: {
    workspaceId?: string;
    requestId: string;
    ip?: string;         // redacted in some compliance modes
    userAgent?: string;
  };
  metadata?: Record<string, unknown>; // sanitised; never raw values
};
```

`outcome: "intent"` is the pre-action entry (Rule 5: audit before execute). `outcome: "success" | "failure"` is the post-action result.

### Append-only

The store enforces append-only at the schema layer:

- No `UPDATE` permission on the audit table.
- No `DELETE` permission. Period.
- Retention pruning (if any) is itself a separate audited event; the deleted entries' hashes remain in the ledger as tombstone references.

If a compliance regime forbids any deletion, retention pruning is disabled and the ledger grows indefinitely (mitigated by archival to cold storage).

### Signing

Entries are signed in **batches**. Per N entries (or per T seconds), a signer:

1. Computes the hash of the batch (Merkle root over entry hashes).
2. Signs the root with the audit signing key.
3. Writes a `signature` row referencing the batch range.

Verifying integrity:

1. Recompute the Merkle root over the entries in the batch range.
2. Verify the signature against the recorded signing key.
3. Mismatch → tamper signal.

Signing keys rotate per the vault rotation rules. Old signatures remain verifiable via retained public keys.

### Merkle anchoring (optional)

For higher assurance:

- Periodically (daily / weekly), publish the latest Merkle root to an immutable external store: another database, a blockchain, a signed-by-third-party log, a public attestation service.
- This anchors the local ledger's tip; if someone retroactively edits a past entry, the recomputed root no longer matches the anchored value.

Adopt anchoring when:

- You have customer-facing claims about tamper-evidence.
- Compliance regime requires (some industries).

### Read API

Queries against the ledger return entries plus the verification status of each:

```ts
audit.entries.list({ filter }) → {
  rows: AuditEntry[],
  verified: boolean,        // signatures over the returned rows match
  unverified: string[],     // entry ids where verification failed
}
```

Display surfaces show the verification status to the operator. An "unverified" row is a red flag, even if rare.

### Sensitive vs non-sensitive

Some audit entries contain sensitive metadata (the actor's IP, the target's name). Compliance modes:

- **Standard**: entries stored as written.
- **Privacy-enhanced**: certain fields hashed (one-way) before storage. Queryable by hash, not by content.
- **Air-gapped**: entries periodically exported to a tamper-evident store off the live system.

Configurable per deployment; default is **Standard**.

### DSAR + legal hold interplay

When a DSAR (data deletion) request lands, the ledger is **not** automatically purged. The retention rules are:

- Personal data **subject** to DSAR: deleted from operational stores; an audit entry records the deletion.
- Personal data **as evidence** in the audit ledger itself: retained per legal / compliance requirements; the regulator's exemption for audit logs typically applies.
- A `legal_hold` flag on a subject suspends both operational-store retention and any optional audit pruning.

### Common failure modes

- **Audit log only on success.** Attacker crashes the system mid-action; intent never logged. → Log intent before execute.
- **Audit log includes raw secret values.** Defeats the vault. → Metadata is sanitised; never includes secret bodies.
- **Mutable audit log.** Someone can edit a past entry. → Append-only at the storage layer; sign batches.
- **Audit log without rotation of signing key.** Compromised signing key compromises all past entries' integrity. → Rotation cadence + key id per signature.
- **Audit log nobody verifies.** Tamper is undetectable until external audit. → Periodic verification job; alerts on mismatch.

### See also

- [`universal.md`](/docs/pillars/security/universal) — Rule 5 (audit before execute), Rule 9 (rotation).
- [`vault-pattern.md`](/docs/pillars/security/vault-pattern) — every vault access logs.
- [`rbac-pattern.md`](/docs/pillars/security/rbac-pattern) — every RBAC mutation logs.
