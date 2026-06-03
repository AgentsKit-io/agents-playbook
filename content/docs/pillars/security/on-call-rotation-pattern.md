---
title: 'On-Call Rotation Pattern'
description: 'How to keep a system reliable 24/7 without burning out the team that maintains it.'
---

# On-Call Rotation Pattern

How to keep a system reliable 24/7 without burning out the team that maintains it.

## TL;DR (human)

On-call is a structured rotation: who responds, in what order, with what tools, for which alerts. A healthy rotation alerts rarely (the system is reliable), pages with high signal (every page is actionable), and rewards the carrier (compensation, time off, growth credit). A burning rotation breaks the team faster than it breaks the system.

## For agents

### Rotation structure

| Element | Default |
|---|---|
| **Primary** | One person, on duty 24/7 for the rotation period |
| **Secondary** | Backup; escalation if primary unreachable in 15 min |
| **Period** | 1 week (5–7 days); never longer; avoid 24-hour fragments |
| **Frequency** | Each person on call no more than 1 week in 6 (i.e. ≥ 6-person rotation) |
| **Handoff** | Live sync at start of week: open incidents, known risks, pending work |

Smaller teams (< 6) need creative coverage: pair primary across the week; rotate days; or hire / outsource until rotation is sustainable.

### Alert hygiene

Every alert that fires must answer:

1. **What is broken?** (specific, not "service is down")
2. **Who is affected?** (which users, how many)
3. **What action does the responder take?** (runbook link)
4. **What is the SLO impact?** (burn rate)
5. **What is the severity?** (SEV-1/2/3/4 — see below)

If an alert can't answer all five, it's noise. Either silence it or improve it.

### Severity ladder

| Sev | Criterion | Response time |
|---|---|---|
| **SEV-1** | Total or major outage; customer-impacting; SLO red | Page primary immediately; respond ≤ 5 min |
| **SEV-2** | Significant degradation; some customers impacted | Page primary; respond ≤ 15 min |
| **SEV-3** | Issue with workaround; SLO at risk; cost spike | Notify (chat/email); respond next business hour |
| **SEV-4** | Annoyance; data inconsistency; non-customer-facing | Ticket; address in next sprint |

Page-worthy = SEV-1/2 only. Anything that pages at SEV-3+ is mis-tuned.

### What gets paged

Page-worthy categories:

- **Customer-facing outage**: API down, login broken, checkout failing.
- **SLO burn-rate critical**: error budget exhausting fast.
- **Security incident**: suspected breach, leaked secret, auth bypass.
- **Data integrity at risk**: corruption, replication divergence, audit-ledger verification failure.
- **Cost catastrophe**: unbounded resource consumption (DoS, runaway query, infinite retry).

What does **not** page:

- Single failed test in CI.
- Latency spike for one minute.
- Deploy failure (it should not have deployed at all).
- Non-critical job failure (queue it for next-day).
- Customer support tickets (different channel).

### Incident response — the IMOC pattern

When a SEV-1/2 fires:

1. **Incident Manager On Call (IMOC)**: takes the page; coordinates. Not necessarily the fixer.
2. **Technical Lead On Call (TLOC)**: drives the fix. May be the primary if rotation is small.
3. **Communications**: posts status updates; updates status page; talks to customers (someone else, not the fixer).
4. **Scribe**: documents the timeline as it happens. The post-mortem starts at the first page, not after.

