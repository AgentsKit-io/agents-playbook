---
title: 'Slash Command — /ship'
description: 'Run the release-gate checklist. Does not actually release — produces the readiness verdict.'
---

# Slash Command — /ship

Run the release-gate checklist. Does not actually release — produces the readiness verdict.

## Trigger

```
/ship
```

## Body

```
Walk the release-gate checklist. Produce a SHIP / NO-SHIP verdict with detailed reasoning.

Process:

1. PRE-RELEASE GATES
   - `pnpm check:all` (or your full pre-release sweep). Quote the result.
   - `pnpm sanity` — CLEAN required.
   - All open issues tagged "release-blocker" → empty.
   - All accepted RFCs scheduled for this release → promoted to ADRs.

2. CHANGE LOG
   - Every PR since last release has a changeset (or equivalent).
   - Aggregate change log generated and reviewed for accuracy.
   - Breaking changes (major bump) called out separately.

3. SECURITY
   - Pending security advisories addressed or documented.
   - Dependency vulnerabilities triaged.
   - Threat model reviewed for new surfaces this release.

4. ARTIFACTS
   - Build reproducible on a clean checkout.
   - Build artifacts signed.
   - Version bumps applied to package.json (or equivalent).

5. DEMO WALK-THROUGH (if applicable)
   - On a cold prod build (not a hot dev server), walk the literal demo script.
   - Document outcome with screenshots / recording.
   - "Tests green ≠ demo reachable" — a CI-green build can hide route-gating bugs that a cold walk catches.

6. RELEASE NOTES
   - User-facing release notes drafted in product voice.
   - Internal release notes (breaking changes, migration, rollback plan).

7. ROLLBACK PLAN
   - How do we roll back if this release breaks production?
   - Who pushes the rollback? Who is on call?

8. OUTPUT FORMAT
   ## Verdict
   SHIP | NO-SHIP.

   ## Gates
   - check:all: green / red (details)
   - sanity: CLEAN / regressions (top 3)
   - release-blockers: 0 / N (list)
   - RFCs promoted: ... / ...

   ## Change log
   - Bullet summary, version bump.

   ## Security
   - Vulnerabilities triaged / open.

   ## Demo
   - Cold prod walk: completed / skipped, link to record.

   ## Rollback
   - Plan: ...
   - On-call: ...

9. HONESTY
   - "SHIP" only when every checklist item is verifiably done.
   - The demo walk is not optional just because CI is green.
   - "Investor-percent" / "release-ready" claims come from the cold walk, not from CI.
   - Quote the worst red item; do not bury it under green items.

10. NO AUTO-RELEASE
    - `/ship` produces a verdict and a plan.
    - The actual release tag + publish is a separate, explicitly confirmed action.
```

## See also

- [`../phases/05-ship/README.md`](../phases/05-ship/README.md)
- [`../pillars/quality/sanity-pattern.md`](../pillars/quality/sanity-pattern.md)
- [`slash-sanity.md`](./slash-sanity.md)
