import { appendFileSync, closeSync, existsSync, mkdirSync, openSync, readFileSync, unlinkSync, writeSync } from 'node:fs'
import { join } from 'node:path'
import { fail } from './errors.js'
import { sha256 } from './hash.js'
import type { ContextQuery } from './context.js'
import type { RunState } from './types.js'
import type { DockerRuntimeEvidence } from './runtime.js'

export const HARNESS_EVENT_SCHEMA_VERSION = 1 as const
export const EVENT_LOG_GENESIS = 'GENESIS' as const
export const HARNESS_EVENT_TYPES = ['run.created', 'state.transitioned', 'context.attached', 'verification.completed', 'approval.recorded', 'authorization.recorded', 'session.started', 'agent.turn.started', 'policy.evaluated', 'tool.approval.requested', 'tool.approval.recorded', 'tool.requested', 'tool.blocked', 'tool.completed', 'tool.failed', 'session.ended'] as const
export type HarnessEventType = typeof HARNESS_EVENT_TYPES[number]
const SESSION_EVENT_TYPES = new Set<HarnessEventType>(['session.started', 'agent.turn.started', 'policy.evaluated', 'tool.approval.requested', 'tool.approval.recorded', 'tool.requested', 'tool.blocked', 'tool.completed', 'tool.failed', 'session.ended'])

export interface HarnessEventPayloads {
  readonly 'run.created': { readonly project: string; readonly baselineRevision: string; readonly baselineStatusHash: string }
  readonly 'state.transitioned': { readonly from: RunState | null; readonly to: RunState; readonly actor: string; readonly reason?: string; readonly transitionIndex: number }
  readonly 'context.attached': { readonly providerId: string; readonly sourceHash: string; readonly snapshotHash: string; readonly query: ContextQuery }
  readonly 'verification.completed': { readonly verificationDigest: string; readonly checkCount: number; readonly outcomeCount: number; readonly totalDurationMs: number; readonly budgetExceeded: boolean }
  readonly 'approval.recorded': { readonly decision: 'approved' | 'rejected'; readonly resultingState: RunState; readonly verificationDigest: string; readonly actor: 'human'; readonly sourceRevision: string; readonly contractHash: string }
  readonly 'authorization.recorded': { readonly decision: 'approved' | 'rejected'; readonly resultingState: RunState; readonly verificationDigest: string; readonly actor: 'human'; readonly target: string; readonly sourceRevision: string; readonly contractHash: string }
  readonly 'session.started': { readonly adapterId: string; readonly adapterVersion: string; readonly capabilities: readonly string[] }
  readonly 'agent.turn.started': { readonly turnId: string; readonly inputHash: string }
  readonly 'policy.evaluated': { readonly actionId: string; readonly turnId: string; readonly toolId: string; readonly decision: 'allow' | 'block' | 'approve'; readonly policyId: string; readonly reason: string }
  readonly 'tool.approval.requested': { readonly turnId: string; readonly actionId: string; readonly toolId: string; readonly argumentsHash: string; readonly policyId: string; readonly reason: string }
  readonly 'tool.approval.recorded': { readonly turnId: string; readonly actionId: string; readonly toolId: string; readonly decision: 'approved' | 'rejected'; readonly actor: 'human'; readonly policyId: string; readonly reason: string }
  readonly 'tool.requested': { readonly turnId: string; readonly actionId: string; readonly toolId: string; readonly argumentsHash: string }
  readonly 'tool.blocked': { readonly turnId: string; readonly actionId: string; readonly toolId: string; readonly policyId: string; readonly reason: string }
  readonly 'tool.completed': { readonly actionId: string; readonly resultHash: string; readonly durationMs: number; readonly runtimeEvidence?: DockerRuntimeEvidence }
  readonly 'tool.failed': { readonly actionId: string; readonly errorCode: string; readonly retryable: boolean; readonly durationMs: number; readonly runtimeEvidence?: DockerRuntimeEvidence }
  readonly 'session.ended': { readonly status: 'completed' | 'failed' | 'cancelled' }
}

export type HarnessEvent<K extends HarnessEventType = HarnessEventType> = K extends HarnessEventType ? {
    readonly schemaVersion: typeof HARNESS_EVENT_SCHEMA_VERSION
    readonly runId: string
    readonly sequence: number
    readonly at: string
    readonly sourceRevision: string
    readonly configHash: string
    readonly previousHash?: string
    readonly eventHash?: string
    readonly sessionId?: string
    readonly type: K
    readonly payload: HarnessEventPayloads[K]
  } : never

export type HarnessEventInput<K extends HarnessEventType = HarnessEventType> = Omit<HarnessEvent<K>, 'schemaVersion' | 'sequence' | 'at'>
export type HarnessEventListener<K extends HarnessEventType> = (event: HarnessEvent<K>) => void

