---
title: "Platform Engineering + Internal Developer Platform Pattern"
description: "How to build the layer between cloud / infra and product engineers, so product teams ship fast without re-learning infra each time."
---

# Platform Engineering + Internal Developer Platform Pattern

How to build the layer between cloud / infra and product engineers, so product teams ship fast without re-learning infra each time.

## TL;DR (human)

Platform engineering productises infrastructure for internal developers. The deliverable is an Internal Developer Platform (IDP) — a curated set of golden paths (templates, paved roads, self-service tools) that let teams ship without becoming infra experts. Tracked metrics: lead time, deploy frequency, change failure rate, time to recover (DORA). The platform team's customer is the product team.

## For agents

### What an IDP includes

| Surface | What it provides |
|---|---|
| **Service templates** | `new-service` scaffolds: code, CI, deploy, observability wired |
| **Self-service deploy** | "I want to ship this" → one command / PR |
| **Self-service env** | "I need staging for my PR" → ephemeral env automatically |
| **Service catalog** | "Where does X live?" → searchable inventory (Backstage et al) |
| **Observability defaults** | dashboards, alerts, SLOs scaffolded per service |
| **Secrets self-service** | "I need a new vault entry" → request + audit |
| **Documentation hub** | API specs, ADRs, runbooks indexed |
| **Cost visibility** | per-team / per-service spend dashboards |

The platform is a **product**. Product engineers are customers; survey them.

### Golden paths

A golden path is the easy, paved way to do a common thing — vs the unpaved way, which is allowed but offers no support.

Examples:

- New microservice: scaffold → live in 30 minutes.
- Add a new background job: existing job-runner abstraction.
- Add a new RPC method: existing dispatcher + schema package.
- Add a new database: managed RDS via IaC.

Going off-road is allowed. Going off-road for everything = the platform isn't paving real needs.

### Self-service ≠ unsupervised

Self-service means a product engineer can do it without filing a ticket. It doesn't mean unreviewed:

- Pre-flight checks (cost, security review, capacity).
- Audit trail of who provisioned what.
- Default-secure choices baked in.
- Auto-rollback on health-check failure.

Self-service + guardrails = velocity + safety. Self-service without guardrails = chaos. Guardrails without self-service = bottleneck.

### DORA metrics

Per-team or per-service measurement (DevOps Research and Assessment):

| Metric | Definition | Elite team target |
|---|---|---|
| **Deploy frequency** | How often code reaches prod | Multiple per day |
| **Lead time for changes** | Commit → production | < 1 day |
| **Change failure rate** | % of deploys causing incident | 0-15% |
| **Time to restore** | Incident → resolved | < 1 hour |

These metrics drive platform investment. The platform team's goal is to move every product team toward elite.

### Service catalog

Per service:

- Name + description.
- Owning team.
- On-call info.
- Source repo.
- Documentation links (ADRs, RFCs, runbooks).
- Dependencies (which services this depends on; which depend on this).
- Tier (critical, important, supporting).
- Compliance tags.

Tool: Backstage, Cortex, OpsLevel, in-house.

The catalog answers "who do I ask?" + "what depends on this?" + "is this safe to change?".

### Templates + scaffolds

A `create-\<thing\>` CLI / template:

```bash
$ npx create-service my-new-service --type=node-ts-api
# scaffolds:
# - source skeleton
# - package.json with workspace conventions
# - Dockerfile + CI workflow
# - terraform module
# - observability defaults
# - README + ADR template
```

Templates encode conventions (per [`universal.md`](./universal.md), [`ts-concrete.md`](./ts-concrete.md)) so new services start compliant.

Templates evolve; old services migrate via a separate "update-service" tool.

### Ephemeral environments

Per-PR preview environments:

- Triggered automatically by PR open.
- Live URL posted to PR.
- Resources auto-torn-down on PR close (or N days idle).
- Cost-attributed to the PR author / team.

Lets reviewers + designers + product see real changes without staging churn.

### Capacity + cost guardrails

Self-service is dangerous without guardrails:

- Per-team budget caps.
- Auto-tear-down of idle resources.
- Required tags (per [`../quality/cost-optimization-pattern.md`](../quality/cost-optimization-pattern.md)).
- New service request → reviewed if cost > threshold.

### Documentation as a platform feature

A docs portal aggregates:

- Per-service READMEs (Backstage-rendered).
- API references (OpenAPI / GraphQL schemas / RPC method indexes).
- ADRs / RFCs.
- Runbooks.
- Tutorials / quickstarts.
- Search.

Engineers find docs in seconds, not minutes. Search quality matters more than doc volume.

### Platform team's customer

Product engineers. Their satisfaction is the platform team's KPI:

- Onboarding time: new engineer → first PR shipped.
- Time to spin up a new service.
- "How happy are you with the platform?" — quarterly survey.
- Support tickets: their volume + topics.

Anti-pattern: platform team optimises for its own elegance, ignores adopters' pain.

### Inner-source contributions

Product teams contribute back to the platform:

- A team builds a niche helper; useful broadly; promote into platform.
- A team finds a bug in a template; patches it; gets credit.
- Codeowners model: platform team owns merging; community drives PRs.

Healthy platforms grow from the edges, not from the center alone.

### Anti-pattern: the gatekeeper platform

Symptoms:

- Every product change requires a platform ticket.
- "Wait 2 weeks for the platform team to enable this."
- Workarounds proliferate.
- Product teams build shadow infrastructure.

Cure: more golden paths; more self-service; fewer tickets.

### Common failure modes

- **No platform team; everyone reinvents**. Drift; bus factor low. → Form a platform team when the org passes ~30 engineers.
- **Platform team builds without users**. Adoption zero. → Adopt-first design.
- **Self-service without guardrails**. Cost / security incidents. → Guardrails baked in.
- **Old services don't migrate**. Platform forks; legacy slows. → Migration tooling; deprecation.
- **Templates rot**. New service uses old template; conventions wrong. → Templates own conventions; CI verifies.
- **No service catalog**. Org-wide knowledge in heads. → Backstage or equivalent.

### Tooling stack (typical)

| Concern | Tool |
|---|---|
| Service catalog | Backstage, Cortex, OpsLevel, Compass |
| IaC | Terraform, Pulumi, CDK, Crossplane |
| Templates | cookiecutter, plop, Backstage Software Templates |
| Ephemeral envs | Vercel preview deploys, Render, Fly.io, custom on k8s |
| Self-service portals | Backstage, in-house |
| DORA metrics | Faros, LinearB, in-house from CI + deploy logs |

### Adoption path

1. **< 30 engineers**: no platform team needed; shared playbook.
2. **30-100**: first platform engineer; service catalog; templates.
3. **100-300**: platform team of 3-8; self-service deploy; DORA tracking.
4. **300+**: full IDP; multiple platform sub-teams (compute, data, security, observability).

Don't form a platform team too early; you have nothing to platform yet.

### See also

- [`anti-overengineering.md`](./anti-overengineering.md) — premature platform = canonical overengineering.
- [`../quality/ci-cd-pipeline-pattern.md`](../quality/ci-cd-pipeline-pattern.md) — platform owns the pipeline.
- [`../quality/cost-optimization-pattern.md`](../quality/cost-optimization-pattern.md) — platform owns cost attribution.
- [`../governance/universal.md`](../governance/universal.md) — platform changes go through ADR / RFC.
