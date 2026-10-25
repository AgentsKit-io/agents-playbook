---
type: module
id: app-for-agents
editRoot: app/for-agents
validationPath: pnpm lint && pnpm build
docbridge:
  covers:
    - area:app/for-agents
---

# For agents route

Owns the short `/for-agents` URL. `app/for-agents/page.tsx` redirects to `/docs/for-agents`, which renders the guide stored in `content/docs/for-agents.mdx`. The route holds no content of its own, so edit the guide, not the redirect.
