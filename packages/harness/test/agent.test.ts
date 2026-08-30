import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, it } from 'vitest'
import { createPolicyGate, createSessionRecorder, createToolRuntime, FileEventStore, loadConfig, planRun, startRun } from '../src/index.js'

const fixture = async (): Promise<{ readonly root: string; readonly run: Awaited<ReturnType<typeof startRun>> }> => {
  const root = mkdtempSync(join(tmpdir(), 'agentskit-harness-agent-test-'))
  mkdirSync(join(root, '.codex'), { recursive: true })
  writeFileSync(join(root, '.codex', 'verification.json'), JSON.stringify({
    schemaVersion: 1, project: 'agent-fixture', root: '..', profile: 'strict',
    contract: { intent: 'Capture an agent session.', scope: { inScope: ['fixture'], outOfScope: ['production'] }, ambiguities: [], outcomes: [{ id: 'outcome', statement: 'The fixture is valid.', checks: ['logic'] }] },
    surfaces: { logic: true, endpoint: false, database: false, cli: false, mcp: false, ui: false, docs: false },
    checks: [{ id: 'logic', category: 'logic', command: 'true', evidence: 'structured' }], tracking: { required: false, reason: 'fixture' },
  }, null, 2))
  const configPath = join(root, '.codex', 'verification.json')
  await planRun({ configPath, decision: 'approved' })
  return { root, run: startRun(loadConfig(configPath)) }
}

const adapter = { id: 'fixture-agent', version: '1.0.0', capabilities: ['tool-calls'] } as const
const policy = createPolicyGate({ rules: [{ id: 'allow-shell', effect: 'allow', toolIds: ['shell'], reason: 'fixture allows shell' }] })
const runtime = createToolRuntime({ tools: [{ toolId: 'shell', execute: async ({ arguments: input }) => ({ echoed: input }) }] })

it('records a privacy-preserving, correlated session and tool lifecycle', async () => {
  const { root, run } = await fixture()
  const stateDir = join(root, '.codex', 'verification')
  const recorder = createSessionRecorder({ stateDir, run, adapter, policy, runtime, sessionId: 'session-1' })
  recorder.startTurn('input-hash', 'turn-1')
  recorder.requestTool({ turnId: 'turn-1', actionId: 'action-1', toolId: 'shell', argumentsHash: 'arguments-hash' })
  await expect(recorder.executeTool({ actionId: 'action-1', arguments: { command: 'echo secret' } })).resolves.toMatchObject({ status: 'completed' })
  recorder.startTurn('input-hash-2', 'turn-2')
  recorder.requestTool({ turnId: 'turn-2', actionId: 'action-2', toolId: 'shell', argumentsHash: 'arguments-hash-2' })
  recorder.failTool({ actionId: 'action-2', errorCode: 'TIMEOUT', retryable: true, durationMs: 12 })
  recorder.end('completed')
  const events = new FileEventStore(stateDir).read(run.runId)
  expect(events.map((event) => event.type)).toEqual(['run.created', 'state.transitioned', 'state.transitioned', 'session.started', 'agent.turn.started', 'policy.evaluated', 'tool.requested', 'tool.execution.started', 'tool.completed', 'agent.turn.started', 'policy.evaluated', 'tool.requested', 'tool.failed', 'session.ended'])
  expect(events.slice(3).every((event) => event.sessionId === 'session-1')).toBe(true)
  expect(readFileSync(join(stateDir, 'runs', run.runId, 'events.ndjson'), 'utf8')).not.toContain('raw prompt or tool arguments')
})

