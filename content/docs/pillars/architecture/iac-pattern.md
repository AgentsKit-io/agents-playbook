---
type: Playbook Pattern
title: 'Infrastructure as Code (IaC) Pattern'
description: 'How to define + version + review + apply infrastructure as code, instead of clicking around cloud consoles.'
---

# Infrastructure as Code (IaC) Pattern

How to define + version + review + apply infrastructure as code, instead of clicking around cloud consoles.

## TL;DR (human)

Every cloud resource is described in code (Terraform / Pulumi / CDK / CloudFormation). Code lives in git, reviewed via PR, applied via CI. Drift detection alerts when reality differs from code. Modules abstract reusable patterns. State management is the operational hard problem; secure + back it up.

## For agents

### Why IaC

- **Reviewable**: changes visible as PRs.
- **Reproducible**: spin up identical environments.
- **Versioned**: history of every change.
- **Auditable**: who applied what when.
- **Testable**: validate before apply.
- **Reusable**: modules across teams + environments.

Clicking in the cloud console:

- Unreviewable.
- Reality drifts.
- Disaster recovery from scratch = days.
- No history.

### Tooling

| Tool | Style | Notes |
|---|---|---|
| **Terraform / OpenTofu** | Declarative HCL; multi-cloud | Most popular; large module ecosystem |
| **Pulumi** | Code (TS/Python/Go); declarative | Multi-cloud; type-safe |
| **AWS CDK** | TypeScript / Python; generates CloudFormation | AWS-only; deep integration |
| **CloudFormation** | YAML/JSON | AWS-native; verbose |
| **Bicep** | Microsoft-native DSL | Azure-only |
| **Crossplane** | k8s-native; provisions cloud resources via CRDs | k8s-first orgs |

Most teams: Terraform / OpenTofu (or Pulumi). Aim for one IaC tool across the org.

### Code structure

```
infra/
├── modules/                 # reusable building blocks
│   ├── vpc/
│   ├── eks-cluster/
│   ├── rds-postgres/
│   └── service/             # generic service module
├── envs/                    # per-environment config
│   ├── dev/
│   │   └── main.tf          # imports modules with dev values
│   ├── staging/
│   └── prod/
└── README.md
```

Modules are reusable; envs compose modules with environment-specific values.

### Module discipline

A module:

