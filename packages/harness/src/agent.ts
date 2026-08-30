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
}

export interface SessionRecorder {
  readonly sessionId: string
  startTurn(inputHash: string, turnId?: string): HarnessEvent<'agent.turn.started'>
  requestTool(input: { readonly turnId: string; readonly toolId: string; readonly argumentsHash: string; readonly actionId?: string }): HarnessEvent<'tool.requested'> | HarnessEvent<'tool.approval.requested'>
  approveTool(input: { readonly actionId: string; readonly decision: 'approved' | 'rejected'; readonly actor?: 'human' }): HarnessEvent<'tool.requested'> | HarnessEvent<'tool.blocked'>
  completeTool(input: { readonly actionId: string; readonly resultHash: string; readonly durationMs: number; readonly runtimeEvidence?: ToolExecutionResult['runtimeEvidence'] }): HarnessEvent<'tool.completed'>
  failTool(input: { readonly actionId: string; readonly errorCode: string; readonly retryable: boolean; readonly durationMs: number; readonly runtimeEvidence?: ToolExecutionResult['runtimeEvidence'] }): HarnessEvent<'tool.failed'>
  executeTool(input: { readonly actionId: string; readonly arguments: unknown }): Promise<ToolExecutionResult>
  end(status: 'completed' | 'failed' | 'cancelled'): HarnessEvent<'session.ended'>
}

type SessionEventType = 'session.started' | 'agent.turn.started' | 'policy.evaluated' | 'tool.approval.requested' | 'tool.approval.recorded' | 'tool.requested' | 'tool.blocked' | 'tool.completed' | 'tool.failed' | 'session.ended'

const required = (value: string, label: string): string => {
  if (typeof value !== 'string' || !value.trim()) fail(`${label} is required.`, 'INVALID_INPUT')
  return value.trim()
}

const duration = (value: number): number => {
  if (!Number.isFinite(value) || value < 0) fail('Tool durationMs must be a non-negative number.', 'INVALID_INPUT')
  return value
}

