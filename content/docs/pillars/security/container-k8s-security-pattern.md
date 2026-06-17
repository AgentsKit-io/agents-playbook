---
type: Playbook Pattern
title: 'Container + Kubernetes Security Pattern'
description: 'How to ship containers + run them on Kubernetes without making the runtime an attack surface.'
---

# Container + Kubernetes Security Pattern

How to ship containers + run them on Kubernetes without making the runtime an attack surface.

## TL;DR (human)

Five layers: **image hygiene** (small, signed, scanned), **runtime restrictions** (non-root, read-only filesystem, no privilege escalation), **network policies** (default deny), **secret injection** (vault integration, not env), **admission control** (gate every deploy). Each layer compounds; missing any is exploitable.

## For agents

### Image hygiene

Smaller, signed, scanned:

- **Base image**: distroless or minimal (Alpine, slim variants); fewer packages = smaller attack surface.
- **Multi-stage builds**: build deps in stage 1; final image only ships runtime.
- **No shells / dev tools** in production images (no `bash`, `curl`, package manager).
- **Pin base image by digest** (`FROM image@sha256:...`), not by tag.
- **Sign + verify** (cosign + sigstore — per [`vulnerability-mgmt-pattern.md`](/docs/pillars/security/vulnerability-mgmt-pattern)).
- **Scan on build** (Trivy / Grype / Snyk) and on registry-pull.

Image size: aim < 100MB for typical Node / Go / Java apps. Cuts attack surface + speeds deploys.

### Runtime restrictions (PodSecurityContext)

Every pod sets:

```yaml
securityContext:
  runAsNonRoot: true
  runAsUser: 10001
  runAsGroup: 10001
  fsGroup: 10001
  allowPrivilegeEscalation: false
  readOnlyRootFilesystem: true
  capabilities:
    drop: [ALL]
  seccompProfile:
    type: RuntimeDefault
```

Each line blocks a class of escape / lateral-movement.

`readOnlyRootFilesystem: true` is the most impactful — many exploits write to filesystem; if filesystem is read-only, exploit blocked. Apps that need temp space mount an emptyDir for `/tmp` only.

### Pod Security Standards (PSS)

K8s native (replaces deprecated PodSecurityPolicy):

- **Privileged**: no restrictions (avoid in production).
- **Baseline**: minimum hardening.
- **Restricted**: hard locked down; default for production.

Apply per namespace:

```yaml
metadata:
  labels:
    pod-security.kubernetes.io/enforce: restricted
    pod-security.kubernetes.io/audit: restricted
    pod-security.kubernetes.io/warn: restricted
```

Restricted mode rejects pods that don't meet hardening criteria. Forces compliance by enforcement, not by hope.

### Network policy

Default deny; explicit allow:

```yaml
# default deny all egress + ingress
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny
spec:
  podSelector: {}
  policyTypes: [Ingress, Egress]
```

Then per-namespace allow only what's needed:

- App pods → DB pods (specific ports).
- App pods → DNS (UDP 53).
- App pods → known external endpoints.
- Ingress controller → app pods.

Default-allow in k8s is the most common misconfiguration. Default-deny first; add what breaks; iterate.

### Secret injection

Anti-pattern: secrets as env vars at deploy time (visible in pod spec).

Preferred:

- **External Secrets Operator** + cloud secret manager (AWS Secrets Manager, GCP Secret Manager, Vault).
- **Vault Agent Injector** for HashiCorp Vault: sidecar fetches secrets; templated into volume.
- **Sealed Secrets** (Bitnami): for GitOps where secrets must live in git.

K8s Secrets (the native object) are **base64, not encrypted** by default. Enable encryption at rest at the etcd layer (KMS provider).

See [`secrets-mgmt-deep-pattern.md`](/docs/pillars/security/secrets-mgmt-deep-pattern).

### Workload identity

Per pod: IAM identity (cloud-specific):

- **EKS**: IRSA (IAM Roles for Service Accounts).
- **GKE**: Workload Identity.
- **AKS**: AAD Pod Identity (deprecated) → Workload Identity Federation.

Pod identity → IAM permissions → cloud resources. No long-lived cloud credentials needed.

### Admission control

Before a pod is created, an admission controller can:

- **Validate** the spec (reject if non-compliant).
- **Mutate** the spec (inject sidecars, defaults).

Tools:

