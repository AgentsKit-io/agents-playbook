---
title: 'Self-Describe Pattern'
description: 'Ship a machine-readable manifest of what your system can do, so external agents can discover and call it without reading your source.'
---

# Self-Describe Pattern

Ship a machine-readable manifest of what your system can do, so external agents can discover and call it without reading your source.

## TL;DR (human)

Generate two artifacts at a stable URL: a structured **capability manifest** (`capabilities.json`) and a human/LLM-readable **`llms.txt`**. Both are generated *deterministically from one source of truth* (your tool/route registry), content-hashed, and gated in CI so they can never drift from the code. An external agent fetches them, learns your surface, and calls it — no source access, no guesswork, no secrets leaked.

## For agents

### Why a system should describe itself

An agent integrating with your system otherwise has three bad options: read your source (often impossible — private repo), scrape your docs (drift, ambiguity), or trial-and-error against your API (slow, noisy, sometimes destructive). A machine-readable manifest replaces all three with a single fetch.

The same artifact also serves your *own* agents: a sub-agent that needs to know "what tools exist and what are their IDs" reads the manifest instead of grepping the registry.

### The two artifacts

| Artifact | Audience | Shape |
|---|---|---|
| `capabilities.json` | Programmatic clients, other agents' tool-loaders | Structured: list of capabilities, each with a stable `id`, input/output contract reference, required permission, one-line description |
| `llms.txt` | LLMs choosing what to fetch; humans skimming | Plain text: short preamble + one line per capability/doc with a description and a link |

Serve both from a **stable, unauthenticated, root-level URL** (`/capabilities.json`, `/llms.txt`). Discovery must not require a key.

### One source of truth → generate, never hand-write

The manifest must be **generated from the same registry the runtime dispatches against** — never maintained by hand in parallel. A hand-maintained manifest drifts within days and becomes a lie that agents trust.

```
registry (the code that actually runs)
   │  gen-self-describe script
   ▼
capabilities.json  +  llms.txt   ← committed artifacts
   │  content-hash
   ▼
freshness gate in CI  ← fails if regenerating produces a different hash
```

- **Deterministic generation.** Same registry in → byte-identical artifact out. No timestamps, no random ordering, no machine-specific paths in the output. (Sort keys; inject any timestamp from outside.)
- **Content hash.** Embed a `contentHash` (e.g. sha256 of the normalized capability set) in the manifest. Clients can cheaply detect "did the surface change?"
- **Freshness gate.** A CI check regenerates the artifact and fails if it differs from what's committed. This is what makes the manifest *trustworthy*: it provably matches the code on every merge.

### What to expose — and what never to

Expose the **interface**, not the **implementation or the deployment**:

| Expose | Never expose |
|---|---|
| Capability `id` and stable name | Internal module paths, file names, package layout |
| Input/output contract (schema reference or shape) | Secrets, tokens, connection strings, vault refs |
| Required permission / scope (the *name* of the cap) | Live credential state, which secrets are *set* |
| One-line human description | Internal hostnames, infra topology, queue names |
| Version / contentHash | Customer data, tenant identifiers, sample PII |

The manifest is a contract surface, not a config dump. If a field would help an attacker more than an integrator, leave it out.

### Permissions belong in the manifest

Each capability should advertise the permission/scope it requires — by **name**, not by evaluating it. This lets an agent reason about "can I call this with the grant I have?" before attempting the call and eating an `AUTHZ_DENIED`. It does **not** leak the policy: naming a required scope is not the same as revealing who holds it. Authorization is still enforced at call time by the server; the manifest is advisory.

### Versioning the surface

- Capability `id`s are a public contract. Renaming or removing one is a breaking change — treat it like an API version bump, with a deprecation window.
- Bump a top-level `version` when the *shape* of the manifest format changes; the `contentHash` already tracks the *content*.
- Additive changes (new capability) are safe; clients ignore unknown entries.

### Common failure modes

- **Hand-maintained manifest.** Drifts from the runtime within a week; agents call capabilities that no longer exist. → Generate from the registry; gate freshness in CI.
- **Non-deterministic output.** A timestamp or unsorted map makes every regeneration differ, so the freshness gate is either disabled or always red. → Normalize: sort keys, inject time from outside, no machine paths.
- **Auth required to read it.** Defeats discovery — the agent needs the manifest *before* it has credentials. → Serve unauthenticated at a root URL.
- **Leaking implementation.** Exposing module paths / infra names turns the discovery surface into a recon surface. → Expose interface only (table above).
- **Treating cap removal as non-breaking.** External agents hard-code `id`s. → Deprecate, don't silently drop.

### See also

- [`bootstrap-doc-pattern.md`](/docs/pillars/ai-collaboration/bootstrap-doc-pattern) — the *internal* equivalent (CLAUDE.md / AGENTS.md) for agents working *inside* the repo.
- [`../security/governance-posture-pattern.md`](/docs/pillars/security/governance-posture-pattern) — expose the system's *security posture* the same machine-readable way.
- [`../architecture/contracts-zod-pattern.md`](/docs/pillars/architecture/contracts-zod-pattern) — the contracts the manifest references.
- [`../quality/quality-gates-pattern.md`](/docs/pillars/quality/quality-gates-pattern) — the freshness gate is one of these.
