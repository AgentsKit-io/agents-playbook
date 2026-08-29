import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const packageRoot = resolve(import.meta.dirname, '../packages/harness')
const cli = resolve(packageRoot, 'dist/cli.js')
const fixtureRoot = mkdtempSync(join(tmpdir(), 'agentskit-harness-cli-flow-'))
const configPath = join(fixtureRoot, '.codex', 'verification.json')
const quote = (value) => `'${value.replaceAll("'", "'\"'\"'")}'`
const evidence = JSON.stringify({ status: 'passed', criteria: ['package'] })
const checkCommand = `${quote(process.execPath)} -e ${quote(`console.log(${JSON.stringify(evidence)})`)}`
const config = {
  schemaVersion: 1,
  project: 'cli-flow-fixture',
  root: '..',
  stateDir: '.codex/verification',
  profile: 'strict',
  contract: { intent: 'Exercise the public CLI lifecycle.', scope: { inScope: ['fixture'], outOfScope: ['production'] }, ambiguities: [], outcomes: [{ id: 'package', statement: 'The public CLI reaches human approval and preserves cancelled history.', checks: ['fixture-check'] }] },
  surfaces: { logic: true, endpoint: { required: false, reason: 'fixture' }, database: { required: false, reason: 'fixture' }, cli: { required: false, reason: 'fixture' }, mcp: { required: false, reason: 'fixture' }, ui: { required: false, reason: 'fixture' }, docs: { required: false, reason: 'fixture' } },
  checks: [{ id: 'fixture-check', category: 'logic', command: checkCommand, evidence: 'structured' }],
  tracking: { required: false, reason: 'fixture' },
}

const runCli = (args) => {
  const result = spawnSync(process.execPath, [cli, ...args, '--config', configPath, '--json'], { cwd: fixtureRoot, encoding: 'utf8' })
  if (result.status !== 0) throw new Error(`ak-harness ${args.join(' ')} failed: ${result.stderr || result.stdout}`)
  return JSON.parse(result.stdout.trim().split(/\r?\n/).at(-1))
}

try {
  if (!existsSync(cli)) throw new Error(`missing built CLI: ${cli}`)
  mkdirSync(join(fixtureRoot, '.codex'), { recursive: true })
  writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`)
  runCli(['plan', 'approved', '--by', 'human'])
  const started = runCli(['start'])
  if (started.state !== 'IMPLEMENTING') throw new Error(`expected IMPLEMENTING, got ${started.state}`)
  const verified = runCli(['run'])
  if (verified.state !== 'AWAITING_HUMAN_APPROVAL') throw new Error(`expected AWAITING_HUMAN_APPROVAL, got ${verified.state}`)
  const cancelled = runCli(['cancel', '--by', 'human', '--reason', 'CLI flow fixture cancellation.'])
  if (cancelled.state !== 'CANCELLED') throw new Error(`expected CANCELLED, got ${cancelled.state}`)
  const retried = runCli(['retry'])
  if (retried.state !== 'IMPLEMENTING' || retried.supersedes !== verified.runId) throw new Error('retry did not supersede the cancelled run')
  console.log(JSON.stringify({ status: 'passed', criteria: ['package'], finalState: retried.state, supersededRunId: verified.runId }))
} catch (error) {
  console.log(JSON.stringify({ status: 'failed', criteria: ['package'], failures: [error instanceof Error ? error.message : String(error)] }))
  process.exitCode = 1
} finally {
  rmSync(fixtureRoot, { recursive: true, force: true })
}
