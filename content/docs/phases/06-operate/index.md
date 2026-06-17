---
type: SDLC Phase
title: 'Phase 06 — Operate'
description: 'What ''running it'' looks like after agents have shipped the first release.'
---

# Phase 06 — Operate

What "running it" looks like after agents have shipped the first release.

## TL;DR (human)

Operate phase keeps the system trustworthy and the codebase clean over months / years. Incidents have runbooks. Bug hunts run on cadence. Backups restore-drilled quarterly. Keys rotate. Dependencies updated. Tombstones applied to retired work. The phase never ends; the disciplines compound.

## For agents

### Outputs (ongoing)

- [ ] **Incident response playbook** — who pages, where to look, how to communicate.
- [ ] **Runbooks** per critical surface (auth, audit, vault, billing, releases).
- [ ] **Backup / DR procedure** — full-state backup; encrypted; offsite; restore-drilled quarterly.
- [ ] **Key rotation calendar** — what rotates when; who triggers.
- [ ] **Bug-hunt cadence** — scheduled, scoped hunts producing real defect lists.
- [ ] **Cost / spend monitor** — budget alerts; cost-guard policies.
- [ ] **Telemetry pipeline** — opt-in; PII-redacted; sampled.
- [ ] **Compliance evidence** — DSAR procedure, legal-hold procedure, audit log retention.
- [ ] **Tombstone discipline** — retired plans / docs / surfaces marked, not deleted.

### Per pillar — Operate-phase discipline

**Architecture**
- [ ] Track tech debt against ADRs; supersede ADRs when reality drifts.
- [ ] Periodic structural review: are package boundaries still right?
- [ ] Quarterly: review file-size baselines; pick top-N largest to shrink.

**Security**
- [ ] Key rotation per calendar.
- [ ] Audit ledger verification job runs daily; alerts on mismatch.
- [ ] Threat model walked per release; new surfaces added.
- [ ] Vulnerability triage SLA (e.g. critical within 24h, high within 7d).
- [ ] Penetration test cadence (annual / pre-major-release).

**UI-UX**
- [ ] Empty-state honesty audits — surfaces still tell the next step.
- [ ] Intl coverage per locale — keys do not drift.
- [ ] A11y full sweep before each release (changed screens) + annual full sweep.
- [ ] Brand-kit verification on a representative tenant per release.

**Quality**
- [ ] Mutation testing on stable utility modules.
- [ ] Bug-hunt phases — periodic, scoped (per area / per layer); produces real defects.
- [ ] Gallery / flake budget — flake rate tracked; flake-fix cadence.
- [ ] Sanity audit weekly; pre-release CLEAN required.

**Governance**
- [ ] Postmortems for any user-facing incident.
- [ ] Tombstone retired plans, ADRs, surfaces.
- [ ] Release engineering retros after each release.
- [ ] Quarterly: review open RFCs; close stale; promote ready.

**AI-collaboration**
- [ ] Memory grooming — duplicates merged; stale entries deleted.
- [ ] Sub-agent recipes updated as lessons land.
- [ ] CLAUDE.md / AGENTS.md kept current as the codebase evolves.
- [ ] Periodic agent-onboarding test: a fresh session, working from a fresh checkout, can a new agent be productive in 30 minutes?

### Incident response shape

A useful incident playbook answers, in order:

1. **Detection** — how did we find out? (alerting / customer / agent / internal)
2. **Triage** — severity (SEV-1..4); who's on call; who's IC.
3. **Containment** — short-term action to limit impact.
4. **Diagnosis** — root cause investigation.
5. **Remediation** — the fix; tests added to prevent recurrence.
6. **Postmortem** — within 5 business days; blameless; produces ADR updates / new gates.

Postmortems are tombstoned not deleted; they form the historical record of failure modes — agents reading them learn future-proofing.

### Bug-hunt cadence

A bug hunt is a **scheduled phase** with a defined scope:

- One area (e.g. "audit ledger writes", "OAuth callback flow").
- One layer (e.g. "boundary validation across all methods").
- Time-boxed (1 week typically).
- Produces a defect list with severity + reproducer.

Bug hunts are not "more testing"; they are *adversarial* — hunting for real defects, not raising coverage numbers.

### Key rotation calendar

| Key | Cadence | Audit |
|---|---|---|
| Vault sealer (KEK) | Quarterly | Ledger entry per rotation |
| Audit ledger signer | Quarterly | Verifiable from public keys retained |
| Session signing key | Quarterly | Sessions migrate at rotation |
| Per-secret rotation (high-value) | Quarterly | Vault audit |
| Per-secret rotation (low-value) | Annually | Vault audit |
| Connector OAuth tokens | Per-token expiry; refresh flow | Per-refresh log |
| Compromise rotation | Immediate | Ledger + comms |

Calendar entries with owners — not just "we should rotate".

### Tombstone discipline (Operate-specific)

In Operate, tombstones accumulate. Periodic archival:

1. Tombstoned files older than N months → move into `_archive/`.
2. Update back-references.
3. Index files list archived items in a collapsed section.

Never delete the body. The historical record is part of the asset.

### Cost / spend monitoring

- Budget per workspace / account / tenant.
- Alert at 50%, 75%, 90%, 100% of budget.
- Hard cap at 110% (or per policy).
- Anomaly detection: sudden 10× spike → pause + page.
- Audit-log every spend-policy change.

### Investor / due-diligence readiness

For repos sold or audited:

- Decision log (`docs/adr/`) is the architecture artefact.
- Threat model (`docs/security/threat-model.md`) is the security artefact.
- Audit ledger is the compliance artefact.
- Tombstoned plans + postmortems are the maturity artefact (proves you remember).
- Sanity report archive is the quality artefact.

A new reviewer should be able to read those five and form a complete picture of the system within an hour.

### Exit criteria

Operate has no exit; the project is in Operate for its entire lifetime. Each cycle (typically per release) checks:

1. Incident response was clean (no SEV-1 unhandled).
2. Backup restore drill succeeded this quarter.
3. Key rotations on calendar happened.
4. Bug hunt for this cycle ran.
5. Tombstones applied; archive groomed.

### See also

- [`../../pillars/security/audit-ledger-pattern.md`](/docs/pillars/security/audit-ledger-pattern)
- [`../../pillars/security/vault-pattern.md`](/docs/pillars/security/vault-pattern) — rotation.
- [`../../pillars/quality/sanity-pattern.md`](/docs/pillars/quality/sanity-pattern)
- [`../../pillars/governance/tombstone-pattern.md`](/docs/pillars/governance/tombstone-pattern)
- [`../../pillars/ai-collaboration/memory-pattern.md`](/docs/pillars/ai-collaboration/memory-pattern) — grooming.
