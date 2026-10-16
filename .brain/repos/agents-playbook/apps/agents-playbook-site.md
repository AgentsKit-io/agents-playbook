---
tipo: app
repo: agents-playbook
camada: ferramenta
visibilidade: publico
verificado-em: 2026-10-16
commits:
  agents-playbook: 11f6585
metodo: "análise estática do código em 11f6585; executados localmente `pnpm test` (13 arquivos, 34 testes ok) e doc-bridge 1.12.0 (`ak-docs index`, `query ownership playbook --agent`, `gate run` ok, `doctor --text` 79/100 B); o índice doc-bridge cobre documentos, não o código do app"
fontes:
  - package.json
  - AGENTS.md
  - app/layout.tsx
  - app/docs/[[...slug]]/page.tsx
  - app/for-agents/page.tsx
  - app/raw/[...path]/route.ts
  - app/llms.txt/route.ts
  - app/llms-full.txt/route.ts
  - app/api/search/route.ts
  - app/api/stats.json/route.ts
  - app/api/ecosystem-stars/route.ts
  - app/sitemap.ts
  - components/ask-widget.tsx
  - components/agentskit-shell.tsx
  - components/posthog-provider.tsx
  - components/ecosystem-link.tsx
  - lib/discovery.ts
  - lib/discovery.test.ts
  - lib/doc-sources.ts
  - lib/source.ts
  - lib/shell.ts
  - lib/ecosystem.ts
  - lib/ecosystem-llms-block.ts
  - lib/posthog-client.ts
  - lib/frontmatter.mjs
  - lib/links.ts
  - scripts/build-discovery.mjs
  - scripts/lib/playbook-discovery.mjs
  - scripts/discovery-metadata.json
  - scripts/build-bundle.mjs
  - scripts/build-raw-index.mjs
  - scripts/compute-stats.mjs
  - scripts/gen-stats-snapshot.mjs
  - scripts/add-okf-type.mjs
  - scripts/generate-doc-bridge-config.mjs
  - scripts/check-doc-bridge-score.mjs
  - scripts/verify-playbook-docs.mjs
  - .ak-harness/verification.json
  - examples/verify-playbook.mjs
  - ecosystem.json
  - next.config.ts
  - open-next.config.ts
  - wrangler.jsonc
  - vercel.json
  - vitest.config.ts
  - playwright.config.ts
  - content/docs/agentskit-chat.md
  - content/docs/discovery.mdx
  - README.md
  - ECOSYSTEM-COHESION.md
tags: [app, repo/agents-playbook, camada/ferramenta]
---

# agents-playbook-site

> [!tldr] Em linguagem comum
> É o manual na web (playbook.agentskit.io): pessoas leem os guias; agentes de IA baixam o mesmo texto em formatos simples (`/llms.txt`, `/raw/...`); e o botão "Ask Playbook" responde na hora, sem sair do navegador, às perguntas cuja resposta já está no manual, chamando o serviço externo de respostas só quando precisa interpretar.

← [[00 Hub - agents-playbook]]

## O que faz e por que existe

App raiz `agents-playbook` 0.1.0, `private: true` — não vai ao npm; o repositório é público (`package.json:2`, `package.json:4`). Next 15 + Fumadocs + MDX sobre o corpus `content/docs` (`lib/source.ts:4`). Responsabilidades:

1. **Site humano**: páginas `/docs/...` geradas do MDX, com JSON-LD, link "View raw .md" e "editar no GitHub" (`app/docs/[[...slug]]/page.tsx:30`, `app/docs/[[...slug]]/page.tsx:39`, `app/docs/[[...slug]]/page.tsx:75`).
2. **Superfícies para máquinas**: `/llms.txt`, `/llms-full.txt`, `/raw/<caminho>`, `/sitemap.xml`, `/api/stats.json`, `/deterministic/*.json` e o ZIP `playbook-bundle.zip` — ver [[Contrato de leitura para agentes]].
3. **Ask Playbook**: widget de conversa que primeiro consulta um [[Artefato de conhecimento determinístico]] verificado por hash e só depois o backend Ask (`components/ask-widget.tsx:206`, `lib/discovery.ts:37`).
4. **Artefatos derivados** no `prebuild`: estatísticas, conhecimento determinístico, ZIP e índice raw (`package.json:8`).

Limite de ownership declarado em `AGENTS.md:5` a `AGENTS.md:9`: o host configura corpus, endpoint, migração de storage, marca e slots; **estado, ciclo de vida, streaming, memória e cancelamento do chat pertencem a AgentsKit/AgentsKit Chat e não podem ser reimplementados aqui** (reforçado em `content/docs/agentskit-chat.md:35`).

