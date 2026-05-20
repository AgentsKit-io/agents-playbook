# Secrets Management Deep Pattern

Beyond `vault-pattern.md` — operational specifics: dynamic secrets, short-lived credentials, secret-zero, secret-less architectures, OIDC federation.

## TL;DR (human)

Long-lived secrets are the highest-value target. Modern best practice: short-lived dynamic secrets, OIDC federation, secret-less where possible (workload identity). The vault still exists but issues credentials valid for minutes, not years.

## For agents

### Secret lifecycle taxonomy

| Class | Lifetime | Issuance |
|---|---|---|
| **Static long-lived** | Months-years (API keys, DB passwords) | Manual; rotated rarely |
| **Static short-lived** | Days (refresh tokens) | Manual; auto-refresh |
| **Dynamic short-lived** | Minutes-hours (just-in-time DB creds) | On request, per session |
| **Workload identity (secret-less)** | Per-request | Federation; never stored |

Move toward dynamic + workload identity. Static long-lived are the leak target.

### Dynamic secrets (Vault example)

Instead of:

```
# .env (committed)
DATABASE_URL=postgresql://app:long_lived_password@host:5432/db
```

Do:

```ts
// at startup
const creds = await vault.read("database/creds/app-readonly");
// creds.username and creds.password are issued for 1 hour.
// New connection uses them; renew before expiry.
```

Vault issues a new DB user on-the-fly; revokes on expiry. Compromise window: the lifetime, not "forever".

### Workload identity (the secretless future)

Modern cloud: a workload's identity is its IAM role. Example (AWS):

```
EC2 instance → role "app-prod" → policy allows access to S3 / RDS / Secrets Manager
```

The workload calls AWS APIs; AWS verifies the role via instance metadata; no secret in code.

For Kubernetes: IRSA (IAM Roles for Service Accounts) — each pod has its own role.

For CI/CD: OIDC federation:

```
GitHub Actions workflow → assumes AWS role (verified via OIDC token) → temporary creds
```

No long-lived secret in CI. The OIDC trust path is the only thing required.

This is the **single highest-leverage security move** modern teams make. Adopt aggressively.

### Cross-cloud federation

- AWS ↔ GCP: workload identity federation (no long-lived service-account keys).
- AWS ↔ Azure: similar.
- Cloud ↔ on-prem: harder; usually requires a bridge vault.

### Secret zero — the bootstrap problem

To read from the vault, you need credentials. To get credentials, you need to read from the vault. Bootstrap.

Solutions:

- **Cloud workload identity**: trust the cloud's identity for the first credential.
- **Hardware token**: physical key for the first credential (HSM, TPM).
- **Operator-injected**: human pastes initial seed on first boot; rotated immediately.
- **Sealed initial secret**: deploy with sealed credentials only the trusted runtime can unseal.

Secret zero is the hardest. Get the rest of your hygiene right first.

### Secret types + storage

| Type | Storage |
|---|---|
| API keys (third-party) | Vault; rotate quarterly |
| DB passwords | Vault; preferably dynamic |
| Encryption keys (DEK) | Vault; wrapped by KEK in KMS |
| Encryption keys (KEK) | KMS / HSM; never extractable |
| TLS certs | Cert manager + ACME (Let's Encrypt) or internal CA |
| OAuth refresh tokens | Vault; per-user; per-connector |
| JWT signing keys | Vault; rotated on schedule; old keys retained for verification |
| Webhook secrets | Vault; per-integration |

### Per-environment isolation

- Dev vault separate from prod vault.
- Dev workloads cannot reach prod vault.
- Different sealer keys per environment.
- Different ACLs; no cross-env reads.

Common mistake: shared vault with namespace separation. One ACL bug = cross-env leak.

### Auditing access

Every vault read / write logs:

- Caller (principal id).
- Secret path.
- Timestamp.
- Source (IP, host).
- Outcome (granted / denied).

Per [`audit-ledger-pattern.md`](./audit-ledger-pattern.md): the audit log itself goes into the same signed ledger.

Anomaly detection: a service that reads secret X 1×/hour suddenly reads 100×/hour = either expected pattern change or compromise. Surface; investigate.

### Operator access

Humans accessing prod secrets:

- Step-up auth (2FA / hardware key).
- Time-boxed grant (per [`rbac-pattern.md`](./rbac-pattern.md) break-glass).
- Audit-logged with reason.
- Notification to security team.
- Auto-revoke after window.

Operators reading prod secrets should be an exception, not routine. If routine, you have automation gaps.

### Secret in environment variables

Common but problematic:

- Visible in process listings (`ps`, `/proc`).
- Inherited by child processes.
- Often leaked into logs / error dumps.

Mitigations:

- Read once into memory; clear env var.
- Memory-only; don't write to disk.
- Logger redactor knows env var keys.

Better: don't put secrets in env at all. Read from vault at startup.

### Secrets at build vs runtime

| Stage | Should contain secrets? |
|---|---|
| Source code | Never |
| Lock files | No |
| Build artifacts (image, bundle) | No — secrets are runtime concerns |
| Container env vars (at run) | OK if vault-injected, never baked in |
| Runtime memory | Yes, transiently |
| Logs | Never (redact) |

A container image with baked-in secrets gets pulled by N developers, lands in image registries, leaks.

### Sealed secrets (for GitOps)

When secrets live in git (rare; usually avoided):

- **SOPS** + KMS (Mozilla): encrypt before commit; decrypt at deploy.
- **Sealed-Secrets** (Bitnami): asymmetric encryption; controller decrypts in-cluster.
- **AWS Secrets Manager** + external-secrets operator: secrets in cloud; manifest references them.

For most cases, **secrets don't live in git**. The above are for unavoidable GitOps integration.

### Common failure modes

- **Long-lived secrets in CI**. Single most common leak. → OIDC federation.
- **One secret used across environments**. Dev compromise = prod compromise. → Per-env.
- **Secret rotated but consumers not updated**. Outage. → Tooling that pushes to all consumers atomically.
- **Vault unreachable = total outage**. App can't read any secret. → Local cache with short TTL; circuit-breaker semantics.
- **HSM not used for KEK**. Sealer key on disk. → Always external-keystore for KEK.
- **No anomaly detection on vault**. Compromise goes undetected. → Per-principal read-rate monitoring.

### See also

- [`vault-pattern.md`](./vault-pattern.md) — vault basics.
- [`secrets-leak-postmortem-playbook.md`](./secrets-leak-postmortem-playbook.md) — when a leak happens.
- [`audit-ledger-pattern.md`](./audit-ledger-pattern.md) — access audit trail.
- [`../quality/ci-cd-pipeline-pattern.md`](../quality/ci-cd-pipeline-pattern.md) — OIDC federation in CI.
- [`rbac-pattern.md`](./rbac-pattern.md) — break-glass for operator access.
