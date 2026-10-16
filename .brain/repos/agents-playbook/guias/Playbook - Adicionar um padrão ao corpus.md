---
tipo: guia
repo: agents-playbook
camada: ferramenta
visibilidade: publico
verificado-em: 2026-10-16
commits:
  agents-playbook: 11f6585
metodo: "derivado de CONTRIBUTING.md, scripts de geração e ci.yml em 11f6585; doc-bridge 1.12.0 executado (`ak-docs index`, `query ownership playbook --agent`)"
fontes:
  - CONTRIBUTING.md
  - GOVERNANCE.md
  - AGENTS.md
  - package.json
  - scripts/add-okf-type.mjs
  - scripts/generate-doc-bridge-config.mjs
  - scripts/lib/playbook-discovery.mjs
  - scripts/discovery-metadata.json
  - scripts/compute-stats.mjs
  - scripts/refresh-readme-standard.mjs
  - .github/workflows/ci.yml
  - content/docs/meta.json
tags: [guia, repo/agents-playbook, camada/ferramenta]
---

# Playbook - Adicionar um padrão ao corpus

> [!tldr] Em linguagem comum
> Como acrescentar uma nova lição (padrão, prompt ou template) ao manual de modo que ela apareça no site, nos arquivos para IA, no catálogo de respostas do Ask e no mapa de documentação — tudo regenerado e conferido.

← [[00 Hub - agents-playbook]]

## Quando usar

Ao criar ou renomear um documento em `content/docs/**` (pilares, fases, prompts, templates).

## Pré-requisitos

- A lição precisa ter origem em produção e citar o modo de falha que previne (`CONTRIBUTING.md:12`, `CONTRIBUTING.md:15`). Texto em inglês (`CONTRIBUTING.md:16`). Licença do conteúdo: CC BY 4.0 (`CONTRIBUTING.md:17`).
- Rotear antes de editar (`AGENTS.md:16`, `AGENTS.md:17`).

## Passos

1. Criar o arquivo seguindo o esqueleto: `## TL;DR (human)` e `## For agents` com `Rule`, `Why`, `How to apply`, `Gate`, `Escape hatch`, `See also` (`CONTRIBUTING.md:27` a `:59`). Frontmatter com `title` e `description` — eles viram título/descrição no `llms.txt`, no artefato do Ask e no doc-bridge (`scripts/lib/playbook-discovery.mjs:55`, `scripts/lib/playbook-discovery.mjs:56`, `scripts/generate-doc-bridge-config.mjs:55`).
2. Se for uma pasta nova, ajustar o `meta.json` correspondente da navegação Fumadocs (ex.: `content/docs/meta.json`).
3. Regenerar derivados:
   ```bash
   pnpm gen:okf-type            # insere `type:` OKF se faltar
   pnpm docs:bridge:config      # nova rota de ownership
   pnpm docs:bridge:index
   pnpm gen:stats               # contagem de padrões/templates
   pnpm build:discovery         # nova entrada no artefato do Ask
   ```
4. Se o README mudou: `pnpm readme:standard:refresh` (recalcula hashes de frescor, `scripts/refresh-readme-standard.mjs:9`).
5. Para aposentar um padrão, não apague — marque como tombstone (`CONTRIBUTING.md:63` a `:67`).

## Como validar

```bash
pnpm check:okf-type
pnpm check:doc-bridge-config
pnpm docs:bridge:gate
pnpm docs:bridge:conformance
pnpm test
pnpm build
git diff --exit-code -- doc-bridge.config.json app/stats.snapshot.json public/deterministic
```

## Erros comuns

- `OKF: N doc(s) missing type` — faltou `pnpm gen:okf-type` (`scripts/add-okf-type.mjs:78`).
- `doc-bridge.config.json is stale` — faltou `pnpm docs:bridge:config` (`scripts/generate-doc-bridge-config.mjs:134`).
- Dois arquivos com o mesmo basename geram ids de ownership com o caminho inteiro (`a--b`), não o basename (`scripts/generate-doc-bridge-config.mjs:54`).
- Artefato acima do limite de bytes do protocolo quebra o build (`scripts/lib/playbook-discovery.mjs:171`).
- `generatedAt` em `scripts/discovery-metadata.json` não muda sozinho; só altere se quiser mudar a revisão declarada (`scripts/lib/playbook-discovery.mjs:42`).
- Revisão: CONTRIBUTING pede um humano e um agente (`CONTRIBUTING.md:71`); mudanças de direção exigem aprovação de mantenedor (`GOVERNANCE.md:11`).

## Notas relacionadas

[[agents-playbook-site]] · [[Playbook - Do corpus à consulta]] · [[Playbook - Validar uma mudança]] · [[doc-bridge-indexacao]]
