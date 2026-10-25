---
type: module
id: site-components
editRoot: components
validationPath: pnpm lint && pnpm test
docbridge:
  covers:
    - area:components
---

# Site components

Owns the React components the Next host renders around the corpus.

- Shell and branding: `components/agentskit-shell.tsx` loads the shared AgentsKit shell stylesheet and script, and `components/product-wordmark.tsx` renders the product name.
- Documentation rendering: `components/mdx.tsx` maps MDX elements to Fumadocs components, `components/copy-markdown.tsx` copies a page's raw Markdown, and `components/copy-prompt.tsx` copies a literal prompt.
- Search: `components/site-search-trigger.tsx` opens the Fumadocs search dialog and `components/accessible-search.tsx` labels its input for assistive technology.
- Ecosystem handoff: `components/ecosystem-link.tsx` sends click analytics, and `components/ecosystem-cross-ref.tsx`, `components/ecosystem-showcase.tsx` and `components/docs-ecosystem-handoff.tsx` link to sibling products listed in `lib/ecosystem.ts`.
- Landing visuals: `components/agent-convergence.tsx` draws the convergence diagram from the marks in `components/agent-marks.ts`.
- Ask Playbook: `components/ask-widget.tsx` configures the AgentsKit Chat widget. Chat state, streaming and memory stay in AgentsKit and AgentsKit Chat, so do not reimplement them here.
- Analytics: `components/posthog-provider.tsx` starts PostHog through `lib/posthog-client.ts`.
