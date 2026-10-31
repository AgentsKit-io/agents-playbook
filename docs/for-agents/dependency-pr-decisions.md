# Dependency PR queue — decisions (#132)

Decision for each of the 13 open Dependabot/Renovate PRs, resolved in the grouped PR for #132.
"Superseded" means the change is applied here and the original PR is closed with the reason.

| PR | Update | Decision | Reason |
| --- | --- | --- | --- |
| #34 | actions/setup-node 6.4.0 → 7.0.0 | Superseded | Applied, SHA-pinned at v7.1.0 in `ci.yml`. |
| #35 | actions/setup-python 6.3.0 → 7.0.0 | Superseded | Applied, SHA-pinned at v7.1.0 in `ci.yml`. |
| #66 | pnpm/action-setup 6.0.9 → 6.1.0 | Superseded | Applied, SHA-pinned at v6.1.0 in `ci.yml`. |
| #102 | pnpm → 10.34.9 | Superseded | Applied in `package.json`. |
| #104 | production deps (patch/minor) — was red | Fixed | fumadocs 15.8.5 broke the loader; fixed with the fumadocs-mdx `files` thunk in `lib/source.ts`. |
| #105 | setup-node → v7 | Superseded | Same change as #34. |
| #106 | setup-python → v7 | Superseded | Same change as #35. |
| #122 | image-size → v2 — was red | Fixed | Moved to image-size-next 2.1.1; the obsolete `image-size-next@1.2.2` patch was dropped. |
| #123 | `js-yaml@<4` → 5.5.0 | **Closed, not viable** (not applied) | `js-yaml@<4` stays pinned at 3.15.1. Consumers of js-yaml 3.x (e.g. via gray-matter) rely on the 3.x API such as `safeLoad`; a major jump through an override is unsafe. |
| #124 | `js-yaml@>=4 <5` → 5.5.0 | Superseded | Applied as `js-yaml@>=4 <6: 5.5.0` in `pnpm-workspace.yaml`. |
| #125 | `minimatch@8>brace-expansion` → 5 | Closed, not viable | `glob@9 → minimatch@8` needs the CJS default export of brace-expansion 2.x; kept at 2.1.7 (see the comment in `pnpm-workspace.yaml`). |
| #126 | nanoid → 6 | Closed, not viable | nanoid stays pinned at 3.3.18 by override in `pnpm-workspace.yaml`; a major bump was not applied. |
| #130 | pin `AgentsKit-io/.github` agent.yml | Superseded | Its pin is superseded by the newer pin to `c6bd249` in `.github/workflows/agent.yml`. |

Follow-up after the grouped PR merges: close each PR above with its reason from this table and confirm `main` CI is green.
