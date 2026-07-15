---
type: Guide
title: 'Onboard Your Agent'
description: 'One paste that feeds any coding agent the whole playbook and has it audit your repo — Claude Code, Cursor, Windsurf, Codex, Copilot, and more.'
---

# Onboard Your Agent

One paste that feeds any coding agent the whole playbook and has it audit your repo — Claude Code, Cursor, Windsurf, Codex, Copilot, and more.

## The idea

The playbook is **agent-agnostic**. It is plain Markdown, served both as a human site and as machine-readable bundles. Any agent that can fetch a URL (or that you can paste text into) can ingest the whole thing, compare it against your repository, and tell you what to adopt — a facilitated training pass, not a manual read-through.

Two steps: point the agent at the bundle, then ask it to audit your repo against it.

## The universal onboarding prompt

Paste this into your agent of choice. It works unchanged across tools — it only asks the agent to fetch, audit, and plan, never to edit blindly.

````text
You are onboarding to a shared engineering playbook for shipping production
software with AI coding agents.

1. Fetch and read the full playbook bundle:
   https://playbook.agentskit.io/llms-full.txt
   (Site map: https://playbook.agentskit.io/llms.txt — fetch individual docs
   from the /raw/ paths if you can't load the whole bundle at once.)

2. Then audit THIS repository against it:
   - Which playbook practices already hold here?
   - Which are missing or violated, ranked by risk
     (security > correctness > quality > governance > DX)?
   - Which are not applicable to this stack, and why?

3. Propose a short, prioritized adoption plan: the 5 highest-leverage changes
   for this repo, each with the playbook doc it comes from and a concrete first
   step.

4. Draft (or update) the repo's bootstrap doc — CLAUDE.md, AGENTS.md,
   .cursor/rules, .windsurfrules, or .github/copilot-instructions.md as
   appropriate for the agent in use — using the playbook's template as the
   starting point.

Do not change code yet. Output the audit and the plan first, then wait for my
go-ahead.
````

> **Why "don't change code yet".** The first pass is an audit. Letting the agent rewrite the repo before you've read its plan is how you get a 40-file diff nobody asked for. See [`pillars/ai-collaboration/human-in-the-loop-pattern.md`](/docs/pillars/ai-collaboration/human-in-the-loop-pattern).

## Where the playbook lives (machine-readable)

| Endpoint | What it is | Use it for |
|---|---|---|
| [`/llms-full.txt`](/llms-full.txt) | Every doc concatenated into one file | One-shot context load / RAG indexing |
| [`/llms.txt`](/llms.txt) | Curated map of core entry points | Letting the agent pick which focused docs to fetch |
| `/raw/<path>.md` | Raw Markdown for any single doc | Targeted reads (e.g. `/raw/pillars/security/rbac-pattern.md`) |
| [`/playbook-bundle.zip`](/playbook-bundle.zip) | Zip of all docs | Local indexing / offline RAG |

## Per-tool setup

Every agent reads a **bootstrap doc** first. Adopt the playbook by putting your repo's rules in the file your agent already looks for — see [`pillars/ai-collaboration/agent-compatibility-pattern.md`](/docs/pillars/ai-collaboration/agent-compatibility-pattern) for the full mapping.

### Claude Code

Paste the prompt in a session. Claude Code fetches the bundle and reads your repo directly. Persist the result to `CLAUDE.md` (or `AGENTS.md`) at the repo root so every future session starts pre-trained.

### Cursor

Paste the prompt into chat (Agent mode so it can read the repo). Save the adopted rules to `.cursor/rules/` (one `.mdc` file per concern) or a root `AGENTS.md` — Cursor reads both.

### Windsurf

Paste into Cascade. Save the rules to `.windsurfrules` at the repo root.

### GitHub Copilot

Paste into Copilot Chat. Persist repo-wide rules to `.github/copilot-instructions.md`.

### OpenAI Codex / Codex CLI

Paste into the Codex prompt. Codex reads `AGENTS.md` at the repo root — write the adopted rules there.

### Aider, Cline, Zed, and others

Any agent that accepts a system/context file works the same way: paste the prompt, then save the adopted rules into that tool's convention file (e.g. Aider's `CONVENTIONS.md`). When in doubt, a root `AGENTS.md` is the most widely-read fallback.

## After the audit

1. Read the agent's prioritized plan. Push back on anything that doesn't fit your stack.
2. Commit the bootstrap doc first — it's the durable artifact that trains every future session.
3. Adopt the [quality gates](/docs/pillars/quality/quality-gates-pattern) early; they catch regressions the moment the agent starts writing code.
4. Re-run the onboarding prompt after major dependency or architecture changes — the applicable subset of the playbook shifts as the repo grows.

## See also

- [`pillars/ai-collaboration/agent-compatibility-pattern.md`](/docs/pillars/ai-collaboration/agent-compatibility-pattern) — the bootstrap-doc-per-tool mapping.
- [`pillars/ai-collaboration/bootstrap-doc-pattern.md`](/docs/pillars/ai-collaboration/bootstrap-doc-pattern) — what goes in the bootstrap doc.
- [`templates/CLAUDE.md.template.md`](/docs/templates/CLAUDE.md.template) — the starting skeleton (works as AGENTS.md too).
- [`getting-started.mdx`](/docs/getting-started) — adopt the playbook step by step.
