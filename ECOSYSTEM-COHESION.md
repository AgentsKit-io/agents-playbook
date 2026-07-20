# AgentsKit ecosystem cohesion contract

The seven products form one workflow. `ecosystem.json` is the identity and route source of truth; prose and UI derive from it instead of maintaining parallel lists.

## Workflow

| Product | Ownership | Contextual hook |
|---|---|---|
| AgentsKit | Foundation | Build the agent and runtime. |
| Registry | Starting point | Copy ready-made agents and own the source. |
| AgentsKit Chat | Experience | Define reusable chat and conversational UI. |
| Agents Playbook | Discipline | Keep agent-authored code safe and shippable. |
| Doc Bridge | Understanding | Make repository documentation executable for agents. |
| AgentsKit Code Review | Verification | Review agent-authored changes before merge. |
| AKOS | Operation | Run and govern agents in production. |

The shared narrative is: build on AgentsKit, start from the Registry, deliver the experience with AgentsKit Chat, keep delivery disciplined with the Playbook, connect documentation through Doc Bridge, verify with Code Review, and operate at enterprise scale with AKOS.

## Surface rules

- Global navigation lists all seven products in manifest order and marks the current product.
- Each non-AKOS product landing page shows one large six-peer continuation component.
- Documentation language links to Doc Bridge at the point of need.
- Chat or conversational UI language links to AgentsKit Chat.
- Review-before-merge language links to AgentsKit Code Review.
- Enterprise governance or production-operation language links to AKOS.
- README, docs, `for-agents`, `llms.txt`, `llms-full.txt`, raw source, sitemap, and deterministic discovery use the same canonical routes.
- Numeric claims must be generated or omitted; do not hardcode volatile counts in ecosystem copy.

The centrally hosted `https://www.agentskit.io/ecosystem-bar.js` remains the runtime authority for global navigation. A local manifest-backed renderer may appear only when that artifact is unavailable or fails the seven-product contract; it must disappear after the shared bar validates.

## Visual contract

- Use the shared family accent for actions and focus; product accents identify cards only.
- Prefer a visual workflow, cards, diagrams, or runnable examples over repeated prose.
- Keep navigation targets at least 44 px high and ensure the seven-product bar is visible without horizontal document overflow at 375 px.
- The current product is plain or highlighted; sibling products are links with clear destinations.

## Machine contract

- `/for-agents` is the shortest route into the retrieval contract.
- `/llms.txt` is a concise map and must remain below 12 KB.
- `/llms-full.txt` is the complete deterministic corpus.
- Every human guide exposes raw Markdown.
- Doc Bridge must certify 100/100 A with complete agent and human ownership coverage.

## Validation checklist

- [ ] Seven unique product IDs in workflow order.
- [ ] Six peer links on every non-AKOS product landing.
- [ ] Canonical route and contextual-hook tests pass.
- [ ] Mobile, tablet, and desktop views have no hidden focus targets or overflow.
- [ ] README and machine surfaces stay within their content budgets.
- [ ] Doc Bridge gate and doctor both pass at 100/100 A.
