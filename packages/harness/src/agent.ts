import { randomUUID } from 'node:crypto'
import { FileEventStore } from './events.js'
import { fail } from './errors.js'
import type { HarnessEvent, HarnessEventInput, HarnessEventPayloads } from './events.js'
import type { PolicyGate } from './policy.js'
import type { ToolExecutionResult, ToolRuntime } from './runtime.js'
import type { VerificationRun } from './types.js'

export interface AgentAdapter {
  readonly id: string
  readonly version: string
  readonly capabilities: readonly string[]
}

export interface AgentSessionOptions {
  readonly stateDir: string
  readonly run: VerificationRun
  readonly adapter: AgentAdapter
  readonly policy: PolicyGate
  readonly runtime: ToolRuntime
  readonly sessionId?: string
  readonly resume?: boolean
}

export interface SessionRecorder {
  readonly sessionId: string
  startTurn(inputHash: string, turnId?: string): HarnessEvent<'agent.turn.started'>
  requestTool(input: { readonly turnId: string; readonly toolId: string; readonly argumentsHash: string; readonly actionId?: string }): HarnessEvent<'tool.requested'> | HarnessEvent<'tool.approval.requested'>
  approveTool(input: { readonly actionId: string; readonly decision: 'approved' | 'rejected'; readonly actor?: 'human' }): HarnessEvent<'tool.requested'> | HarnessEvent<'tool.blocked'>
  recoverTool(input: { readonly actionId: string; readonly decision: 'retry' | 'abandon'; readonly actor?: 'human' }): HarnessEvent<'tool.recovery.recorded'> | HarnessEvent<'tool.blocked'>
  completeTool(input: { readonly actionId: string; readonly resultHash: string; readonly durationMs: number; readonly runtimeEvidence?: ToolExecutionResult['runtimeEvidence'] }): HarnessEvent<'tool.completed'>
  failTool(input: { readonly actionId: string; readonly errorCode: string; readonly retryable: boolean; readonly durationMs: number; readonly runtimeEvidence?: ToolExecutionResult['runtimeEvidence'] }): HarnessEvent<'tool.failed'>
  executeTool(input: { readonly actionId: string; readonly arguments: unknown }): Promise<ToolExecutionResult>
  end(status: 'completed' | 'failed' | 'cancelled'): HarnessEvent<'session.ended'>
}

type SessionEventType = 'session.started' | 'session.resumed' | 'agent.turn.started' | 'policy.evaluated' | 'tool.approval.requested' | 'tool.approval.recorded' | 'tool.requested' | 'tool.execution.started' | 'tool.recovery.recorded' | 'tool.blocked' | 'tool.completed' | 'tool.failed' | 'session.ended'

const required = (value: string, label: string): string => {
  if (typeof value !== 'string' || !value.trim()) fail(`${label} is required.`, 'INVALID_INPUT')
  return value.trim()
}

const duration = (value: number): number => {
  if (!Number.isFinite(value) || value < 0) fail('Tool durationMs must be a non-negative number.', 'INVALID_INPUT')
  return value
}