it('rejects invalid ordering, duplicate actions, pending completion, and post-end calls', async () => {
  const { root, run } = await fixture()
  const recorder = createSessionRecorder({ stateDir: join(root, '.codex', 'verification'), run, adapter, policy, runtime })
  expect(() => recorder.requestTool({ turnId: 'missing', toolId: 'shell', argumentsHash: 'hash' })).toThrow(/Turn does not exist/)
  recorder.startTurn('input', 'turn')
  recorder.requestTool({ turnId: 'turn', actionId: 'action', toolId: 'shell', argumentsHash: 'hash' })
  expect(() => recorder.requestTool({ turnId: 'turn', actionId: 'action', toolId: 'shell', argumentsHash: 'hash' })).toThrow(/already exists/)
  expect(() => recorder.end('completed')).toThrow(/pending/)
  recorder.completeTool({ actionId: 'action', resultHash: 'result', durationMs: 0 })
  expect(() => recorder.completeTool({ actionId: 'action', resultHash: 'result', durationMs: 0 })).toThrow(/not pending/)
  recorder.end('completed')
  expect(() => recorder.startTurn('input-2')).toThrow(/already ended/)
  const blocked = createSessionRecorder({ stateDir: join(root, '.codex', 'verification'), run, adapter, policy: createPolicyGate({ rules: [] }), runtime, sessionId: 'blocked-session' })
  blocked.startTurn('blocked-input', 'blocked-turn')
  expect(() => blocked.requestTool({ turnId: 'blocked-turn', actionId: 'blocked-action', toolId: 'network', argumentsHash: 'hash' })).toThrow(/blocked by policy/)
  blocked.end('failed')
  const events = new FileEventStore(join(root, '.codex', 'verification')).read(run.runId)
  expect(events.some((event) => event.type === 'policy.evaluated' && event.payload.decision === 'block')).toBe(true)
  expect(events.some((event) => event.type === 'tool.blocked' && event.payload.actionId === 'blocked-action')).toBe(true)
})

it('requires implementation state and validates adapter metadata', async () => {
  const root = mkdtempSync(join(tmpdir(), 'agentskit-harness-agent-state-test-'))
  const run = { runId: 'planned', state: 'PLANNED', sourceRevision: 'revision', configHash: 'config' } as const
  expect(() => createSessionRecorder({ stateDir: root, run: run as never, adapter, policy, runtime })).toThrow(/IMPLEMENTING/)
  const implementing = { ...run, state: 'IMPLEMENTING' } as const
  expect(() => createSessionRecorder({ stateDir: root, run: implementing as never, adapter: { ...adapter, capabilities: [''] }, policy, runtime })).toThrow(/capabilities/)
})

it('closes a failed execution and requires a fresh policy-approved action for recovery', async () => {
  const { root, run } = await fixture()
  let attempts = 0
  const flaky = createToolRuntime({ tools: [{ toolId: 'shell', execute: async () => { attempts += 1; if (attempts === 1) throw new Error('transient'); return 'recovered' } }] })
  const recorder = createSessionRecorder({ stateDir: join(root, '.codex', 'verification'), run, adapter, policy, runtime: flaky })
  const turn = recorder.startTurn('recovery-input', 'recovery-turn')
  const first = recorder.requestTool({ turnId: turn.payload.turnId, actionId: 'failed-action', toolId: 'shell', argumentsHash: 'hash-1' })
  await expect(recorder.executeTool({ actionId: first.payload.actionId, arguments: { attempt: 1 } })).resolves.toMatchObject({ status: 'failed', errorCode: 'RUNTIME_ERROR' })
  const second = recorder.requestTool({ turnId: turn.payload.turnId, actionId: 'recovered-action', toolId: 'shell', argumentsHash: 'hash-2' })
  await expect(recorder.executeTool({ actionId: second.payload.actionId, arguments: { attempt: 2 } })).resolves.toMatchObject({ status: 'completed' })
  recorder.end('completed')
})

