# Phase 04 — Test

How "tests pass" stops being a feeling and starts being a contract.

## Status

◐ Scoped, not yet detailed.

## Layers

1. **Unit / contract tests** — parse / reject schemas; subscriber sees the right error code. Fast (ms).
2. **Integration tests** — handler + store + adapter wired in-process. Seconds.
3. **End-to-end** — real app, real sidecar / real server. Minutes; minimal scope.
4. **Visual regression** — token / primitive drift catches.
5. **A11y** — axe + manual screen-reader pass on changed screens.
6. **Mutation** — once unit is good, mutate to score real coverage.

## Discipline

- **Hermetic before E2E.** Reproduce + lock bugs in component tests. E2E is for smoke + golden paths only.
- **Verify-first.** Before "fixing" a flaky test, check if it was fixed concurrently.
- **Tests assert on codes, not messages.** Messages are intl-resolved and may change.
- **Coverage per package.** Aggregate hides bad packages behind good ones.
- **Reproduce the report, not the description.** A bug report says X; the failing test asserts X verbatim, then is improved.

## See also

- [`../../pillars/quality/README.md`](../../pillars/quality/README.md)
- [`../../pillars/architecture/error-hierarchy.md`](../../pillars/architecture/error-hierarchy.md) — codes-not-messages convention.
