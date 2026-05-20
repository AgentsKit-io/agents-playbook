# Reusable prompts

System prompts, sub-agent recipes, and slash-command bodies that consistently produce gold-standard output.

## Status

◐ Scoped. Full prompt bodies ship in a future session.

## Index

| Prompt | Type | Use when |
|---|---|---|
| `system-architect.md` | system | Designing a new package boundary, ADR, or contract |
| `system-implementer.md` | system | Building a sub-unit against an existing design |
| `system-reviewer.md` | system | Code review pass with confidence-scored output |
| `system-security.md` | system | Security review of pending changes |
| `subagent-explore.md` | sub-agent recipe | Read-only fan-out search across files |
| `subagent-plan.md` | sub-agent recipe | Step-by-step implementation plan |
| `subagent-code-explorer.md` | sub-agent recipe | Trace execution paths, map dependencies |
| `subagent-code-reviewer.md` | sub-agent recipe | Confidence-filtered review |
| `slash-goal.md` | slash command | Set a session goal + stop hook |
| `slash-loop.md` | slash command | Schedule recurring or self-paced runs |
| `slash-review.md` | slash command | Multi-agent PR review |
| `slash-clear.md` | slash command | Reset session context cleanly |

## Sub-agent strategy

When orchestrating long fan-outs, delegate to scoped specialists:

| Task | Sub-agent type | Model tier |
|---|---|---|
| File / symbol lookup | `explore` | haiku |
| Documentation, unit tests, code review | `plan` / `code-reviewer` | sonnet |
| Complex implementation needing deep reasoning | `implementer` | opus |

Tier by task complexity. Reserve opus for what truly needs it; haiku for trivial fan-outs.

## Slash-command discipline

- One command = one well-scoped workflow.
- The command body is a prompt template, not a script.
- Commands that side-effect (open PR, push, merge) require explicit user confirmation in their body.

## See also

- [`../pillars/ai-collaboration/README.md`](../pillars/ai-collaboration/README.md)
- [`../templates/CLAUDE.md.template.md`](../templates/CLAUDE.md.template.md) — bootstrap doc references these.
