---
type: module
id: app-docs
editRoot: app/docs
validationPath: pnpm lint && pnpm build
docbridge:
  covers:
    - area:app/docs
---

# Documentation routes

Owns the `/docs` section of the site.

- `app/docs/layout.tsx` wraps every documentation page in the Fumadocs docs layout. It feeds the page tree from `lib/source.ts`, shows the `ProductWordmark` in the navigation bar, and links to For agents, Matrix, Glossary, `/llms.txt` and the bundle download. The theme switch is off because the site is dark only.
- `app/docs/[[...slug]]/page.tsx` renders one page of the `content/docs` corpus. It emits TechArticle and breadcrumb JSON-LD, offers `CopyMarkdown` for the raw source at `/raw/<slug>.md`, and ends with the `DocsEcosystemHandoff` block.

A page that is missing from the corpus returns the Next not-found response. Add pages under `content/docs`, not here.
