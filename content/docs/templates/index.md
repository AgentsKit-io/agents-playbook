---
type: Index
title: 'Templates'
description: 'Copy-paste skeletons for the documents the playbook relies on — bootstrap docs, decision records, and the PR-intent manifest.'
---

# Templates

Copy-paste skeletons for the documents the playbook relies on. Each is a starting point — adapt the wording, keep the structure.

## For agents

| Template | Use when | Pattern |
|---|---|---|
| [`CLAUDE.md.template.md`](/docs/templates/CLAUDE.md.template) | Bootstrapping the agent's first-read file for a repo | [bootstrap-doc-pattern](/docs/pillars/ai-collaboration/bootstrap-doc-pattern) |
| [`AGENTS.md.template.md`](/docs/templates/AGENTS.md.template) | The routing table mapping "change X" → "edit path Y" | [bootstrap-doc-pattern](/docs/pillars/ai-collaboration/bootstrap-doc-pattern) |
| [`MEMORY.md.template.md`](/docs/templates/MEMORY.md.template) | The persistent-memory index + per-fact file convention | [memory-pattern](/docs/pillars/ai-collaboration/memory-pattern) |
| [`ADR.template.md`](/docs/templates/ADR.template) | Recording an architecture decision | [adr-pattern](/docs/pillars/architecture/adr-pattern) |
| [`RFC.template.md`](/docs/templates/RFC.template) | Proposing a breaking-contract change before building | [rfc-pattern](/docs/pillars/architecture/rfc-pattern) |
| [`PR-intent.template.md`](/docs/templates/PR-intent.template) | Declaring what a PR adds / changes / removes | [pr-intent-pattern](/docs/pillars/governance/pr-intent-pattern) |

## See also

- [Pillar — AI Collaboration](/docs/pillars/ai-collaboration) — where the bootstrap + memory templates come from.
- [Pillar — Governance](/docs/pillars/governance) — where the PR-intent manifest is enforced.
- [Scripts](/docs/scripts) — reference implementations of the gates these documents feed.
