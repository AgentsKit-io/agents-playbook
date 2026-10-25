---
type: module
id: app-api
editRoot: app/api
validationPath: pnpm test && pnpm build
docbridge:
  covers:
    - area:app/api
---

# Site API routes

Owns the three Next route handlers under `app/api`.

- `app/api/search/route.ts` serves documentation search. It builds a Fumadocs search index from `lib/source.ts` and exports its `GET` handler. It is covered by `app/api/search/route.test.ts`.
- `app/api/stats.json/route.ts` serves the Playbook counts as static JSON for sibling ecosystem sites. The numbers come from `app/stats.snapshot.json`, which `scripts/gen-stats-snapshot.mjs` regenerates during `prebuild`.
- `app/api/ecosystem-stars/route.ts` sums GitHub stargazers across the products listed in `lib/ecosystem.ts`. It returns `0` for any repository it cannot read, and it is cached for six hours.

Change the counts by changing the content corpus and re-running `pnpm gen:stats`, not by editing the snapshot by hand.
