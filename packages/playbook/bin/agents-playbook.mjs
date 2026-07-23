#!/usr/bin/env node

import { spawn } from 'node:child_process'
import { stat } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import packageJson from '../package.json' with { type: 'json' }
import gateManifest from '../gate-manifest.json' with { type: 'json' }

const VERSION = packageJson.version
const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const gates = gateManifest.map((gate) => ({ ...gate, script: resolve(packageRoot, 'gates', `check-${gate.name}.mjs`) }))

const help = `Agents Playbook quality gates

USAGE
  agents-playbook <command> [options]

COMMANDS
  list                    List the available gates
  run [gate...]           Run named gates, or every enabled gate when omitted
  explain [gate]          Explain one gate or the complete gate set
  completion <shell>      Print completion for bash, zsh, or fish

OPTIONS
  --cwd <path>            Repository to check (default: current directory)
  --fast                  Run the fast gate subset
  --baseline              Regenerate the file-size baseline
  --base <ref>            Git base for the pr-intent gate
  --description-file <p>  PR body file for the pr-intent gate
  --json                  Emit machine-readable output for list
  -h, --help              Show help
  -v, --version           Show version

EXAMPLES
  npx @agentskit/playbook list
  npx @agentskit/playbook run no-any named-exports
  npx @agentskit/playbook run --fast
  npx @agentskit/playbook explain secrets

Learn more: https://playbook.agentskit.io/docs/scripts
`

class UsageError extends Error {}

function parseArgs(argv) {
  const positionals = []
  const options = { cwd: process.cwd(), fast: false, baseline: false, json: false }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === '--') {
      positionals.push(...argv.slice(index + 1))
      break
    }
    if (arg === '--fast') options.fast = true
    else if (arg === '--baseline') options.baseline = true
    else if (arg === '--json') options.json = true
    else if (arg === '--help' || arg === '-h') options.help = true
    else if (arg === '--version' || arg === '-v') options.version = true
    else if (arg === '--cwd') {
      const value = argv[index + 1]
      if (!value || value.startsWith('-')) throw new UsageError('--cwd requires a directory path.')
      options.cwd = resolve(value)
      index += 1
    } else if (arg.startsWith('--cwd=')) {
      const value = arg.slice('--cwd='.length)
      if (!value) throw new UsageError('--cwd requires a directory path.')
      options.cwd = resolve(value)
    } else if (arg === '--base' || arg === '--description-file') {
      const value = argv[index + 1]
      if (!value || value.startsWith('-')) throw new UsageError(`${arg} requires a value.`)
      options[arg.slice(2)] = value
      index += 1
    } else if (arg.startsWith('--base=') || arg.startsWith('--description-file=')) {
      const [name, ...rest] = arg.slice(2).split('=')
      const value = rest.join('=')
      if (!value) throw new UsageError(`--${name} requires a value.`)
      options[name] = value
    } else if (arg.startsWith('-')) throw new UsageError(`Unknown option: ${arg}`)
    else positionals.push(arg)
  }

  return { command: positionals[0], values: positionals.slice(1), options }
}

async function validateCwd(cwd) {
  try {
    if (!(await stat(cwd)).isDirectory()) throw new Error('not a directory')
  } catch {
    throw new UsageError(`Repository directory not found: ${cwd}`)
  }
}

async function loadConfig(cwd) {
  try {
    const raw = await import('node:fs/promises').then(({ readFile }) => readFile(resolve(cwd, '.quality-gates.json'), 'utf8'))
    return JSON.parse(raw)
  } catch (error) {
    if (error?.code === 'ENOENT') return { gates: {} }
    if (error instanceof SyntaxError) throw new UsageError(`Invalid JSON in ${resolve(cwd, '.quality-gates.json')}: ${error.message}`)
    throw error
  }
}

function selectGates(names, options, config) {
  const known = new Map(gates.map((gate) => [gate.name, gate]))
  const unknown = names.filter((name) => !known.has(name))
  if (unknown.length > 0) {
    throw new UsageError(`Unknown gate${unknown.length > 1 ? 's' : ''}: ${unknown.join(', ')}\nRun 'agents-playbook list' to see valid names.`)
  }

  let selected = names.length > 0 ? names.map((name) => known.get(name)) : gates
  if (options.fast && names.length === 0) selected = selected.filter((gate) => gate.fast)
  return selected.filter((gate) => config.gates?.[gate.name]?.enabled !== false)
}

function runGate(gate, cwd, args, children) {
  return new Promise((complete) => {
    const startedAt = performance.now()
    const child = spawn(process.execPath, [gate.script, ...args], { cwd, stdio: ['ignore', 'pipe', 'pipe'] })
    children.add(child)
    let stdout = ''
    let stderr = ''
    child.stdout.setEncoding('utf8').on('data', (chunk) => { stdout += chunk })
    child.stderr.setEncoding('utf8').on('data', (chunk) => { stderr += chunk })
    child.on('error', (error) => complete({ gate, code: 1, stdout, stderr: `${stderr}${error.message}\n`, durationMs: performance.now() - startedAt }))
    child.on('close', (code) => {
      children.delete(child)
      complete({ gate, code: code ?? 1, stdout, stderr, durationMs: performance.now() - startedAt })
    })
  })
}

