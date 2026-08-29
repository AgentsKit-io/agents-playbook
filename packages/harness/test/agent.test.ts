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
  expect(events.map((event) => event.type)).toEqual(['run.created', 'state.transitioned', 'state.transitioned', 'session.started', 'agent.turn.started', 'policy.evaluated', 'tool.requested', 'tool.completed', 'agent.turn.started', 'policy.evaluated', 'tool.requested', 'tool.failed', 'session.ended'])
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
