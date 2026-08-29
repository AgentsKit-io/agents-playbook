import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { approveRun, authorizeRun, loadConfig, loadLatestRun, planRun, retryRun, startRun, verifyRun } from '../lib/index.js'

const quote = (value) => `'${value.replaceAll("'", "'\"'\"'")}'`
const nodeCheck = (value, exitCode = 0) => `${quote(process.execPath)} -e ${quote(`console.log(${JSON.stringify(JSON.stringify(value))}); process.exit(${exitCode})`)}`
const hash = (value) => createHash('sha256').update(value).digest('hex')

const project = (checks, { ambiguities = [], surfaces = {} } = {}) => {
  const root = mkdtempSync(join(tmpdir(), 'ak-harness-test-'))
  mkdirSync(join(root, '.codex'), { recursive: true })
  const configPath = join(root, '.codex', 'verification.json')
  const config = {
    schemaVersion: 1,
    project: 'fixture',
    root: '..',
    profile: 'strict',
    contract: {
      intent: 'Validate fixture behavior.',
      scope: { inScope: ['fixture'], outOfScope: ['production'] },
      ambiguities,
      outcomes: checks.map((check, index) => ({ id: `outcome-${index}`, statement: `Check ${check.id} passes.`, checks: [check.id] })),
    },
    surfaces: { logic: true, endpoint: false, database: false, cli: false, mcp: false, ui: false, docs: false, ...surfaces },
    checks,
    tracking: { required: false, reason: 'fixture only' },
    cleanup: { roots: ['.codex/verification/tmp'] },
  }
  writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`)
  return { root, configPath, stateDir: join(root, '.codex', 'verification'), config }
}

const runToVerify = async (fixture) => {
  await planRun({ configPath: fixture.configPath, decision: 'approved', actor: 'human' })
  startRun(loadConfig(fixture.configPath))
  return verifyRun({ configPath: fixture.configPath })
}

test('runs a complete local task through human approval', async () => {
  const fixture = project([{ id: 'logic', category: 'logic', command: nodeCheck({ status: 'passed', criteria: ['outcome-0'] }), evidence: 'structured' }])
  const verified = await runToVerify(fixture)
  assert.equal(verified.state, 'AWAITING_HUMAN_APPROVAL')
  const complete = await approveRun({ configPath: fixture.configPath, decision: 'approved', actor: 'human' })
  assert.equal(complete.state, 'COMPLETE')
  assert.equal(complete.outcomes[0].status, 'passed')
})

test('refuses to plan while ambiguities remain', async () => {
  const fixture = project([{ id: 'logic', category: 'logic', command: nodeCheck({ status: 'passed', criteria: ['outcome-0'] }), evidence: 'structured' }], { ambiguities: ['Which persistence boundary is in scope?'] })
  await assert.rejects(() => planRun({ configPath: fixture.configPath, decision: 'approved', actor: 'human' }), (error) => error.code === 'CLARIFYING')
  assert.equal(loadLatestRun(fixture.stateDir), null)
})

test('executes every required check and blocks on structured failure', async () => {
  const fixture = project([
    { id: 'first', category: 'logic', command: nodeCheck({ status: 'failed', criteria: ['outcome-0'] }), evidence: 'structured' },
    { id: 'second', category: 'logic', command: nodeCheck({ status: 'passed', criteria: ['outcome-1'] }), evidence: 'structured' },
  ])
  const blocked = await runToVerify(fixture)
  assert.equal(blocked.state, 'BLOCKED')
  assert.deepEqual(blocked.checks.map((check) => check.status), ['failed', 'passed'])
  const retry = await retryRun({ configPath: fixture.configPath })
  assert.equal(retry.state, 'IMPLEMENTING')
})

test('invalidates approval when the frozen contract changes', async () => {
  const fixture = project([{ id: 'logic', category: 'logic', command: nodeCheck({ status: 'passed', criteria: ['outcome-0'] }), evidence: 'structured' }])
  await runToVerify(fixture)
  fixture.config.contract.intent = 'Changed after execution.'
  writeFileSync(fixture.configPath, `${JSON.stringify(fixture.config, null, 2)}\n`)
  await assert.rejects(() => approveRun({ configPath: fixture.configPath, decision: 'approved', actor: 'human' }), (error) => error.code === 'STALE')
  assert.equal(loadLatestRun(fixture.stateDir).state, 'STALE')
})

test('validates real-browser screenshot evidence', async () => {
  const screenshot = 'deterministic screenshot fixture'
  const screenshotPath = join('artifacts', 'screen.txt')
  const fixture = project([{ id: 'ui', category: 'ui', execution: 'real', capabilities: ['real-browser', 'screenshot'], command: '', evidence: 'structured' }], { surfaces: { logic: false, ui: true } })
  mkdirSync(join(fixture.root, 'artifacts'))
  writeFileSync(join(fixture.root, screenshotPath), screenshot)
  fixture.config.checks[0].command = nodeCheck({ status: 'passed', criteria: ['outcome-0'], capability: 'real-browser', artifacts: [{ path: screenshotPath, sha256: hash(screenshot), viewport: { width: 1280, height: 720 } }] })
  writeFileSync(fixture.configPath, `${JSON.stringify(fixture.config, null, 2)}\n`)
  const verified = await runToVerify(fixture)
  assert.equal(verified.state, 'AWAITING_HUMAN_APPROVAL')
  assert.equal(verified.checks[0].evidence.artifacts[0].sha256, hash(readFileSync(join(fixture.root, screenshotPath))))
})

test('requires authorization only when tracking is declared', async () => {
  const fixture = project([{ id: 'logic', category: 'logic', command: nodeCheck({ status: 'passed', criteria: ['outcome-0'] }), evidence: 'structured' }])
  fixture.config.tracking = { required: true, target: 'github:fixture/repo#1' }
  writeFileSync(fixture.configPath, `${JSON.stringify(fixture.config, null, 2)}\n`)
  await runToVerify(fixture)
  const awaiting = await approveRun({ configPath: fixture.configPath, decision: 'approved', actor: 'human' })
  assert.equal(awaiting.state, 'AWAITING_AUTHORIZATION')
  const complete = await authorizeRun({ configPath: fixture.configPath, decision: 'approved', actor: 'human' })
  assert.equal(complete.state, 'COMPLETE')
})
