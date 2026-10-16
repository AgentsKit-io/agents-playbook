---
tipo: app
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
tags: [repo/agents-playbook, app]
---

# agents-playbook-site

> [!tldr] Em linguagem comum
> É o manual na web: pessoas navegam nos guias; agentes recebem texto e índices; o Ask tenta responder pelo material local antes de recorrer ao serviço externo.

← [[00 Hub - agents-playbook]]

## Papel e contratos

App raiz `agents-playbook` 0.1.0, não publicável. MDX é a origem editorial; Chat é reutilizado para estado e streaming.

| Pergunta | Resposta |
|---|---|
| O que entrega | Rotas `/docs`, `/for-agents`, `/raw`, `/llms.txt`, `/llms-full.txt`, busca e estatísticas; bundle e conhecimento determinístico. |
| Quem usa | Visitantes, agentes e [[playbook]] como consumidor dos exemplos canônicos. |
| Do que depende | Next/Fumadocs, [[00 Hub - agentskit-chat]], [[00 Hub - agentskit]] e [[00 Hub - doc-bridge]] no desenvolvimento. |
| Dados lidos e gravados | Lê corpus e índices gerados; gera ZIP/raw/discovery. Ask verifica hash e siteId; fallback usa endpoint configurável. Memória de sessão fica sob chave por corpus, via Chat. |

> [!info]- Detalhe técnico
> - `agents-playbook/package.json:2`.
> - `agents-playbook/scripts/build-discovery.mjs:7`.
> - `agents-playbook/lib/discovery.ts:19`.
> - `agents-playbook/lib/discovery.ts:63`.
> - `agents-playbook/components/ask-widget.tsx:206`.
> - `agents-playbook/components/ask-widget.tsx:225`.
> - `agents-playbook/components/ask-widget.tsx:251`.
