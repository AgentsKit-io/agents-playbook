---
type: Guide
title: AgentsKit Chat dogfood
description: How Ask Playbook composes the public AgentsKit Chat framework without recreating chat state.
---

# Ask Playbook on AgentsKit Chat

Ask Playbook is a production dogfood host for
[`@agentskit/chat`](https://github.com/AgentsKit-io/agentskit-chat). The host
keeps the `playbook` corpus, endpoint, brand, CTA, and CSS. AgentsKit Chat owns
the definition, session, ordered content, standard components, and React shell;
AgentsKit owns messages, streaming, memory, cancellation, retry, editing, and
regeneration.

## Host recipe

1. Pin the stable npm packages `@agentskit/chat`,
   `@agentskit/chat-protocol`, and `@agentskit/chat-react` at exact version
   `0.2.0`. Their published manifests resolve the internal graph without host
   overrides.
2. Build one `defineChat` definition with the public standard component
   manifest, an AgentsKit `AdapterFactory`, and `ChatMemory`.
3. Project the Ask service's validated NDJSON records into ordered text and the
   standard `source-list` component. Unknown records stay inert.
4. Render `AgentChat` and use native React slots only for Playbook branding,
   linked prose, the composer, loading copy, and citations.
5. Keep `corpus="playbook"` and `NEXT_PUBLIC_ASK_ENDPOINT` in this host.

The implementation lives in `components/ask-widget.tsx` and
`components/ask-chat/ask-adapter.ts`. Do not add a reducer, stream loop, message
store, cancellation state, or a second component protocol to the host.

## Migration and parity evidence

The former widget managed `messages`, `streaming`, `AbortController`, NDJSON,
`sessionStorage`, message rendering, and scrolling itself. It was removed only
after the AgentsKit Chat integration covered:

- text, citations, errors, done, malformed and unknown records;
- cancellation through the public adapter source;
- migration from `ak:ask-thread-v2:playbook` to canonical serialized memory;
- safe, bounded citations and ordered text + `source-list` rendering;
- empty/loading states, close, clear, send, stop, retry, edit, and regenerate;
- production build plus responsive evidence at 375, 768, 1280, and 1440 px,
  with no sub-44 px panel targets.

See AgentsKit Chat issue
[#27](https://github.com/AgentsKit-io/agentskit-chat/issues/27) for the shared
Registry/Playbook evidence and upstream-adoption record.
