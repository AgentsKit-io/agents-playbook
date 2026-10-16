---
tipo: guia
repo: agents-playbook
camada: ferramenta
visibilidade: publico
verificado-em: 2026-10-16
commits:
  agents-playbook: 11f6585
metodo: "derivado de AGENTS.md, package.json, README e ci.yml em 11f6585; executados localmente `pnpm install --frozen-lockfile`, `pnpm test`, `pnpm test:playbook-package`, `pnpm check:playbook-package`, `ak-docs index`, `ak-docs gate run` (ok) e `pnpm check:doc-bridge-score` (falhou: 79/100 B)"
fontes:
  - AGENTS.md
  - package.json
  - README.md
  - .github/workflows/ci.yml
  - .github/workflows/doc-bridge-advisory.yml
  - scripts/check-doc-bridge-score.mjs
  - .ak-harness/verification.json
  - vitest.config.ts
  - playwright.config.ts
tags: [guia, repo/agents-playbook, camada/ferramenta]
---

# Playbook - Validar uma mudança

> [!tldr] Em linguagem comum
> A lista de comandos que um agente ou pessoa roda antes de abrir um PR no agents-playbook, na mesma ordem em que a CI vai conferir.

← [[00 Hub - agents-playbook]]

## Quando usar

Antes de qualquer PR neste repo — corpus, app, scripts ou pacote. O handoff do doc-bridge para o repo declara `pnpm check:all` como verificação (`ak-docs query ownership playbook --agent`).

## Pré-requisitos

- Node 22 (`package.json:77`) e pnpm 10.34.4 (`package.json:75`). O README ainda diz "pnpm 9" (`README.md:45`); use a versão do `packageManager`.
- Para o teste do hook: `pre-commit` 4.4+ (a CI instala 4.6.1, `.github/workflows/ci.yml:76`).
- Para E2E: `pnpm exec playwright install --with-deps chromium` (`.github/workflows/ci.yml:56`).

## Passos

1. Instalar e rotear a mudança (`AGENTS.md:16` a `:18`):
   ```bash
   pnpm install --frozen-lockfile
   pnpm docs:bridge:index
   pnpm docs:bridge:query ownership playbook --agent
   ```
2. Reproduzir o job `quality` da CI (`.github/workflows/ci.yml:29` a `:41`):
   ```bash
   pnpm check:okf-type
   pnpm check:doc-bridge-config
   pnpm docs:bridge:index
   git diff --exit-code -- doc-bridge.config.json .doc-bridge
   pnpm docs:bridge:gate
   pnpm docs:bridge:conformance
   pnpm check:readme-standard
   pnpm test
   pnpm lint
   pnpm build
   test -s public/playbook-bundle.zip
   git diff --exit-code -- app/stats.snapshot.json public/deterministic
   ```
3. Se tocou em `packages/playbook`, `content/docs/scripts` ou no hook, reproduzir o job `playbook-package` (`.github/workflows/ci.yml:77` a `:81`):
   ```bash
   pnpm check:playbook-package
   pnpm test:playbook-package
   pnpm test:pre-commit-hook
   (cd packages/playbook && npm pack --dry-run)
   ```
4. Se tocou em UI, rodar o job `browser`: `pnpm test:e2e` (`.github/workflows/ci.yml:57`).
5. Opcional, contrato do Harness: `pnpm harness:doctor` e `pnpm harness:verify` (`package.json:20`, `package.json:21`), que executam `node scripts/verify-playbook-docs.mjs` (`.ak-harness/verification.json:28`).

Atalho que encadeia quase tudo: `pnpm check:all` (`package.json:42`).

## Como validar

- Saídas esperadas: `pnpm test` → 13 arquivos / 34 testes; `pnpm test:playbook-package` → 15 testes (medido em 11f6585).
- Os dois `git diff --exit-code` não podem mostrar nada: artefatos gerados precisam estar commitados.
- No PR, o workflow `Documentation advisory` comenta impacto documental sem bloquear (`.github/workflows/doc-bridge-advisory.yml:24`, `.github/workflows/doc-bridge-advisory.yml:25`).

## Erros comuns

- **`pnpm check:all` falha em `check:doc-bridge-score`**: o script exige 100/100 A (`scripts/check-doc-bridge-score.mjs:14`); em 11f6585, com doc-bridge 1.12.0, `ak-docs doctor --text` dá 79/100 B (conectividade 27% < 80% e sem suíte de benchmark). A CI não roda esse passo, então o PR pode passar mesmo assim. O vault `.brain/` na raiz também entra na projeção do doctor.
- **`git diff` em `public/deterministic`**: rode `pnpm build:discovery` (ou `pnpm build`) e commite.
- **`doc-bridge.config.json` desatualizado**: `pnpm docs:bridge:config`.
- **Vitest pegando testes da CLI**: não acontece; `packages/playbook/test/**` e `tests/e2e/**` são excluídos (`vitest.config.ts:11`).
- **Porta do E2E ocupada**: Playwright usa 3210 (`playwright.config.ts:21`).

## Notas relacionadas

[[agents-playbook-site]] · [[playbook]] · [[Playbook - Adicionar um padrão ao corpus]] · [[Playbook - Adicionar ou alterar um gate]] · [[doc-bridge-consulta-mcp]]