For small teams, one person plays multiple roles. The point: each role is explicit; nobody fixes AND communicates AND documents (that's how mistakes happen).

### Runbooks

Per known incident class, a runbook lives at a stable URL. Contents:

- **Symptoms**: how you know this is happening.
- **Verification**: commands / dashboards that confirm.
- **Immediate mitigation**: actions that reduce blast radius before root cause.
- **Diagnosis**: where to look; what to query.
- **Resolution**: how to fix.
- **Rollback**: if the fix is wrong.
- **Comms template**: what to say to customers / status page.

Runbooks are tested. A runbook that has never been followed is a guess; quarterly drill validates.

### Status pages

Customer-facing status page:

- Updated by the IMOC during incidents.
- Severity matches what customers see (not internal sev).
- Updates every 30 min minimum during active incident.
- Post-resolution: brief summary; link to post-mortem when published.

Status page is the contract for transparency. Customers tolerate outages; they do not tolerate silence.

### Post-mortems

After every SEV-1/2:

- Written within 5 business days.
- Blameless: focuses on system gaps, not human errors.
- Includes timeline (from first page to resolution).
- Root cause analysis: usually the "5 whys" chain.
- Action items with owners + dates.
- Published internally (team-wide); sometimes externally (transparency).

Anti-patterns:

- Post-mortem that blames an individual.
- "Action items" with no owner / no date.
- Post-mortem that never gets written ("we know what happened").
- Same incident class repeats; action items never landed.

### Compensation + recovery

On-call has cost. Reward it:

- **Compensation**: per-shift stipend OR equivalent time off OR explicit credit toward promotion.
- **Post-shift recovery**: a day off after a heavy week is not a luxury; it's load balancing.
- **Page-night reward**: pages at 3 AM compensate further. Adjust the next day off.
- **Swap freedom**: people swap shifts without bureaucracy (within the rotation).

Teams that under-compensate on-call burn out the senior engineers first. They leave; juniors take their place under-prepared; pages get worse; spiral.

### On-call as a learning surface

Done well, on-call accelerates engineer growth:

- Forced exposure to the whole system.
- Real incidents teach incident response.
- Runbook authoring is documentation practice.
- Post-mortem participation is system reasoning.

Pair junior + senior on rotation; rotate roles so juniors take IMOC eventually.

### Alert tuning loop

Quarterly review of all alerts:

- **Page-worthy ratio**: pages that turned out to be actionable / total pages. Target > 80%.
- **Mean time to acknowledge (MTTA)**: how fast pages get accepted.
- **Mean time to resolve (MTTR)**: how fast incidents close.
- **Alert that never fires**: review; either preventable (good) or no longer relevant (delete).
- **Alert that fires often**: investigate the underlying instability.

Delete more alerts than you add. The total alert count should be small enough to memorise.

### Tools

| Concern | Tool |
|---|---|
| Paging | PagerDuty, Opsgenie, VictorOps, Splunk On-Call |
| Status page | Statuspage, Better Stack, Instatus |
| Incident comms | Slack channel + IMOC plays |
| Runbooks | Confluence, Notion, repo-committed markdown |
| Post-mortems | Confluence, repo-committed markdown, Sentry, FireHydrant, Jeli |
| Schedule | Calendly, Lever, native to paging tool |

### Common failure modes

- **One-person rotation.** Burnout guaranteed; bus factor of 1. → Minimum 4–6; bring in cross-team rotation if needed.
- **No runbooks.** Incidents resolved by tribal knowledge. → Document; quarterly drill.
- **Page-fatigue.** Every alert pages; responders ignore; real one missed. → Tune; SEV ladder; delete noisy alerts.
- **No post-mortems.** Same incident recurs. → Mandatory after SEV-1/2.
- **Post-mortem blame.** Engineers cover up incidents to avoid scrutiny. → Blameless; system-focused.
- **Manager off-rotation.** Decisions stall during incidents. → Manager rotates too; or designate ICs.
- **Hire-and-toss.** New engineers thrown on rotation without training. → Shadow shifts; pair rotation; document onboarding.
- **No comp.** Senior engineers leave. → Compensate; the alternative is more expensive.

### Adoption path

1. **Day 0**: business hours best-effort. Acknowledge: not 24/7 yet.
2. **Pre-customer**: identify paging-worthy alerts; minimum 4 people in rotation.
3. **Beta launch**: SEV ladder; runbooks for top 5 known failure modes.
4. **GA**: 24/7 rotation; full alert hygiene; post-mortem discipline.
5. **Scale**: IMOC role distinct from TLOC; comms role separate.
6. **Mature**: chaos engineering integrated; runbooks tested; alerts tuned quarterly.

Adopting too fast (full 24/7 rotation before product is stable) burns the team. Adopting too slow (no rotation at GA) burns customers.

### See also

- [`../quality/observability-pattern.md`](/docs/pillars/quality/observability-pattern) — SLOs + alerts feed paging.
- [`../quality/chaos-engineering-pattern.md`](/docs/pillars/quality/chaos-engineering-pattern) — drills test the rotation.
- [`audit-ledger-pattern.md`](/docs/pillars/security/audit-ledger-pattern) — security incidents flow through on-call.
- [`secrets-leak-postmortem-playbook.md`](/docs/pillars/security/secrets-leak-postmortem-playbook) — specific runbook example.
- [`../../phases/06-operate/README.md`](/docs/phases/06-operate) — on-call sits inside Operate.