it('requires human approval before sensitive tools execute and records rejection', async () => {
  const { root, run } = await fixture()
  let executions = 0
  const recorder = createSessionRecorder({
    stateDir: join(root, '.codex', 'verification'),
    run,
    adapter,
    policy: createPolicyGate({ rules: [{ id: 'approve-sensitive', effect: 'approve', toolIds: ['sensitive'], reason: 'sensitive tool requires review' }] }),
    runtime: { execute: async () => { executions += 1; return 'should not run' } },
    sessionId: 'approval-session',
  })
  recorder.startTurn('approval-input', 'approval-turn')
  const requested = recorder.requestTool({ turnId: 'approval-turn', actionId: 'sensitive-action', toolId: 'sensitive', argumentsHash: 'sensitive-arguments' })
  expect(requested.type).toBe('tool.approval.requested')
  await expect(recorder.executeTool({ actionId: 'sensitive-action', arguments: { secret: 'never persisted' } })).rejects.toThrow(/not pending/)
  expect(() => recorder.end('completed')).toThrow(/approvals are pending/)
  expect(recorder.approveTool({ actionId: 'sensitive-action', decision: 'rejected' }).type).toBe('tool.blocked')
  recorder.end('failed')
  expect(executions).toBe(0)
  const events = new FileEventStore(join(root, '.codex', 'verification')).read(run.runId)
  expect(events.some((event) => event.type === 'tool.approval.requested' && event.payload.actionId === 'sensitive-action')).toBe(true)
  expect(events.some((event) => event.type === 'tool.approval.recorded' && event.payload.decision === 'rejected' && event.payload.actor === 'human')).toBe(true)
  expect(readFileSync(join(root, '.codex', 'verification', 'runs', run.runId, 'events.ndjson'), 'utf8')).not.toContain('never persisted')

  const approvedFixture = await fixture()
  const approvedRecorder = createSessionRecorder({
    stateDir: join(approvedFixture.root, '.codex', 'verification'),
    run: approvedFixture.run,
    adapter,
    policy: createPolicyGate({ rules: [{ id: 'approve-sensitive', effect: 'approve', toolIds: ['sensitive'], reason: 'sensitive tool requires review' }] }),
    runtime: createToolRuntime({ tools: [{ toolId: 'sensitive', execute: async () => { executions += 1; return 'approved' } }] }),
    sessionId: 'approved-session',
  })
  approvedRecorder.startTurn('approved-input', 'approved-turn')
  approvedRecorder.requestTool({ turnId: 'approved-turn', actionId: 'approved-action', toolId: 'sensitive', argumentsHash: 'approved-arguments' })
  const released = approvedRecorder.approveTool({ actionId: 'approved-action', decision: 'approved' })
  expect(released.type).toBe('tool.requested')
  await expect(approvedRecorder.executeTool({ actionId: 'approved-action', arguments: { safe: true } })).resolves.toMatchObject({ status: 'completed' })
  approvedRecorder.end('completed')
  expect(executions).toBe(1)
})

it('resumes pending approvals from the event log without replaying completed tools', async () => {
  const { root, run } = await fixture()
  let executions = 0
  const policy = createPolicyGate({ rules: [{ id: 'approve-sensitive', effect: 'approve', toolIds: ['sensitive'], reason: 'sensitive tool requires review' }] })
  const runtime = createToolRuntime({ tools: [{ toolId: 'sensitive', execute: async () => { executions += 1; return 'resumed' } }] })
  const stateDir = join(root, '.codex', 'verification')
  const interrupted = createSessionRecorder({ stateDir, run, adapter, policy, runtime, sessionId: 'recoverable-session' })
  interrupted.startTurn('input-hash', 'recoverable-turn')
  interrupted.requestTool({ turnId: 'recoverable-turn', actionId: 'recoverable-action', toolId: 'sensitive', argumentsHash: 'recoverable-arguments' })

  const resumed = createSessionRecorder({ stateDir, run, adapter, policy, runtime, sessionId: 'recoverable-session', resume: true })
  await expect(resumed.executeTool({ actionId: 'recoverable-action', arguments: { beforeApproval: true } })).rejects.toThrow(/not pending/)
  resumed.approveTool({ actionId: 'recoverable-action', decision: 'approved' })
  await expect(resumed.executeTool({ actionId: 'recoverable-action', arguments: { afterApproval: true } })).resolves.toMatchObject({ status: 'completed' })
  resumed.end('completed')
  expect(executions).toBe(1)
  const events = new FileEventStore(stateDir).read(run.runId)
  expect(events.some((event) => event.type === 'session.resumed' && event.sessionId === 'recoverable-session')).toBe(true)
  expect(events.filter((event) => event.type === 'tool.completed' && event.payload.actionId === 'recoverable-action')).toHaveLength(1)
})

