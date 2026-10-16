---
tipo: global
repo: agents-playbook
verificado-em: 2026-10-16
commits:
  agents-playbook: 11f6585
metodo: "material bruto extraído das notas v2 de agents-playbook; análise estática + doc-bridge 1.12.0 e testes executados localmente"
fontes:
  - packages/playbook/bin/agents-playbook.mjs
  - packages/playbook/gate-manifest.json
  - scripts/sync-playbook-package.mjs
  - scripts/run-pre-commit-hook.mjs
  - scripts/lib/playbook-discovery.mjs
  - lib/discovery.ts
  - components/ask-widget.tsx
  - app/llms.txt/route.ts
  - app/llms-full.txt/route.ts
  - app/raw/[...path]/route.ts
  - app/api/stats.json/route.ts
  - app/api/ecosystem-stars/route.ts
  - scripts/compute-stats.mjs
  - scripts/add-okf-type.mjs
  - package.json
  - wrangler.jsonc
  - vercel.json
  - .github/workflows/ci.yml
  - .github/workflows/doc-bridge-advisory.yml
  - .github/workflows/dependency-review.yml
  - README.md
  - ECOSYSTEM-COHESION.md
  - CONTRIBUTING.md
  - lib/ecosystem-llms-block.ts
  - lib/shell.ts
tags: [global, repo/agents-playbook]
---

# Candidatos globais - agents-playbook

Material bruto para as notas globais. Não é nota final.

## Conceitos

- **Gate de qualidade** → Script Node sem dependências que verifica uma regra estrutural (tamanho de arquivo, `any`, segredos, export default…) e sai com código ≠ 0 e mensagem acionável quando a regra é violada. No Playbook, cada gate tem versão canônica no corpus e cópia empacotada no npm; configuração por `.quality-gates.json`. → [[playbook]], [[Playbook - Da regra ao gate executável]], [[Playbook - Adicionar ou alterar um gate]] → `packages/playbook/gate-manifest.json:2`, `packages/playbook/bin/agents-playbook.mjs:96`, `content/docs/scripts/check-quality-gates.example.mjs:24`.
- **Subconjunto fast** → Gates marcados `fast: true` (`file-size`, `error-raw`, `secrets`) pensados para pre-commit/pre-push; `--fast` só se aplica quando nenhum gate é nomeado. → [[playbook]] → `packages/playbook/gate-manifest.json:2`, `packages/playbook/bin/agents-playbook.mjs:115`.
- **Baseline shrink-only** → Arquivo que "anistia" infratores existentes de um gate; eles não podem crescer e arquivos novos respeitam o orçamento. Regerado só explicitamente (`--baseline`). → [[playbook]] → `packages/playbook/gates/check-file-size.mjs:11`, `packages/playbook/gates/check-file-size.mjs:89`.
- **Artefato de conhecimento determinístico** → JSON com entradas de correspondência exata (aliases → resposta markdown + citações), identificado por `siteId` e endereçado por hash SHA-256 de conteúdo, verificado no navegador antes de responder sem rede. Protocolo do [[chat-protocol]]; também usado por Registry/Docs segundo o hub de agentskit-chat. → [[agents-playbook-site]], [[Playbook - Do corpus à consulta]] → `scripts/lib/playbook-discovery.mjs:157`, `lib/discovery.ts:78`.
- **Resposta local-first com escalada** → Perguntas exatas são respondidas do artefato; ambíguas viram escolhas; o resto escala para o backend com o contexto da falha e o `sessionId`. A proveniência (local/backend) é exibida e só vira "grounded" após stream completo sem erro. → [[Playbook - Do corpus à consulta]] → `lib/discovery.ts:58`, `lib/discovery.ts:83`, `components/ask-widget.tsx:313`. Relacionado: [[AgentsChat - Resposta local e escalada]].
- **Contrato de leitura para agentes** → Conjunto de rotas estáveis para LLMs: `/llms.txt` (mapa curto), `/llms-full.txt` (corpus em um arquivo), `/raw/<path>.md` (fonte de cada página), `/for-agents`, `/deterministic/*.json`, ZIP. → [[agents-playbook-site]] → `app/llms.txt/route.ts:85`, `app/llms-full.txt/route.ts:25`, `app/raw/[...path]/route.ts:54`, `ECOSYSTEM-COHESION.md:37` a `:41`.
- **Provider pre-commit** → Repositório que publica `.pre-commit-hooks.yaml` para que outros repos usem o hook via `rev:`; aqui o hook roda os gates num snapshot do índice staged. → [[playbook]] → `.pre-commit-hooks.yaml:1`, `scripts/run-pre-commit-hook.mjs:31`.
- **OKF (Open Knowledge Format)** → Exigência de um campo `type` no frontmatter de todo documento; o repo deriva o tipo pelo caminho. → [[agents-playbook-site]] → `scripts/add-okf-type.mjs:21`.
- **Contagens canônicas** → Números públicos (pilares, padrões, gates, fases, templates) definidos por regras em código e servidos por `/api/stats.json` para os outros sites; proibido escrever número à mão. → [[agents-playbook-site]] → `scripts/compute-stats.mjs:27`, `app/api/stats.json/route.ts:10`.

## Glossário

- **Pilar** — eixo temático do corpus (AI collaboration, architecture, governance, quality, security, UI/UX); 6 (`app/stats.snapshot.json:5`).
- **Fase SDLC** — `content/docs/phases/NN-*` (discover, design, build, test, ship, operate); 6.
- **Tombstone** — marca de padrão aposentado, mantido para rastro (`CONTRIBUTING.md:66`).
- **PR intent** — manifesto `pr-intent.yaml` com `summary`, `pillar`, `phase`, `sub-unit`, `type`, conferido contra o diff (`packages/playbook/gates/check-pr-intent.mjs:33`).
- **Ask Playbook** — widget de perguntas do site, `corpus="playbook"` (`app/layout.tsx:119`).
- **README Standard v1** — contrato de README com hashes de frescor (`readme-standard-v1.json`, `scripts/check-readme-standard.mjs:7`).

