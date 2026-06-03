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

- [`../architecture/error-hierarchy.md`](../architecture/error-hierarchy.md) — `SecurityError` namespace.
- [`../governance/README.md`](../governance/README.md) — break-glass + consent audit trail.
- [`../../templates/`](../../templates/) — ADR + RFC skeletons for security changes.

## Documents in this pillar

| Doc | Read when |
|---|---|
| [`universal.md`](./universal.md) | First read; the 10 non-negotiables |
| [`rbac-pattern.md`](./rbac-pattern.md) | Designing role / capability / scope model |
| [`vault-pattern.md`](./vault-pattern.md) | Storing secrets; rotation; sealer |
| [`audit-ledger-pattern.md`](./audit-ledger-pattern.md) | Append-only signed ledger for privileged actions |
| [`egress-firewall-pattern.md`](./egress-firewall-pattern.md) | Outbound network allowlist |
| [`vulnerability-mgmt-pattern.md`](./vulnerability-mgmt-pattern.md) | SBOM, CVE triage, supply-chain attacks, signed releases |
| [`dependency-hygiene-pattern.md`](./dependency-hygiene-pattern.md) | Add / update / remove dependency lifecycle, transitive risk |
| [`multi-tenant-isolation-pattern.md`](./multi-tenant-isolation-pattern.md) | Tenant data isolation, noisy-neighbor, cell-based deploy |
| [`data-classification-pattern.md`](./data-classification-pattern.md) | Per-field tagging drives redaction, retention, residency |
| [`on-call-rotation-pattern.md`](./on-call-rotation-pattern.md) | Paging structure, severity ladder, IMOC, post-mortems |
| [`secrets-leak-postmortem-playbook.md`](./secrets-leak-postmortem-playbook.md) | Minute-by-minute response when a secret leaks |
| [`compliance-framework-pattern.md`](./compliance-framework-pattern.md) | SOC 2 / ISO / GDPR / HIPAA controls mapped to playbook practices |
| [`secrets-mgmt-deep-pattern.md`](./secrets-mgmt-deep-pattern.md) | Dynamic secrets; OIDC federation; workload identity; secret-zero |
| [`session-mgmt-pattern.md`](./session-mgmt-pattern.md) | Hybrid JWT + refresh; cookie flags; step-up; SSO + SCIM |
| [`rate-limiting-ddos-pattern.md`](./rate-limiting-ddos-pattern.md) | Edge + app rate limits; algorithms; login + signup hardening |
| [`container-k8s-security-pattern.md`](./container-k8s-security-pattern.md) | Image hygiene; SecurityContext; NetworkPolicy; admission control |
| [`ai-llm-safety-pattern.md`](./ai-llm-safety-pattern.md) | Prompt injection defense; tool authorization; cost + safety caps |
| [`governance-posture-pattern.md`](./governance-posture-pattern.md) | Expose enforced controls (air-gap, egress, redaction, sandbox, RBAC, audit) as a read-only, low-privilege signal |
| [`threat-model-template.md`](./threat-model-template.md) | Per-project threat-model skeleton |
