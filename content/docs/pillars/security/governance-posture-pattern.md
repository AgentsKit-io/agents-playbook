---
title: 'Governance Posture Pattern'
description: 'Expose the system''s live security and governance posture as a read-only, machine-readable signal — so agents, dashboards, and auditors can see what is enforced without admin rights.'
---

# Governance Posture Pattern

Expose the system's live security and governance posture as a read-only, machine-readable signal — so agents, dashboards, and auditors can see what is enforced without admin rights.

## TL;DR (human)

Add one read-only endpoint/RPC that reports *which controls are currently on*: air-gap, egress firewall, redaction, sandbox network policy, RBAC mode, audit. It reads live state (env + policy stores), returns a small normalized object, and requires only an **observability-read** permission — never admin. A dashboard card and an agent can both consume it to answer "is this system governed right now?" in one call, instead of inferring it from scattered config.

## For agents

### Why posture must be its own signal

"Is the firewall on?" and "what is the firewall config?" are different questions with different blast radii. The first is a *posture* question — a yes/no/summary an operator, an auditor, or an agent should be able to read freely. The second is *admin* territory. Conflating them forces the cheap question behind the expensive permission, so the dashboard that should reassure everyone becomes invisible to everyone who isn't an admin.

A posture surface answers the cheap question cheaply: **what is enforced right now**, summarized, read-only, low-privilege.

### What the posture surface reports

A small set of **pillars**, each a normalized status — not raw config:

| Pillar | Reports | Source |
|---|---|---|
| Air-gap / network isolation | on / off | env flag |
| Egress firewall | on + allowlist size (count, not contents) | egress policy store |
| Redaction / PII handling | on / off / mode | env or policy |
| Sandbox network policy | none / restricted / open | runtime config |
| RBAC mode | enforcing / permissive | auth config |
| Audit ledger | active / inactive | audit subsystem |

Report **derived status**, not the underlying values: "egress firewall: on, 12 entries" — not the 12 hostnames. The count is posture; the list is config.

### Design constraints

- **Read-only.** The surface never mutates anything. It is a projection of state.
- **Pure derivation.** A pure function `state → posture` makes it trivially testable and free of side effects. Read env + stores at the edge; compute the posture object in a pure core.
- **Low privilege.** Gate it behind an `observability:read`-class permission, not `security:admin`. The whole point is broad visibility. A non-admin reviewer must be able to read it.
- **Don't compose a new god-object.** Reuse the existing query handlers / stores; register the posture reader alongside them. It is a *view*, not a new subsystem.

### Posture vs. policy bundle

A "security bundle" or policy composer (what an admin *configures*) is a different thing from posture (what is *currently enforced*). The composer is admin-gated and write-capable; posture is observability-gated and read-only. Build posture as a separate read path even if it reads some of the same stores — otherwise the visible-to-everyone signal inherits the admin gate of the composer and disappears from the dashboard.

### Consuming it

- **Dashboard card.** A governance card renders the pillars as badges. Empty/off states get an honest label and a CTA to the relevant config screen, not a blank.
- **Agent precheck.** An agent about to run a sensitive flow reads posture first: "sandbox network = open, redaction = off" → warn or refuse before acting.
- **Audit/export.** The posture object is a natural line item in a compliance export — a timestamped snapshot of enforced controls.

### What posture must never leak

Same discipline as the self-describe manifest: posture reports *that* a control is on and a coarse magnitude, never the secret material or the exact allowlist. "Redaction: on" is posture; the redaction ruleset is config. Keep the read-only surface free of anything that would help an attacker map the controls they need to evade.

### Common failure modes

- **Posture behind admin auth.** The reassurance signal is invisible to the people who need reassurance. → Gate on `observability:read`.
- **Returning raw config.** Allowlist contents, hostnames, secret refs leak through the "harmless" status endpoint. → Return derived status + counts only.
- **Side effects in the reader.** A "status" call that lazily initializes or mutates state. → Pure `state → posture`; read at the edge.
- **Growing a monolith to host it.** Adding posture to an already-maxed composition root. → Register alongside existing read handlers; keep it a view.
- **Blank empty states.** "Firewall: —" with no explanation. → Honest label + CTA (see [`../ui-ux/empty-states-pattern.md`](/docs/pillars/ui-ux/empty-states-pattern)).

### See also

- [`audit-ledger-pattern.md`](/docs/pillars/security/audit-ledger-pattern) — posture is the *current* control state; the ledger is the *history* of privileged actions.
- [`rbac-pattern.md`](/docs/pillars/security/rbac-pattern) — the RBAC mode posture reports; required-permission names belong in contracts.
- [`egress-firewall-pattern.md`](/docs/pillars/security/egress-firewall-pattern) — the allowlist whose *size* (not contents) posture reports.
- [`../ai-collaboration/self-describe-pattern.md`](/docs/pillars/ai-collaboration/self-describe-pattern) — same machine-readable discipline for capabilities.
- [`../quality/observability-pattern.md`](/docs/pillars/quality/observability-pattern) — posture as an operability signal.
