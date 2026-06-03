---
title: 'Slash Commands Pattern'
description: 'How to turn repeated workflows into palette-invoked commands so they run identically every time.'
---

# Slash Commands Pattern

How to turn repeated workflows into palette-invoked commands so they run identically every time.

## TL;DR (human)

A slash command is a named, palette-invoked prompt template. One command = one well-scoped workflow. The body is a prompt, not a script. Side-effects (push, merge, deploy) require explicit confirmation in the body.

## For agents

### Anatomy

A slash command has:

- **Trigger** — `/\<name\>` typed by the user (or auto-invoked by another agent / hook).
- **Args** — optional positional or named arguments parsed from the trigger line.
- **Body** — a prompt template that instructs the agent.
- **Tools** — the set the command is allowed to use.
- **Confirmation** — for side-effecting commands, an explicit "are you sure?" or annotation requirement.

### When to make a slash command

Make one when **all** of the following hold:

- The workflow runs ≥3 times per week.
- The workflow has 5+ steps that benefit from being stated once.
- The prompt body is the same each time (the args parameterise the variable part).
- A human would rather type `/\<name\> \<arg\>` than re-type the prompt.

If any condition fails, do not make a slash command — make a script or a snippet instead.

### Canonical commands

| Command | Purpose | Args |
|---|---|---|
| `/goal \<condition\>` | Set a session goal + stop hook | the success condition |
| `/loop [\<interval\>] \<prompt\>` | Recurring or self-paced runs | interval (optional), command body |
| `/review [\<pr#\>]` | Multi-agent PR review | PR number; defaults to current branch |
| `/clear` | Reset session context cleanly | none |
| `/plan \<task\>` | Spawn `plan` sub-agent on the task | task description |
| `/ship` | Run the release-gate checklist | none |
| `/sanity` | Run cross-cutting audit, surface drift | none |

Project-specific commands go on top. Examples worth defining:

- `/issue-from-bug "\<description\>"` — files a structured bug report from a one-line description.
- `/promote-rfc \<rfc#\>` — promotes an accepted RFC to an ADR.
- `/tombstone \<doc-path\>` — adds a tombstone block to a retired doc.

### Body discipline

The body is a prompt. It should:

1. **State the goal in imperative voice.** "Open a PR with…" not "I would like to open…".
2. **List the steps explicitly.** Number them. Each step is one action.
3. **Name verification points.** "Verify gates green before merging" — explicit, not implied.
4. **Require confirmation for side-effects.** "Confirm with user before pushing."
5. **State the exit condition.** "Done when the PR is merged and the branch is deleted."

Anti-pattern: a body that says "do the right thing". The slash command exists *because* "the right thing" was being done inconsistently.

### Side-effect confirmation

Commands that mutate outside the local checkout — push, merge, deploy, file an issue on someone else's behalf, send a Slack message — require **explicit confirmation in the body**:

```
Before running `gh pr merge --admin`, summarize the diff to the user and wait
for an explicit "yes, merge" reply. Do not merge based on prior approval in
a different context.
```

Reason: approval in one context does not extend to the next. A user who said "merge it" 30 minutes ago for a different PR is not approving this one.

### Versioning

Slash command bodies are part of the repo (commit them; do not rely on per-user toolchain dotfiles for shared workflows). Changing a slash command body is a PR. Reviewers verify the change.

### Common failure modes

- **Slash command does too much.** `/ship` that bumps version, opens PR, merges, deploys, posts to Slack. One step fails; partial state. → One command = one well-scoped workflow.
- **Body relies on implicit context.** "Use the standard PR template" — which one? → Inline the template or link explicitly.
- **No confirmation on side-effect.** `/deploy` merges and pushes to prod without asking. → Confirmation in body.
- **Args parsed loosely.** `/loop` with ambiguous interval; agent defaults to "every minute" and burns budget. → Strict arg parsing; default to safe (long interval).
- **Slash command not shared.** Each agent has a different version in their dotfiles. → Commit shared commands to the repo.

### Loop discipline

`/loop` deserves special care. It is the command that most often goes wrong:

- **Pick the right interval.** Burning the prompt cache every 30s costs more than every 20 minutes; the prompt cache TTL is short.
- **Default to long fallbacks.** If the loop is waiting on external state, the wake-up should be tied to that state, not a fixed timer.
- **Have a clear exit.** A loop with no exit will run until budget runs out.

### See also

- [`sub-agent-pattern.md`](/docs/pillars/ai-collaboration/sub-agent-pattern) — many slash commands delegate to a sub-agent.
- [`../../prompts/README.md`](/docs/prompts) — command bodies live here.
- [`universal.md`](/docs/pillars/ai-collaboration/universal) — Rule 7 (explicit goal, explicit exit).
