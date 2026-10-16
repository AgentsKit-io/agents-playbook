---
tipo: fluxo
repo: agents-playbook
camada: ferramenta
visibilidade: publico
verificado-em: 2026-10-16
commits:
  agents-playbook: 11f6585
metodo: "análise estática em 11f6585; `pnpm test` executado localmente (inclui lib/discovery.test.ts e scripts/lib/playbook-discovery.test.mjs, ok)"
fontes:
  - package.json
  - scripts/gen-stats-snapshot.mjs
  - scripts/build-discovery.mjs
  - scripts/lib/playbook-discovery.mjs
  - scripts/discovery-metadata.json
  - scripts/build-bundle.mjs
  - scripts/build-raw-index.mjs
  - public/deterministic/site-config.json
  - lib/discovery.ts
  - lib/discovery.test.ts
  - components/ask-widget.tsx
  - app/layout.tsx
  - app/raw/[...path]/route.ts
  - app/llms.txt/route.ts
  - content/docs/discovery.mdx
  - .github/workflows/ci.yml
tags: [fluxo, repo/agents-playbook, camada/ferramenta]
---

# Playbook - Do corpus à consulta

> [!tldr] Em linguagem comum
> O mesmo texto do manual vira, no build, um site, arquivos simples para IA e um "catálogo de respostas prontas" assinado por hash. Quando alguém pergunta no Ask, o navegador confere esse catálogo e responde na hora se a pergunta é conhecida; se não for (ou o catálogo falhar), pergunta ao serviço externo e mostra de onde veio a resposta.

← [[00 Hub - agents-playbook]]

## Entrada e resultado

- **Entrada**: arquivos `content/docs/**/*.md|mdx|mjs` e `scripts/discovery-metadata.json`.
- **Resultado**: páginas `/docs`, rotas de máquina, `public/deterministic/{site-config,knowledge}.json` e uma resposta no widget Ask rotulada como `instant · local`, `consulting backend` ou `grounded · backend` (`components/ask-widget.tsx:313`).
- **Persistência**: só artefatos estáticos versionados ou gerados; a conversa fica no navegador pela memória do [[chat]] (chave `ak:ask-thread-v3:playbook`, `components/ask-widget.tsx:225`).

```mermaid
flowchart LR
  C[content/docs] -->|prebuild| K[knowledge.json + site-config.json]
  C -->|prebuild| Z[playbook-bundle.zip + raw-index]
  C --> S[/docs, /llms.txt, /raw]
  U[Visitante abre/foca o Ask] --> L[loadPlaybookDiscovery 6,5 s]
  L -->|ok + hash + siteId| D{Resposta exata?}
  L -->|falha| B[Backend Ask]
  D -->|sim| R1[instant · local]
  D -->|ambígua| CH[Escolhas locais]
  D -->|não| B
  B -->|texto e done sem erro| R2[grounded · backend]
```

| Etapa | O que acontece | Evidência |
|---|---|---|
| 1. Prebuild | `gen-stats-snapshot` → `build-discovery` → `build-bundle` → `build-raw-index` | `package.json:8` |
| 2. Artefato | Uma entrada por arquivo do corpus + 9 fixas; hash SHA-256 de conteúdo; validação pelo schema do [[chat-protocol]]; erro se passar do limite de bytes | `scripts/lib/playbook-discovery.mjs:157` a `:175` |
| 3. Config do site | `siteId: 'playbook'`, `artifact.contentHash`, `fallback.mode: 'backend'` | `scripts/lib/playbook-discovery.mjs:177`, `public/deterministic/site-config.json:4` |
| 4. Superfícies | Fumadocs, `/llms.txt`, `/llms-full.txt`, `/raw/...` (disco ou índice gerado no Workers) | `app/llms.txt/route.ts:85`, `app/raw/[...path]/route.ts:69` |
| 5. Intenção do usuário | Hover, foco ou clique no FAB disparam a carga; antes disso nada é baixado | `components/ask-widget.tsx:279`, `content/docs/discovery.mdx:49` |
| 6. Carga | `site-config.json` e `knowledge.json` em paralelo com timeout de 6,5 s; qualquer falha → `null` | `lib/discovery.ts:19` a `:34` |
| 7. Adapter | Config inválida → adapter degradado (só backend); válida → `verifyLocalKnowledgeArtifactSync` + `createDeterministicAnswerAdapter` | `lib/discovery.ts:63`, `lib/discovery.ts:78`, `lib/discovery.ts:87` |
| 8. Escalada | Fallback `createAskAdapter({ endpoint, corpus })` recebe o `sessionId` ativo | `components/ask-widget.tsx:239`, `lib/discovery.ts:83` |
| 9. Proveniência | `onDecision` / `onBackendStart` / `onBackendAnswer` atualizam o rodapé | `components/ask-widget.tsx:243` a `:249` |
| 10. CI | Build regenera e `git diff --exit-code` exige artefatos idênticos aos versionados | `.github/workflows/ci.yml:39`, `.github/workflows/ci.yml:41` |

## Erros e recuperação

- **Artefato indisponível**: `discovery` vira `null`; nova tentativa só após `DISCOVERY_RETRY_DELAY_MS` (1 s) numa próxima interação (`components/ask-widget.tsx:35`, `components/ask-widget.tsx:228`). Enquanto isso, o adapter degradado usa o backend.
- **Artefato corrompido ou de outro site**: rejeitado por hash/`siteId`; nunca vira contexto confiável (`lib/discovery.ts:78` a `:81`; `content/docs/discovery.mdx:51`).
- **Stream do backend com erro**: não é rotulado `grounded` (`lib/discovery.ts:57`, `lib/discovery.ts:58`; teste `lib/discovery.test.ts:76`).
- **Backend Ask fora do ar**: não tratado neste repo além do erro exibido pelo Chat; o serviço não é implementado aqui.

## Quem atua aqui

| Peça | Papel |
|---|---|
| [[agents-playbook-site]] | Gera artefatos, serve rotas e hospeda o widget |
| [[chat]] / [[chat-protocol]] | Adapter determinístico, verificação, `defineChat`, memória de sessão |
| [[AgentsChat - Resposta local e escalada]] | O mesmo fluxo visto do lado do framework |
| [[Artefato de conhecimento determinístico]] | Conceito central do fluxo |

> [!info]- Detalhe técnico
> - `generatedAt` fixo vindo de `scripts/discovery-metadata.json:2`, lido em `scripts/lib/playbook-discovery.mjs:42` — mantém o hash estável entre builds.
> - Aliases de correspondência exata por página: rota, caminho, slug, título e variações (`scripts/lib/playbook-discovery.mjs:61`).
> - Teste "fatos exatos ficam locais, síntese escala com contexto": `lib/discovery.test.ts:30`.
> - Endpoint padrão do backend e variável `NEXT_PUBLIC_ASK_ENDPOINT`: `components/ask-widget.tsx:207`.
> - Bundle ZIP: `scripts/build-bundle.mjs:16`; índice raw: `scripts/build-raw-index.mjs:20`.
