---
tipo: guia
repo: agents-playbook
camada: ferramenta
visibilidade: publico
verificado-em: 2026-10-16
commits:
  agents-playbook: 11f6585
metodo: "derivado de scripts/sync-playbook-package.mjs, testes e ci.yml em 11f6585; `pnpm check:playbook-package` e `pnpm test:playbook-package` executados localmente (ok)"
fontes:
  - content/docs/scripts/index.md
  - content/docs/scripts/check-quality-gates.example.mjs
  - packages/playbook/gate-manifest.json
  - packages/playbook/package.json
  - packages/playbook/test/cli.test.mjs
  - scripts/sync-playbook-package.mjs
  - scripts/onboarding-proof.test.mjs
  - scripts/compute-stats.mjs
  - scripts/run-pre-commit-hook.mjs
  - package.json
  - README.md
  - CONTRIBUTING.md
tags: [guia, repo/agents-playbook, camada/ferramenta]
---

# Playbook - Adicionar ou alterar um gate

> [!tldr] Em linguagem comum
> Como criar ou corrigir uma verificação automática do manual de forma que ela apareça ao mesmo tempo no site e no pacote npm, sem as duas cópias se separarem.

← [[00 Hub - agents-playbook]]

## Quando usar

Ao corrigir o comportamento de um gate existente ou ao criar um novo [[Gate de qualidade]].

## Pré-requisitos

- Ler [[Playbook - Da regra ao gate executável]] e `content/docs/scripts/index.md`.
- O script tem de ser Node 22 puro, sem dependências (o pacote não declara nenhuma, `packages/playbook/package.json:10` a `:16`).

## Passos

1. **Editar só o canônico**: `content/docs/scripts/check-<nome>.example.mjs`. Nunca edite `packages/playbook/gates/` direto.
2. **Gate novo**:
   - Acrescente `{ "name", "fast", "description" }` em `packages/playbook/gate-manifest.json`.
   - Acrescente a linha na lista `GATES` do orquestrador de referência (`content/docs/scripts/check-quality-gates.example.mjs:24`) — não há sincronização automática dela.
   - Documente na tabela de `content/docs/scripts/index.md` e na seção `### Gate` do padrão correspondente (`CONTRIBUTING.md:48`).
   - Atualize as contagens fixas nos testes: 12 gates em `packages/playbook/test/cli.test.mjs:31` e 13 scripts em `scripts/onboarding-proof.test.mjs:29`.
3. **Sincronizar**:
   ```bash
   pnpm sync:playbook-package
   ```
4. **Regenerar derivados** (o número de scripts entra nas estatísticas, `scripts/compute-stats.mjs:38`, e o corpus muda o artefato do Ask):
   ```bash
   pnpm gen:stats
   pnpm build:discovery
   pnpm docs:bridge:config
   pnpm readme:standard:refresh   # se o README mudar
   ```
   A tabela "What is verified" do README cita contagens (`README.md:36`) — confira contra `app/stats.snapshot.json`.
5. **Testar**: acrescente um caso em `packages/playbook/test/cli.test.mjs` (padrão: `fixture()` + `execute(process.execPath, [cli, 'run', '<gate>', '--cwd', root])`).
6. **Versão**: se for publicar, suba `packages/playbook/package.json` e o teste de versão (`packages/playbook/test/cli.test.mjs:25`). Decida se o provider pre-commit continua em `@agentskit/playbook@0.1.0` (`scripts/run-pre-commit-hook.mjs:39`).

## Como validar

```bash
pnpm check:playbook-package
pnpm test:playbook-package
pnpm test
pnpm test:pre-commit-hook
(cd packages/playbook && npm pack --dry-run)
git diff --exit-code -- app/stats.snapshot.json public/deterministic
```

## Erros comuns

- `Gate manifest does not match canonical scripts` — manifesto e `content/docs/scripts` divergem (`scripts/sync-playbook-package.mjs:23`).
- `Packaged gate set does not match the manifest` — falta rodar o sync (`scripts/sync-playbook-package.mjs:27`).
- `Package gate is stale` — gate empacotado diferente do canônico (`scripts/sync-playbook-package.mjs:42`).
- Teste de onboarding falha com contagem ≠ 13 — atualize `scripts/onboarding-proof.test.mjs:29`.

## Notas relacionadas

[[playbook]] · [[agents-playbook-site]] · [[Playbook - Validar uma mudança]]