async function run(names, options) {
  await validateCwd(options.cwd)
  const config = await loadConfig(options.cwd)
  const selected = selectGates(names, options, config)
  if (options.baseline && selected.some((gate) => gate.name !== 'file-size')) {
    throw new UsageError('--baseline can only be used with: run file-size --baseline')
  }
  const prIntentOptions = [options.base && `--base=${options.base}`, options['description-file'] && `--description-file=${options['description-file']}`].filter(Boolean)
  if (prIntentOptions.length > 0 && selected.some((gate) => gate.name !== 'pr-intent')) {
    throw new UsageError('--base and --description-file can only be used with: run pr-intent')
  }
  if (selected.length === 0) {
    process.stdout.write('agents-playbook: no enabled gates selected.\n')
    return 0
  }

  const children = new Set()
  let interruptCode = 0
  const interrupt = (signal) => {
    const force = interruptCode !== 0
    interruptCode = signal === 'SIGINT' ? 130 : 143
    for (const child of children) child.kill(force ? 'SIGKILL' : signal)
  }
  const onSigint = () => interrupt('SIGINT')
  const onSigterm = () => interrupt('SIGTERM')
  process.on('SIGINT', onSigint)
  process.on('SIGTERM', onSigterm)
  const results = await Promise.all(selected.map((gate) => {
    const gateArgs = []
    if (options.baseline) gateArgs.push('--baseline')
    if (gate.name === 'pr-intent') gateArgs.push(...prIntentOptions)
    return runGate(gate, options.cwd, gateArgs, children)
  }))
  process.removeListener('SIGINT', onSigint)
  process.removeListener('SIGTERM', onSigterm)
  if (interruptCode) return interruptCode

  let failed = 0
  for (const result of results) {
    const passed = result.code === 0
    if (!passed) failed += 1
    process.stdout.write(`${passed ? 'PASS' : 'FAIL'} ${result.gate.name} ${Math.round(result.durationMs)}ms\n`)
    if (result.stdout) process.stdout.write(result.stdout)
    if (result.stderr) process.stderr.write(result.stderr)
  }
  process.stdout.write(`agents-playbook: ${results.length - failed}/${results.length} gates passed.\n`)
  return failed === 0 ? 0 : 1
}

function list(options) {
  if (options.json) {
    process.stdout.write(`${JSON.stringify(gates.map(({ name, fast, description }) => ({ name, fast, description })), null, 2)}\n`)
    return
  }
  process.stdout.write(`${gates.map((gate) => `${gate.name.padEnd(15)} ${gate.fast ? '[fast] ' : '       '}${gate.description}`).join('\n')}\n`)
}

function explain(name) {
  if (name) {
    const gate = gates.find((candidate) => candidate.name === name)
    if (!gate) throw new UsageError(`Unknown gate: ${name}\nRun 'agents-playbook list' to see valid names.`)
    process.stdout.write(`${gate.name}\n${gate.description}\n\nConfiguration: .quality-gates.json → gates.${gate.name}\n`)
    return
  }
  process.stdout.write('Each gate enforces one structural rule and returns an actionable failure.\nUse `agents-playbook explain <gate>` for its purpose and configuration key.\n')
}

function completion(shell) {
  const names = gates.map((gate) => gate.name).join(' ')
  const scripts = {
    bash: `_agents_playbook() { COMPREPLY=( $(compgen -W "list run explain completion ${names} --fast --baseline --json --cwd --help --version" -- "\${COMP_WORDS[COMP_CWORD]}") ); }\ncomplete -F _agents_playbook agents-playbook ak-playbook\n`,
    zsh: `#compdef agents-playbook ak-playbook\n_agents_playbook() {\n  _arguments '1:command:(list run explain completion)' '*:gate:(${names})' '--fast[run the fast subset]' '--baseline[regenerate file-size baseline]' '--json[emit JSON]' '--cwd[repository directory]:directory:_directories'\n}\ncompdef _agents_playbook agents-playbook ak-playbook\n`,
    fish: `complete -c agents-playbook -f -a "list run explain completion ${names}"\ncomplete -c ak-playbook -f -a "list run explain completion ${names}"\n`,
  }
  if (!scripts[shell]) throw new UsageError(`Unsupported shell: ${shell ?? '(missing)'}\nExpected one of: bash, zsh, fish.`)
  process.stdout.write(scripts[shell])
}

async function main() {
  const { command, values, options } = parseArgs(process.argv.slice(2))
  if (options.version) {
    process.stdout.write(`${VERSION}\n`)
    return 0
  }
  if (options.help || !command) {
    process.stdout.write(help)
    return 0
  }
  if (command === 'list') list(options)
  else if (command === 'run') return run(values, options)
  else if (command === 'explain') explain(values[0])
  else if (command === 'completion') completion(values[0])
  else throw new UsageError(`Unknown command: ${command}\nRun 'agents-playbook --help' for usage.`)
  return 0
}

try {
  process.exitCode = await main()
} catch (error) {
  if (error instanceof UsageError) {
    process.stderr.write(`Error: ${error.message}\n`)
    process.exitCode = 2
  } else {
    process.stderr.write(`Error: ${error instanceof Error ? error.message : String(error)}\n`)
    process.exitCode = 1
  }
}
