import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const cli = resolve(root, 'packages/harness/dist/cli.js')
const fixture = process.argv.includes('--fixture')
const fixtureRoot = fixture ? mkdtempSync(join(tmpdir(), 'agentskit-harness-ci-evidence-')) : root
const configPath = fixture ? join(fixtureRoot, '.codex', 'verification.json') : join(root, '.codex', 'verification.json')

const fixtureConfig = {
  schemaVersion: 1,
  project: 'ci-evidence-fixture',
  root: '..',
  stateDir: '.codex/verification',
  profile: 'strict',
  contract: { intent: 'Exercise CI evidence generation.', scope: { inScope: ['fixture'], outOfScope: [] }, ambiguities: [], outcomes: [{ id: 'fixture', statement: 'The CI evidence probe passes.', checks: ['probe'] }] },
  surfaces: { logic: true, endpoint: false, database: false, cli: false, mcp: false, ui: false, docs: false },
  checks: [{ id: 'probe', category: 'logic', command: `${process.execPath} -e ${JSON.stringify("console.log(JSON.stringify({status:'passed',criteria:['fixture']}))")}`, evidence: 'structured' }],
  tracking: { required: false, reason: 'fixture' },
}

const run = (args) => {
  const result = spawnSync(process.execPath, [cli, '--config', configPath, ...args, '--json'], { cwd: fixtureRoot, encoding: 'utf8' })
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `CLI failed: ${args.join(' ')}`)
  return JSON.parse(result.stdout.trim().split(/\r?\n/).at(-1))
}

try {
  if (!existsSync(cli)) throw new Error(`missing built CLI: ${cli}`)
  if (fixture) {
    mkdirSync(join(fixtureRoot, '.codex'), { recursive: true })
    writeFileSync(configPath, `${JSON.stringify(fixtureConfig, null, 2)}\n`, { encoding: 'utf8' })
    run(['plan', 'approved', '--by', 'human'])
  } else {
    run(['plan', 'approved', '--by', 'human'])
  }
  run(['start'])
  const verified = run(['run'])
  if (verified.state !== 'AWAITING_HUMAN_APPROVAL') throw new Error(`expected AWAITING_HUMAN_APPROVAL, got ${verified.state}`)
  console.log(JSON.stringify({ status: 'passed', criteria: ['ci-evidence'], state: verified.state, runId: verified.runId }))
} catch (error) {
  console.log(JSON.stringify({ status: 'failed', criteria: ['ci-evidence'], failures: [error instanceof Error ? error.message : String(error)] }))
  process.exitCode = 1
} finally {
  if (fixture) rmSync(fixtureRoot, { recursive: true, force: true })
}
