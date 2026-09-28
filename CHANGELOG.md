# Changelog

All notable changes to Agents Playbook are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## Unreleased

### Added

- Versioned pre-commit provider for the published `@agentskit/playbook@0.1.0` gates, with staged-snapshot isolation and Linux, macOS, and Windows validation.
- Local-first Ask Playbook discovery with 150 content-addressed answers, deterministic choices, safe fallback, retry, and truthful provenance.
- Complete Doc Bridge ownership for 130 guides with a 100/100 A health grade.
- README Standard v1 contract, synchronized runnable example, explanatory visual, freshness gate, and contribution journey.
- Dedicated discovery and contribution guides, raw gate-script routes, and expanded `llms.txt`/`llms-full.txt` coverage.
- Unit, onboarding, desktop/mobile Playwright, build, and continuous-integration gates.
- Cached same-origin ecosystem star aggregation to avoid public API failures in browsers.
- Explicit analytics opt-in so an invalid PostHog project cannot emit errors on public pages.

### Changed

- The Playbook now consumes the published `@agentskit/harness` from npm as a devDependency. Its task contract moved to `.ak-harness/verification.json` and covers only the corpus documentation checks; `pnpm harness:doctor` validates it and `pnpm harness:verify` runs it.
- Repository scripts use `@agentskit/cross-platform` for module paths, POSIX-relative paths and `.cmd` shim resolution (`pnpm`, `node_modules/.bin/ak-docs`), and `pnpm lint` runs its portability ratchet against `.cross-platform-baseline.json`.
- Prepared `@agentskit/playbook@0.1.1` with an explicit dual-license boundary:
  CLI software under MIT and the Playbook content corpus under CC BY 4.0.
- Updated Doc Bridge to 1.1.1.
- Deferred the shared ecosystem bar until idle to protect the critical rendering path.
- Expanded ecosystem cross-links across human and machine-readable surfaces.

### Removed

- The stale `packages/harness` fork (v0.1.0), which was published under the same name as the canonical `@agentskit/harness` ([AgentsKit-io/harness](https://github.com/AgentsKit-io/harness)). Its lifecycle attestation, reconciliation, and event-log lock work lives in the canonical package. Removed with it: the `scripts/verify-harness-*.mjs` self-tests, the `benchmarks/harness-phase-*.json` development corpus, the fork's `.codex/verification.json` contract (including a `documentation-audit` check that pointed at a local machine path and could not run elsewhere), the `harness:test`/`harness:build`/`harness:cli` scripts, and the CI `docker pull` that only served the fork's Docker sandbox test.
