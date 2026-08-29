# Contributing to `@agentskit/harness`

## Before opening a change

1. State the behavior and failure mode the change addresses.
2. Keep the public API in `src/index.ts` intentionally small.
3. Add or update a typed test for every behavior change.
4. Update the README, changelog, and contract when the user-facing protocol changes.

## Local checks

```bash
pnpm --filter @agentskit/harness typecheck
pnpm --filter @agentskit/harness test
pnpm --filter @agentskit/harness build
```

Do not claim completion when a required check is unavailable. Preserve criterion-level evidence and report blocked work honestly.

## Pull requests

Use a focused branch and commit. Describe the contract change, affected states, evidence produced, and exact commands executed. Breaking public API or CLI changes require a changelog entry and a maintainer review.

## License

Contributions are accepted under the repository's MIT license.
