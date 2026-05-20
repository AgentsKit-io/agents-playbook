---
title: 'Vault Pattern'
description: 'How to store secrets so a leaked log line, a stolen disk, or a curious agent does not compromise the system.'
---

# Vault Pattern

How to store secrets so a leaked log line, a stolen disk, or a curious agent does not compromise the system.

## TL;DR (human)

Secrets live in a vault, not in code or env files. The vault encrypts at rest with a rotatable sealer key. Code holds vault references; values resolve at access time. All access is audit-logged. Rotation is automated and zero-downtime via dual-read windows.

## For agents

### What "vault" means here

A vault is an abstraction with three guarantees:

1. **Encryption at rest** with a key that is itself separately stored / managed (KMS / HSM / Tang).
2. **Per-secret access control** (which principals / roles can read which secret).
3. **Audit log** of every read / write / rotate.

It can be implemented as:

- A SQLite store with envelope encryption (sealer wraps DEKs; DEKs wrap secrets).
- An external service: HashiCorp Vault, AWS Secrets Manager, 1Password, Doppler.
- Cloud KMS-backed (GCP KMS, AWS KMS) with secrets in their managed store.

The choice depends on deployment topology; the abstraction is the same.

### Reference shape

Code does not contain secret values. It contains references.

```
# .env (committed, contains references)
OPENAI_API_KEY=vault://prod/openai/api-key
STRIPE_WEBHOOK_SECRET=vault://prod/stripe/webhook-secret
```

```ts
// at access time
const apiKey = await vault.resolve("vault://prod/openai/api-key", ctx);
```

The `vault.resolve` call:

- Checks the caller's capability against the secret's ACL.
- Audit-logs the access (principal, secret id, time).
- Decrypts and returns. Caches in-memory with a short TTL.

The resolved value never gets written back to disk in plaintext, never gets logged, never appears in stack traces.

### Envelope encryption

Layered encryption keeps the blast radius small:

```
plaintext
   ↓ encrypt with DEK (data encryption key, per-secret)
ciphertext1 + DEK_wrapped
   ↓ DEK encrypted with KEK (key encryption key, the sealer)
ciphertext1 + DEK_wrapped_by_KEK
```

To rotate the sealer (KEK), you re-wrap every DEK with the new KEK — fast, because DEKs are tiny and there are few of them per secret. You do not re-encrypt the secret bodies.

To rotate a specific secret, you generate a new DEK, re-encrypt the secret, replace the row. The KEK is untouched.

### Rotation

Sealer (KEK) rotation:

1. Generate new sealer.
2. Re-wrap every DEK with the new sealer. Store both wrapped versions briefly.
3. Promote the new sealer to current.
4. After dual-read window, retire the old sealer.
5. Audit-log the rotation event.

Per-secret rotation (e.g. quarterly for high-value secrets):

1. Generate new secret value (or fetch from upstream — e.g. new API key from OpenAI).
2. Write a new version of the row. Mark old version as deprecated, retain for dual-read.
3. Update consumers (typically: re-resolve references).
4. After dual-read, retire old version.

Compromise rotation (suspected leak):

1. Generate new value.
2. Mark old version revoked, not deprecated.
3. Audit incident; bump rotation log.

### Logger redaction

Even with vault refs in code, secrets can leak via logged objects (e.g. a request body containing a token). The logger redacts:

- Known key names: `password`, `token`, `secret`, `apiKey`, `authorization`, `cookie`.
- Known patterns: AWS-style key prefixes, Stripe `sk_*`, GitHub `ghp_*`, generic PEM blocks, base64 high-entropy strings over N bytes.
- Vault refs themselves: `vault://*` → `vault://***`.

Redaction is at the logger boundary, not at the call site. Call sites cannot forget.

A **secrets scan gate** (see [`../quality/quality-gates-pattern.md`](../quality/quality-gates-pattern.md)) runs on every commit to catch raw secrets that escaped the logger redactor.

### Per-environment vaults

Production and dev vaults are separate. A dev principal cannot resolve a prod reference. Common implementation:

- Each vault has a namespace prefix in the reference (`vault://prod/...`, `vault://dev/...`).
- The runtime context carries `env`. Resolving a prefix that does not match `env` fails.
- Bootstrap config injects the right `env` into each deployment.

### Connector credentials

OAuth tokens / API credentials from third-party integrations live in the vault as encrypted rows in a `connector_credentials` store. Per-row metadata:

- `principal_id` (who connected it).
- `workspace_id` (scope).
- `provider` (github, slack, etc.).
- `expires_at` (when the token expires; refresh flow re-writes the row).
- `revoked_at` (null if active).

Refresh flow: a scheduler reads rows with `expires_at < now + grace`, runs provider-specific refresh, writes new row.

### Common failure modes

- **Secret in a `.env.example` file committed verbatim instead of a placeholder.** Real key in git forever. → `.env.example` contains references only, not values. Secrets scan blocks raw values.
- **Secret in a code comment** ("`// the API key is XYZ for local dev`"). → Secrets scan catches it.
- **Secret in an error message echoed to logs.** → Logger redactor.
- **In-memory caching with no TTL.** Compromised process holds secrets in memory forever. → Short TTL (minutes).
- **Sealer key stored alongside the vault contents.** Owning the disk gives you everything. → Sealer in KMS / HSM / Tang, separate trust boundary.
- **No rotation cadence.** Old keys stay live forever. → Scheduled rotation; rotation is a regular event.

### See also

- [`universal.md`](./universal.md) — Rule 4 (vault refs), Rule 9 (rotation).
- [`rbac-pattern.md`](./rbac-pattern.md) — capability check gates vault reads.
- [`audit-ledger-pattern.md`](./audit-ledger-pattern.md) — every vault access logged.