it('requires an explicit human decision before recovering a possibly started action', async () => {
  const { root, run } = await fixture()
  let executions = 0
  const stateDir = join(root, '.codex', 'verification')
  const runtime = createToolRuntime({ tools: [{ toolId: 'shell', execute: async () => { executions += 1; return 'recovered' } }] })
  const interrupted = createSessionRecorder({ stateDir, run, adapter, policy, runtime, sessionId: 'started-action-session' })
  const turn = interrupted.startTurn('input', 'started-action-turn')
  interrupted.requestTool({ turnId: turn.payload.turnId, actionId: 'started-action', toolId: 'shell', argumentsHash: 'arguments' })
  new FileEventStore(stateDir).append({ runId: run.runId, sourceRevision: run.sourceRevision, configHash: run.configHash, sessionId: 'started-action-session', type: 'tool.execution.started', payload: { turnId: turn.payload.turnId, actionId: 'started-action', toolId: 'shell', attempt: 1 } })

  const resumed = createSessionRecorder({ stateDir, run, adapter, policy, runtime, sessionId: 'started-action-session', resume: true })
  await expect(resumed.executeTool({ actionId: 'started-action', arguments: { retry: false } })).rejects.toThrow(/requires human recovery decision/)
  expect(() => resumed.recoverTool({ actionId: 'started-action', decision: 'retry', actor: 'human' })).not.toThrow()
  await expect(resumed.executeTool({ actionId: 'started-action', arguments: { retry: true } })).resolves.toMatchObject({ status: 'completed' })
  resumed.end('completed')
  expect(executions).toBe(1)
  const events = new FileEventStore(stateDir).read(run.runId)
  expect(events.some((event) => event.type === 'tool.recovery.recorded' && event.payload.actionId === 'started-action' && event.payload.decision === 'retry' && event.payload.actor === 'human')).toBe(true)
  expect(events.filter((event) => event.type === 'tool.execution.started' && event.payload.actionId === 'started-action').map((event) => event.payload.attempt)).toEqual([1, 2])
})

it('can abandon a possibly started action without entering the runtime', async () => {
  const { root, run } = await fixture()
  let executions = 0
  const stateDir = join(root, '.codex', 'verification')
  const runtime = createToolRuntime({ tools: [{ toolId: 'shell', execute: async () => { executions += 1; return 'must-not-run' } }] })
  const interrupted = createSessionRecorder({ stateDir, run, adapter, policy, runtime, sessionId: 'abandoned-action-session' })
  const turn = interrupted.startTurn('input', 'abandoned-action-turn')
  interrupted.requestTool({ turnId: turn.payload.turnId, actionId: 'abandoned-action', toolId: 'shell', argumentsHash: 'arguments' })
  new FileEventStore(stateDir).append({ runId: run.runId, sourceRevision: run.sourceRevision, configHash: run.configHash, sessionId: 'abandoned-action-session', type: 'tool.execution.started', payload: { turnId: turn.payload.turnId, actionId: 'abandoned-action', toolId: 'shell', attempt: 1 } })

  const resumed = createSessionRecorder({ stateDir, run, adapter, policy, runtime, sessionId: 'abandoned-action-session', resume: true })
  expect(resumed.recoverTool({ actionId: 'abandoned-action', decision: 'abandon' }).type).toBe('tool.blocked')
  await expect(resumed.executeTool({ actionId: 'abandoned-action', arguments: {} })).rejects.toThrow(/not pending/)
  resumed.end('failed')
  expect(executions).toBe(0)
})

it('persists runtime attestation with the terminal tool event', async () => {
  const { root, run } = await fixture()
  const runtimeWithEvidence = {
    execute: async () => ({
      status: 'completed' as const,
      resultHash: 'result-hash',
      durationMs: 4,
      runtimeEvidence: {
        provider: 'docker' as const,
        profileHash: 'profile-hash',
        image: 'node:22.13.0-bookworm-slim',
        imageDigest: `sha256:${'a'.repeat(64)}`,
        network: 'none' as const,
        readOnlyRootFilesystem: true as const,
        noNewPrivileges: true as const,
        capabilities: 'drop-all' as const,
        user: '65532:65532',
        memoryLimit: '512m',
        cpus: '1',
        pidsLimit: 128,
      },
    }),
  }
  const recorder = createSessionRecorder({ stateDir: join(root, '.codex', 'verification'), run, adapter, policy, runtime: runtimeWithEvidence, sessionId: 'attested-session' })
  recorder.startTurn('attested-input', 'attested-turn')
  const action = recorder.requestTool({ turnId: 'attested-turn', actionId: 'attested-action', toolId: 'shell', argumentsHash: 'attested-arguments' })
  await recorder.executeTool({ actionId: action.payload.actionId, arguments: { fixture: true } })
  recorder.end('completed')
  const completed = new FileEventStore(join(root, '.codex', 'verification')).read(run.runId).find((event) => event.type === 'tool.completed')
  expect(completed?.payload).toMatchObject({ actionId: 'attested-action', runtimeEvidence: { provider: 'docker', imageDigest: `sha256:${'a'.repeat(64)}` } })
})
