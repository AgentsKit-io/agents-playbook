---
type: module
id: app-llms-txt
editRoot: app/llms.txt
validationPath: pnpm test
docbridge:
  covers:
    - area:app/llms.txt
---

# llms.txt route

Owns the `/llms.txt` site map for language models. `app/llms.txt/route.ts` reads every documentation source through `lib/doc-sources.ts`, takes the title and description from front matter (falling back to the first heading and paragraph), and lists each page with its raw Markdown URL. It prepends the ecosystem block built from `ecosystem.json` by `lib/ecosystem-llms-block.ts`.

The route is static. `app/llms.txt/route.test.ts` covers its output. The full single-file bundle is a separate route in the `app/llms-full.txt` area.
