---
type: Playbook Pattern
title: 'Data Classification Pattern'
description: 'How to label every field by sensitivity, then make the labels drive redaction, retention, residency, and access.'
---

# Data Classification Pattern

How to label every field by sensitivity, then make the labels drive redaction, retention, residency, and access.

## TL;DR (human)

Every field in the system has a classification tag (Public, Internal, Confidential, Restricted, PII). The tag drives behavior: logger redaction, retention windows, storage encryption, region routing, DSAR exportability. Classification lives in the schema, not in a spreadsheet — agents see it where they write the code.

## For agents

### The classification ladder

| Class | Examples | Storage | Logs | Retention default | Cross-region |
|---|---|---|---|---|---|
| **Public** | Product name, public docs, marketing | Anywhere | Logged in full | Indefinite | OK |
| **Internal** | Workspace names, non-sensitive metadata | App stores | Logged with sanitisation | Indefinite (with cleanup) | OK |
| **Confidential** | Business logic, internal metrics, API URLs | App stores | Logged with redaction | 1–7 years | Region-aware |
| **Restricted** | API keys, OAuth tokens, internal secrets | Vault only | Redacted always | Per rotation cycle | Vault per region |
| **PII** | Name, email, phone, address, IP | Encrypted at rest; access-audited | Redacted; never logged in full | 7 years default; DSAR-deletable | Region-pinned per sovereignty |
| **Sensitive-PII** | SSN, payment card, health | Tokenised via specialist provider | Never logged | Minimum retention; regulated | Per regulation |

