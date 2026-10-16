---
tipo: fluxo
repo: agents-playbook
camada: ferramenta
visibilidade: publico
verificado-em: 2026-10-16
commits:
  agents-playbook: 11f6585
metodo: "análise estática em 11f6585; executados localmente `pnpm check:playbook-package` (ok) e `pnpm test:playbook-package` (15/15 ok); `test:pre-commit-hook` não executado (requer pre-commit)"
fontes:
  - content/docs/scripts/index.md
  - content/docs/scripts/check-quality-gates.example.mjs
  - packages/playbook/gate-manifest.json
  - packages/playbook/package.json
  - packages/playbook/bin/agents-playbook.mjs
  - scripts/sync-playbook-package.mjs
  - scripts/run-pre-commit-hook.mjs
  - scripts/test-pre-commit-hook.mjs
  - scripts/onboarding-proof.test.mjs
  - scripts/compute-stats.mjs
  - .pre-commit-hooks.yaml
  - .github/workflows/ci.yml
  - CONTRIBUTING.md
tags: [fluxo, repo/agents-playbook, camada/ferramenta]
---

# Playbook - Da regra ao gate executável

> [!tldr] Em linguagem comum
> Cada regra do manual que pode ser checada por máquina tem um script de referência publicado junto do texto. O pacote npm leva exatamente esse script para outros projetos — no terminal, na CI ou antes de cada commit — e a CI deste repo garante que a cópia empacotada nunca se afaste do original.

← [[00 Hub - agents-playbook]]

## Entrada e resultado

- **Entrada**: uma regra em `content/docs/pillars/**` que declara um gate (a seção `### Gate` é obrigatória pelo formato de contribuição, `CONTRIBUTING.md:48`) e o script `content/docs/scripts/check-<nome>.example.mjs`.
- **Resultado**: `@agentskit/playbook` com `gates/check-<nome>.mjs` idêntico, executável por `npx @agentskit/playbook run <nome>` ou pelo hook pre-commit `agentskit-playbook`; saída `PASS/FAIL <gate> <ms>` e código 0/1.

| Etapa | O que acontece | Evidência |
|---|---|---|
| 1. Script canônico | Vive no corpus e é servido em `/raw/scripts/<arquivo>.mjs`; 13 `.mjs` (12 gates + orquestrador) | `scripts/onboarding-proof.test.mjs:29`, `scripts/compute-stats.mjs:38` |
| 2. Catálogo | `gate-manifest.json` lista nome, `fast` e descrição | `packages/playbook/gate-manifest.json:1` |
| 3. Sync | `pnpm sync:playbook-package` copia cada script para `gates/`; aborta se manifesto ≠ scripts | `scripts/sync-playbook-package.mjs:22`, `scripts/sync-playbook-package.mjs:46` |
| 4. Check | `--check` compara byte a byte e manda rodar o sync se defasado | `scripts/sync-playbook-package.mjs:35` a `:44` |
| 5. Empacotar | `prepack` repete o check; `files` limita o tarball | `packages/playbook/package.json:10`, `packages/playbook/package.json:19` |
| 6. Executar | CLI lê `.quality-gates.json`, escolhe gates (nomes, `--fast`, `enabled`) e roda cada um num processo Node em paralelo | `packages/playbook/bin/agents-playbook.mjs:136` a `:168` |
| 7. Agregar | Imprime PASS/FAIL e saídas; código 1 se algum falhou | `packages/playbook/bin/agents-playbook.mjs:173` a `:182` |
| 8. Pre-commit | Snapshot do índice staged em diretório temporário → `npx @agentskit/playbook@0.1.0 run --fast --cwd <snapshot>` → limpeza | `.pre-commit-hooks.yaml:4`, `scripts/run-pre-commit-hook.mjs:31`, `scripts/run-pre-commit-hook.mjs:39` |
| 9. CI | Job `playbook-package` em Ubuntu/macOS/Windows: sync check, testes da CLI, teste do hook, `npm pack --dry-run` | `.github/workflows/ci.yml:59` a `:81` |

## Erros e recuperação

- **Gate defasado**: `Package gate is stale ... Run: pnpm sync:playbook-package` (`scripts/sync-playbook-package.mjs:42`).
- **Nome de gate desconhecido**: erro de uso, código 2, sugere `agents-playbook list` (`packages/playbook/bin/agents-playbook.mjs:111`).
- **`.quality-gates.json` inválido**: erro de uso com o caminho (`packages/playbook/bin/agents-playbook.mjs:102`).
- **Arquivos não staged/untracked** não bloqueiam o commit, porque o hook roda no snapshot do índice (`scripts/test-pre-commit-hook.mjs:87` a `:112`).
- **Falha ao criar o snapshot**: diretório temporário é removido mesmo assim (`scripts/test-pre-commit-hook.mjs:120` a `:134`).

## Quem atua aqui

| Peça | Papel |
|---|---|
| [[agents-playbook-site]] | Mantém regra, script canônico e página `/docs/scripts` |
| [[playbook]] | Distribui e executa os gates |
| [[Gate de qualidade]] | Conceito central do fluxo |
| [[Playbook - Adicionar ou alterar um gate]] | Guia passo a passo deste fluxo |

> [!info]- Detalhe técnico
> - O orquestrador de referência (`content/docs/scripts/check-quality-gates.example.mjs:24`) duplica a lista de gates e roda com `spawnSync` sequencial dentro de `Promise.all` (`content/docs/scripts/check-quality-gates.example.mjs:53`, `content/docs/scripts/check-quality-gates.example.mjs:101`); a CLI usa `spawn` assíncrono de verdade (`packages/playbook/bin/agents-playbook.mjs:122`). Ao adicionar gate, a lista do orquestrador também precisa ser atualizada à mão — nada a sincroniza.
> - O sync exclui o orquestrador pelo nome `quality-gates` (`scripts/sync-playbook-package.mjs:15`).
> - O hook usa `resolveNpxCommand` para achar `npx-cli.js` no Windows (`scripts/run-pre-commit-hook.mjs:9`).