export interface EventStore {
  append<K extends HarnessEventType>(event: HarnessEventInput<K>): HarnessEvent<K>
  read(runId: string): readonly HarnessEvent[]
  verify(runId: string): EventLogVerification
}

export interface EventLogVerification {
  readonly status: 'verified' | 'legacy'
  readonly eventCount: number
  readonly headHash?: string
}

export interface EventLogLock {
  readonly pid: number
  readonly at: string
}

export interface EventLogLockStatus {
  readonly status: 'locked' | 'unlocked'
  readonly path: string
  readonly lock?: EventLogLock
}

export interface EventLogLockRecovery {
  readonly status: 'recovered' | 'unlocked'
  readonly path: string
  readonly lock?: EventLogLock
}

const eventPath = (stateDir: string, runId: string): string => join(stateDir, 'runs', runId, 'events.ndjson')
const lockPath = (stateDir: string, runId: string): string => `${eventPath(stateDir, runId)}.lock`
const parseLock = (value: string): EventLogLock => {
  try {
    const record = JSON.parse(value) as Record<string, unknown>
    if (!Number.isInteger(record['pid']) || (record['pid'] as number) <= 0 || typeof record['at'] !== 'string' || !Number.isFinite(Date.parse(record['at']))) fail('Event log lock metadata is invalid.', 'HARNESS_ERROR')
    return { pid: record['pid'] as number, at: record['at'] as string }
  } catch (error) {
    if (error instanceof SyntaxError) fail('Event log lock metadata is invalid.', 'HARNESS_ERROR')
    throw error
  }
}
const readLock = (stateDir: string, runId: string): EventLogLock | null => {
  const path = lockPath(stateDir, runId)
  return existsSync(path) ? parseLock(readFileSync(path, 'utf8')) : null
}
const isEventType = (value: unknown): value is HarnessEventType => typeof value === 'string' && (HARNESS_EVENT_TYPES as readonly string[]).includes(value)
const digest = (value: string): boolean => /^[a-f0-9]{64}$/.test(value)
const eventBody = (event: HarnessEvent): Omit<HarnessEvent, 'eventHash'> => {
  const { eventHash: _eventHash, ...body } = event
  return body
}
const eventDigest = (event: HarnessEvent): string => sha256(JSON.stringify(eventBody(event)))

const parseEvent = (value: unknown, expectedSequence: number): HarnessEvent => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) fail('Event log contains a non-object record.', 'HARNESS_ERROR')
  const record = value as Record<string, unknown>
  if (record['schemaVersion'] !== HARNESS_EVENT_SCHEMA_VERSION || typeof record['runId'] !== 'string' || typeof record['sequence'] !== 'number' || record['sequence'] !== expectedSequence || typeof record['at'] !== 'string' || typeof record['sourceRevision'] !== 'string' || typeof record['configHash'] !== 'string' || !isEventType(record['type']) || typeof record['payload'] !== 'object' || record['payload'] === null || (record['sessionId'] !== undefined && (typeof record['sessionId'] !== 'string' || !record['sessionId'].trim())) || (SESSION_EVENT_TYPES.has(record['type']) && typeof record['sessionId'] !== 'string')) fail('Event log is invalid or out of order.', 'HARNESS_ERROR')
  const hasPreviousHash = record['previousHash'] !== undefined
  const hasEventHash = record['eventHash'] !== undefined
  if (hasPreviousHash !== hasEventHash || (hasPreviousHash && (typeof record['previousHash'] !== 'string' || (record['previousHash'] !== EVENT_LOG_GENESIS && !digest(record['previousHash'] as string)) || typeof record['eventHash'] !== 'string' || !digest(record['eventHash'] as string)))) fail('Event log integrity metadata is invalid.', 'HARNESS_ERROR')
  return record as unknown as HarnessEvent
}

const validateChain = (events: readonly HarnessEvent[]): EventLogVerification => {
  const current = events.filter((event) => event.eventHash !== undefined)
  if (!current.length) return { status: 'legacy', eventCount: events.length }
  if (current.length !== events.length) fail('Event log mixes legacy and hashed records.', 'HARNESS_ERROR')
  let previous: string = EVENT_LOG_GENESIS
  for (const event of events) {
    const eventHash = event.eventHash ?? fail('Event log hash chain is invalid.', 'HARNESS_ERROR')
    if (event.previousHash !== previous || eventHash !== eventDigest(event)) fail('Event log hash chain is invalid.', 'HARNESS_ERROR')
    previous = eventHash
  }
  return { status: 'verified', eventCount: events.length, ...(events.length ? { headHash: previous } : {}) }
}

