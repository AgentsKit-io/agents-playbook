---
type: Playbook Pattern
title: 'CI/CD Pipeline Pattern'
description: 'How to wire continuous integration + continuous delivery so the path from commit to production is short, verifiable, reversible, and boring.'
---

# CI/CD Pipeline Pattern

How to wire continuous integration + continuous delivery so the path from commit to production is short, verifiable, reversible, and boring.

## TL;DR (human)

Five stages: **lint/format → typecheck → unit → integration → deploy**. Each stage has a clear pass/fail signal. Caching makes warm runs fast; matrix sharding makes cold runs fast. Branch protection on main; trunk-based development. Deploys are reversible (one-click rollback) and progressive (canary → blue-green → ramp). Production is reached only by passing every stage; no human can manually push.

## For agents

### Pipeline stages (default order)

| Stage | What runs | Typical duration | Gate? |
|---|---|---|---|
| **Lint + format** | ESLint, Prettier, framework lints | < 1 min | Hard block |
| **Typecheck** | tsc -b, mypy, etc. | 1–3 min | Hard block |
| **Structural gates** | file-size, no-any, named-exports, etc. (`quality-gates`) | < 30 s | Hard block |
| **Unit + contract tests** | tier 1–2 from test pyramid | 1–5 min | Hard block |
| **Integration tests** | tier 3 (in-process, no external services) | 2–10 min | Hard block |
| **Build** | bundle + artifact creation | 1–5 min | Hard block |
| **Bundle-size gate** | per-route size budget | < 30 s | Hard block |
| **E2E (tier 5)** | smoke + golden paths only | 5–15 min | Hard block |
| **Security scan** | SAST + dependency CVE scan | 1–5 min | Hard block (critical/high) |
| **Deploy to staging** | automatic on green main | 2–10 min | n/a |
| **Smoke against staging** | tier 5 against real staging | 2–5 min | Hard block before prod |
| **Deploy to production** | canary first | progressive | Manual approval (or auto, per policy) |

Total budget target: **< 20 minutes** from PR open to merge-ready signal. Past that, agents and humans context-switch and the loop breaks.

### Caching discipline

Caches deliver most of the speedup:

- **Package manager cache** (`pnpm store`, `node_modules`): keyed by lock-file hash.
- **Build cache** (Turbo / Nx / Rush): keyed by inputs (source + deps).
- **Test cache**: per-package; skip unchanged packages.
- **Docker layer cache**: ordered for max hit rate (deps before source).

Cold-cache run remains as the worst-case bound; design pipelines so warm-cache is the common case.

### Matrix sharding

When the test suite is large, shard:

- 4–8 parallel shards is the sweet spot.
- Each shard runs a roughly-equal slice (by historical duration, not by alphabetical).
- Tools: Vitest projects, Jest `--shard`, Playwright shards, pytest-xdist.

Result aggregation: each shard reports pass/fail; one aggregate signal goes back to the PR.

### Branch protection (mandatory)

Main branch rules:

- Direct pushes blocked (everyone goes through PR).
- Required status checks: lint, typecheck, structural, unit, integration, build, security.
- Required reviewers: ≥ 1 human (or per your policy).
- Linear history (rebase merge); no merge commits unless explicitly allowed.
- Force-push blocked.

Per-branch policy: long-lived branches (`develop`, `epic/*`) have similar rules; ephemeral feature branches don't need them.

### Trunk-based development

The recommended model:

- Main is always shippable.
- Feature branches are short-lived (hours to days).
- Large changes go behind feature flags (per [`../architecture/feature-flags-pattern.md`](/docs/pillars/architecture/feature-flags-pattern)) instead of long-lived branches.
- No `develop` / `staging` / `qa` branches that diverge.

Why: long-lived branches accumulate conflicts; short-lived branches keep concurrent-agent coordination tractable.

### Deploy patterns

**Canary**: deploy to 1% of traffic; observe SLOs for N minutes; promote on pass.

**Blue-green**: full new stack stands up; traffic flips when ready; old stack stays for instant rollback.

**Rolling**: incremental replacement of instances; cheaper but slower rollback.

**Feature-flag ramp**: code deployed everywhere; flag controls user-visible rollout (0% → 1% → 10% → 100%).

Most products combine: blue-green + feature flags. Canary as a pre-ramp validation.

### Rollback discipline

Every deploy is reversible. One-click. Within 5 minutes.

Mechanisms:

- **Re-deploy previous version**: previous artifact is retained for N versions.
- **Feature-flag flip**: turn off the new behavior (faster than redeploy).
- **DB migration backward-compat**: every migration must support N and N-1 application versions concurrently. No destructive migrations without a 2-phase deprecation (add new → backfill → switch → drop old).

A deploy you cannot roll back is a one-way door. Avoid; if unavoidable, treat as RFC.

### Database migration discipline

Migrations are the trickiest CI/CD territory:

- **Forward-only** in production. Roll-back via roll-forward (a new migration that reverses).
- **Backward-compat**: app version N and N+1 must both work with schema version M during deploy.
- **Two-phase column changes**:
  1. Add new column (deployable any time).
  2. Backfill data.
  3. Code reads from new, writes to both.
  4. Code reads + writes new only.
  5. Drop old column (deployable any time).

This sequence enables rollback at any step. Single-step "drop column" mid-deploy is the canonical post-mortem.

