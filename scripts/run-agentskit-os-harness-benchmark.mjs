#!/usr/bin/env node
import { execFileSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { loadBenchmarkManifest, benchmarkRuns } from '../packages/harness/dist/index.js'

const arg = (name, fallback) => {
  const index = process.argv.indexOf(name)
  return index === -1 ? fallback : process.argv[index + 1]
}
const root = resolve(import.meta.dirname, '..')
const manifestPath = resolve(root, arg('--manifest', 'benchmarks/agentskit-os-phase-28.json'))
const manifest = loadBenchmarkManifest(manifestPath)
const mode = process.argv.includes('--self-test') ? 'self-test' : process.argv.includes('--collect') ? 'collect' : process.argv.includes('--execute') ? 'execute' : 'prepare'
const repeatCount = Number(arg('--repeats', '1'))
if (!Number.isInteger(repeatCount) || repeatCount < 1) throw new Error('--repeats must be a positive integer.')
const taskId = arg('--task-id')
const requestedSample = arg('--sample')
const sampleNumber = requestedSample === undefined ? undefined : Number(requestedSample)
if (taskId && !manifest.tasks.some((task) => task.id === taskId)) throw new Error(`unknown benchmark task: ${taskId}`)
if (requestedSample !== undefined && (!Number.isInteger(sampleNumber) || sampleNumber < 1)) throw new Error('--sample must be a positive integer.')
if (requestedSample !== undefined && repeatCount !== 1) throw new Error('--sample cannot be combined with --repeats greater than 1.')
const selectedTasks = taskId ? manifest.tasks.filter((task) => task.id === taskId) : manifest.tasks
const phaseRoot = resolve(root, arg('--phase-root', '.codex/verification/phase-30'))
const configRoot = join(phaseRoot, 'configs')
const stateRoot = join(phaseRoot, 'runs')
const cli = resolve(root, 'packages/harness/dist/cli.js')
const shellQuote = (value) => `'${value.replaceAll("'", "'\\''")}'`

const taskConfig = (task, destination, sample) => {
  if (mode === 'execute' && !process.env.AGENTSKIT_OS_ROOT) throw new Error('AGENTSKIT_OS_ROOT is required for benchmark execution.')
  const sampleRoot = join(destination, 'runs', task.id, `sample-${sample}`)
  const stateDir = relative(root, sampleRoot).replaceAll('\\', '/')
  const reportDir = relative(root, join(sampleRoot, 'reports')).replaceAll('\\', '/')
  const target = process.env.AGENTSKIT_OS_ROOT ? ` --target ${shellQuote(process.env.AGENTSKIT_OS_ROOT)}` : ''
  return {
  schemaVersion: 1,
  project: `agents-playbook-harness-phase-33-${task.id}-sample-${sample}`,
  root: '../../../../../',
  stateDir,
  profile: 'strict',
  contract: {
    intent: `Complete benchmark task ${task.id} under the AgentsKit Harness.`,
    scope: { inScope: [`benchmark:${manifest.suiteId}/${task.id}`], outOfScope: ['unrelated changes'] },
    ambiguities: [],
    outcomes: [{ id: 'task-delivery', statement: 'The real provider completes and validates the benchmark task.', checks: ['real-task'] }],
  },
  surfaces: { logic: true, endpoint: { required: false, reason: 'No endpoint.' }, database: { required: false, reason: 'No database.' }, cli: { required: false, reason: 'No CLI.' }, mcp: { required: false, reason: 'No MCP.' }, ui: { required: false, reason: 'No UI.' }, docs: { required: false, reason: 'No docs.' } },
  checks: [{ id: 'real-task', category: 'logic', execution: 'real', command: `node scripts/run-agentskit-os-baseline.mjs --manifest ${shellQuote(manifestPath)}${target} --output ${shellQuote(reportDir)} --task-id ${shellQuote(task.id)} --harness`, evidence: 'structured', timeoutMs: 240000 }],
  tracking: { required: false, reason: 'Local benchmark measurement.' },
  budget: { maxDurationMs: 300000 },
  cleanup: { roots: ['.codex/verification/tmp'] },
  benchmark: { suiteId: manifest.suiteId, taskId: task.id, mode: 'harness' },
  }
}

const prepare = (destination = phaseRoot, repeats = repeatCount) => {
  const configs = join(destination, 'configs')
  mkdirSync(configs, { recursive: true })
  const samples = sampleNumber === undefined ? Array.from({ length: repeats }, (_, index) => index + 1) : [sampleNumber]
  const tasks = selectedTasks.flatMap((task) => samples.map((sample) => {
    const config = join(configs, `${task.id}-sample-${sample}.json`)
    const stateDir = join(destination, 'runs', task.id, `sample-${sample}`)
    if (requestedSample !== undefined && (existsSync(config) || existsSync(stateDir))) throw new Error(`replacement sample already exists: ${task.id}/sample-${sample}`)
    writeFileSync(config, `${JSON.stringify(taskConfig(task, destination, sample), null, 2)}\n`)
    return { taskId: task.id, sample, config, stateDir }
  }))
  return { suiteId: manifest.suiteId, taskCount: selectedTasks.length, sampleCount: samples.length, configRoot: configs, stateRoot: join(destination, 'runs'), tasks }
}

const runCli = (args, env) => JSON.parse(execFileSync(process.execPath, [cli, '--config', args.config, ...args.command, '--json'], { cwd: root, encoding: 'utf8', env: { ...process.env, ...env } }).trim().split(/\r?\n/).at(-1))

if (mode === 'self-test') {
  const fixture = mkdtempSync(join(tmpdir(), 'agentskit-harness-phase-30-'))
  const prepared = prepare(fixture, 2)
  const configs = readdirSync(prepared.configRoot).filter((file) => file.endsWith('.json'))
  if (configs.length !== manifest.tasks.length * 2) throw new Error('one harness config was not prepared per task sample')
  const first = JSON.parse(readFileSync(join(prepared.configRoot, configs[0]), 'utf8'))
  if (first.root !== '../../../../../' || first.benchmark?.suiteId !== manifest.suiteId || first.benchmark?.mode !== 'harness' || !first.checks?.[0]?.command.includes('--harness') || (process.env.AGENTSKIT_OS_ROOT && !first.checks?.[0]?.command.includes('--target'))) throw new Error('harness benchmark binding is incomplete')
  const emptyMetrics = benchmarkRuns(join(fixture, 'empty'), manifest)
  const expectedEmptyComparability = manifest.observations.length ? 'harness-not-run' : 'missing-baseline'
  if (emptyMetrics.manifest?.comparableTaskCount !== 0 || emptyMetrics.comparisons.some((comparison) => comparison.comparability !== expectedEmptyComparability)) throw new Error('empty benchmark must remain non-comparable')
  console.log(JSON.stringify({ status: 'passed', criteria: ['harness-runner', 'measurement-integrity'], suiteId: manifest.suiteId, taskCount: manifest.tasks.length }))
} else if (mode === 'prepare') {
  console.log(JSON.stringify({ status: 'passed', criteria: ['harness-runner'], ...prepare() }))
} else if (mode === 'execute') {
  const prepared = prepare()
  const runs = []
  for (const task of prepared.tasks) {
    const config = task.config
    const env = { AGENTSKIT_OS_ROOT: process.env.AGENTSKIT_OS_ROOT ?? '' }
    let result
    try {
      let retried = false
      try { runCli({ config, command: ['retry'] }, env); retried = true } catch {}
      if (!retried) runCli({ config, command: ['plan', 'prepared', '--by', 'ci', '--allow-dirty'] }, env)
      runCli({ config, command: ['start'] }, env)
      result = runCli({ config, command: ['verify'] }, env)
    } catch (error) {
      result = { status: 'blocked', taskId: task.taskId, error: error instanceof Error ? error.message : String(error) }
    }
    runs.push({ taskId: task.taskId, runId: result.runId, state: result.state, error: result.error })
  }
  console.log(JSON.stringify({ status: runs.every((run) => ['AWAITING_HUMAN_APPROVAL', 'COMPLETE'].includes(run.state)) ? 'passed' : 'blocked', criteria: ['harness-runner'], suiteId: manifest.suiteId, runs }))
} else {
const combined = mkdtempSync(join(tmpdir(), 'agentskit-harness-phase-30-metrics-'))
  mkdirSync(join(combined, 'runs'), { recursive: true })
  const runs = []
  for (const task of manifest.tasks) {
    const taskRoot = join(stateRoot, task.id)
    if (!existsSync(taskRoot)) continue
    for (const sample of readdirSync(taskRoot, { withFileTypes: true }).filter((entry) => entry.isDirectory())) {
      const source = join(taskRoot, sample.name, 'runs')
      if (!existsSync(source)) continue
      for (const entry of readdirSync(source)) cpSync(join(source, entry), join(combined, 'runs', entry), { recursive: true })
    }
  }
  const report = benchmarkRuns(combined, manifest)
  console.log(JSON.stringify({ status: 'passed', criteria: ['measurement-integrity'], suiteId: manifest.suiteId, report }))
}
