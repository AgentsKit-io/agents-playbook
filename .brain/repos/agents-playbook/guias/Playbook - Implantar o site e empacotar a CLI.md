---
tipo: guia
repo: agents-playbook
camada: ferramenta
visibilidade: publico
verificado-em: 2026-10-16
commits:
  agents-playbook: 11f6585
metodo: "análise estática de package.json, wrangler.jsonc, open-next.config.ts, vercel.json e ci.yml em 11f6585; nada de deploy foi executado"
fontes:
  - package.json
  - wrangler.jsonc
  - open-next.config.ts
  - next.config.ts
  - vercel.json
  - public/_headers
  - packages/playbook/package.json
  - .github/workflows/ci.yml
  - content/docs/scripts/index.md
tags: [guia, repo/agents-playbook, camada/ferramenta]
---

# Playbook - Implantar o site e empacotar a CLI

> [!tldr] Em linguagem comum
> Os dois caminhos de saída do repo: colocar o site no ar (Cloudflare Workers ou Vercel) e preparar o pacote npm dos gates. Nenhum dos dois é automático na CI deste repo.

← [[00 Hub - agents-playbook]]

## Quando usar

Ao publicar uma versão do site ou da CLI `@agentskit/playbook`.

## Pré-requisitos

- Credenciais Cloudflare (para `wrangler`) ou projeto Vercel conectado ao repo — nomes e valores não estão no repo.
- Validação completa passando ([[Playbook - Validar uma mudança]]).

## Passos

**Site em Cloudflare Workers (OpenNext)**

```bash
pnpm cf:preview   # build OpenNext + preview local (package.json:15)
pnpm cf:deploy    # build OpenNext + deploy (package.json:16)
```

Worker `agents-playbook` com `nodejs_compat`, assets em `.open-next/assets`, observabilidade ligada e teto de CPU de 5 s (`wrangler.jsonc:5`, `wrangler.jsonc:8`, `wrangler.jsonc:9`, `wrangler.jsonc:13`, `wrangler.jsonc:15`). Cache incremental em assets estáticos, sem KV (`open-next.config.ts:8`).

**Site em Vercel**

Deploy por git só em `main`, `master`, `staging`, `qa`, `dev`, `develop` (`vercel.json:4` a `:11`); build `npx -y pnpm@9.15.4 build` (`vercel.json:15`).

**CLI npm**

```bash
pnpm check:playbook-package
cd packages/playbook
npm pack --dry-run        # prepack roda o sync --check (packages/playbook/package.json:19)
npm publish               # publishConfig.access = public (packages/playbook/package.json:41)
```

Provider pre-commit: a documentação diz que o release cria a tag `pre-commit-v0.1.0` antes de a instrução entrar no ar (`content/docs/scripts/index.md:45`).

## Como validar

- Site: abrir `/llms.txt`, `/raw/index.md`, `/deterministic/site-config.json` e o Ask no ambiente publicado.
- HSTS presente (`next.config.ts:12`, `public/_headers:2`).
- CLI: `npx @agentskit/playbook --version` deve imprimir a versão publicada.

## Erros comuns

- `/raw` 404 no Workers: o índice `lib/raw-index.generated.json` não foi gerado — ele vem do `prebuild` (`package.json:8`).
- Vercel instala com pnpm 9 e `--no-frozen-lockfile` (`vercel.json:16`) enquanto o repo declara pnpm 10.34.4 (`package.json:75`): o lockfile pode ser reescrito no build da Vercel.

> [!question] Dúvida
> Qual dos dois destinos serve `playbook.agentskit.io` hoje? O código mantém os dois; nenhum workflow de deploy existe no repo. Também não há workflow de `npm publish` — quem publica e com que credencial não é verificável aqui. Ver [[Dúvidas abertas]] e [[Infra e deploy]].

## Notas relacionadas

[[agents-playbook-site]] · [[playbook]] · [[Infra e deploy]]