### Tier-by-tier signal

Each stage exits with a clear signal:

- **0**: pass.
- **1**: fail (rule was clear; fix it).
- **2**: error (the gate itself crashed; investigate).

Aggregated dashboard shows: which stage, which check, when, with link to logs. Agents triaging a red build go to the specific failed gate, not "the build failed".

### Caching gotchas

- **Cache poisoning**: a bad build polluted the cache; next builds use it; fail mysteriously. → Cache key includes a salt / version stamp; bumped on infrastructure change.
- **Stale cache mask real failures**: tests pass against cached artifacts; real artifact would fail. → Periodic cold-cache runs (nightly).
- **Cache size growth**: cache costs more than the compute savings. → TTL on cache entries; max-size enforced.

### Pre-merge vs post-merge

Two strategies for placing expensive checks:

**Pre-merge**: every PR runs full pipeline. Slow PRs; high confidence at merge.

**Post-merge with revert**: PRs run fast subset (lint + typecheck + unit); merge fast; full suite runs post-merge; if red, revert.

Pre-merge for products with low merge frequency. Post-merge with auto-revert works for very high frequency.

### Auto-merge

When the queue has 10+ PRs waiting:

- Configure auto-merge: when checks pass + reviewer approved, merge automatically.
- Merge queue (GitHub native, or Mergify): orders merges; each tested against the queued tip.

Without a merge queue, fast-merge PRs invalidate each other's CI status.

### Build artifacts

What you ship is what you tested. Artifact discipline:

- Build once at the start of the pipeline.
- All subsequent stages test that artifact.
- Same artifact promotes through staging → production.
- Never rebuild between stages.

Rebuilding between stages introduces drift; tests pass; production differs.

### Secrets in CI

Secrets reach CI via:

- **Built-in secret store** (GitHub Actions secrets, GitLab CI variables, etc.).
- **OIDC federation** to cloud provider (preferred): CI proves identity; cloud grants temporary credentials; no long-lived secrets in CI.
- **Vault integration**: CI fetches from your vault.

Discipline:

- Secrets per environment (staging vs prod).
- Per-job scope (job that doesn't need a secret can't read it).
- Rotation per [`../security/vault-pattern.md`](/docs/pillars/security/vault-pattern).
- Audit-log secret access.

### Build provenance

Per [`../security/vulnerability-mgmt-pattern.md`](/docs/pillars/security/vulnerability-mgmt-pattern):

- Sign build artifacts (cosign).
- Attest the build process (SLSA framework).
- Consumers verify chain.

Provenance attaches CI → commit → artifact, traceably.

### Per-pillar concerns at CI/CD scope

**Security**: SAST scan in pipeline; SBOM generated; secrets scan; vulnerability triage.

**Quality**: gate suite (structural + unit + integration); coverage thresholds; bundle budgets.

**UI-UX**: a11y axe scan; visual regression; intl parity.

**Architecture**: schema diff (RFC enforcement); ADR/RFC integrity.

**Governance**: PR-intent gate; required reviews; changeset present.

**AI-collaboration**: prompts updated when CI conventions change.

### Common failure modes

- **20-minute pipeline.** Agents context-switch. → Cache; shard; ruthlessly cut.
- **Flaky tests**. PRs retry, eventually pass. Real failures hide. → Track flake rate; quarantine; fix or delete.
- **Long-lived `develop` branch**. Diverges from main. → Trunk-based; flags for in-flight.
- **Manual deploy step**. Toil; mistakes. → Automate end-to-end.
- **Rollback "is just redeploying old version"**. Slow. → Feature flag flip; blue-green flip.
- **Single environment**. No staging. → At minimum staging that resembles prod.
- **No build provenance**. Cannot prove what came from where. → Sign + attest.
- **Cache poisoning hidden**. Bad cache survives. → Nightly cold runs.

### Tooling stack (typical)

| Concern | Tool |
|---|---|
| CI runner | GitHub Actions, GitLab CI, CircleCI, Buildkite |
| Build cache | Turborepo, Nx, Bazel |
| Container registry | GHCR, ECR, GCR |
| Deploy | ArgoCD, Spinnaker, Flux, custom |
| Feature flags | Unleash, LaunchDarkly, Flagsmith, in-house |
| DB migrations | Atlas, Liquibase, Flyway, framework-native |
| Secrets in CI | OIDC + cloud KMS, GitHub Secrets, Vault |
| Provenance | sigstore, SLSA |
| Merge queue | GitHub merge queue, Mergify |

### See also

- [`pre-push-pattern.md`](/docs/pillars/quality/pre-push-pattern) — the local-side counterpart.
- [`quality-gates-pattern.md`](/docs/pillars/quality/quality-gates-pattern) — gates that the pipeline runs.
- [`../architecture/feature-flags-pattern.md`](/docs/pillars/architecture/feature-flags-pattern) — flags decouple deploy from release.
- [`../architecture/api-versioning-pattern.md`](/docs/pillars/architecture/api-versioning-pattern) — DB migration backwards-compat.
- [`../security/vulnerability-mgmt-pattern.md`](/docs/pillars/security/vulnerability-mgmt-pattern) — SBOM + provenance.
- [`../phases/05-ship/README.md`](/docs/phases/05-ship) — release-gate checklist.
