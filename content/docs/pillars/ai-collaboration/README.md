---
title: 'Pillar — AI Collaboration'
description: 'How to make an agent productive in your repo on day one and durably good across sessions.'
---

# Pillar — AI Collaboration

How to make an agent productive in your repo on day one and durably good across sessions.

## Status

◐ Scoped, not yet detailed. This is the most distinctive pillar of the playbook — it captures lessons that have no analogue in pre-agent software development.

## Scope

| Concern | Universal principle | Concrete pattern |
|---|---|---|
| Bootstrap doc | One file an agent reads first, every session | `CLAUDE.md` (or `AGENTS.md`) at the repo root with non-negotiables + routing |
| Routing table | Map "I want to change X" → "edit path Y" | `AGENTS.md` table; agents triage faster by group than by file |
| Persistent memory | Lessons survive session ends | `MEMORY.md` (index) + `memory/*.md` (one fact per file) pattern |
| Goal mode | Agent works toward a condition, not a turn count | Stop hook with goal condition; clears when the condition holds |
| Sub-agents | Long fan-outs delegate to scoped specialist agents | Sub-agent recipes per task class (search, plan, review, implement) |
| Slash commands | Repeated workflows become palette entries | `/goal`, `/loop`, `/review`, `/clear`, plus project-specific |
| System prompts | Per-role prompts (architect, reviewer, fixer) | Reusable role files; injected per task |
| Verify-first | Before acting, confirm the state is what you think it is | Default `gh issue view`, `git fetch`, `pwd` at session start |
| Single sub-unit | One discrete shippable change per session | Defined up front; no scope creep |
| Honest reporting | Faithful state, not optimistic state | "Tests failed: \<output\>", not "Tests pass after I fix the unrelated thing" |
| Duplication detection | Verify against real exports, not doc names | `npm pack` + read `.d.ts`, never trust naming similarity |
| Concurrent-merge survival | Multiple agents pushing to main | Stash-verify red, rebase clean, retry; pre-push hook covers structural drift |

## Non-negotiables

1. **CLAUDE.md / AGENTS.md is mandatory.** No agent starts work without one.
2. **Persistent memory grows from lessons, not from chat.** Each memory file is a fact + how to apply it.
3. **Verify-first.** State at session start may not match state at PR open.
4. **Honest reporting.** Tests that failed are reported failed. Steps skipped are reported skipped.
5. **One sub-unit per session.** Quality over speed.

## See also

- [`../../templates/CLAUDE.md.template.md`](../../templates/CLAUDE.md.template.md) — bootstrap doc skeleton.
- [`../../templates/AGENTS.md.template.md`](../../templates/AGENTS.md.template.md) — routing table skeleton.
- [`../../templates/MEMORY.md.template.md`](../../templates/MEMORY.md.template.md) — persistent memory skeleton.
- [`../../prompts/`](../../prompts/) — system prompts + sub-agent recipes.

## Roadmap

- `universal.md`
- `bootstrap-doc-pattern.md`
- `memory-pattern.md`
- `sub-agent-pattern.md`
- `slash-commands-pattern.md`
- `concurrent-agent-pattern.md`
- `self-describe-pattern.md`
