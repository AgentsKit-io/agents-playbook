---
type: Playbook Pattern
title: 'Pre-push Pattern'
description: 'The safety net between local changes and CI.'
---

# Pre-push Pattern

The safety net between local changes and CI.

## TL;DR (human)

Pre-push runs structural gates + typecheck + build — fast enough to be tolerable (target ≤ 30s), thorough enough to catch what pre-commit missed. It does **not** run lint or full tests. The goal is "catch structural drift before CI burns minutes", not "be CI".

## For agents

### What runs

| Tier | Pre-commit | Pre-push | CI |
|---|---|---|---|
| File-size (changed files) | ✓ | | ✓ (all files) |
| Secrets scan | ✓ | ✓ | ✓ |
| Raw-error scan | ✓ | ✓ | ✓ |
| All structural gates | | ✓ | ✓ |
| Typecheck | | ✓ | ✓ |
| Build | | ✓ | ✓ |
| ADR / RFC integrity | | ✓ | ✓ |
| Lint | | | ✓ |
| Unit tests | | | ✓ |
| Integration tests | | | ✓ |
| E2E | | | ✓ |
| Sanity audit | | | ✓ (scheduled) |
| Mutation | | | ✓ (periodic) |

Why lint and tests are pre-push **not**:

- Lint is slow on a big repo and CI catches it anyway.
- Full tests take minutes; nobody waits for them at push time.
- Pre-push must stay tolerable or agents `git push --no-verify`.

### Runtime budget

- Total pre-push: ≤ 30s on a warm machine.
- If you bust the budget: profile; move slow checks to CI.
- Gates that grow over time: cache aggressively; scope-narrow to changed files where the gate semantics allow.

### Implementation

Husky / lefthook / native git hooks. Hook script:

```bash
#!/usr/bin/env bash
set -e

pnpm check:quality-gates --fast    # structural gates, no baselines regen
pnpm check:adr-rfc                  # ADR/RFC integrity
pnpm typecheck                      # tsc -b
pnpm build                          # turbo build, cached
```

Set `-e` so a failure stops the push. The hook exits non-zero on any failure; git refuses the push.

### Concurrent-merge protection

Pre-push runs against `HEAD`, not against `origin/main`. If main has moved since you forked, your pre-push may pass while CI fails because your branch is out of date.

Defense:

1. Before push: `git fetch && git status -uno` — confirm you're not behind main.
2. If behind: rebase, re-run pre-push.
3. The pre-push hook itself can perform this check and refuse to push when behind — opt-in based on team comfort.

### Bypass policy

`git push --no-verify` bypasses the hook. It exists for emergencies.

Conventions worth adopting:

- If you bypass, the PR description must say why ("hook misfired; verified manually").
- A CI job verifies that bypassed PRs still pass all pre-push checks. Bypass surfaces the failure in CI instead of locally.
- Repeated bypass without justification is a process smell; investigate the hook (probably too slow or producing false positives).

### Per-package vs whole-repo

In a monorepo, pre-push can be scoped to the packages your branch touches. Faster, but riskier — a structural drift in a peer package might not show until CI.

Conservative default: whole-repo gates. Optimize only if you measure them slow.

### Common failure modes

- **Hook takes 90 seconds.** Agents bypass. → Profile; move slow checks to CI.
- **Hook runs full test suite.** Agents bypass. → Tests are CI, not pre-push.
- **Hook depends on dev-only env (e.g. `.env.local`).** Fails on fresh checkouts. → Hooks read from committed config only.
- **Hook silently auto-fixes things.** Surprise commits during push. → Hooks check, do not modify.
- **Hook output is hundreds of lines.** Agent skims. → Concise output; full report on demand via `--verbose`.

### Hooks that auto-regenerate files

A common trap: a pre-commit / pre-push hook that re-runs a code generator (status file, types from schemas) and stages the result. This makes for surprising commit contents and conflicts with rebase.

Avoid auto-staging. If a generator needs to run, the hook fails and tells the agent to run the generator + amend the commit. Agent control beats hook magic.

### Failure recovery

If pre-push fails on a single small drift:

1. Read the message. It is actionable.
2. Fix in the smallest possible diff (often a one-line correction).
3. Amend the commit (`git commit --amend --no-edit`), re-run hook.
4. Push.

If pre-push fails on something you cannot fix in 5 minutes:

1. Stash, investigate root cause.
2. Open a ticket if it's a hook bug or pre-existing main red.
3. Bypass with justification, file follow-up.

### See also

- [`universal.md`](/docs/pillars/quality/universal) — Rule 5 (three-tier split).
- [`quality-gates-pattern.md`](/docs/pillars/quality/quality-gates-pattern) — what `check:quality-gates --fast` does.
- [`../ai-collaboration/concurrent-agent-pattern.md`](/docs/pillars/ai-collaboration/concurrent-agent-pattern) — stash-verify-red protocol.
