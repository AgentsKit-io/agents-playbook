# Changelog

All notable changes to `@agentskit/harness` are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the package follows Semantic Versioning.

## [Unreleased]

### Added

- Strict TypeScript modular core with generated declarations and source maps.
- Contract-frozen lifecycle, structured evidence, stale detection, human approval, retry, and cleanup.
- Explicit human cancellation and superseded retry history.
- Typed dependency-aware plugin lifecycle with deterministic cleanup.
- Append-only, source- and contract-bound lifecycle event log per run.
- Declarative profile inheritance with validated check overrides.
- Optional provenance-bearing context provider slot for Doc Bridge and Playbook adapters.
- Dependency-free Doc Bridge index adapter with deterministic references and frozen context snapshots.
- Context lifecycle events and stable context hashes that ignore resolution timestamps.
- Portable CLI snapshot resolution and `plan --context-file` binding for shell-based agents.
- Tamper-evident validation for imported context snapshots.
- `ak-harness` CLI and `ak-verify` common-protocol alias.
- Public package documentation and community policy files.
