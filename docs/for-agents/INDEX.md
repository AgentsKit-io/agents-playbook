---
package: playbook-agent-handoff
purpose: Route coding agents through the public Playbook guides and their executable checks.
humanDoc: https://playbook.agentskit.io/docs/for-agents
editRoots:
  - content/docs
checks:
  - pnpm check:all
---

# Agents Playbook agent handoff

Start at [`content/docs/for-agents.mdx`](../../content/docs/for-agents.mdx), select the smallest relevant guide, and run the checks declared by that guide. The public guides remain the human documentation corpus; this directory owns only agent routing and verification context.
