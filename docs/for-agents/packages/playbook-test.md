---
type: module
id: playbook-package-tests
editRoot: packages/playbook/test
validationPath: pnpm test:playbook-package
docbridge:
  covers:
    - area:packages/playbook/test
---

# Playbook package tests

Owns the tests of the `@agentskit/playbook` CLI. `packages/playbook/test/cli.test.mjs` runs `packages/playbook/bin/agents-playbook.mjs` as a child process against temporary fixture repositories. It checks help and version output, the JSON gate listing, and gate pass and fail behavior. Run it with `pnpm test:playbook-package`, which uses the Node test runner.
