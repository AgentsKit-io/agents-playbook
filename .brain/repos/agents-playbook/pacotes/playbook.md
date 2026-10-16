---
tipo: pacote
repo: agents-playbook
camada: ferramenta
npm: "@agentskit/playbook"
visibilidade: publico
verificado-em: 2026-10-16
commits:
  agents-playbook: 11f6585
metodo: "análise estática do código em 11f6585; executados localmente `pnpm test:playbook-package` (15/15 ok) e `pnpm check:playbook-package` (ok); doc-bridge 1.12.0 (`ak-docs index`/`query`) consultado, mas o índice não tem entrada de ownership para packages/playbook"
fontes:
  - packages/playbook/package.json
  - packages/playbook/bin/agents-playbook.mjs
  - packages/playbook/gate-manifest.json
  - packages/playbook/test/cli.test.mjs
  - packages/playbook/README.md
  - packages/playbook/gates/check-file-size.mjs
  - packages/playbook/gates/check-pr-intent.mjs
  - scripts/sync-playbook-package.mjs
  - scripts/run-pre-commit-hook.mjs
  - scripts/resolve-npx-command.mjs
  - scripts/test-pre-commit-hook.mjs
  - .pre-commit-hooks.yaml
  - content/docs/scripts/index.md
  - content/docs/scripts/check-quality-gates.example.mjs
  - .github/workflows/ci.yml
  - package.json
  - CHANGELOG.md
  - doc-bridge.config.json
tags: [pacote, repo/agents-playbook, camada/ferramenta]
---

# playbook

> [!tldr] Em linguagem comum
> É a caixa de ferramentas do manual: com um único comando (`npx @agentskit/playbook run`) qualquer projeto roda as mesmas verificações de qualidade que o manual descreve — tamanho de arquivo, segredos vazados, `any` no TypeScript, textos sem tradução e outras — sem copiar scripts nem instalar dependências.

← [[00 Hub - agents-playbook]]

## O que faz e por que existe

`@agentskit/playbook` (versão 0.1.1) é o **único workspace publicável** do repo (`pnpm-workspace.yaml:2` declara só `packages/*`) e a forma executável dos [[Gate de qualidade|gates de qualidade]] que o corpus ensina (`packages/playbook/package.json:2`, `packages/playbook/package.json:3`). O problema que resolve: os gates de referência vivem em `content/docs/scripts/*.example.mjs` para serem copiados; o pacote evita a cópia e garante que todos os projetos rodem o mesmo código.

Limites:

- **Não é a fonte dos gates.** Os arquivos em `packages/playbook/gates/` são cópias byte a byte de `content/docs/scripts/check-<nome>.example.mjs`, geradas por `scripts/sync-playbook-package.mjs` (`scripts/sync-playbook-package.mjs:9`, `scripts/sync-playbook-package.mjs:10`, `scripts/sync-playbook-package.mjs:46`). Editar direto em `gates/` é desfeito no próximo sync e reprovado pelo `--check`.
- **Não inclui o orquestrador de referência** `check-quality-gates.example.mjs`; o sync o exclui (`scripts/sync-playbook-package.mjs:15`) e a CLI reimplementa a orquestração (`packages/playbook/bin/agents-playbook.mjs:136`).
- **Zero dependências de runtime**: só módulos `node:*` (`packages/playbook/bin/agents-playbook.mjs:3`) e Node ≥22 (`packages/playbook/package.json:38`).

## API e contratos

CLI com dois nomes de binário apontando para o mesmo arquivo (`packages/playbook/package.json:6`).