- Has clear inputs (variables) + outputs.
- Has versioning (tagged in git or registry).
- Has README + example usage.
- Has tests (Terratest, Pulumi unit tests).
- Has minimal blast radius (a "VPC module" doesn't reach into compute).

Cross-cutting modules (security groups, IAM roles, observability defaults) capture conventions per [`anti-overengineering.md`](/docs/pillars/architecture/anti-overengineering): write once, reuse N+ times.

### State management

Terraform state is a JSON file describing what's deployed. Treat it as critical:

- **Remote backend** (S3 + DynamoDB lock, GCS, Terraform Cloud, Pulumi service): never local-only in prod.
- **Encryption at rest**: backend-level.
- **Locking**: prevents concurrent applies corrupting state.
- **Backup**: state file backup retention; recover from corruption.
- **Per-env state**: dev / staging / prod separate; blast-radius bounded.

State drift (reality differs from state) is the common operational issue. `terraform plan` regularly to detect.

### Workflow

```
1. Engineer writes / changes Terraform code.
2. PR opens.
3. CI runs `terraform plan` against target env; comments plan on PR.
4. Reviewer reads the plan; approves changes.
5. PR merges.
6. CI runs `terraform apply` (or manual approval gate).
7. State updates; resources change.
8. Smoke checks confirm health.
```

Direct `terraform apply` outside the pipeline = bypass; treat as anti-pattern.

### Plan as the review artifact

`terraform plan` outputs:

- What will be created.
- What will be updated.
- What will be **destroyed** (critical to spot).

The plan is the reviewable thing. A PR with a plan showing "destroy production database" is caught here.

CI posts the plan to the PR; reviewer reads.

### Drift detection

Reality vs state:

- Someone clicked in the console.
- A different tool made changes.
- An incident response did emergency changes that weren't codified.

Detection:

- Scheduled `terraform plan` (CI cron); alerts on diff.
- Cloud-native drift detection (AWS Config, CloudFormation drift, Pulumi drift detection).
- Manual review periodically.

When drift detected: either codify the change (write the IaC) or revert. Don't ignore.

### Secrets in IaC

Don't commit secrets to IaC. Patterns:

- **Variable references to vault**: IaC sets the connection to vault; secret values flow at runtime.
- **SOPS-encrypted variable files**: works for GitOps where the deploy operator has the decrypt key.
- **External Secrets Operator**: k8s case; IaC creates the reference, ESO fetches the value.

Common mistake: secrets in Terraform state. State files contain plaintext of all values; readable by anyone with state access.

### Modular vs monolith repo

Two patterns:

- **Mono-IaC repo**: all infra in one repo; cross-team coordination.
- **Per-service infra**: each service repo includes its infra; smaller scope.

Mono-IaC for early-stage; per-service for mature with mature platform team.

### Testing IaC

Yes, IaC needs tests:

- **Validate** (`terraform validate`): syntax + provider rules.
- **Format** (`terraform fmt -check`).
- **Lint** (tflint, checkov): security + best-practice rules.
- **Plan**: a successful plan IS a kind of test.
- **Integration**: Terratest, Pulumi unit tests — create real infra in a sandbox; assert; tear down.
- **Policy as code** (Sentinel, OPA, Checkov): "this PR cannot create a public S3 bucket without explicit exception".

### Cost forecasting

Before apply:

- Infracost analyses the plan; estimates monthly cost.
- Posts to PR.
- Reviewer sees "this PR adds $1200/mo".

Cost-aware reviews catch over-provisioning before it ships.

### Disaster recovery via IaC

A region failure → re-create infra in another region via the same IaC. If you can't, IaC isn't actually capturing the system.

Drill: tear down a non-prod env; re-create via IaC; confirm functional. Quarterly.

### GitOps

GitOps is IaC for runtime config (k8s manifests; not just cloud resources):

- Manifests in git.
- A controller (Flux, Argo CD) reconciles cluster state to git state.
- Changes go through PR.

GitOps for k8s; IaC for cloud resources. Often combined: IaC creates the cluster; GitOps manages workloads on it.

### Common failure modes

- **Click-ops alongside IaC**. Drift constant; IaC distrusted. → Console access restricted; ops via IaC.
- **State in local file**. Lost laptop = lost knowledge of what exists. → Remote backend.
- **Secrets in state**. Visible to anyone with state read. → Vault / external; no secrets in IaC.
- **`destroy` in plan unnoticed**. PR merged; prod DB gone. → Reviewers read the plan; tag PR with destroy warning.
- **No drift detection**. Reality drifts; IaC doesn't reflect; future apply destroys reality. → Scheduled plan.
- **`apply` outside CI**. Bypass review. → Cloud IAM prevents direct apply.
- **One mega-module**. Hard to test; hard to reuse. → Small composable modules.

### Tooling stack (typical)

| Concern | Tool |
|---|---|
| Core IaC | Terraform / OpenTofu, Pulumi, AWS CDK |
| Modules registry | Terraform Registry, private registries |
| Policy | Sentinel (TF Cloud), OPA, Checkov, tfsec |
| Cost forecast | Infracost |
| Drift detection | Driftctl, CloudQuery, Atlantis |
| GitOps (k8s) | Flux, Argo CD |
| Test | Terratest, Pulumi Test, Pester (PowerShell) |
| Lint | tflint, checkov, tfsec |
| Backend | S3 + DynamoDB, GCS, Terraform Cloud, Pulumi service |

### Adoption path

1. **Day 0**: new resources go through IaC. Existing manually-created: import incrementally.
2. **Month 1**: per-env state; CI plan-on-PR.
3. **Month 2**: cost forecasting; policy gates.
4. **Quarter 1**: modules for reusable patterns; tests for them.
5. **Quarter 2+**: DR drill; drift detection; GitOps for k8s.

### See also

- [`platform-engineering-idp-pattern.md`](/docs/pillars/architecture/platform-engineering-idp-pattern) — platform team owns shared modules.
- [`multi-region-pattern.md`](/docs/pillars/architecture/multi-region-pattern) — IaC enables region duplication.
- [`../security/container-k8s-security-pattern.md`](/docs/pillars/security/container-k8s-security-pattern) — k8s defined via IaC.
- [`../security/secrets-mgmt-deep-pattern.md`](/docs/pillars/security/secrets-mgmt-deep-pattern) — secrets not in IaC.
- [`../quality/cost-optimization-pattern.md`](/docs/pillars/quality/cost-optimization-pattern) — IaC enforces tagging.
- [`../quality/ci-cd-pipeline-pattern.md`](/docs/pillars/quality/ci-cd-pipeline-pattern) — IaC pipeline.
