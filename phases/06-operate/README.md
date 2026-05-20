# Phase 06 — Operate

What "running it" looks like after the agents have shipped the first release.

## Status

◐ Scoped, not yet detailed.

## Concerns

- **Incident response** — paging, on-call, runbooks, postmortems.
- **Bug-hunt cadence** — scheduled, scoped hunts (per area, per phase) that produce real defect lists, not coverage numbers.
- **Backup / DR** — full-state backup, encryption, offsite, restore drill quarterly.
- **Key rotation** — sealer keys, connector creds, audit-ledger signing keys.
- **Telemetry honesty** — opt-in, redacted, sampled; PII never on the wire.
- **Cost guard** — budgets per workspace / account; alert before block.
- **Legal hold / DSAR** — retention overridable per subject; proof of completion on request.
- **Dependency hygiene** — renovate / dependabot; security advisories triaged within SLA.
- **Tombstone discipline** — retired plans, ADRs, screens — tombstoned, not deleted.

## Per pillar

| Pillar | Operate concerns |
|---|---|
| Architecture | Track tech-debt against ADRs; supersede when reality drifts |
| Security | Key rotation, audit reviews, threat-model revisits |
| UI-UX | Empty-state honesty audits; intl coverage per locale |
| Quality | Mutation testing, bug-hunt phases, gallery flake budget |
| Governance | Postmortems, tombstones, release-engineering retros |
| AI-collaboration | Memory grooming; sub-agent recipe updates as lessons land |

## See also

- [`../../pillars/quality/README.md`](../../pillars/quality/README.md)
- [`../../pillars/security/README.md`](../../pillars/security/README.md)