| Símbolo | Tipo | Para que serve | Onde |
|---|---|---|---|
| `agents-playbook` / `ak-playbook` | bin | Entrada da CLI | `packages/playbook/package.json:7`, `packages/playbook/package.json:8` |
| `list [--json]` | comando | Lista nome, `fast` e descrição de cada gate | `packages/playbook/bin/agents-playbook.mjs:185` |
| `run [gate...] [--fast] [--cwd <p>]` | comando | Roda gates em paralelo e agrega PASS/FAIL | `packages/playbook/bin/agents-playbook.mjs:136` |
| `run file-size --baseline` | opção | Regenera o baseline do gate de tamanho (escreve arquivo) | `packages/playbook/bin/agents-playbook.mjs:140` |
| `run pr-intent --base <ref> --description-file <p>` | opção | Repasse de argumentos só para o gate `pr-intent` | `packages/playbook/bin/agents-playbook.mjs:143` |
| `explain [gate]` | comando | Descrição e chave de configuração do gate | `packages/playbook/bin/agents-playbook.mjs:193` |
| `completion <bash\|zsh\|fish>` | comando | Script de autocompletar | `packages/playbook/bin/agents-playbook.mjs:203` |
| `parseArgs(argv)` | função interna | Parser manual de flags; flag desconhecida vira `UsageError` | `packages/playbook/bin/agents-playbook.mjs:47` |
| `loadConfig(cwd)` | função interna | Lê `.quality-gates.json`; ausente → `{ gates: {} }`; JSON inválido → erro de uso | `packages/playbook/bin/agents-playbook.mjs:96` |
| `selectGates(names, options, config)` | função interna | Valida nomes, aplica `--fast` só sem nomes explícitos e remove `enabled: false` | `packages/playbook/bin/agents-playbook.mjs:107` |
| `runGate(gate, cwd, args, children)` | função interna | `spawn(process.execPath, [script])` com `cwd` do repo alvo | `packages/playbook/bin/agents-playbook.mjs:119` |
| `gate-manifest.json` | dados | Catálogo dos 12 gates: `name`, `fast`, `description` | `packages/playbook/gate-manifest.json:1` |
| `.quality-gates.json` | contrato de config | `gates.<nome>.enabled` e opções específicas de cada gate, no repo alvo | `packages/playbook/bin/agents-playbook.mjs:98` |

**Os 12 gates** (`packages/playbook/gate-manifest.json:2` a `:13`): `file-size` (fast), `named-exports`, `no-any`, `error-raw` (fast), `tokens`, `native-html`, `intl`, `secrets` (fast), `completeness`, `adr`, `rfc`, `pr-intent`.

**Códigos de saída**: 0 todos passaram; 1 algum gate falhou (`packages/playbook/bin/agents-playbook.mjs:182`); 2 erro de uso (`packages/playbook/bin/agents-playbook.mjs:237`); 130/143 quando interrompido por SIGINT/SIGTERM (`packages/playbook/bin/agents-playbook.mjs:156`).

Exemplo real (teste que roda um gate num repo temporário, `packages/playbook/test/cli.test.mjs:35`):

```js
const root = await fixture('export const answer: number = 42\n')
const result = await execute(process.execPath, [cli, 'run', 'no-any', '--cwd', root])
assert.match(result.stdout, /PASS no-any/)
assert.match(result.stdout, /1\/1 gates passed/)
```

Consumo via pre-commit (provider versionado deste repo): `.pre-commit-hooks.yaml:1` declara o hook `agentskit-playbook` com `args: [--fast]` (`.pre-commit-hooks.yaml:7`); o script `scripts/run-pre-commit-hook.mjs` executa `npx --yes @agentskit/playbook@0.1.0 run ... --cwd <snapshot>` (`scripts/run-pre-commit-hook.mjs:39`).

## Quem usa e do que depende

| Relação | Nota / evidência |
|---|---|
| Fonte dos gates | [[agents-playbook-site]] — corpus `content/docs/scripts` (`scripts/sync-playbook-package.mjs:9`) |
| Fluxo que o descreve | [[Playbook - Da regra ao gate executável]] |
| Consumidor: hook pre-commit deste repo | `scripts/run-pre-commit-hook.mjs:39` (fixa a versão publicada 0.1.0) |
| Consumidor: projetos externos | via `npx @agentskit/playbook` (`packages/playbook/README.md:6`) — consumidores concretos não aparecem neste repo |
| Dependências de runtime | nenhuma; só `node:child_process`, `node:fs/promises`, `node:path`, `node:url` (`packages/playbook/bin/agents-playbook.mjs:3` a `:6`) |
| Ferramenta externa usada por um gate | `git` (gate `pr-intent`, `packages/playbook/gates/check-pr-intent.mjs:131`) |
| Divulgação | [[00 Hub - ecosystem-distribution-ops]] cita campanhas dos gates npm (relação editorial, sem import) |

