---
type: module
id: examples
editRoot: examples
validationPath: node examples/verify-playbook.mjs
docbridge:
  covers:
    - area:examples
---

# Examples

Owns the runnable examples for consumers of the Playbook. `examples/verify-playbook.mjs` decodes `public/deterministic/site-config.json`, verifies `public/deterministic/knowledge.json` against the content hash and site id the config declares, and prints how many local answers were verified. It throws on any mismatch, which makes it a quick check that the deterministic knowledge artifact and its config still agree.