## API e contratos

| Símbolo / rota | Tipo | Para que serve | Onde |
|---|---|---|---|
| `/docs/[[...slug]]` | página | Renderiza MDX do Fumadocs; `generateStaticParams` | `app/docs/[[...slug]]/page.tsx:30`, `app/docs/[[...slug]]/page.tsx:115` |
| `/for-agents` | página | Redireciona para `/docs/for-agents` | `app/for-agents/page.tsx:4` |
| `GET /raw/[...path]` | route handler | Devolve o `.md`/`.mdx`/`.mjs` original; tenta disco e cai no índice gerado | `app/raw/[...path]/route.ts:54` |
| `GET /llms.txt` | route handler | Mapa com título/descrição de cada doc + bloco do ecossistema | `app/llms.txt/route.ts:85` |
| `GET /llms-full.txt` | route handler | Corpus inteiro num arquivo, separado por `==== <url>` | `app/llms-full.txt/route.ts:25` |
| `GET /api/search` | route handler | Busca Fumadocs `createFromSource(source)` | `app/api/search/route.ts:4` |
| `GET /api/stats.json` | route handler | Contagens canônicas com CORS `*` para outros sites do ecossistema | `app/api/stats.json/route.ts:10` |
| `GET /api/ecosystem-stars` | route handler | Soma estrelas GitHub dos produtos do `ecosystem.json` | `app/api/ecosystem-stars/route.ts:27` |
| `sitemap()` | metadata route | Home, `/for-agents`, llms e cada doc | `app/sitemap.ts:31` |
| `AskWidget(props)` | componente | FAB + painel Ask; props `corpus`, `endpoint?`, textos, `accent`, `cta?` | `components/ask-widget.tsx:206` |
| `loadPlaybookDiscovery(fetchImpl?, base?)` | função | Busca `site-config.json` e `knowledge.json` com timeout 6,5 s; `null` em falha | `lib/discovery.ts:19` |
| `createPlaybookDiscoveryAdapter({ inputs, fallback, onDecision?, onBackendStart?, onBackendAnswer? })` | função | Monta o adapter determinístico com fallback de backend e repasse de sessão | `lib/discovery.ts:37` |
| `readDocSources()` | função | Lista `{ rel, body }` do corpus (disco ou índice gerado) | `lib/doc-sources.ts:13` |
| `ecosystemProducts`, `sharedNavProducts`, `ecosystemProduct(id)`, `ecosystemPeers(id)` | dados/funções | Leitura ordenada de `ecosystem.json` | `lib/ecosystem.ts:27`, `lib/ecosystem.ts:32`, `lib/ecosystem.ts:36`, `lib/ecosystem.ts:42` |
| `formatEcosystemLlmsBlock(options)` | função | Bloco "AgentsKit ecosystem" do `llms.txt` | `lib/ecosystem-llms-block.ts:27` |
| `initPostHog()`, `track(event, props?)`, `isPostHogConfigured(...)` | funções | Analytics opt-in | `lib/posthog-client.ts:11`, `lib/posthog-client.ts:29`, `lib/posthog-client.ts:7` |
| `parseFrontmatter(text)`, `frontmatterString(fm, key)` | funções | YAML de frontmatter compartilhado por rotas e scripts | `lib/frontmatter.mjs:5`, `lib/frontmatter.mjs:14` |
| `isNonPageHref(href)` | função | Evita prefetch RSC de arquivos (`.zip`, `.txt`, `/raw/`, `/api/`) | `lib/links.ts:7` |
| `createPlaybookDiscoveryArtifact(root)`, `createPlaybookSiteConfig(hash)` | funções (build) | Geram o artefato determinístico e a config do site | `scripts/lib/playbook-discovery.mjs:157`, `scripts/lib/playbook-discovery.mjs:177` |
| `computeStats()` | função (build) | Regras que definem as contagens públicas | `scripts/compute-stats.mjs:27` |

Exemplo real — composição do Ask no widget (`components/ask-widget.tsx:238` a `:259`):

```tsx
const fallback = createAskAdapter({ endpoint, corpus });
const answer = createPlaybookDiscoveryAdapter({
  inputs: discovery ?? null,
  fallback,
  onDecision: (decision) => {
    if (decision.outcome === "answer") setAnswerPath(decision.provenance.source);
    else if (decision.outcome === "escalation") setAnswerPath("pending");
    else setAnswerPath("local");
  },
  onBackendStart: () => setAnswerPath("pending"),
  onBackendAnswer: () => setAnswerPath("backend"),
});
return defineChat({
  id: `ask-${corpus}`,
  components: ASK_COMPONENTS,
  ...(answer.deterministic ? { choiceSubmission: answer.deterministic.resolveChoiceSubmission } : {}),
  chat: {
    adapter: answer.adapter,
    memory: createAskSessionMemory({ key: storageKey, legacyKeys: [`ak:ask-thread-v2:${corpus}`, `ak:ask-thread:${corpus}`] }),
  },
});
```

