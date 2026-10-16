---
tipo: fluxo
repo: "agents-playbook"
camada: docs
visibilidade: publico
verificado-em: 2026-10-16
commits:
  "agents-playbook": ea29444
metodo: análise estática; nada foi executado
fontes:
  - "agents-playbook/scripts/sync-playbook-package.mjs"
  - "agents-playbook/packages/playbook/bin/agents-playbook.mjs"
  - "agents-playbook/.github/workflows/ci.yml"
tags: [repo/agents-playbook, fluxo]
---

# Playbook - Da regra ao gate executável

> [!tldr] Em linguagem comum
> A regra escrita no manual tem um script correspondente; o pacote leva esse mesmo script para a máquina e a CI de outros projetos.

← [[00 Hub - agents-playbook]]

## O que acontece

1. Manter exemplos canônicos em `content/docs/scripts` e catálogo em gate-manifest.
2. Sincronizar scripts para `packages/playbook/gates`; o modo check compara o conteúdo byte a byte.
3. A CLI lê `.quality-gates.json`, seleciona nomes ou subconjunto fast e exclui gates desabilitados.
4. Executar os gates em processos Node, agregar saídas e devolver erro se qualquer gate falhar.
5. CI confere sincronização e comportamento da CLI/hooks em três sistemas operacionais.

## Quem atua aqui

| Peça | Papel |
|---|---|
| [[playbook]] | Distribui e executa gates |
| [[agents-playbook-site]] | Mantém o corpus canônico |

> [!info]- Detalhe técnico
> - `agents-playbook/scripts/sync-playbook-package.mjs:9`.
> - `agents-playbook/scripts/sync-playbook-package.mjs:35`.
> - `agents-playbook/packages/playbook/bin/agents-playbook.mjs:96`.
> - `agents-playbook/packages/playbook/bin/agents-playbook.mjs:163`.
> - `agents-playbook/.github/workflows/ci.yml:59`.
