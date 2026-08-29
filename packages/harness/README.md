# `@agentskit/harness`

Portable development protocol for coding agents. It freezes a human-approved task contract, runs every required check, validates structured evidence, records hashes and run IDs, and refuses completion without human approval.

```bash
ak-harness doctor --json
ak-harness plan approved --by human
ak-harness start
ak-harness verify --json
ak-harness approve approved --by human --json
ak-harness status --json
```

Checks must print a final JSON line such as:

```json
{"status":"passed","criteria":["package"],"artifacts":[]}
```

UI checks additionally declare `real-browser` and `screenshot`, and each screenshot artifact must include a project-relative path, SHA-256 hash, and viewport dimensions.