Uso no layout raiz com `corpus="playbook"` (`app/layout.tsx:119`).

## Quem usa e do que depende

| Relação | Nota / evidência |
|---|---|
| Chat, adapter Ask, memória de sessão, protocolo determinístico | [[chat]] e [[chat-protocol]] (`@agentskit/chat` 0.4.1 exato, `package.json:45`; imports em `components/ask-widget.tsx:19` a `:32` e `lib/discovery.ts:2` a `:7`) |
| Fluxo de resposta local e escalada (lado framework) | [[AgentsChat - Resposta local e escalada]] |
| Tipos e container de chat | [[agentskit-core]], [[agentskit-react]] (`package.json:46`, `package.json:47`; `components/ask-widget.tsx:17`, `components/ask-widget.tsx:18`) |
| Utilitários de caminho/processo nos scripts | [[agentskit-cross-platform]] (`scripts/lib/playbook-discovery.mjs:3`, `scripts/check-doc-bridge-score.mjs:3`) |
| Índice, gates e doctor de documentação (dev) | [[doc-bridge-indexacao]], [[doc-bridge-consulta-mcp]] (`package.json:36` a `:40`) |
| Contrato de verificação de docs (dev) | [[00 Hub - harness]] (`package.json:20`, `package.json:21`; `.ak-harness/verification.json:28`) |
| Backend Ask (rede, padrão) | serviço externo do ecossistema, endpoint padrão em `components/ask-widget.tsx:207`; hospedado em [[00 Hub - agentskit]] segundo o hub dele |
| Shell visual do ecossistema (rede, runtime) | script/CSS `shell/v1` servidos por `www.agentskit.io` (`lib/shell.ts:9`, `lib/shell.ts:10`) |
| Consumidores | visitantes, agentes de IA (rotas de máquina), outros sites do ecossistema (`/api/stats.json`, CORS `*`, `app/api/stats.json/route.ts:14`), e [[playbook]] (copia gates de `content/docs/scripts` no build) |
| Fluxos | [[Playbook - Do corpus à consulta]], [[Playbook - Da regra ao gate executável]] |

## Dados e efeitos

- **Lê**: `content/docs/**` (`lib/doc-sources.ts:10`); `ecosystem.json` (`lib/ecosystem.ts:1`); `app/stats.snapshot.json` (`app/api/stats.json/route.ts:1`); `public/deterministic/*.json` no navegador (`lib/discovery.ts:26`, `lib/discovery.ts:27`); `lib/raw-index.generated.json` quando não há sistema de arquivos (Workers) (`lib/doc-sources.ts:26`, `app/raw/[...path]/route.ts:36`).
- **Gera no build** (`package.json:8`): `app/stats.snapshot.json` (`scripts/gen-stats-snapshot.mjs:11`), `public/deterministic/knowledge.json` e `site-config.json` (`scripts/build-discovery.mjs:13`, `scripts/build-discovery.mjs:14`), `public/playbook-bundle.zip` (`scripts/build-bundle.mjs:16`, ignorado no git) e `lib/raw-index.generated.json` (`scripts/build-raw-index.mjs:10`, ignorado no git). Os dois primeiros são versionados e a CI exige que não mudem após o build (`.github/workflows/ci.yml:41`).
- **Navegador**: memória da conversa via `createAskSessionMemory` sob a chave `ak:ask-thread-v3:<corpus>`, migrando `v2` e v1 (`components/ask-widget.tsx:225`, `components/ask-widget.tsx:257`). O tipo de storage é decidido por `@agentskit/chat` (ver Dúvida abaixo). PostHog com cookie compartilhado entre subdomínios `*.agentskit.io` quando habilitado (`lib/posthog-client.ts:24`).
- **Variáveis de ambiente** (todas públicas, `NEXT_PUBLIC_*`):
  - `NEXT_PUBLIC_ASK_ENDPOINT` — endpoint do backend Ask; padrão do ecossistema (`components/ask-widget.tsx:207`).
  - `NEXT_PUBLIC_SITE_URL` — base de URLs canônicas em layout, docs, llms, robots e sitemap (`app/layout.tsx:28`, `app/sitemap.ts:7`).
  - `NEXT_PUBLIC_AGENTSKIT_SHELL_ORIGIN` — origem do shell visual (`lib/shell.ts:6`).
  - `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_ENABLED`, `NEXT_PUBLIC_POSTHOG_HOST` — analytics só liga com `ENABLED === "true"` e chave diferente do placeholder (`lib/posthog-client.ts:8`, `lib/posthog-client.ts:13` a `:17`).