## Arestas de dependência

- `agents-playbook --> agentskit-chat : @agentskit/chat 0.4.1 exato (Ask, protocolo determinístico, memória) : package.json:45`
- `agents-playbook --> agentskit : @agentskit/core ^1.12.9 e @agentskit/react ^0.7.6 no Ask : package.json:46`
- `agents-playbook --> agentskit : @agentskit/cross-platform (dev) nos scripts : package.json:59`
- `agents-playbook --> doc-bridge : @agentskit/doc-bridge ^1.12.0 (dev) — ak-docs index/query/gate/doctor/conformance : package.json:60`
- `agents-playbook --> doc-bridge : Action AgentsKit-io/doc-bridge 2.0.0 em PR (advisory, comenta) : .github/workflows/doc-bridge-advisory.yml:20`
- `agents-playbook --> harness : @agentskit/harness ^0.22.3 (dev) — ak-harness doctor / ak-verify : package.json:61`
- `agents-playbook --> .github : workflows reutilizáveis codeql/scorecard/dependency-review/audit @ e921ea2 : .github/workflows/dependency-review.yml:45`
- `agents-playbook --> agentskit (rede) : backend Ask padrão via NEXT_PUBLIC_ASK_ENDPOINT : components/ask-widget.tsx:207`
- `agents-playbook --> agentskit (rede) : shell visual v1 (script/CSS) de www.agentskit.io : lib/shell.ts:9`
- `ecossistema --> agents-playbook (rede) : consome /api/stats.json (CORS *) : app/api/stats.json/route.ts:14`
- `projetos externos --> agents-playbook : npx @agentskit/playbook e hook pre-commit : packages/playbook/README.md:6, .pre-commit-hooks.yaml:1`

## Infra e deploy

- Cloudflare Workers via OpenNext: Worker `agents-playbook`, `nodejs_compat` + `global_fetch_strictly_public`, assets binding `ASSETS`, observabilidade, `cpu_ms: 5000` (`wrangler.jsonc:5`, `wrangler.jsonc:8`, `wrangler.jsonc:11`, `wrangler.jsonc:13`, `wrangler.jsonc:15`); cache incremental em assets estáticos, sem KV (`open-next.config.ts:8`). Comando `pnpm cf:deploy` (`package.json:16`).
- Vercel: deploy por git em `main/master/staging/qa/dev/develop`; build com pnpm 9.15.4 e `--no-frozen-lockfile` (`vercel.json:4`, `vercel.json:15`, `vercel.json:16`).
- npm: `@agentskit/playbook` público, `prepack` = sync `--check` (`packages/playbook/package.json:19`, `packages/playbook/package.json:41`). Sem workflow de publish.
- CI: `ubuntu-latest` (quality, browser) + matriz ubuntu/macos/windows (playbook-package) (`.github/workflows/ci.yml:65`); `pnpm audit` crítico só produção (`.github/workflows/dependency-review.yml:56`, `.github/workflows/dependency-review.yml:57`).

## Dados

- Sem banco nem segredo de servidor. Variáveis só públicas: `NEXT_PUBLIC_ASK_ENDPOINT`, `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_AGENTSKIT_SHELL_ORIGIN`, `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_ENABLED`, `NEXT_PUBLIC_POSTHOG_HOST`.
- Navegador: conversa do Ask sob `ak:ask-thread-v3:playbook` (storage decidido pelo Chat); cookie PostHog cross-subdomain `*.agentskit.io` se habilitado (`lib/posthog-client.ts:24`).

## Dúvidas abertas

- Qual destino serve `playbook.agentskit.io` hoje: Workers ou Vercel?
- Quem publica `@agentskit/playbook` e com que credencial (não há workflow)? A 0.1.1 já está no npm?
- O provider pre-commit continuará fixado em `@agentskit/playbook@0.1.0` (`scripts/run-pre-commit-hook.mjs:39`) após a 0.1.1?
- Onde `createAskSessionMemory` persiste a conversa (sessionStorage/localStorage)?
- `/api/ecosystem-stars` é consumido pelo shell remoto `shell/v1.js`? Nenhum chamador no repo.
- Doc Bridge: README anuncia 100/100 A, doctor local dá 79/100 B; a CI deveria rodar `check:doc-bridge-score`? O `.brain/` deveria ser excluído da projeção?
- `lib/ecosystem-llms-block.ts:3` cita `scripts/lib/ecosystem-llms-block.mjs`, inexistente — está em outro repo?
- `ECOSYSTEM-COHESION.md` (sete produtos, tabela com seis, `ecosystem-bar.js`) está defasado em relação a `lib/shell.ts`?
- Hub global de skills fala de "skills públicas de agents-playbook"; o repo não tem skills.

## Capacidades não usadas

- `GET /api/ecosystem-stars` sem chamador no repo (`app/api/ecosystem-stars/route.ts:27`).
- `agents-playbook completion <shell>` só testado (`packages/playbook/bin/agents-playbook.mjs:203`).
- `examples/verify-playbook.mjs` só citado no README (`README.md:64`).
- `pnpm harness:verify` fora de `check:all` e da CI (`package.json:21`).
- MCP `ak-docs mcp` documentado em `AGENTS.md:21`, sem configuração versionada no repo.
