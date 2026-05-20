---
title: "Glossary"
description: "Short definitions for the terms used across this playbook."
---

# Glossary

Short definitions for the terms used across this playbook.

| Term | Definition |
|---|---|
| **ADR** | Architecture Decision Record. Numbered, append-only doc capturing one decision. Source of truth for codebase structure. |
| **RFC** | Request for Comment. ADR-with-review-window, used for changes to public contracts. Promotes to ADR on acceptance. |
| **Boundary** | Anywhere bytes enter the process from outside the trust boundary: HTTP, IPC, JSON-RPC, file IO, env, message bus. |
| **Contract** | A schema (typically Zod / Pydantic / Protobuf) that defines the shape crossing a boundary. |
| **Contract package** | The dependency-free package that owns all shared schemas + the error model. |
| **Stable code** | A string error code (`\<NS\>_\<REASON\>`, all caps) that clients pattern-match on. Append-only. |
| **AppError** | The single base error class. Every other error subclasses it. |
| **Routing table** | The `AGENTS.md` mapping from "I want to change X" to "edit package Y". |
| **PR-intent manifest** | YAML block in PR description: `adds:`, `changes:`, `removes:`, `tests:`, `docs:`. Verified by a gate. |
| **removes-list** | The `removes:` entries in the manifest. Removing another author's exported symbol requires one. |
| **Sub-unit** | One discrete, shippable change. One sub-unit per session. |
| **Phased PR** | A long initiative shipped as a chain of phase PRs, each merged with `--merge --admin`. |
| **Verify-first** | Confirm state (issue open, branch fresh, file path real) before acting. |
| **Tombstone** | Status block prepended to a retired doc indicating it is no longer active. Body kept for trail. |
| **Completeness contract** | Per-screen rule that no `TODO`/disabled tab/empty body ships. |
| **Hermetic test** | In-process test that reproduces a bug without external services. Preferred over E2E for repro/lock. |
| **Quality gates** | Fast structural checks (file size, no `any`, named exports, intl, tokens). Run pre-commit + CI. |
| **Sanity** | Cross-cutting periodic audit. Generates a report; CI fails on regressions. |
| **Shrink-only baseline** | Gate config: existing offenders are baselined, new violations fail. Baseline can only shrink. |
| **Break-glass** | Time-boxed admin role elevation with signed audit trail. |
| **Consent (in security)** | Scoped, time-boxed user approval for a specific action. Distinct from role elevation. |
| **Egress allowlist** | Default-deny outbound network policy; only allowlisted destinations resolve. |
| **Sealer** | The key that encrypts secrets at rest. Rotatable. |
| **Audit ledger** | Append-only signed log of privileged operations. Verifiable via batch signature / Merkle anchor. |
| **DSAR** | Data Subject Access Request. GDPR-style export / delete request. |
| **Legal hold** | Flag that suspends retention for a subject under investigation. |
| **Whitelabel / OEM** | Per-tenant brand kit + plan presets that swap product name, logo, palette at build / runtime. |
| **MEMORY pattern** | One-fact-per-file persistent agent memory with an index file (`MEMORY.md`). |
| **Sub-agent** | Scoped specialist agent delegated for a fan-out task. |
| **Slash command** | Palette-invoked workflow body. |
| **Goal mode** | Stop hook with a condition; agent works until the condition holds. |