Two-tier PII split: regular PII (commonly handled by most products) vs sensitive PII (PCI-DSS, HIPAA, PSD2 — often tokenised via specialist providers like Stripe so you don't store it directly).

### Where the classification lives

In the schema. Annotation alongside the field:

```ts
const User = z.object({
  id: z.string().uuid(),                                 // Internal
  workspaceId: z.string().uuid(),                        // Internal
  email: z.string().email().describe("pii"),             // PII
  hashedPassword: z.string().describe("restricted"),     // Restricted (don't log; never return)
  preferences: z.record(z.unknown()),                    // Internal
  createdAt: z.string().datetime(),                      // Public
});
```

The `describe()` (or your schema metadata) carries the classification. Tools introspect it.

Alternative: a separate `*.classification.ts` file per schema package, mapping field paths to classes. Either works; consistency matters.

### What the classification drives

**Logger redaction**:

```ts
// The logger introspects the schema; redacts any field tagged PII / Restricted.
logger.info("user-created", User.parse(rawUser));
// → email redacted as "***@***", hashedPassword as "***", others passed through.
```

**Database storage encryption**:

- Restricted: column-level encryption (per-row key from vault).
- PII: per-tenant key encryption at rest (rotation across all PII tables on key rotation).
- Sensitive PII: typically not stored — tokenised externally.

**Retention**:

- Storage layer reads classification → applies retention default.
- Legal hold flag suspends.
- DSAR deletion respects classification (PII deletable; audit-ledger PII retained per regulator exemption).

**Region routing**:

- PII writes to user's region only.
- Cross-region replication for non-PII; pinned for PII.
- See [`../architecture/multi-region-pattern.md`](/docs/pillars/architecture/multi-region-pattern).

**Access control**:

- PII fields require a specific capability (`pii:read`).
- Restricted fields require step-up auth.
- All sensitive-class accesses audit-logged.

### Redaction discipline

Three redaction modes, by class:

| Class | Redaction in logs | Redaction in error messages | Redaction in DSAR export |
|---|---|---|---|
| Public | none | none | none |
| Internal | none | none | exported as-is |
| Confidential | sanitise keys (no value leakage) | minimise | exported as-is |
| Restricted | always full redaction | never echoed | never exported |
| PII | always redacted to non-identifying form | never echoed | exported (user owns their data) |
| Sensitive-PII | never logged | never echoed | per regulation |

Redaction at the **logger boundary**, not at the call site. Call sites cannot forget; agents writing handlers cannot leak.

### DLP (Data Loss Prevention) controls

Beyond redaction, DLP scans for accidental classification breaches:

- **Outbound network traffic**: scan for known PII patterns (email regex, credit-card-with-Luhn, SSN format). Block + alert on match in a non-PII destination.
- **Log streams**: scan; alert if redactor missed a known-PII pattern.
- **Database query results**: optionally scan for cross-class leakage (Restricted appearing in a Confidential query).

DLP is a backstop, not a primary defense. The primary defense is classification-driven redaction.

### Sovereignty + classification

When a customer's PII must stay in their region (GDPR / LGPD / regional law):

- PII fields are region-pinned at the storage layer.
- A tenant-id → region map drives routing (see multi-tenant isolation).
- Cross-region access enforced at the network / storage layer, not just app.

Sovereignty applies to PII; non-PII can replicate freely.

### Right to erasure (DSAR / GDPR Article 17)

When a user requests deletion:

1. Identify all PII fields for that user (the schema classifications make this systematic).
2. Delete from operational stores.
3. **Audit ledger entries about the user**: retained per regulator exemption (audit logs are legal evidence; classification.legalRetention overrides DSAR).
4. **Anonymise where possible**: usage metrics keyed by hashed user id; aggregated counts stay.
5. **Proof of completion**: signed record of the deletion (DSAR proof), retained.

The classification metadata makes this tractable. Without it, every DSAR is an archaeology project.

### Sensitive PII (PCI / HIPAA / specialist regimes)

These deserve special treatment:

- **PCI (payment card)**: do not store. Use a tokenising provider (Stripe, Braintree, Adyen). Your DB holds the token; the provider holds the card.
- **HIPAA (PHI)**: classified; access-controlled; audit-logged per HIPAA requirements; BAA with cloud provider; encryption at rest mandatory.
- **PSD2 (open banking)**: strong customer authentication; consent management distinct from your normal consent flow.

For each regime, document the scope (which fields fall under it), the compliance program (encryption, BAA, audits), and the data-handling boundary (often a separate microservice).

### Gate

A classification gate scans the schema files:

1. Every PII-classed field is associated with a known retention class.
2. Every PII-classed field is logged-redacted (verified by static analysis of logger calls).
3. Cross-class violations detected (a Restricted field flowing into a Confidential-only logger sink, e.g.).

This is harder than the basic gates; consider building it incrementally as the schema base grows.

### Common failure modes

- **No classification at all.** Everything treated as equally sensitive (paralysing) or equally non-sensitive (leak risk). → Even rough Public / Confidential / PII split is a huge win.
- **Classification in a spreadsheet.** Drifts from code. → In-schema annotation.
- **DSAR runs as an ad-hoc script per request.** Slow + error-prone. → Tooling that walks the classification metadata.
- **Audit logs scrubbed in DSAR.** Lose evidence; regulator unhappy. → Audit logs retain per exemption.
- **Cross-class flow** (PII used as a primary key in a non-PII analytics table). → Schema gate forbids.
- **Sensitive PII stored at all.** PCI scope creeps because "we just need it for one feature". → Architectural ADR: do not store; use tokeniser.

### Adoption path

1. Pick the four classes that matter (Public, Internal, Confidential, PII as a starter).
2. Tag the obvious fields (email, password, name, id).
3. Wire the logger to read tags + redact.
4. Wire DSAR to walk PII fields.
5. Add Restricted + Sensitive-PII later as the regime requires.

Tagging incrementally beats trying to classify everything at once.

### See also

- [`universal.md`](/docs/pillars/security/universal) — Rule 8 (PII).
- [`audit-ledger-pattern.md`](/docs/pillars/security/audit-ledger-pattern) — sensitive accesses logged.
- [`vault-pattern.md`](/docs/pillars/security/vault-pattern) — Restricted lives in vault.
- [`multi-tenant-isolation-pattern.md`](/docs/pillars/security/multi-tenant-isolation-pattern) — tenant + class scope.
- [`../architecture/multi-region-pattern.md`](/docs/pillars/architecture/multi-region-pattern) — region pinning for PII.
