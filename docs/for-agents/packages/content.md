---
type: module
id: content-corpus
editRoot: content
validationPath: pnpm check:all
docbridge:
  covers:
    - area:content
---

# Content corpus

Owns the published Playbook corpus under `content/docs`: the pillar, phase, prompt and template guides, the reference gate scripts, and the top-level pages such as the glossary and the matrix.

`source.config.ts` registers the directory with Fumadocs, `lib/source.ts` turns it into the page tree, and `scripts/build-discovery.mjs`, `scripts/build-bundle.mjs` and `scripts/build-raw-index.mjs` derive the discovery data, the downloadable bundle and the raw index from it. Each guide's route, owner entry and summary in `doc-bridge.config.json` are generated from the files here by `scripts/generate-doc-bridge-config.mjs`, so add or rename a guide and then run `pnpm docs:bridge:index`.

Guides carry front matter with at least `title` and `description`. `scripts/add-okf-type.mjs` maintains the `type` field.