export const createSessionRecorder = ({ stateDir, run, adapter, policy, runtime, sessionId = randomUUID() }: AgentSessionOptions): SessionRecorder => {
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
  const pending = new Map<string, { readonly turnId: string; readonly toolId: string; readonly argumentsHash: string }>()
  const approvals = new Map<string, { readonly turnId: string; readonly toolId: string; readonly argumentsHash: string; readonly policyId: string; readonly reason: string }>()
  const executing = new Set<string>()
  let ended = false
  const open = (): void => { if (ended) fail('Session has already ended.', 'INVALID_STATE') }
  const complete = (input: { readonly actionId: string; readonly resultHash: string; readonly durationMs: number; readonly runtimeEvidence?: ToolExecutionResult['runtimeEvidence'] }): HarnessEvent<'tool.completed'> => { open(); const actionId = required(input.actionId, 'actionId'); if (!pending.has(actionId)) fail(`Tool action is not pending: ${actionId}.`, 'INVALID_STATE'); const event = append('tool.completed', { actionId, resultHash: required(input.resultHash, 'resultHash'), durationMs: duration(input.durationMs), ...(input.runtimeEvidence ? { runtimeEvidence: input.runtimeEvidence } : {}) }); pending.delete(actionId); return event }
  const failAction = (input: { readonly actionId: string; readonly errorCode: string; readonly retryable: boolean; readonly durationMs: number; readonly runtimeEvidence?: ToolExecutionResult['runtimeEvidence'] }): HarnessEvent<'tool.failed'> => { open(); const actionId = required(input.actionId, 'actionId'); if (!pending.has(actionId)) fail(`Tool action is not pending: ${actionId}.`, 'INVALID_STATE'); if (typeof input.retryable !== 'boolean') fail('retryable must be boolean.', 'INVALID_INPUT'); const event = append('tool.failed', { actionId, errorCode: required(input.errorCode, 'errorCode'), retryable: input.retryable, durationMs: duration(input.durationMs), ...(input.runtimeEvidence ? { runtimeEvidence: input.runtimeEvidence } : {}) }); pending.delete(actionId); return event }
  const recorder: SessionRecorder = {
    sessionId: id,
    startTurn: (inputHash, turnId = randomUUID()) => { open(); const turn = required(turnId, 'turnId'); if (turns.has(turn)) fail(`Turn already exists: ${turn}.`, 'INVALID_STATE'); const event = append('agent.turn.started', { turnId: turn, inputHash: required(inputHash, 'inputHash') }); turns.add(turn); return event },
    requestTool: (input): HarnessEvent<'tool.requested'> | HarnessEvent<'tool.approval.requested'> => { open(); const turnId = required(input.turnId, 'turnId'); if (!turns.has(turnId)) fail(`Turn does not exist: ${turnId}.`, 'INVALID_STATE'); const actionId = required(input.actionId ?? randomUUID(), 'actionId'); if (actions.has(actionId)) fail(`Tool action already exists: ${actionId}.`, 'INVALID_STATE'); const toolId = required(input.toolId, 'toolId'); const argumentsHash = required(input.argumentsHash, 'argumentsHash'); const decision = policy.evaluate({ actionId, turnId, toolId, argumentsHash }); if (!decision || (decision.decision !== 'allow' && decision.decision !== 'block' && decision.decision !== 'approve')) fail('Policy decision is invalid.', 'HARNESS_ERROR'); const policyId = required(decision.policyId, 'policyId'); const reason = required(decision.reason, 'policy reason'); append('policy.evaluated', { actionId, turnId, toolId, decision: decision.decision, policyId, reason }); actions.add(actionId); if (decision.decision === 'block') { append('tool.blocked', { turnId, actionId, toolId, policyId, reason }); fail(`Tool action blocked by policy: ${policyId}.`, 'POLICY_BLOCKED') } if (decision.decision === 'approve') { const event = append('tool.approval.requested', { turnId, actionId, toolId, argumentsHash, policyId, reason }); approvals.set(actionId, { turnId, toolId, argumentsHash, policyId, reason }); return event } const event = append('tool.requested', { turnId, actionId, toolId, argumentsHash }); pending.set(actionId, { turnId, toolId, argumentsHash }); return event },
    approveTool: (input) => { open(); const actionId = required(input.actionId, 'actionId'); const approval = approvals.get(actionId) ?? fail(`Tool action is not awaiting human approval: ${actionId}.`, 'INVALID_STATE'); if (input.actor !== undefined && input.actor !== 'human') fail('Tool approval requires a human actor.', 'HUMAN_APPROVAL_REQUIRED'); const decision = input.decision; if (decision !== 'approved' && decision !== 'rejected') fail('Tool approval decision is invalid.', 'INVALID_INPUT'); append('tool.approval.recorded', { turnId: approval.turnId, actionId, toolId: approval.toolId, decision, actor: 'human', policyId: approval.policyId, reason: approval.reason }); approvals.delete(actionId); if (decision === 'rejected') return append('tool.blocked', { turnId: approval.turnId, actionId, toolId: approval.toolId, policyId: approval.policyId, reason: 'Human rejected the tool action.' }); const event = append('tool.requested', { turnId: approval.turnId, actionId, toolId: approval.toolId, argumentsHash: approval.argumentsHash }); pending.set(actionId, { turnId: approval.turnId, toolId: approval.toolId, argumentsHash: approval.argumentsHash }); return event },
    completeTool: complete,
    failTool: failAction,
    executeTool: async (input) => { open(); const actionId = required(input.actionId, 'actionId'); const action = pending.get(actionId) ?? fail(`Tool action is not pending: ${actionId}.`, 'INVALID_STATE'); if (executing.has(actionId)) fail(`Tool action is already executing: ${actionId}.`, 'INVALID_STATE'); executing.add(actionId); try { const result = await runtime.execute({ actionId, turnId: action.turnId, toolId: action.toolId, argumentsHash: action.argumentsHash, arguments: input.arguments }); if (result.status === 'completed') { complete({ actionId, resultHash: result.resultHash, durationMs: result.durationMs, runtimeEvidence: result.runtimeEvidence }); return result } if (result.status === 'failed') { failAction({ actionId, errorCode: result.errorCode, retryable: result.retryable, durationMs: result.durationMs, runtimeEvidence: result.runtimeEvidence }); return result } return fail('Runtime returned an invalid execution result.', 'HARNESS_ERROR') } catch { const result = { status: 'failed' as const, errorCode: 'RUNTIME_ERROR', retryable: true, durationMs: 0 }; if (pending.has(actionId)) failAction({ actionId, ...result }); return result } finally { executing.delete(actionId) } },
    end: (status) => { open(); if (!['completed', 'failed', 'cancelled'].includes(status)) fail('Session status is invalid.', 'INVALID_INPUT'); if (pending.size) fail('Session cannot end while tool actions are pending.', 'INVALID_STATE'); if (approvals.size) fail('Session cannot end while tool approvals are pending.', 'HUMAN_APPROVAL_REQUIRED'); const event = append('session.ended', { status }); ended = true; return event },
  }
  append('session.started', { adapterId, adapterVersion, capabilities: adapter.capabilities.map((capability) => capability.trim()) })
  return recorder
}