## Dados e efeitos

- **Lê** (no repo alvo, `--cwd` ou diretório atual): `.quality-gates.json` (`packages/playbook/bin/agents-playbook.mjs:98`) e os arquivos que cada gate varre — ex.: `file-size` varre por padrão `src`, `packages`, `apps` (`packages/playbook/gates/check-file-size.mjs:24`); `pr-intent` lê `pr-intent.yaml` na raiz ou o arquivo de `--description-file` (`packages/playbook/gates/check-pr-intent.mjs:118`).
- **Escreve**: somente com `run file-size --baseline`, que grava o baseline (padrão `.file-size-baseline.json`, `packages/playbook/gates/check-file-size.mjs:23`) via `saveBaseline` (`packages/playbook/gates/check-file-size.mjs:89`). Todo o resto é somente leitura.
- **Processos**: um processo Node por gate, todos em paralelo (`packages/playbook/bin/agents-playbook.mjs:163`); `pr-intent` chama `git diff <base>...HEAD` (`packages/playbook/gates/check-pr-intent.mjs:137`).
- **Rede**: nenhuma na CLI. O hook pre-commit baixa o pacote do npm via `npx` (`scripts/run-pre-commit-hook.mjs:39`).
- **Variáveis de ambiente**: a CLI não lê nenhuma. O teste do hook aceita `PRE_COMMIT` (caminho do executável pre-commit, `scripts/test-pre-commit-hook.mjs:12`).
- **Segurança**: o gate `secrets` redige o valor encontrado (teste `packages/playbook/test/cli.test.mjs:115`) e recusa caminhos de varredura fora do repo (`packages/playbook/test/cli.test.mjs:128`).

## Como mexer (para agentes)

- **Comece por** `packages/playbook/bin/agents-playbook.mjs` (CLI) e `packages/playbook/gate-manifest.json` (catálogo). Para mudar o comportamento de um gate, edite `content/docs/scripts/check-<nome>.example.mjs` e rode `pnpm sync:playbook-package` — veja [[Playbook - Adicionar ou alterar um gate]].
- **Invariantes**:
  - O conjunto de nomes do manifesto = scripts canônicos (sem `quality-gates`) = arquivos em `gates/`; o sync aborta se divergir (`scripts/sync-playbook-package.mjs:22`, `scripts/sync-playbook-package.mjs:26`).
  - Nomes explícitos em `run` vencem `--fast` (`packages/playbook/bin/agents-playbook.mjs:115`; teste `packages/playbook/test/cli.test.mjs:46`).
  - `--baseline` só com `file-size`; `--base`/`--description-file` só com `pr-intent` (`packages/playbook/bin/agents-playbook.mjs:140`, `packages/playbook/bin/agents-playbook.mjs:144`).
  - A versão impressa vem de `package.json` (`packages/playbook/bin/agents-playbook.mjs:10`) e o teste fixa `0.1.1` (`packages/playbook/test/cli.test.mjs:25`): ao subir versão, atualize o teste.
  - O teste conta exatamente 12 gates (`packages/playbook/test/cli.test.mjs:31`).
- **Testes**: `packages/playbook/test/cli.test.mjs` (CLI e gates, `node:test`); `scripts/test-pre-commit-hook.mjs` (provider pre-commit ponta a ponta, exige `pre-commit` instalado). O vitest raiz exclui `packages/playbook/test/**` (`vitest.config.ts:11`).
- **Validação exata**:
  ```bash
  pnpm check:playbook-package      # node scripts/sync-playbook-package.mjs --check
  pnpm test:playbook-package       # node --test packages/playbook/test/cli.test.mjs
  pnpm test:pre-commit-hook        # requer pre-commit 4.4+ no PATH
  (cd packages/playbook && npm pack --dry-run)
  ```
  A CI roda os quatro em Ubuntu, macOS e Windows (`.github/workflows/ci.yml:65`, `.github/workflows/ci.yml:77` a `:81`).
