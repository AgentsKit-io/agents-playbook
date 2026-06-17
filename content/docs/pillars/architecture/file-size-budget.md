---
type: Playbook Pattern
title: 'File-size Budget'
description: 'How to keep files reviewable when agents write most of the code.'
---

# File-size Budget

How to keep files reviewable when agents write most of the code.

## TL;DR (human)

Agents will happily produce 1500-line files. Reviewers cannot read 1500-line files. A per-extension line budget, enforced as a CI gate with a shrink-only baseline, forces extractions at the right moment — when the file is still small enough to split cleanly.

## For agents

### Budgets (calibrated)

| Extension | Budget (lines) | Notes |
|---|---|---|
| `.tsx` (React components / screens) | 300 | Forces sub-component extraction at the right granularity |
| `.ts` (logic modules) | 500 | Enough for a real module; small enough to scan |
| `.test.ts(x)` | 800 | Table-driven tests legitimately get long |
| `.md` | none | Docs are linear; agents don't get confused inside long docs |
| `.json` (data) | none | Generated / data files exempt |

Adjust per language: Go and Rust modules legitimately run larger (target 800 / 1000); Python target 500.

Measure: physical lines (`wc -l`), not "non-blank non-comment". Blank lines and JSDoc are part of readability; counting them keeps the budget honest.

### The gate

Mode: **shrink-only baseline**.

1. Generate a baseline JSON listing every file currently over budget with its current line count.
2. On every CI run, recompute. For each baselined file: fail if it grew. For each file not in baseline: fail if it exceeds budget.
3. Baseline regenerates only on intentional sweeps (a PR that removes entries explicitly).

Why shrink-only: prevents adoption from blocking the whole repo on day one; prevents drift from making it worse.

**Split new violations — never baseline them.** The baseline exists for code that predates the gate. A file *you* push over budget must be extracted, not added to the baseline. Baselining your own new violation is the technical-debt equivalent of `// eslint-disable` — it silences the gate without solving anything, and the next reader inherits the unreviewable file.

**An over-budget file on the shared branch blocks everyone.** Because the gate fails on any non-baselined file over budget, a single oversized file merged into the main branch fails *every other contributor's* push until it's split — not just the author's. This makes "split, don't baseline" a courtesy to the whole team, and makes catching it in pre-push (below) worth the cost. If CI is ever bypassed and an over-budget file lands, the fix is to split it promptly, not to widen the budget or baseline it.

Reference impl: [`../../scripts/check-file-size.example.mjs`](/docs/scripts). The baseline file lives at `.file-size-baseline.json` in the repo root.

### Extraction patterns

When the gate fires, do not lower the budget. Do not split into `\<file\>-2.tsx`. Extract intentionally:

**React component over 300 lines** → identify sub-renders:

```tsx
// Before: dashboard.tsx — 420 lines
export function Dashboard() {
  // ... 100 lines of state
  // ... 90 lines of header JSX
  // ... 120 lines of body JSX
  // ... 80 lines of footer JSX
  // ... 30 lines of handlers
}

// After: dashboard.tsx — 90 lines
import { DashboardHeader } from "./parts/dashboard-header";
import { DashboardBody } from "./parts/dashboard-body";
import { DashboardFooter } from "./parts/dashboard-footer";
import { useDashboardState } from "./use-dashboard-state";

export function Dashboard() {
  const state = useDashboardState();
  return (
    <ScreenShell>
      <DashboardHeader {...state.header} />
      <DashboardBody {...state.body} />
      <DashboardFooter {...state.footer} />
    </ScreenShell>
  );
}
```

The `parts/` convention is enforced: extractions go in a sibling `parts/` directory, not a top-level `components/`. Keeps the screen's surface area local.

**Logic module over 500 lines** → identify cohesive responsibilities:

- One file per public function family. If a 500-line file has CRUD for two unrelated entities, split by entity.
- Helpers move to `\<module\>-helpers.ts`; types to `\<module\>-types.ts`.

### Gate ergonomics

To prevent agents grinding against the budget:

- The error message says **exactly which file is over budget, by how much, and what the budget is**. Not "size check failed".
- The pre-commit hook runs the gate so the agent learns at commit time, not at push time.
- The gate has a flag `--explain` that prints the recommended extraction pattern.

### Common failure modes (sourced from production)

- **Agent inlines a multi-line ternary just under budget instead of refactoring.** File passes but is now harder to read. → Pair the size gate with a separate "no nested ternary" lint and a complexity-per-function gate (max cyclomatic ~14).
- **Agent renames the file to dodge the baseline.** New name is under budget by accident; baseline forgets the old one. → Gate hashes file content; an unchanged content under a new name still counts.
- **Agent splits the file into `dashboard.tsx` + `dashboard-2.tsx`.** Worse than the original. → Lint bans `-N.tsx` numeric suffixes.
- **Baseline grows over time because no one shrinks it.** → Set an explicit "baseline shrink-only" rule plus a separate per-quarter goal: pick the top-N largest baselined files and extract.

### Calibration

If the budget is too tight, agents waste cycles. If too loose, files get unreviewable. Recalibrate based on:

- Reviewer feedback: "I cannot read this in one sitting" → tighten.
- Extraction noise: too many `parts/parts/parts/` chains → loosen, or revisit the design — the component is doing too much.
- Test files growing: legitimately table-driven; 800 is permissive on purpose.

### See also

- [`universal.md`](/docs/pillars/architecture/universal) — Rule 6 (file-size budget).
- [`../quality/README.md`](/docs/pillars/quality) — gate wiring.
- [`../../scripts/check-file-size.example.mjs`](/docs/scripts) — reference impl.
