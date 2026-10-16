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
  - "agents-playbook/package.json"
  - "agents-playbook/scripts/build-discovery.mjs"
  - "agents-playbook/lib/discovery.ts"
  - "agents-playbook/components/ask-widget.tsx"
tags: [repo/agents-playbook, fluxo]
---

# Playbook - Do corpus à consulta

> [!tldr] Em linguagem comum
> O manual gera uma versão para navegação e outra para perguntas; se a resposta local não for segura, o Ask segue a política de fallback.

← [[00 Hub - agents-playbook]]

## O que acontece

1. O prebuild gera estatísticas, conhecimento determinístico, bundle e índice raw a partir do corpus.
2. O site oferece páginas e rotas de texto para pessoas e agentes.
3. Ao abrir Ask, carregar site-config e knowledge com timeout; verificar hash e identidade do site.
4. Construir adapter determinístico com fallback configurado; configuração inválida degrada para backend. O endpoint padrão é o Ask do ecossistema.
5. Chat mantém a sessão e mostra texto e fontes; o repo não reimplementa o laço conversacional.

## Quem atua aqui

| Peça | Papel |
|---|---|
| [[agents-playbook-site]] | Gera e apresenta o conhecimento |
| [[00 Hub - agentskit-chat]] | Resposta local, fallback e sessão |

> [!info]- Detalhe técnico
> - `agents-playbook/package.json:8`.
> - `agents-playbook/scripts/build-discovery.mjs:9`.
> - `agents-playbook/lib/discovery.ts:19`.
> - `agents-playbook/lib/discovery.ts:63`.
> - `agents-playbook/components/ask-widget.tsx:238`.