- **Armadilhas**:
  - `--description-file` é repassado sem `resolve()` (`packages/playbook/bin/agents-playbook.mjs:74`) e o gate roda com `cwd` = repo alvo (`packages/playbook/bin/agents-playbook.mjs:122`): caminho relativo é resolvido a partir do `--cwd`, não do diretório de quem chamou.
  - `prepack` roda o sync em modo `--check` (`packages/playbook/package.json:19`): `npm pack`/`publish` falha se os gates estiverem defasados.
  - O hook pre-commit fixa `@agentskit/playbook@0.1.0` (`scripts/run-pre-commit-hook.mjs:39`) enquanto o pacote está em 0.1.1; a documentação diz que é intencional para a tag `pre-commit-v0.1.0` (`content/docs/scripts/index.md:38`). Ao publicar nova versão, decida se o provider sobe junto.
- **Quem revisa**: não há CODEOWNERS no repo; `GOVERNANCE.md:3` nomeia o líder do projeto como decisor final.

## Decisões e história

O repo não tem ADRs próprios (não há `docs/adr/`); as decisões ficam em PRs e no `CHANGELOG.md`.

| Data | Commit | O quê |
|---|---|---|
| 2026-07-22 | `b4840c9` | Cria a CLI de gates sem dependências (#31) |
| 2026-07-23 | `8b28624` | Adiciona o provider pre-commit versionado (#32) |
| 2026-07-29 | `561d4de` | Controles de segurança OpenSSF (#33) |
| — | `CHANGELOG.md:22` | 0.1.1 preparada com fronteira de licenças: CLI MIT, corpus CC BY 4.0 |

`git log --oneline -15 -- packages/playbook` mostra só esses três commits no pacote; os demais da lista do caminho `content/docs/scripts` são anteriores à criação do pacote (2026-05 a 2026-06).

> [!info]- Detalhe técnico
> - Workspace: `pnpm-workspace.yaml:2`.
> - Mapa nome→arquivo: `packages/playbook/bin/agents-playbook.mjs:13` (`gates/check-<nome>.mjs`).
> - Ajuda embutida: `packages/playbook/bin/agents-playbook.mjs:15`.
> - Interrupção: `interrupt` mata filhos com o sinal recebido e, na segunda vez, com SIGKILL (`packages/playbook/bin/agents-playbook.mjs:154`).
> - Saída agregada: `packages/playbook/bin/agents-playbook.mjs:177`, `packages/playbook/bin/agents-playbook.mjs:181`.
> - Sync check byte a byte: `scripts/sync-playbook-package.mjs:35` a `:44`.
> - Hook: snapshot do índice com `git checkout-index` (`scripts/run-pre-commit-hook.mjs:31`), symlinks staged viram arquivos com o texto do alvo (`scripts/run-pre-commit-hook.mjs:12`), limpeza no `finally` (`scripts/run-pre-commit-hook.mjs:48`); `resolveNpxCommand` resolve `npx-cli.js` ao lado do Node no Windows (`scripts/resolve-npx-command.mjs:4`).
> - Orquestrador de referência (não empacotado): `content/docs/scripts/check-quality-gates.example.mjs:24`.
> - Teste de PR intent falhando fechado com base inválida: `packages/playbook/test/cli.test.mjs:162`.

> [!bug] Existe, mas ninguém usa
> - O comando `completion` não é instalado por nenhum script do repo; só é testado (`packages/playbook/test/cli.test.mjs:175`).
> - Não há workflow de publicação npm neste repo (só `ci.yml`, `codeql.yml`, `dependency-review.yml`, `doc-bridge-advisory.yml`, `scorecard.yml`); como 0.1.1 chega ao npm não é verificável aqui. Ver [[Dúvidas abertas]].