- **Rede**: backend Ask (somente quando o artefato local não responde ou está indisponível); `api.github.com` em `/api/ecosystem-stars`, sem token, timeout 4 s (`app/api/ecosystem-stars/route.ts:11`, `app/api/ecosystem-stars/route.ts:15`); shell em `www.agentskit.io`; PostHog se habilitado.
- **Cabeçalhos**: HSTS via `next.config.ts:12` e `public/_headers:2`; `cache-control` público em `/raw` e `/llms*` (`app/raw/[...path]/route.ts:77`, `app/llms.txt/route.ts:115`).
- **Sem banco, sem segredos de servidor**: nenhum `process.env` fora de `NEXT_PUBLIC_*` no app (busca `git grep process.env`).

> [!question] Dúvida
> Onde `createAskSessionMemory` guarda a conversa (sessionStorage, localStorage, memória)? O código do host só passa `key`/`legacyKeys`; o v1 dizia "memória de sessão" sem evidência no repo. Confirmar em [[chat]].

## Como mexer (para agentes)

- **Antes de editar**, rode o roteamento do doc-bridge (`AGENTS.md:16` a `:18`): `pnpm docs:bridge:index` e `pnpm docs:bridge:query ownership playbook --agent`. O handoff retorna `editRoots: content/docs/index.mdx` e `checks: pnpm check:all` — ele cobre o corpus; **para código do app não há rota de ownership**, use esta nota.
- **Por onde começar**: Ask → `components/ask-widget.tsx` + `lib/discovery.ts`; rotas de máquina → `app/llms.txt/route.ts`, `app/raw/[...path]/route.ts`, `lib/doc-sources.ts`; artefato → `scripts/lib/playbook-discovery.mjs`; layout/shell → `app/layout.tsx`, `components/agentskit-shell.tsx`.
- **Invariantes**:
  - Não reimplementar reducer, laço de stream, store de mensagens, cancelamento ou matcher no host (`content/docs/agentskit-chat.md:35`).
  - Artefato inválido ou de outro site nunca vira contexto confiável: `decodeDeterministicSiteConfig` falho → adapter degradado só com backend (`lib/discovery.ts:63` a `:77`); `verifyLocalKnowledgeArtifactSync` checa `contentHash` e `siteId` (`lib/discovery.ts:78`).
  - "grounded · backend" só após stream com texto e sem erro (`lib/discovery.ts:58`; teste `lib/discovery.test.ts:57`).
  - A sessão do Chat é repassada ao backend na escalada (`lib/discovery.ts:82` a `:86`; teste `lib/discovery.test.ts:87`).
  - Artefato abaixo de `DETERMINISTIC_ARTIFACT_MAX_BYTES` (`scripts/lib/playbook-discovery.mjs:171`).
  - Rotas `/raw` funcionam sem sistema de arquivos (Workers) graças ao índice gerado (`app/raw/[...path]/route.ts:33`).
  - Contagens públicas só mudam pelas regras de `computeStats` (`scripts/compute-stats.mjs:5`).
- **Testes por parte**: Ask/discovery `lib/discovery.test.ts`, `scripts/lib/playbook-discovery.test.mjs`, `tests/e2e/playbook-chat.spec.ts`; rotas `app/llms.txt/route.test.ts`, `app/llms-full.txt/route.test.ts`, `app/api/search/route.test.ts`; ecossistema/shell `lib/ecosystem.test.ts`, `tests/playbook-shell.test.ts`, `tests/ecosystem-header.test.ts`, `tests/e2e/ecosystem-docs.spec.ts`; analytics `lib/posthog-client.test.ts`; onboarding `scripts/onboarding-proof.test.mjs`; visual `tests/visual-findings.test.ts`.
- **Validação**: `pnpm test && pnpm lint && pnpm build` (o build roda o `prebuild`); depois `git diff --exit-code -- app/stats.snapshot.json public/deterministic`; E2E `pnpm test:e2e` (Playwright sobe `next dev` na porta 3210, `playwright.config.ts:20`). Completo: `pnpm check:all` (`package.json:42`) — ver [[Playbook - Validar uma mudança]].
- **Armadilhas**:
  - Qualquer mudança em `content/docs` muda o `contentHash` do artefato; rode `pnpm build:discovery` e versione `public/deterministic/*` ou a CI falha (`.github/workflows/ci.yml:41`).
  - `generatedAt` do artefato vem de `scripts/discovery-metadata.json` (`scripts/lib/playbook-discovery.mjs:42`), não do relógio — o artefato é determinístico.
  - `/llms.txt` filtra `showInBar !== false` (`app/llms.txt/route.ts:71`) e o Playbook tem `showInBar: false` (`ecosystem.json:211`): o próprio Playbook não aparece no bloco do ecossistema.
  - `.brain/` (este vault) está na raiz e entra na projeção de recuperação do doc-bridge (`ak-docs search brain` retorna notas do vault); isso pode alterar métricas do `doctor`.
  - `pnpm check:doc-bridge-score` exige 100/100 A (`scripts/check-doc-bridge-score.mjs:14`), mas nesta checagem o `doctor` deu 79/100 B (conectividade 27% e benchmark ausente); a CI não roda esse script.

