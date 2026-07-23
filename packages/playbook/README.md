# `@agentskit/playbook`

Run the Agents Playbook's structural quality gates without copying scripts into every repository. The CLI has zero runtime dependencies and runs locally on Node.js 22 or newer.

```bash
npx @agentskit/playbook list
npx @agentskit/playbook run no-any named-exports
npx @agentskit/playbook run --fast
```

## Commands

```text
agents-playbook list
agents-playbook run [gate...] [--fast] [--cwd <path>]
agents-playbook run pr-intent [--base <ref>] [--description-file <path>]
agents-playbook explain [gate]
agents-playbook completion <bash|zsh|fish>
```

All enabled gates run when `run` has no gate names. Disable a gate for a project with `.quality-gates.json`:

```json
{
  "gates": {
    "native-html": { "enabled": false }
  }
}
```

Every gate runs against the selected repository and exits non-zero when it finds a violation. Use `--cwd <path>` from automation that is not already running at the repository root.

Read the [gate reference](https://playbook.agentskit.io/docs/scripts) for the enforced contracts, configuration, and adoption guidance.

## License

CC BY 4.0. See `LICENSE`.