- **Open Policy Agent (OPA) Gatekeeper**: policy-as-code; rejects non-compliant.
- **Kyverno**: k8s-native; YAML policies.
- **Pod Security Admission**: built-in PSS enforcement.
- **Validation webhooks**: custom logic.

Example policies:

- Require `runAsNonRoot: true`.
- Block `:latest` image tags (force digest).
- Require image from approved registries.
- Require Network Policy on every pod.
- Require resource limits.
- Block `hostPath` mounts (escape vector).

### Resource limits

Every pod sets CPU + memory limits:

```yaml
resources:
  requests:
    cpu: 100m
    memory: 256Mi
  limits:
    cpu: 1000m
    memory: 512Mi
```

Why critical security-wise:

- No limits = one pod OOMs the node = cascading.
- DDoS-by-resource-exhaustion within cluster.
- Cost predictability.

Enforce via admission controller; reject pods without limits.

### RBAC for k8s itself

Kubernetes API access:

- Use Role / RoleBinding (namespace-scoped); ClusterRole / ClusterRoleBinding (cluster-wide).
- Service Accounts for pods (not user-level for workloads).
- Audit logging on the API server.
- No `cluster-admin` for regular operators; break-glass only.

A `kubectl exec` to a production pod is a privileged action — audited; rare; alternative tooling for routine ops.

### Image registry

- Private registry (ECR, GCR, GHCR, Harbor).
- Pull-secrets per namespace.
- Vulnerability scanning on push.
- Retention policy (keep last N versions; expire older).
- Image-signing required (cosign verification at pull).

### Cluster hardening (operator concerns)

- Etcd encryption at rest (KMS).
- API server audit logging.
- Control plane access restricted (private endpoints).
- Worker nodes hardened (CIS Benchmark).
- Regular cluster upgrades (K8s patches; deprecated APIs).
- Pod-level monitoring (Falco, Tetragon — runtime threat detection).

### Container vulnerability lifecycle

1. **At build**: scan; fail high-CVE.
2. **At registry**: scan periodically; re-scan as new CVEs land.
3. **At deploy**: gate on scan results.
4. **In production**: image catalog tracks which clusters run which versions; CVE alerts route to teams.

Per [`vulnerability-mgmt-pattern.md`](/docs/pillars/security/vulnerability-mgmt-pattern): patch SLA per severity.

### Common failure modes

- **Containers run as root**. Default in many images; exploit easier. → `runAsNonRoot: true`.
- **No Network Policy**. Lateral movement trivial within cluster. → Default deny.
- **Secrets as plain env**. Visible in pod spec; in logs. → External Secrets / Vault injection.
- **`:latest` image tag**. Mutability; rollback ambiguous. → Pin digest.
- **No resource limits**. One pod kills a node. → Required; admission-enforced.
- **`hostPath` mount**. Container can write host filesystem. → Block via admission.
- **Privileged sidecar**. Compromise privileged sidecar = node compromise. → Avoid privileged; specific capabilities instead.
- **Image scan but no enforcement**. Vulnerable images deploy. → Gate at deploy.

### Tooling stack (typical)

| Concern | Tool |
|---|---|
| Image scan | Trivy, Grype, Snyk, Anchore |
| Sign + verify | cosign, sigstore |
| Admission control | OPA Gatekeeper, Kyverno |
| Runtime threat detection | Falco, Tetragon |
| Secrets | External Secrets Operator + cloud SM, Vault |
| Network policy | Calico, Cilium, native |
| Cluster hardening | kube-bench (CIS), kube-hunter |
| RBAC visualisation | kubectl-who-can, rbac-tool |

### See also

- [`vulnerability-mgmt-pattern.md`](/docs/pillars/security/vulnerability-mgmt-pattern) — SBOM + CVE pipeline.
- [`secrets-mgmt-deep-pattern.md`](/docs/pillars/security/secrets-mgmt-deep-pattern) — secret injection patterns.
- [`vault-pattern.md`](/docs/pillars/security/vault-pattern) — secret storage.
- [`../architecture/service-mesh-pattern.md`](/docs/pillars/architecture/service-mesh-pattern) — mTLS in mesh.
- [`compliance-framework-pattern.md`](/docs/pillars/security/compliance-framework-pattern) — container security is a SOC 2 / ISO control.
- [`../architecture/iac-pattern.md`](/docs/pillars/architecture/iac-pattern) — cluster + namespaces defined as code.
