---
tipo: guia
repo: agents-playbook
camada: ferramenta
visibilidade: publico
verificado-em: 2026-10-16
commits:
  agents-playbook: 11f6585
metodo: "comparação das notas v1 (commit ea29444) com o código em 11f6585; doc-bridge 1.12.0 e `pnpm test`/`test:playbook-package`/`check:playbook-package`/`check:doc-bridge-score` executados localmente"
fontes:
  - README.md
  - package.json
  - vercel.json
  - ECOSYSTEM-COHESION.md
  - CONTRIBUTING.md
  - lib/shell.ts
  - lib/ecosystem-llms-block.ts
  - components/ask-widget.tsx
  - scripts/check-doc-bridge-score.mjs
  - scripts/run-pre-commit-hook.mjs
  - packages/playbook/package.json
  - .github/workflows/ci.yml
tags: [guia, repo/agents-playbook, camada/ferramenta]
---

# Auditoria - agents-playbook

> [!tldr] Em linguagem comum
> O que estava errado ou impreciso nas notas antigas deste repo, e as divergências entre o que o repo diz sobre si e o que o código mostra.

← [[00 Hub - agents-playbook]]

## Erros e imprecisões nas notas v1

| # | Nota v1 | Problema | Correção v2 |
|---|---|---|---|
| 1 | Todas | `camada: docs` não existe no schema v2 (framework, plataforma, produto, ferramenta, infra); o [[00 Hub - Ecossistema AgentsKit]] também lista "docs" na tabela, mas desenha o repo em "Ferramentas" | `camada: ferramenta`, tag `camada/ferramenta` |
| 2 | Todas | Referências com prefixo `agents-playbook/` e `commits` em `ea29444`; v2 usa caminhos relativos ao repo | Caminhos relativos, commit `11f6585` (código idêntico a `ea29444` fora de `.brain/`) |
| 3 | Todas | Hub do repo sem link de volta para a camada; pacote e app sem seções API/Dados/Como mexer | Reescritas no corpo v2 |
| 4 | [[Playbook - Do corpus à consulta]] | "Ao abrir Ask, carregar site-config e knowledge": a carga começa já no hover ou foco do botão, não só ao abrir | `components/ask-widget.tsx:279` |
| 5 | [[agents-playbook-site]] e hub v1 | "Memória de sessão" afirmada sem evidência no repo — o host só passa `key`/`legacyKeys` a `createAskSessionMemory` | Mantido como Dúvida (`components/ask-widget.tsx:257`) |
| 6 | [[playbook]] v1 | Não registrava que o hook pre-commit fixa a versão publicada 0.1.0 enquanto o pacote é 0.1.1 | `scripts/run-pre-commit-hook.mjs:39`, `packages/playbook/package.json:3` |
| 7 | Hub v1 | "Doc Bridge: dependência de desenvolvimento para ownership e gates" correto, mas omitia que o ownership cobre só documentos (nenhuma rota para app/pacote) | `scripts/generate-doc-bridge-config.mjs:29` |

O resto do conteúdo v1 (12 gates, `--baseline` como opção que escreve, hash/siteId no Ask, Worker com 5 s de CPU, matriz de 3 SOs na CI, ausência de backend Ask e de workflow de publicação) foi confirmado e mantido.

## Divergências do próprio repo (não são erros do vault)

- **Doc Bridge 100/100 A**: `README.md:16` e `ECOSYSTEM-COHESION.md:41` exigem/anunciam A; `ak-docs doctor --text` em 11f6585 deu **79/100 B** (conectividade 27% < 80%, benchmark ausente) e `pnpm check:doc-bridge-score` falhou (`scripts/check-doc-bridge-score.mjs:14`). A CI não roda esse script (`.github/workflows/ci.yml:29` a `:41`). O vault `.brain/` local entra na projeção do doctor, mas o critério de benchmark independe dele.
- **pnpm**: README pede 9 (`README.md:45`), `packageManager` é 10.34.4 (`package.json:75`), Vercel usa 9.15.4 sem lockfile congelado (`vercel.json:15`, `vercel.json:16`).
- **Sete produtos**: `ECOSYSTEM-COHESION.md:3` diz sete, a tabela tem seis (sem Harness); o arquivo cita `ecosystem-bar.js` (`ECOSYSTEM-COHESION.md:26`) enquanto o código usa `shell/v1.js` (`lib/shell.ts:9`).
- **Arquivo inexistente citado**: `lib/ecosystem-llms-block.ts:3` manda manter sincronia com `scripts/lib/ecosystem-llms-block.mjs`, que não existe no repo.
- **Prompt inexistente**: `CONTRIBUTING.md:71` cita `prompts/code-review.md`; o corpus tem `content/docs/prompts/subagent-code-reviewer.md` e `system-reviewer.md`.
- **Hub skills (global)**: o hub [[00 Hub - skills]] fala em "skills públicas de agents-playbook"; este repo não tem skills, só prompts e slash commands documentados em `content/docs/prompts/`.

Tudo isso também está em `_candidatos/agents-playbook.md` para [[Dúvidas abertas]].
