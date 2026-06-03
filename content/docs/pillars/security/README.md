---
title: 'Pillar — Security'
description: 'How to build security in from day one when the people writing the code are agents, not a hardened security team.'
---

# Pillar — Security

How to build security in from day one when the people writing the code are agents, not a hardened security team.

## Status

◐ Scoped, not yet detailed. Universal layer outlined below; concrete recipes ship in a future session.

## Scope

| Concern | Universal principle | Concrete pattern (TS) |
|---|---|---|
| Identity | One signed principal per call; never trust caller-supplied `userId` | `resolveAuthContext(req)` middleware; principal comes from verified session/JWT only |
| RBAC | Roles → capabilities → resources, persisted, audited | RBAC store with SQLite; capability check at handler entry |
| Vault | Secrets sealed at rest, sealer is rotatable | Key ring with KMS/HSM sealer; envelope-encrypted secrets |
| Audit ledger | Append-only, signed batches, Merkle-verifiable | Ed25519-signed audit entries; periodic Merkle anchoring |
| Egress | Allowlist outbound network access per workspace | `firewall.evaluate(url, ctx)` at every fetch; deny by default |
| Consent vs elevation | Scoped time-boxed user consent ≠ role escalation | `consent.grant` (scoped) and `access.breakGlass` (role-elevation) are separate contracts |
| PII | Classification → redaction → retention | PII profiles + redaction at log + storage boundaries |
| Legal hold | Suspend retention on subject of investigation | Legal-hold flag short-circuits retention GC |
| DSAR | Subject access / deletion request workflow | DSAR proof-of-completion record signed |
| Key rotation | Connector creds + sealer keys rotatable without downtime | Versioned keys, dual-write window, audit on rotate |
| Break-glass | Time-boxed admin elevation with signed audit | `access.breakGlass.{request,list,revoke}` writes signed ledger |
| Threat model | Documented and revisited per release | `docs/security/threat-model.md`, updated on RFC changes |

## Non-negotiables

1. **No raw secrets in code, env files committed, or logs.** Vault refs only; logs redact known PII keys at the logger.
2. **Auth defaults to required.** Every contract entry is `requireAuth: true` unless an explicit `false` survives PR review.
3. **Audit before action.** Privileged operations log to the signed ledger before they execute; rollback if they fail.
4. **Egress is allowlist, not blocklist.** Default deny.
5. **Tenancy from the session, never the body.** `orgId` / `workspaceId` is resolved from the verified principal; clients cannot spoof it.

## See also

- [`../architecture/error-hierarchy.md`](/docs/pillars/architecture/error-hierarchy) — `SecurityError` namespace.
- [`../governance/README.md`](/docs/pillars/governance) — break-glass + consent audit trail.
- [`../../templates/`](/docs/templates) — ADR + RFC skeletons for security changes.

## Documents in this pillar

| Doc | Read when |
|---|---|
| [`universal.md`](/docs/pillars/security/universal) | First read; the 10 non-negotiables |
| [`rbac-pattern.md`](/docs/pillars/security/rbac-pattern) | Designing role / capability / scope model |
| [`vault-pattern.md`](/docs/pillars/security/vault-pattern) | Storing secrets; rotation; sealer |
| [`audit-ledger-pattern.md`](/docs/pillars/security/audit-ledger-pattern) | Append-only signed ledger for privileged actions |
| [`egress-firewall-pattern.md`](/docs/pillars/security/egress-firewall-pattern) | Outbound network allowlist |
| [`vulnerability-mgmt-pattern.md`](/docs/pillars/security/vulnerability-mgmt-pattern) | SBOM, CVE triage, supply-chain attacks, signed releases |
| [`dependency-hygiene-pattern.md`](/docs/pillars/security/dependency-hygiene-pattern) | Add / update / remove dependency lifecycle, transitive risk |
| [`multi-tenant-isolation-pattern.md`](/docs/pillars/security/multi-tenant-isolation-pattern) | Tenant data isolation, noisy-neighbor, cell-based deploy |
| [`data-classification-pattern.md`](/docs/pillars/security/data-classification-pattern) | Per-field tagging drives redaction, retention, residency |
| [`on-call-rotation-pattern.md`](/docs/pillars/security/on-call-rotation-pattern) | Paging structure, severity ladder, IMOC, post-mortems |
| [`secrets-leak-postmortem-playbook.md`](/docs/pillars/security/secrets-leak-postmortem-playbook) | Minute-by-minute response when a secret leaks |
| [`compliance-framework-pattern.md`](/docs/pillars/security/compliance-framework-pattern) | SOC 2 / ISO / GDPR / HIPAA controls mapped to playbook practices |
| [`secrets-mgmt-deep-pattern.md`](/docs/pillars/security/secrets-mgmt-deep-pattern) | Dynamic secrets; OIDC federation; workload identity; secret-zero |
| [`session-mgmt-pattern.md`](/docs/pillars/security/session-mgmt-pattern) | Hybrid JWT + refresh; cookie flags; step-up; SSO + SCIM |
| [`rate-limiting-ddos-pattern.md`](/docs/pillars/security/rate-limiting-ddos-pattern) | Edge + app rate limits; algorithms; login + signup hardening |
| [`container-k8s-security-pattern.md`](/docs/pillars/security/container-k8s-security-pattern) | Image hygiene; SecurityContext; NetworkPolicy; admission control |
| [`ai-llm-safety-pattern.md`](/docs/pillars/security/ai-llm-safety-pattern) | Prompt injection defense; tool authorization; cost + safety caps |
| [`governance-posture-pattern.md`](/docs/pillars/security/governance-posture-pattern) | Expose enforced controls (air-gap, egress, redaction, sandbox, RBAC, audit) as a read-only, low-privilege signal |
| [`threat-model-template.md`](/docs/pillars/security/threat-model-template) | Per-project threat-model skeleton |