export const createSessionRecorder = ({ stateDir, run, adapter, policy, runtime, sessionId = randomUUID(), resume = false }: AgentSessionOptions): SessionRecorder => {
  if (run.state !== 'IMPLEMENTING') fail(`Agent sessions can only start during IMPLEMENTING, not ${run.state}.`, 'INVALID_STATE')
  const id = required(sessionId, 'sessionId')
  const adapterId = required(adapter.id, 'adapter.id')
  const adapterVersion = required(adapter.version, 'adapter.version')
  if (!policy || typeof policy.evaluate !== 'function') fail('policy.evaluate is required.', 'INVALID_INPUT')
  if (!runtime || typeof runtime.execute !== 'function') fail('runtime.execute is required.', 'INVALID_INPUT')
  if (!Array.isArray(adapter.capabilities) || adapter.capabilities.some((capability) => typeof capability !== 'string' || !capability.trim())) fail('adapter.capabilities must contain non-empty strings.', 'INVALID_INPUT')
  const store = new FileEventStore(stateDir)
  const append = <K extends SessionEventType>(type: K, payload: HarnessEventPayloads[K]): HarnessEvent<K> => store.append({ runId: run.runId, sourceRevision: run.sourceRevision, configHash: run.configHash, sessionId: id, type, payload } as unknown as HarnessEventInput<K>)
  const turns = new Set<string>()
  const actions = new Set<string>()
  const pending = new Map<string, { readonly turnId: string; readonly toolId: string; readonly argumentsHash: string; executionStarted: boolean }>()
  const approvals = new Map<string, { readonly turnId: string; readonly toolId: string; readonly argumentsHash: string; readonly policyId: string; readonly reason: string }>()
  const released = new Map<string, { readonly turnId: string; readonly toolId: string; readonly argumentsHash: string; executionStarted: boolean }>()
  const attempts = new Map<string, number>()
  const executing = new Set<string>()
  let ended = false
  if (resume) {
    const prior = store.read(run.runId).filter((event) => event.sessionId === id)
    if (!prior.some((event) => event.type === 'session.started')) fail(`Session does not exist: ${id}.`, 'INVALID_STATE')
    if (prior.some((event) => event.type === 'session.ended')) fail(`Session has already ended: ${id}.`, 'INVALID_STATE')
    for (const event of prior) {
      if (event.type === 'agent.turn.started') turns.add(event.payload.turnId)
      if (event.type === 'tool.approval.requested') { actions.add(event.payload.actionId); approvals.set(event.payload.actionId, { turnId: event.payload.turnId, toolId: event.payload.toolId, argumentsHash: event.payload.argumentsHash, policyId: event.payload.policyId, reason: event.payload.reason }) }
      if (event.type === 'tool.approval.recorded') { approvals.delete(event.payload.actionId); if (event.payload.decision === 'approved') released.set(event.payload.actionId, { turnId: event.payload.turnId, toolId: event.payload.toolId, argumentsHash: event.payload.argumentsHash, executionStarted: false }) }
      if (event.type === 'tool.requested') { actions.add(event.payload.actionId); pending.set(event.payload.actionId, { turnId: event.payload.turnId, toolId: event.payload.toolId, argumentsHash: event.payload.argumentsHash, executionStarted: false }); released.delete(event.payload.actionId) }
      if (event.type === 'tool.execution.started') { const action = pending.get(event.payload.actionId); if (action) action.executionStarted = true; attempts.set(event.payload.actionId, event.payload.attempt) }
      if (event.type === 'tool.recovery.recorded' && event.payload.decision === 'retry') { const action = pending.get(event.payload.actionId); if (action) action.executionStarted = false }
      if (event.type === 'tool.completed' || event.type === 'tool.failed' || event.type === 'tool.blocked') pending.delete(event.payload.actionId)
    }
    for (const [actionId, action] of released) if (!pending.has(actionId)) pending.set(actionId, action)
  }
  const open = (): void => { if (ended) fail('Session has already ended.', 'INVALID_STATE') }
  const complete = (input: { readonly actionId: string; readonly resultHash: string; readonly durationMs: number; readonly runtimeEvidence?: ToolExecutionResult['runtimeEvidence'] }): HarnessEvent<'tool.completed'> => { open(); const actionId = required(input.actionId, 'actionId'); if (!pending.has(actionId)) fail(`Tool action is not pending: ${actionId}.`, 'INVALID_STATE'); const event = append('tool.completed', { actionId, resultHash: required(input.resultHash, 'resultHash'), durationMs: duration(input.durationMs), ...(input.runtimeEvidence ? { runtimeEvidence: input.runtimeEvidence } : {}) }); pending.delete(actionId); return event }
  const failAction = (input: { readonly actionId: string; readonly errorCode: string; readonly retryable: boolean; readonly durationMs: number; readonly runtimeEvidence?: ToolExecutionResult['runtimeEvidence'] }): HarnessEvent<'tool.failed'> => { open(); const actionId = required(input.actionId, 'actionId'); if (!pending.has(actionId)) fail(`Tool action is not pending: ${actionId}.`, 'INVALID_STATE'); if (typeof input.retryable !== 'boolean') fail('retryable must be boolean.', 'INVALID_INPUT'); const event = append('tool.failed', { actionId, errorCode: required(input.errorCode, 'errorCode'), retryable: input.retryable, durationMs: duration(input.durationMs), ...(input.runtimeEvidence ? { runtimeEvidence: input.runtimeEvidence } : {}) }); pending.delete(actionId); return event }
  const recorder: SessionRecorder = {
    sessionId: id,
    startTurn: (inputHash, turnId = randomUUID()) => { open(); const turn = required(turnId, 'turnId'); if (turns.has(turn)) fail(`Turn already exists: ${turn}.`, 'INVALID_STATE'); const event = append('agent.turn.started', { turnId: turn, inputHash: required(inputHash, 'inputHash') }); turns.add(turn); return event },
    requestTool: (input): HarnessEvent<'tool.requested'> | HarnessEvent<'tool.approval.requested'> => { open(); const turnId = required(input.turnId, 'turnId'); if (!turns.has(turnId)) fail(`Turn does not exist: ${turnId}.`, 'INVALID_STATE'); const actionId = required(input.actionId ?? randomUUID(), 'actionId'); if (actions.has(actionId)) fail(`Tool action already exists: ${actionId}.`, 'INVALID_STATE'); const toolId = required(input.toolId, 'toolId'); const argumentsHash = required(input.argumentsHash, 'argumentsHash'); const decision = policy.evaluate({ actionId, turnId, toolId, argumentsHash }); if (!decision || (decision.decision !== 'allow' && decision.decision !== 'block' && decision.decision !== 'approve')) fail('Policy decision is invalid.', 'HARNESS_ERROR'); const policyId = required(decision.policyId, 'policyId'); const reason = required(decision.reason, 'policy reason'); append('policy.evaluated', { actionId, turnId, toolId, decision: decision.decision, policyId, reason }); actions.add(actionId); if (decision.decision === 'block') { append('tool.blocked', { turnId, actionId, toolId, policyId, reason }); fail(`Tool action blocked by policy: ${policyId}.`, 'POLICY_BLOCKED') } if (decision.decision === 'approve') { const event = append('tool.approval.requested', { turnId, actionId, toolId, argumentsHash, policyId, reason }); approvals.set(actionId, { turnId, toolId, argumentsHash, policyId, reason }); return event } const event = append('tool.requested', { turnId, actionId, toolId, argumentsHash }); pending.set(actionId, { turnId, toolId, argumentsHash, executionStarted: false }); return event },
    approveTool: (input) => { open(); const actionId = required(input.actionId, 'actionId'); const approval = approvals.get(actionId) ?? fail(`Tool action is not awaiting human approval: ${actionId}.`, 'INVALID_STATE'); if (input.actor !== undefined && input.actor !== 'human') fail('Tool approval requires a human actor.', 'HUMAN_APPROVAL_REQUIRED'); const decision = input.decision; if (decision !== 'approved' && decision !== 'rejected') fail('Tool approval decision is invalid.', 'INVALID_INPUT'); append('tool.approval.recorded', { turnId: approval.turnId, actionId, toolId: approval.toolId, argumentsHash: approval.argumentsHash, decision, actor: 'human', policyId: approval.policyId, reason: approval.reason }); approvals.delete(actionId); if (decision === 'rejected') return append('tool.blocked', { turnId: approval.turnId, actionId, toolId: approval.toolId, policyId: approval.policyId, reason: 'Human rejected the tool action.' }); const event = append('tool.requested', { turnId: approval.turnId, actionId, toolId: approval.toolId, argumentsHash: approval.argumentsHash }); pending.set(actionId, { turnId: approval.turnId, toolId: approval.toolId, argumentsHash: approval.argumentsHash, executionStarted: false }); return event },
    recoverTool: (input) => { open(); const actionId = required(input.actionId, 'actionId'); const action = pending.get(actionId) ?? fail(`Tool action is not pending: ${actionId}.`, 'INVALID_STATE'); if (!action.executionStarted) fail(`Tool action does not require recovery: ${actionId}.`, 'INVALID_STATE'); if (input.actor !== undefined && input.actor !== 'human') fail('Tool recovery requires a human actor.', 'HUMAN_APPROVAL_REQUIRED'); if (input.decision !== 'retry' && input.decision !== 'abandon') fail('Tool recovery decision is invalid.', 'INVALID_INPUT'); const reason = input.decision === 'retry' ? 'Human authorized a retry after interruption.' : 'Human abandoned the interrupted tool action.'; const recovery = append('tool.recovery.recorded', { turnId: action.turnId, actionId, toolId: action.toolId, decision: input.decision, actor: 'human', reason }); if (input.decision === 'retry') { action.executionStarted = false; return recovery } pending.delete(actionId); return append('tool.blocked', { turnId: action.turnId, actionId, toolId: action.toolId, policyId: 'recovery', reason }) },
    completeTool: complete,
    failTool: failAction,
    executeTool: async (input) => { open(); const actionId = required(input.actionId, 'actionId'); const action = pending.get(actionId) ?? fail(`Tool action is not pending: ${actionId}.`, 'INVALID_STATE'); if (action.executionStarted) fail(`Tool action requires human recovery decision: ${actionId}.`, 'HUMAN_APPROVAL_REQUIRED'); if (executing.has(actionId)) fail(`Tool action is already executing: ${actionId}.`, 'INVALID_STATE'); executing.add(actionId); action.executionStarted = true; const attempt = (attempts.get(actionId) ?? 0) + 1; attempts.set(actionId, attempt); append('tool.execution.started', { actionId, turnId: action.turnId, toolId: action.toolId, attempt }); try { const result = await runtime.execute({ actionId, turnId: action.turnId, toolId: action.toolId, argumentsHash: action.argumentsHash, arguments: input.arguments }); if (result.status === 'completed') { complete({ actionId, resultHash: result.resultHash, durationMs: result.durationMs, runtimeEvidence: result.runtimeEvidence }); return result } if (result.status === 'failed') { failAction({ actionId, errorCode: result.errorCode, retryable: result.retryable, durationMs: result.durationMs, runtimeEvidence: result.runtimeEvidence }); return result } return fail('Runtime returned an invalid execution result.', 'HARNESS_ERROR') } catch { const result = { status: 'failed' as const, errorCode: 'RUNTIME_ERROR', retryable: true, durationMs: 0 }; if (pending.has(actionId)) failAction({ actionId, ...result }); return result } finally { executing.delete(actionId) } },
    end: (status) => { open(); if (!['completed', 'failed', 'cancelled'].includes(status)) fail('Session status is invalid.', 'INVALID_INPUT'); if (pending.size) fail('Session cannot end while tool actions are pending.', 'INVALID_STATE'); if (approvals.size) fail('Session cannot end while tool approvals are pending.', 'HUMAN_APPROVAL_REQUIRED'); const event = append('session.ended', { status }); ended = true; return event },
  }
  if (resume) append('session.resumed', { recovery: 'event-log' })
  else append('session.started', { adapterId, adapterVersion, capabilities: adapter.capabilities.map((capability) => capability.trim()) })
  return recorder
}
