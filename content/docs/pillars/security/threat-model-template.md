---
type: Playbook Pattern
title: 'Threat Model Template'
description: 'Skeleton for the per-project threat model doc. Lives at `docs/security/threat-model.md`. Revisited every release.'
---

# Threat Model Template

Skeleton for the per-project threat model doc. Lives at `docs/security/threat-model.md`. Revisited every release.

## TL;DR (human)

A threat model enumerates what is valuable, who might attack, how, and how you defend. It is a living document — not a one-time deliverable. The act of writing it surfaces gaps; the act of revisiting it catches new risks from new surfaces.

## Template body

Copy the below into `docs/security/threat-model.md` and fill the bracketed parts.

```markdown
# Threat Model — <PROJECT>

- **Version:** vN
- **Last reviewed:** YYYY-MM-DD
- **Owner:** @name
- **Reviewers:** @name, @name

## Scope

What this threat model covers. What it explicitly does not cover. The "out of scope" section is as important as the "in scope" — it prevents false security assumptions about uncovered surfaces.

## Assets

Things attackers want. Classified by sensitivity.

| Asset | Description | Sensitivity | Where it lives |
|---|---|---|---|
| User PII | Names, emails, profile data | High | `users` table; logs (redacted) |
| Secrets | API keys, OAuth tokens | Critical | Vault |
| Workspace data | Tenant-owned content | High | Per-workspace stores |
| Audit ledger | Compliance evidence | Critical (integrity) | Append-only store |
| Code | Source IP | Medium | Git repo, build artefacts |
| Customer payment data | Cards, bank | Critical | (typically: not stored; tokenised via PSP) |
| <add per project> | | | |

## Actors

Threat actors, ordered by capability. Pick the relevant tiers; not every project needs all.

| Actor | Motivation | Capability | In scope? |
|---|---|---|---|
| Curious user | Snooping | Limited; uses the product UI | ✓ |
| Malicious customer | Fraud, abuse | Has a valid account; can submit malicious inputs | ✓ |
| Compromised user account | Account takeover via password reuse / phishing | As above + valid session | ✓ |
| External attacker (unauthenticated) | Data theft, defacement, DoS | Internet-facing; no credentials | ✓ |
| Insider | Disgruntled employee, contractor | Privileged access | ✓ if applicable |
| Supply chain attacker | Compromise a dependency to reach customers | Indirect; controls a package you depend on | ✓ |
| Nation-state | Espionage | Sophisticated; long-term | ✗ unless your threat model requires |

## Attack surface

Where untrusted input meets the system. List every entry point.

- Public HTTP endpoints (list specifically).
- Authenticated HTTP / JSON-RPC endpoints.
- IPC channels (desktop ↔ sidecar).
- File-system reads (paths under user control).
- Environment variables.
- External-service callbacks (OAuth redirect, webhook).
- CLI flags / args.
- Schemas the system parses (uploaded files, e.g. configs, bundles, plugins).
- Code-execution sandboxes (if any).

## Threats × mitigations

One table row per (asset, actor, surface) combination worth modeling. Not exhaustive; meaningful.

| # | Threat | Asset | Actor | Surface | Mitigation | ADR / RFC | Residual risk |
|---|---|---|---|---|---|---|---|
| 1 | Compromised user account exfiltrates other-tenant data via crafted body | Workspace data | Compromised user | Auth'd HTTP | Tenancy derived from session (Rule 2) | ADR-NNNN | Low |
| 2 | Stack trace leaks file paths over the wire | (none directly, but reveals structure) | External | Public HTTP | Error serializer strips `cause`; tests assert no leak | ADR-NNNN | Low |
| 3 | Agent code exfiltrates secrets via outbound HTTP | Secrets | Malicious plugin | Outbound network | Allowlist firewall (`safeFetch` shim) | ADR-NNNN | Medium — depends on allowlist hygiene |
| 4 | Stolen disk yields readable vault | Secrets | External w/ physical access | Persistent storage | Envelope encryption, sealer in KMS | ADR-NNNN | Low if sealer not co-located |
| 5 | Insider grants themselves a role | All | Insider | RBAC mutation endpoint | `rbac.role.grant` requires `rbac:manage` capability not granted on self; audit | ADR-NNNN | Low; detectable post-hoc |
| 6 | <add per project> | | | | | | |

## Mitigations summary

Reference the pillars / patterns that implement the mitigations cited above.

- [Egress firewall](/docs/pillars/security/egress-firewall-pattern) — Rule 3.
- [Vault](/docs/pillars/security/vault-pattern) — Rule 4.
- [Audit ledger](/docs/pillars/security/audit-ledger-pattern) — Rule 5.
- [RBAC](/docs/pillars/security/rbac-pattern) — Rule 1, Rule 7.
- [Error hierarchy](/docs/pillars/architecture/error-hierarchy) — Rule 6.

## Residual risks

Risks accepted as residual. Each has a sign-off.

- **R1**: Browser-side XSS via untrusted SVG upload. Sign-off: @owner, YYYY-MM-DD. Plan: server-side strip on upload (RFC-NNNN, open).
- **R2**: <add>

## Review log

| Date | Reviewer | Changes |
|---|---|---|
| YYYY-MM-DD | @name | Initial |
| YYYY-MM-DD | @name | Added threats #6–#8 for new webhook surface |
| YYYY-MM-DD | @name | Removed #3 (mitigation shipped) |
```

## Review cadence

- **Per release**: walk the doc. Add threats for new surfaces. Close threats whose mitigations shipped. Record any new residual decisions.
- **Per security incident**: post-mortem updates the relevant rows.
- **Per dependency upgrade with known CVE history**: revisit relevant rows.

## Adoption path

Project on day one cannot have a complete threat model. Phase it:

1. **Week 1**: enumerate Assets, Actors, Surface. Threats table empty.
2. **Week 2**: fill 5–10 highest-priority threat rows.
3. **Per release**: add new rows; close old rows; review residuals.

An incomplete threat model is dramatically better than no threat model.

## Common failure modes

- **Threat model written once, never revisited.** Drift; new surfaces uncovered. → Per-release review.
- **Generic threats with no mitigation.** "XSS" listed; no row pointing to the mitigation. → Each threat references the ADR/RFC implementing the mitigation.
- **No "out of scope".** Reviewers assume coverage you do not have. → Explicit scope.
- **No residual-risk section.** Every threat treated as "mitigated"; reality differs. → Be honest about residuals.

## See also

- [`universal.md`](/docs/pillars/security/universal) — Rule 10 (threat model is a doc).
- [`README.md`](/docs/pillars/security) — pillar map.