## Decisões e história

Sem ADRs no repo. Mudanças recentes (`git log --oneline -15` em `app components lib scripts public` e configs):

| Data | Commit | O quê |
|---|---|---|
| 2026-10-12 | `a10a150` | Padrão Doc Bridge adicionado ao pilar AI collaboration (#94) |
| 2026-10-03 | `c433073` | Parser de frontmatter YAML compartilhado (`lib/frontmatter.mjs`) (#86) |
| 2026-10-02 | `24b2324` | Deploy em Cloudflare Workers via OpenNext, Vercel mantido (#84) |
| 2026-09-27 | `55df31c` | Remove o fork `packages/harness`; passa a usar `@agentskit/harness` publicado (#81) |
| 2026-09-27 | `1871e40` | Scripts adotam `@agentskit/cross-platform` (#80) |
| 2026-09-26 | `8f00851` | Adota o shell AgentsKit v1 (#76) |
| 2026-09-19 | `e7e58da` | Remove referências públicas a AKOS (#73) |
| 2026-08-30 | `a59fb5b` | Harness de verificação documental (#55) |
| 2026-07-14 | `6bad9a5` | Docs padronizadas e descoberta local (#17) |
| 2026-07-13 | `ed00558` | Ask migrado para AgentsKit Chat (#12) |

> [!info]- Detalhe técnico
> - Busca com fallback: `loadPlaybookDiscovery` só é chamado em hover/foco/clique do FAB (`components/ask-widget.tsx:279`), com reintento após `DISCOVERY_RETRY_DELAY_MS` (`components/ask-widget.tsx:35`, `components/ask-widget.tsx:228`).
> - Provedor declarado ao backend: `backend: { provider: 'ask-playbook' }` (`lib/discovery.ts:93`); modo de fallback vem da config `fallback.mode` = `backend` (`scripts/lib/playbook-discovery.mjs:182`).
> - Entradas do artefato: uma por arquivo do corpus (`pageEntry`, `scripts/lib/playbook-discovery.mjs:49`) + 9 entradas fixas de comando/ecossistema (`scripts/lib/playbook-discovery.mjs:94`).
> - Rótulos de proveniência: `components/ask-widget.tsx:313`.
> - ZIP sem dependência (PKZIP manual com `deflateRawSync`): `scripts/build-bundle.mjs:105`; inclui `README.md`, `CONTRIBUTING.md`, `LICENSE` (`scripts/build-bundle.mjs:17`).
> - OKF: `typeFor` deriva `type:` pelo caminho (`scripts/add-okf-type.mjs:21`).
> - Config doc-bridge gerada: ids de ownership por basename único ou rota com `--` (`scripts/generate-doc-bridge-config.mjs:54`); rotas de infraestrutura fixas (`scripts/generate-doc-bridge-config.mjs:29`).
> - Shell: `AgentsKitShellScript` (`components/agentskit-shell.tsx:22`), rodapé com fallback estático (`components/agentskit-shell.tsx:44`).
> - Vercel usa `pnpm@9.15.4` e `--no-frozen-lockfile` (`vercel.json:15`, `vercel.json:16`), enquanto `packageManager` é `pnpm@10.34.4` (`package.json:75`).

> [!bug] Existe, mas ninguém usa
> - `GET /api/ecosystem-stars` não tem chamador neste repo (nenhuma referência fora da própria rota); pode ser consumida pelo shell remoto — não verificado. Ver [[Capacidades não usadas]].
> - `examples/verify-playbook.mjs` só é citado no README (`README.md:64`); nenhum script ou CI o executa.
> - `pnpm harness:verify` (`package.json:21`) e `pnpm docs:bridge:conformance` local não estão em `check:all`; a conformance roda só na CI (`.github/workflows/ci.yml:35`).
