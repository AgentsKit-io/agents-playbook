---
tipo: pacote
repo: "agents-playbook"
camada: docs
visibilidade: publico
verificado-em: 2026-10-16
commits:
  "agents-playbook": ea29444
metodo: análise estática; nada foi executado
fontes:
  - "agents-playbook/packages/playbook/package.json"
  - "agents-playbook/packages/playbook/bin/agents-playbook.mjs"
  - "agents-playbook/packages/playbook/gate-manifest.json"
  - "agents-playbook/scripts/sync-playbook-package.mjs"
npm: "@agentskit/playbook"
tags: [repo/agents-playbook, pacote]
---

# playbook

> [!tldr] Em linguagem comum
> É a caixa de ferramentas do manual: roda verificações de qualidade em qualquer projeto sem instalar uma cadeia de dependências.

← [[00 Hub - agents-playbook]]

## Papel e contratos

Único pacote publicável do workspace, `@agentskit/playbook` 0.1.1. Os scripts canônicos vivem no corpus e são sincronizados para o pacote.

| Pergunta | Resposta |
|---|---|
| O que entrega | CLI `agents-playbook`/`ak-playbook`: list, run, explain e completion. 12 gates: file-size, named-exports, no-any, error-raw, tokens, native-html, intl, secrets, completeness, adr, rfc e pr-intent. |
| Quem usa | Engenheiros e CI de projetos consumidores; [[agents-playbook-site]] explica as regras. |
| Do que depende | Somente módulos nativos Node ≥22; lê `.quality-gates.json`. |
| Dados lidos e gravados | Lê arquivos e configuração do repo alvo; executa gates filhos e agrega códigos. `run file-size --baseline` pode regenerar baseline, portanto não é uma opção somente leitura. |

> [!info]- Detalhe técnico
> - `agents-playbook/packages/playbook/package.json:2`.
> - `agents-playbook/packages/playbook/bin/agents-playbook.mjs:96`.
> - `agents-playbook/packages/playbook/bin/agents-playbook.mjs:119`.
> - `agents-playbook/packages/playbook/bin/agents-playbook.mjs:136`.
> - `agents-playbook/packages/playbook/gate-manifest.json:1`.
> - `agents-playbook/scripts/sync-playbook-package.mjs:9`.
