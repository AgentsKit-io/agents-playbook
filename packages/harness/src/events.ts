import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fail } from './errors.js'
import type { RunState } from './types.js'

export const HARNESS_EVENT_SCHEMA_VERSION = 1 as const
export const HARNESS_EVENT_TYPES = ['run.created', 'state.transitioned'] as const
export type HarnessEventType = typeof HARNESS_EVENT_TYPES[number]

export interface HarnessEventPayloads {
  readonly 'run.created': { readonly project: string; readonly baselineRevision: string; readonly baselineStatusHash: string }
  readonly 'state.transitioned': { readonly from: RunState | null; readonly to: RunState; readonly actor: string; readonly reason?: string; readonly transitionIndex: number }
}

export type HarnessEvent<K extends HarnessEventType = HarnessEventType> = K extends HarnessEventType ? {
    readonly schemaVersion: typeof HARNESS_EVENT_SCHEMA_VERSION
    readonly runId: string
    readonly sequence: number
    readonly at: string
    readonly sourceRevision: string
    readonly configHash: string
    readonly type: K
    readonly payload: HarnessEventPayloads[K]
  } : never

export type HarnessEventInput<K extends HarnessEventType = HarnessEventType> = Omit<HarnessEvent<K>, 'schemaVersion' | 'sequence' | 'at'>
export type HarnessEventListener<K extends HarnessEventType> = (event: HarnessEvent<K>) => void

export interface EventStore {
  append<K extends HarnessEventType>(event: HarnessEventInput<K>): HarnessEvent<K>
  read(runId: string): readonly HarnessEvent[]
}

const eventPath = (stateDir: string, runId: string): string => join(stateDir, 'runs', runId, 'events.ndjson')
const isEventType = (value: unknown): value is HarnessEventType => typeof value === 'string' && (HARNESS_EVENT_TYPES as readonly string[]).includes(value)

const parseEvent = (value: unknown, expectedSequence: number): HarnessEvent => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) fail('Event log contains a non-object record.', 'HARNESS_ERROR')
  const record = value as Record<string, unknown>
  if (record['schemaVersion'] !== HARNESS_EVENT_SCHEMA_VERSION || typeof record['runId'] !== 'string' || typeof record['sequence'] !== 'number' || record['sequence'] !== expectedSequence || typeof record['at'] !== 'string' || typeof record['sourceRevision'] !== 'string' || typeof record['configHash'] !== 'string' || !isEventType(record['type']) || typeof record['payload'] !== 'object' || record['payload'] === null) fail('Event log is invalid or out of order.', 'HARNESS_ERROR')
  return record as unknown as HarnessEvent
}

export class FileEventStore implements EventStore {
  public constructor(private readonly stateDir: string) {}

  public append<K extends HarnessEventType>(event: HarnessEventInput<K>): HarnessEvent<K> {
    if (!event.runId.trim()) fail('Event runId is required.', 'INVALID_INPUT')
    if (!event.sourceRevision.trim() || !event.configHash.trim()) fail('Event sourceRevision and configHash are required.', 'INVALID_INPUT')
    const events = this.read(event.runId)
    const record = { schemaVersion: HARNESS_EVENT_SCHEMA_VERSION, sequence: events.length + 1, at: new Date().toISOString(), runId: event.runId, sourceRevision: event.sourceRevision, configHash: event.configHash, type: event.type, payload: event.payload } as HarnessEvent<K>
    const path = eventPath(this.stateDir, event.runId)
    mkdirSync(join(this.stateDir, 'runs', event.runId), { recursive: true })
    appendFileSync(path, `${JSON.stringify(record)}\n`, 'utf8')
    return record
  }

  public read(runId: string): readonly HarnessEvent[] {
    const path = eventPath(this.stateDir, runId)
    if (!existsSync(path)) return []
    return readFileSync(path, 'utf8').split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map((line, index) => {
      try { return parseEvent(JSON.parse(line) as unknown, index + 1) } catch (error) { if (error instanceof SyntaxError) fail('Event log contains invalid JSON.', 'HARNESS_ERROR'); throw error }
    })
  }
}
