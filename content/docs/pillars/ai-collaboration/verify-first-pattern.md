---
type: Playbook Pattern
title: 'Verify-First Pattern'
description: 'Why an agent must trust live code over docs, plans, and its own memory — and how to verify before claiming or "fixing".'
---

# Verify-First Pattern

Why an agent must trust live code over docs, plans, and its own memory — and how to verify before claiming or "fixing".

## TL;DR (human)

Docs drift, plans go stale, and memory is a point-in-time snapshot. Code is the only thing that is true *right now*. Before asserting a fact, reproducing an issue, or fixing a "bug", confirm it against the live source. Two rules carry most of the weight: **the code wins over any document**, and **before you fix a suspicious behavior, check for a test that codifies it as intended.**

## For agents

### The hierarchy of truth

When two sources disagree, trust them in this order:

1. **Live code** (what runs today).
2. **Tests** (what the team asserted should be true — but verify they still pass).
3. **Generated docs / indexes** (true at generation time; may be stale).
4. **Hand-written docs, plans, READMEs** (true when written; drift fastest).
5. **Memory / prior-session notes** (a snapshot; may describe code that no longer exists).

A plan that says "X is broken" and code that shows X working means the plan is stale, not that the code is wrong. This inversion happens constantly: audits derived from documentation repeatedly flag "P0 bugs" that were already fixed. Verify before you act on any claim — including your own memory and a confident senior plan.

### Verify what, exactly

Before you **claim** a fact: read the symbol, the call site, the test — do not infer behavior from a name. A function called `validateInput` may validate nothing.

Before you **reproduce** an issue: confirm it still exists. Check whether the ticket is already closed, the branch already carries the fix, the file path is real. Cheap checks at session start (`git fetch`, `pwd`, view the issue) prevent hours spent fixing a non-problem.

Before you **fix** a "bug": confirm the behavior is actually wrong against the *contract*, not against your assumption of what it should do.

### The intent-test guard

The most expensive verify-first failure is "fixing" deliberate behavior. State-hygiene observations — "this field should be cleared on reset", "this transition should throw", "this stale value should be recomputed" — are often intentional and pinned by a test that says exactly that.

**Before changing such behavior, search for a test that codifies it.** If a test asserts the current behavior on purpose, the behavior is intended; changing it reverts a decision and breaks the suite. Only a failing test against the *documented contract* — with no intent test defending the current behavior — justifies the fix. See [`../quality/adversarial-bug-hunt-pattern.md`](/docs/pillars/quality/adversarial-bug-hunt-pattern).

### Tooling can lie too

Your read tools are part of the verification chain. Cached or rewritten shell tools can show pre-edit content; a watcher can revert a file after you edit it. When an edit's effect matters, confirm it with a tool that reads live disk, and re-check that externally-managed files actually stuck. "I ran `grep` and it looked fine" is not verification if the `grep` reads a stale index.

### Verify-first vs distrust

This is not paralysis. Verify the things that change your actions: the claim you're about to repeat, the bug you're about to fix, the state you're about to mutate. Do not re-derive settled facts. The goal is to spend zero time fixing problems that don't exist and to never revert an intentional decision.

### Common failure modes

- **Acting on a stale plan.** Hours spent "fixing" already-fixed code. → Verify the claim against live code first.
- **Inferring behavior from a name.** The function does not do what it's called. → Read the body and a test.
- **Fixing pinned behavior.** The suite breaks; a decision is reverted. → Search for an intent test first.
- **Trusting a cached/rewritten tool's output.** You "verified" against stale bytes. → Confirm with a live-disk read; re-check externally-managed files.
- **Treating memory as current state.** Memory is a snapshot, not live truth. → Re-verify file paths, symbols, and flags named in memory before relying on them.

### See also

- [`hallucination-reduction-pattern.md`](/docs/pillars/ai-collaboration/hallucination-reduction-pattern) — grounding and abstention; verify-first is the action-time complement.
- [`honest-confidence-pattern.md`](/docs/pillars/ai-collaboration/honest-confidence-pattern) — report what you actually verified, not what you assume.
- [`memory-pattern.md`](/docs/pillars/ai-collaboration/memory-pattern) — memory is point-in-time; re-verify before relying on it.
- [`../quality/adversarial-bug-hunt-pattern.md`](/docs/pillars/quality/adversarial-bug-hunt-pattern) — the intent-test guard in a review loop.
