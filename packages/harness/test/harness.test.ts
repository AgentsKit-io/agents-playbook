import { createHash } from 'node:crypto'
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, it } from 'vitest'
import { approveRun, authorizeRun, cancelRun, cleanTaskArtifacts, FileEventStore, loadConfig, loadLatestRun, planRun, reconcileRun, retryRun, startRun, validateConfig, verifyRun } from '../src/index.js'
import type { TrackingConfig, VerificationCheck, VerificationConfig } from '../src/index.js'

const quote = (value: string): string => `'${value.replaceAll("'", "'\"'\"'")}'`
const evidenceCommand = (value: unknown, exitCode = 0): string => `${quote(process.execPath)} -e ${quote(`console.log(${JSON.stringify(JSON.stringify(value))}); process.exit(${exitCode})`)} `
const hash = (value: string): string => createHash('sha256').update(value).digest('hex')

const project = (checks: VerificationCheck[], ambiguities: string[] = [], tracking: TrackingConfig = { required: false, reason: 'fixture only' }): { root: string; configPath: string; stateDir: string; config: VerificationConfig } => {
  const root = mkdtempSync(join(tmpdir(), 'agentskit-harness-test-'))
  mkdirSync(join(root, '.codex'), { recursive: true })
  const configPath = join(root, '.codex', 'verification.json')
  const hasLogic = checks.some((check) => check.category === 'logic')
  const hasUi = checks.some((check) => check.category === 'ui')
  const config = { schemaVersion: 1 as const, project: 'fixture', root: '..', profile: 'strict', contract: { intent: 'Validate fixture.', scope: { inScope: ['fixture'], outOfScope: ['production'] }, ambiguities, outcomes: checks.map((check, index) => ({ id: `outcome-${index}`, statement: `${String(check.id)} passes.`, checks: [check.id] })) }, surfaces: { logic: hasLogic, endpoint: { required: false, reason: 'fixture' }, database: { required: false, reason: 'fixture' }, cli: { required: false, reason: 'fixture' }, mcp: { required: false, reason: 'fixture' }, ui: hasUi, docs: { required: false, reason: 'fixture' } }, checks, tracking, cleanup: { roots: ['.codex/verification/tmp'] } }
  writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`)
  return { root, configPath, stateDir: join(root, '.codex', 'verification'), config: config as VerificationConfig }
}

const runToVerify = async (fixture: ReturnType<typeof project>) => {
  await planRun({ configPath: fixture.configPath, decision: 'approved' })
  startRun(loadConfig(fixture.configPath))
  return verifyRun({ configPath: fixture.configPath })
}

it('runs a complete typed task through human approval', async () => {
  const fixture = project([{ id: 'logic', category: 'logic', command: evidenceCommand({ status: 'passed', criteria: ['outcome-0'] }), evidence: 'structured' }])
  const verified = await runToVerify(fixture)
  const approved = await approveRun({ configPath: fixture.configPath, decision: 'approved' })
  expect(approved.state).toBe('COMPLETE')
  expect(approved.humanApproval?.verificationDigest).toBe(verified.verificationDigest)
  expect(new FileEventStore(fixture.stateDir).read(verified.runId).at(-1)).toMatchObject({ type: 'approval.recorded', payload: { decision: 'approved', resultingState: 'COMPLETE', verificationDigest: verified.verificationDigest, sourceRevision: verified.sourceRevision, contractHash: verified.contractHash } })
})

it('lets CI prepare verification without impersonating human approval', async () => {
  const fixture = project([{ id: 'logic', category: 'logic', command: evidenceCommand({ status: 'passed', criteria: ['outcome-0'] }), evidence: 'structured' }])
  const prepared = await planRun({ configPath: fixture.configPath, decision: 'prepared', actor: 'ci' })
  expect(prepared.state).toBe('PLANNED')
  expect(prepared.contractApproval).toBeUndefined()
  expect(prepared.contractPreparation).toMatchObject({ actor: 'ci', contractHash: prepared.contractHash })
  startRun(loadConfig(fixture.configPath))
  const verified = await verifyRun({ configPath: fixture.configPath })
  expect(verified.state).toBe('AWAITING_HUMAN_APPROVAL')
  expect((await approveRun({ configPath: fixture.configPath, decision: 'approved' })).state).toBe('COMPLETE')
})

it('rejects CI attempts to approve a contract', async () => {
  const fixture = project([{ id: 'logic', category: 'logic', command: evidenceCommand({ status: 'passed', criteria: ['outcome-0'] }), evidence: 'structured' }])
  await expect(planRun({ configPath: fixture.configPath, decision: 'approved', actor: 'ci' })).rejects.toMatchObject({ code: 'HUMAN_APPROVAL_REQUIRED' })
})

it('preserves CI preparation across retries', async () => {
  const fixture = project([{ id: 'logic', category: 'logic', command: evidenceCommand({ status: 'failed', criteria: ['outcome-0'] }), evidence: 'structured' }])
  await planRun({ configPath: fixture.configPath, decision: 'prepared', actor: 'ci' })
  startRun(loadConfig(fixture.configPath))
  expect((await verifyRun({ configPath: fixture.configPath })).state).toBe('BLOCKED')
  const retry = await retryRun({ configPath: fixture.configPath })
  expect(retry.contractApproval).toBeUndefined()
  expect(retry.contractPreparation?.actor).toBe('ci')
})

it('rejects approval when the verification projection is tampered with', async () => {
  const fixture = project([{ id: 'logic', category: 'logic', command: evidenceCommand({ status: 'passed', criteria: ['outcome-0'] }), evidence: 'structured' }])
  const verified = await runToVerify(fixture)
  writeFileSync(join(fixture.stateDir, 'runs', verified.runId, 'run.json'), `${JSON.stringify({ ...verified, outcomes: verified.outcomes.map((outcome) => ({ ...outcome, statement: 'tampered' })) }, null, 2)}\n`)
  await expect(approveRun({ configPath: fixture.configPath, decision: 'approved' })).rejects.toThrow(/attestation/)
})

it('reconciles terminal decisions and rejects post-approval tampering', async () => {
  const fixture = project([{ id: 'logic', category: 'logic', command: evidenceCommand({ status: 'passed', criteria: ['outcome-0'] }), evidence: 'structured' }])
  const verified = await runToVerify(fixture)
  const approved = await approveRun({ configPath: fixture.configPath, decision: 'approved' })
  expect(await reconcileRun({ configPath: fixture.configPath })).toMatchObject({ status: 'verified', runId: approved.runId, state: 'COMPLETE', verificationDigest: verified.verificationDigest })
  const runPath = join(fixture.stateDir, 'runs', approved.runId, 'run.json')
  const originalRun = readFileSync(runPath, 'utf8')
  writeFileSync(runPath, `${JSON.stringify({ ...approved, state: 'COMPLETE', humanApproval: { ...approved.humanApproval, verificationDigest: 'tampered' } }, null, 2)}\n`)
  await expect(reconcileRun({ configPath: fixture.configPath })).rejects.toThrow(/projection|attestation/)
  writeFileSync(runPath, originalRun)
  const eventPath = join(fixture.stateDir, 'runs', approved.runId, 'events.ndjson')
  const eventLines = readFileSync(eventPath, 'utf8').trim().split('\n')
  writeFileSync(eventPath, `${eventLines.slice(0, -1).join('\n')}\n`)
  await expect(reconcileRun({ configPath: fixture.configPath })).rejects.toThrow(/approval event/)
})

it('refuses to plan while ambiguities remain', async () => {
  const fixture = project([{ id: 'logic', category: 'logic', command: evidenceCommand({ status: 'passed', criteria: ['outcome-0'] }), evidence: 'structured' }], ['Which persistence boundary is in scope?'])
  await expect(planRun({ configPath: fixture.configPath, decision: 'approved' })).rejects.toMatchObject({ code: 'CLARIFYING' })
  expect(loadLatestRun(fixture.stateDir)).toBeNull()
})

it('executes every configured check and blocks on structured failure', async () => {
  const fixture = project([{ id: 'first', category: 'logic', command: evidenceCommand({ status: 'failed', criteria: ['outcome-0'] }), evidence: 'structured' }, { id: 'second', category: 'logic', command: evidenceCommand({ status: 'passed', criteria: ['outcome-1'] }), evidence: 'structured' }])
  const blocked = await runToVerify(fixture)
  expect(blocked.state).toBe('BLOCKED')
  expect(blocked.checks.map((check) => check.status)).toEqual(['failed', 'passed'])
  expect((await retryRun({ configPath: fixture.configPath })).state).toBe('IMPLEMENTING')
})

it('invalidates approval when the frozen contract changes', async () => {
  const fixture = project([{ id: 'logic', category: 'logic', command: evidenceCommand({ status: 'passed', criteria: ['outcome-0'] }), evidence: 'structured' }])
  await runToVerify(fixture)
  const changedConfig = { ...fixture.config, contract: { ...fixture.config.contract, intent: 'Changed after execution.' } }
  writeFileSync(fixture.configPath, `${JSON.stringify(changedConfig, null, 2)}\n`)
  await expect(approveRun({ configPath: fixture.configPath, decision: 'approved' })).rejects.toMatchObject({ code: 'STALE' })
  expect(loadLatestRun(fixture.stateDir)?.state).toBe('STALE')
})

it('validates real-browser screenshot evidence and its hash', async () => {
  const screenshot = 'deterministic screenshot fixture'
  const fixture = project([{ id: 'ui', category: 'ui', execution: 'real', capabilities: ['real-browser', 'screenshot'], command: evidenceCommand({ status: 'passed', criteria: ['outcome-0'], capability: 'real-browser', artifacts: [{ type: 'screenshot', path: 'artifacts/screen.txt', sha256: hash(screenshot), viewport: { width: 1280, height: 720 } }] }), evidence: 'structured' }])
  mkdirSync(join(fixture.root, 'artifacts')); writeFileSync(join(fixture.root, 'artifacts/screen.txt'), screenshot)
  expect((await runToVerify(fixture)).state).toBe('AWAITING_HUMAN_APPROVAL')
  expect(loadLatestRun(fixture.stateDir)?.checks[0].evidence?.artifacts?.[0]?.sha256).toBe(hash(readFileSync(join(fixture.root, 'artifacts/screen.txt')).toString()))
})

it('requires authorization only when tracking is declared', async () => {
  const fixture = project([{ id: 'logic', category: 'logic', command: evidenceCommand({ status: 'passed', criteria: ['outcome-0'] }), evidence: 'structured' }], [], { required: true, target: 'github:fixture/repo#1' })
  await runToVerify(fixture)
  expect((await approveRun({ configPath: fixture.configPath, decision: 'approved' })).state).toBe('AWAITING_AUTHORIZATION')
  const authorized = await authorizeRun({ configPath: fixture.configPath, decision: 'approved' })
  expect(authorized.state).toBe('COMPLETE')
  expect(authorized.authorization?.verificationDigest).toBe(authorized.humanApproval?.verificationDigest)
  expect(new FileEventStore(fixture.stateDir).read(authorized.runId).at(-1)).toMatchObject({ type: 'authorization.recorded', payload: { decision: 'approved', resultingState: 'COMPLETE', verificationDigest: authorized.verificationDigest, target: 'github:fixture/repo#1' } })
})

it('blocks a human rejection instead of treating it as completion', async () => {
  const fixture = project([{ id: 'logic', category: 'logic', command: evidenceCommand({ status: 'passed', criteria: ['outcome-0'] }), evidence: 'structured' }])
  const verified = await runToVerify(fixture)
  expect((await approveRun({ configPath: fixture.configPath, decision: 'rejected' })).state).toBe('BLOCKED')
  expect(new FileEventStore(fixture.stateDir).read(verified.runId).at(-1)).toMatchObject({ type: 'approval.recorded', payload: { decision: 'rejected', resultingState: 'BLOCKED', verificationDigest: verified.verificationDigest } })
})

it('cancels an active run and supersedes it on retry', async () => {
  const fixture = project([{ id: 'logic', category: 'logic', command: evidenceCommand({ status: 'passed', criteria: ['outcome-0'] }), evidence: 'structured' }])
  await planRun({ configPath: fixture.configPath, decision: 'approved' })
  const cancelled = await cancelRun({ configPath: fixture.configPath, reason: 'Fixture cancellation.' })
  expect(cancelled.state).toBe('CANCELLED')
  const retried = await retryRun({ configPath: fixture.configPath })
  expect(retried.state).toBe('IMPLEMENTING')
  const superseded = JSON.parse(readFileSync(join(fixture.stateDir, 'runs', cancelled.runId, 'run.json'), 'utf8')) as { state: string }
  expect(superseded.state).toBe('SUPERSEDED')
})

it('blocks when a required check omits structured evidence', async () => {
  const fixture = project([{ id: 'logic', category: 'logic', command: `${process.execPath} -e "process.stdout.write('done')"`, evidence: 'structured' }])
  const blocked = await runToVerify(fixture)
  expect(blocked.state).toBe('BLOCKED')
  expect(blocked.checks[0].failures).toContain('missing final structured evidence')
})

it('blocks screenshot evidence that escapes the project root', async () => {
  const fixture = project([{ id: 'ui', category: 'ui', execution: 'real', capabilities: ['real-browser', 'screenshot'], command: evidenceCommand({ status: 'passed', criteria: ['outcome-0'], capability: 'real-browser', artifacts: [{ type: 'screenshot', path: '../outside.png', sha256: hash('outside'), viewport: { width: 1280, height: 720 } }] }), evidence: 'structured' }])
  const blocked = await runToVerify(fixture)
  expect(blocked.state).toBe('BLOCKED')
  expect(blocked.checks[0].failures?.some((failure) => failure.includes('artifact path escapes project root'))).toBe(true)
})

it('blocks a check that exceeds its declared timeout', async () => {
  const fixture = project([{ id: 'slow', category: 'logic', timeoutMs: 10, command: `${process.execPath} -e "setTimeout(() => {}, 100)"`, evidence: 'structured' }])
  const blocked = await runToVerify(fixture)
  expect(blocked.state).toBe('BLOCKED')
  expect(blocked.checks[0].failures).toContain('check timed out')
})

it('rejects UI checks without real-browser and screenshot capabilities', () => {
  expect(() => validateConfig({ schemaVersion: 1, project: 'invalid-ui', contract: { intent: 'test', scope: { inScope: ['fixture'], outOfScope: [] }, ambiguities: [], outcomes: [{ id: 'ui-outcome', statement: 'test', checks: ['ui'] }] }, checks: [{ id: 'ui', category: 'ui', execution: 'real', command: 'true', evidence: 'structured' }], surfaces: { logic: false, endpoint: false, database: false, cli: false, mcp: false, ui: true, docs: false }, tracking: { required: false, reason: 'test' } })).toThrow(/real-browser/)
})

it('rejects required checks that are not mapped to an outcome', () => {
  const fixture = project([{ id: 'logic', category: 'logic', command: evidenceCommand({ status: 'passed', criteria: ['outcome-0'] }), evidence: 'structured' }])
  const raw = JSON.parse(readFileSync(fixture.configPath, 'utf8')) as { contract: { outcomes: Array<{ checks: string[] }> } }
  raw.contract.outcomes[0].checks = []
  expect(() => validateConfig(raw)).toThrow(/every required check must map to an outcome/)
})

it('requires real execution for CLI, endpoint, database, MCP, and UI checks', () => {
  const fixture = project([{ id: 'cli', category: 'cli', command: 'true', evidence: 'structured' }])
  expect(() => loadConfig(fixture.configPath)).toThrow(/execution: real/)
})

it('rejects approval attempts made by an agent actor', async () => {
  const fixture = project([{ id: 'logic', category: 'logic', command: evidenceCommand({ status: 'passed', criteria: ['outcome-0'] }), evidence: 'structured' }])
  await runToVerify(fixture)
  await expect(approveRun({ configPath: fixture.configPath, decision: 'approved', actor: 'agent' })).rejects.toMatchObject({ code: 'HUMAN_APPROVAL_REQUIRED' })
})

it('blocks rejected external tracking authorization', async () => {
  const fixture = project([{ id: 'logic', category: 'logic', command: evidenceCommand({ status: 'passed', criteria: ['outcome-0'] }), evidence: 'structured' }], [], { required: true, target: 'github:fixture/repo#1' })
  await runToVerify(fixture)
  await approveRun({ configPath: fixture.configPath, decision: 'approved' })
  expect((await authorizeRun({ configPath: fixture.configPath, decision: 'rejected' })).state).toBe('BLOCKED')
})

it('rejects cleanup roots outside the project', () => {
  const fixture = project([{ id: 'logic', category: 'logic', command: evidenceCommand({ status: 'passed', criteria: ['outcome-0'] }), evidence: 'structured' }])
  const raw = JSON.parse(readFileSync(fixture.configPath, 'utf8')) as { cleanup: { roots: string[] } }
  raw.cleanup.roots = ['..']
  writeFileSync(fixture.configPath, `${JSON.stringify(raw, null, 2)}\n`)
  expect(() => cleanTaskArtifacts(fixture.configPath)).toThrow(/Cleanup root escapes project root/)
})
