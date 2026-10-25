---
type: module
id: app-raw
editRoot: app/raw
validationPath: pnpm build
docbridge:
  covers:
    - area:app/raw
---

# Raw Markdown route

Owns `GET /raw/<path>`, which returns the Markdown (or reference script) source of a corpus page. `app/raw/[...path]/route.ts` resolves a path against `content/docs`, trying `.md`, `.mdx`, `index` and `README` variants. On hosts without a filesystem it falls back to the build-time index that `scripts/build-raw-index.mjs` produces.

`generateStaticParams` walks `content/docs` so every page and `.mjs` reference script gets a static raw URL. The `CopyMarkdown` component and the `Raw:` links in `/llms.txt` rely on this route.
