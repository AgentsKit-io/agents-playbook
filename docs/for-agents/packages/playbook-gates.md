---
type: module
id: playbook-gates
editRoot: packages/playbook/gates
validationPath: pnpm check:playbook-package
docbridge:
  covers:
    - area:packages/playbook/gates
---

# Playbook gate scripts

Owns the packaged gate implementations that `@agentskit/playbook` runs. There is one `check-<name>.mjs` script per entry in `packages/playbook/gate-manifest.json`: file size, named exports, `no-any`, raw errors, tokens, native HTML, intl, secrets, completeness, ADR, RFC and PR intent.

The files here are synchronized from the copy-ready reference scripts in `content/docs/scripts` by `scripts/sync-playbook-package.mjs`. Edit the reference script, run `pnpm sync:playbook-package`, and let `pnpm check:playbook-package` prove the two sets match.
