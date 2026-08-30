import type { RunState } from './types.js'

export const STATES = [
  'CLARIFYING', 'PLANNED', 'IMPLEMENTING', 'VERIFYING',
  'AWAITING_HUMAN_APPROVAL', 'AWAITING_AUTHORIZATION', 'COMPLETE',
  'BLOCKED', 'STALE', 'CANCELLED', 'SUPERSEDED',
] as const satisfies readonly RunState[]

export const LEGAL_TRANSITIONS = {
  CLARIFYING: ['PLANNED', 'BLOCKED', 'CANCELLED'],
  PLANNED: ['IMPLEMENTING', 'CLARIFYING', 'STALE', 'CANCELLED'],
  IMPLEMENTING: ['VERIFYING', 'CLARIFYING', 'STALE', 'CANCELLED'],
  VERIFYING: ['AWAITING_HUMAN_APPROVAL', 'BLOCKED', 'STALE', 'CANCELLED'],
  AWAITING_HUMAN_APPROVAL: ['AWAITING_AUTHORIZATION', 'COMPLETE', 'BLOCKED', 'IMPLEMENTING', 'STALE', 'CANCELLED'],
  AWAITING_AUTHORIZATION: ['COMPLETE', 'BLOCKED', 'IMPLEMENTING', 'STALE', 'CANCELLED'],
  COMPLETE: ['STALE', 'SUPERSEDED'],
  BLOCKED: ['SUPERSEDED'],
  STALE: ['SUPERSEDED', 'PLANNED'],
  CANCELLED: ['SUPERSEDED'],
  SUPERSEDED: [],
} as const satisfies Readonly<Record<RunState, readonly RunState[]>>

export const REAL_CATEGORIES: ReadonlySet<string> = new Set(['endpoint', 'database', 'cli', 'mcp', 'ui'])
export const DECISIONS: ReadonlySet<string> = new Set(['approved', 'approve', 'yes', 'ok', 'rejected', 'reject', 'no'])
