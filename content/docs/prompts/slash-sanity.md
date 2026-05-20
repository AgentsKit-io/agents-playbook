---
title: 'Slash Command — /sanity'
description: 'Run the cross-cutting sanity audit, surface drift.'
---

# Slash Command — /sanity

Run the cross-cutting sanity audit, surface drift.

## Trigger

```
/sanity [--section=<name>]
```

- `/sanity` — full audit.
- `/sanity --section=quality` — just the quality pillar's contributions.

## Body

```
Run the cross-cutting sanity audit.

Process:

1. INVOKE
   - Run `pnpm sanity` (or your equivalent). Each pillar contributes a section.
   - Read the produced `docs/audit/sanity-report.md`.

2. COMPARE TO BASELINE
   - For each metric in the report, compare to the last committed baseline.
   - Mark deltas: regression / improvement / unchanged.

3. SECTION OUTPUT
   For each pillar:
   - Section title.
   - Top 3 deltas (regressions worst first).
   - Top 1 improvement (when one exists).

4. PRIORITIZE
   - Regressions blocking release: surface to top.
   - "Easy wins" (a few-line fix that closes a metric): list separately.

5. OUTPUT FORMAT
   ## Verdict
   CLEAN | REGRESSIONS-PRESENT | RELEASE-BLOCKED.

   ## Pillar deltas
   - architecture: ...
   - security: ...
   - ui-ux: ...
   - quality: ...
   - governance: ...
   - ai-collaboration: ...

   ## Easy wins
   - <one-liner>

   ## Recommended actions
   - Open issue / fix-now / next-session per finding.

6. HONESTY
   - "CLEAN" only when every metric is at or below baseline.
   - Quote the worst regression's specific numbers.
   - Do not pretend a regression "will likely fix itself".

7. NO AUTO-FIX
   - `/sanity` reports. Fixing is a separate action, ideally a new sub-unit.
```

## Cadence

- On demand (this command).
- Nightly in CI.
- Pre-release (release-gate checklist runs `/sanity` and requires CLEAN).

## See also

- [`../pillars/quality/sanity-pattern.md`](../pillars/quality/sanity-pattern.md)
- [`../pillars/quality/quality-gates-pattern.md`](../pillars/quality/quality-gates-pattern.md)
- [`slash-ship.md`](./slash-ship.md) — release-gate flow.
