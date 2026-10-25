---
type: module
id: playbook-cli
editRoot: packages/playbook/bin
validationPath: pnpm test:playbook-package
docbridge:
  covers:
    - area:packages/playbook/bin
---

# Playbook CLI entry point

Owns the command line of `@agentskit/playbook`. `packages/playbook/bin/agents-playbook.mjs` parses `list`, `run`, `explain` and `completion`, reads the available gates from `packages/playbook/gate-manifest.json`, and spawns the matching `check-<name>.mjs` script from the gates directory. Flags such as `--fast`, `--cwd`, `--baseline`, `--base` and `--description-file` are forwarded to the gates that use them.

Add a gate by adding its script and a manifest entry, not by editing this file. `packages/playbook/test/cli.test.mjs` covers the CLI behavior.
