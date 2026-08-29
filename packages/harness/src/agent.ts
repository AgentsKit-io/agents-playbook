import { randomUUID } from 'node:crypto'
import { FileEventStore } from './events.js'
import { fail } from './errors.js'
import type { HarnessEvent, HarnessEventInput, HarnessEventPayloads } from './events.js'
import type { PolicyGate } from './policy.js'
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
  readonly sessionId?: string
}

export interface SessionRecorder {
  readonly sessionId: string
  startTurn(inputHash: string, turnId?: string): HarnessEvent<'agent.turn.started'>
  requestTool(input: { readonly turnId: string; readonly toolId: string; readonly argumentsHash: string; readonly actionId?: string }): HarnessEvent<'tool.requested'>
  completeTool(input: { readonly actionId: string; readonly resultHash: string; readonly durationMs: number }): HarnessEvent<'tool.completed'>
  failTool(input: { readonly actionId: string; readonly errorCode: string; readonly retryable: boolean }): HarnessEvent<'tool.failed'>
  end(status: 'completed' | 'failed' | 'cancelled'): HarnessEvent<'session.ended'>
}

type SessionEventType = 'session.started' | 'agent.turn.started' | 'policy.evaluated' | 'tool.requested' | 'tool.blocked' | 'tool.completed' | 'tool.failed' | 'session.ended'

const required = (value: string, label: string): string => {
  if (typeof value !== 'string' || !value.trim()) fail(`${label} is required.`, 'INVALID_INPUT')
  return value.trim()
}

const duration = (value: number): number => {
  if (!Number.isFinite(value) || value < 0) fail('Tool durationMs must be a non-negative number.', 'INVALID_INPUT')
  return value
}

export const createSessionRecorder = ({ stateDir, run, adapter, policy, sessionId = randomUUID() }: AgentSessionOptions): SessionRecorder => {
  if (run.state !== 'IMPLEMENTING') fail(`Agent sessions can only start during IMPLEMENTING, not ${run.state}.`, 'INVALID_STATE')
  const id = required(sessionId, 'sessionId')
  const adapterId = required(adapter.id, 'adapter.id')
  const adapterVersion = required(adapter.version, 'adapter.version')
  if (!policy || typeof policy.evaluate !== 'function') fail('policy.evaluate is required.', 'INVALID_INPUT')
  if (!Array.isArray(adapter.capabilities) || adapter.capabilities.some((capability) => typeof capability !== 'string' || !capability.trim())) fail('adapter.capabilities must contain non-empty strings.', 'INVALID_INPUT')
  const store = new FileEventStore(stateDir)
  const append = <K extends SessionEventType>(type: K, payload: HarnessEventPayloads[K]): HarnessEvent<K> => store.append({ runId: run.runId, sourceRevision: run.sourceRevision, configHash: run.configHash, sessionId: id, type, payload } as unknown as HarnessEventInput<K>)
  const turns = new Set<string>()
  const actions = new Set<string>()
  const pending = new Set<string>()
  let ended = false
  const open = (): void => { if (ended) fail('Session has already ended.', 'INVALID_STATE') }
  const recorder: SessionRecorder = {
    sessionId: id,
    startTurn: (inputHash, turnId = randomUUID()) => { open(); const turn = required(turnId, 'turnId'); if (turns.has(turn)) fail(`Turn already exists: ${turn}.`, 'INVALID_STATE'); const event = append('agent.turn.started', { turnId: turn, inputHash: required(inputHash, 'inputHash') }); turns.add(turn); return event },
    requestTool: (input) => { open(); const turnId = required(input.turnId, 'turnId'); if (!turns.has(turnId)) fail(`Turn does not exist: ${turnId}.`, 'INVALID_STATE'); const actionId = required(input.actionId ?? randomUUID(), 'actionId'); if (actions.has(actionId)) fail(`Tool action already exists: ${actionId}.`, 'INVALID_STATE'); const toolId = required(input.toolId, 'toolId'); const argumentsHash = required(input.argumentsHash, 'argumentsHash'); const decision = policy.evaluate({ actionId, turnId, toolId, argumentsHash }); if (!decision || (decision.decision !== 'allow' && decision.decision !== 'block')) fail('Policy decision is invalid.', 'HARNESS_ERROR'); const policyId = required(decision.policyId, 'policyId'); const reason = required(decision.reason, 'policy reason'); append('policy.evaluated', { actionId, turnId, toolId, decision: decision.decision, policyId, reason }); actions.add(actionId); if (decision.decision === 'block') { append('tool.blocked', { turnId, actionId, toolId, policyId, reason }); fail(`Tool action blocked by policy: ${policyId}.`, 'POLICY_BLOCKED') } const event = append('tool.requested', { turnId, actionId, toolId, argumentsHash }); pending.add(actionId); return event },
    completeTool: (input) => { open(); const actionId = required(input.actionId, 'actionId'); if (!pending.has(actionId)) fail(`Tool action is not pending: ${actionId}.`, 'INVALID_STATE'); const event = append('tool.completed', { actionId, resultHash: required(input.resultHash, 'resultHash'), durationMs: duration(input.durationMs) }); pending.delete(actionId); return event },
    failTool: (input) => { open(); const actionId = required(input.actionId, 'actionId'); if (!pending.has(actionId)) fail(`Tool action is not pending: ${actionId}.`, 'INVALID_STATE'); if (typeof input.retryable !== 'boolean') fail('retryable must be boolean.', 'INVALID_INPUT'); const event = append('tool.failed', { actionId, errorCode: required(input.errorCode, 'errorCode'), retryable: input.retryable }); pending.delete(actionId); return event },
    end: (status) => { open(); if (!['completed', 'failed', 'cancelled'].includes(status)) fail('Session status is invalid.', 'INVALID_INPUT'); if (pending.size) fail('Session cannot end while tool actions are pending.', 'INVALID_STATE'); const event = append('session.ended', { status }); ended = true; return event },
  }
  append('session.started', { adapterId, adapterVersion, capabilities: adapter.capabilities.map((capability) => capability.trim()) })
  return recorder
}