export class FileEventStore implements EventStore {
  public constructor(private readonly stateDir: string) {}

  public append<K extends HarnessEventType>(event: HarnessEventInput<K>): HarnessEvent<K> {
    if (!event.runId.trim()) fail('Event runId is required.', 'INVALID_INPUT')
    if (!event.sourceRevision.trim() || !event.configHash.trim()) fail('Event sourceRevision and configHash are required.', 'INVALID_INPUT')
    if (!isEventType(event.type)) fail('Event type is invalid.', 'INVALID_INPUT')
    if (SESSION_EVENT_TYPES.has(event.type) && (!event.sessionId || !event.sessionId.trim())) fail('Session events require a sessionId.', 'INVALID_INPUT')
    if (event.sessionId !== undefined && !event.sessionId.trim()) fail('Event sessionId cannot be empty.', 'INVALID_INPUT')
    const path = eventPath(this.stateDir, event.runId)
    const lock = lockPath(this.stateDir, event.runId)
    mkdirSync(join(this.stateDir, 'runs', event.runId), { recursive: true })
    let lockFd: number
    try { lockFd = openSync(lock, 'wx'); writeSync(lockFd, JSON.stringify({ pid: process.pid, at: new Date().toISOString() })) } catch (error) { if ((error as NodeJS.ErrnoException).code === 'EEXIST') fail('Event log is busy; retry the operation.', 'HARNESS_ERROR'); throw error }
    try {
      const events = this.readUnlocked(event.runId)
      const previous = events.at(-1)
      const body = { schemaVersion: HARNESS_EVENT_SCHEMA_VERSION, sequence: events.length + 1, at: new Date().toISOString(), runId: event.runId, sourceRevision: event.sourceRevision, configHash: event.configHash, ...(event.sessionId ? { sessionId: event.sessionId } : {}), ...(previous?.eventHash ? { previousHash: previous.eventHash } : events.length ? {} : { previousHash: EVENT_LOG_GENESIS }), type: event.type, payload: event.payload } as HarnessEvent<K>
      const record = (events.length && !previous?.eventHash ? body : { ...body, eventHash: eventDigest(body) }) as HarnessEvent<K>
      appendFileSync(path, `${JSON.stringify(record)}\n`, 'utf8')
      return record
    } finally {
      closeSync(lockFd)
      unlinkSync(lock)
    }
  }

  private readUnlocked(runId: string): readonly HarnessEvent[] {
    const path = eventPath(this.stateDir, runId)
    if (!existsSync(path)) return []
    const events = readFileSync(path, 'utf8').split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map((line, index) => {
      try { return parseEvent(JSON.parse(line) as unknown, index + 1) } catch (error) { if (error instanceof SyntaxError) fail('Event log contains invalid JSON.', 'HARNESS_ERROR'); throw error }
    })
    validateChain(events)
    return events
  }

  public read(runId: string): readonly HarnessEvent[] {
    if (existsSync(lockPath(this.stateDir, runId))) fail('Event log is busy; retry the operation.', 'HARNESS_ERROR')
    return this.readUnlocked(runId)
  }

  public verify(runId: string): EventLogVerification {
    return validateChain(this.read(runId))
  }
}

export const inspectEventLogLock = (stateDir: string, runId: string): EventLogLockStatus => {
  const path = lockPath(stateDir, runId)
  const lock = readLock(stateDir, runId)
  return lock ? { status: 'locked', path, lock } : { status: 'unlocked', path }
}

export const recoverEventLogLock = ({ stateDir, runId, actor, maxAgeMs = 300_000 }: { readonly stateDir: string; readonly runId: string; readonly actor: string; readonly maxAgeMs?: number }): EventLogLockRecovery => {
  if (actor !== 'human') fail('Event log lock recovery requires a human actor.', 'HUMAN_APPROVAL_REQUIRED')
  if (!Number.isInteger(maxAgeMs) || maxAgeMs < 0) fail('maxAgeMs must be a non-negative integer.', 'INVALID_INPUT')
  const path = lockPath(stateDir, runId)
  const lock = readLock(stateDir, runId)
  if (!lock) return { status: 'unlocked', path }
  const ageMs = Date.now() - Date.parse(lock.at)
  if (ageMs < maxAgeMs) fail('Event log lock is not old enough to recover.', 'HARNESS_ERROR')
  try { process.kill(lock.pid, 0) } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ESRCH') fail('Event log lock owner cannot be proven dead.', 'HARNESS_ERROR')
    unlinkSync(path)
    return { status: 'recovered', path, lock }
  }
  return fail('Event log lock owner is still alive.', 'HARNESS_ERROR')
}
