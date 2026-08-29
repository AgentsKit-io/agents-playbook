import { DECISIONS, LEGAL_TRANSITIONS, STATES } from './constants.js'
import { fail } from './errors.js'
import type { RunState, StateTransition, VerificationRun } from './types.js'

export const transition = (run: Pick<VerificationRun, 'state' | 'transitions'>, to: RunState, reason?: string, actor = 'harness'): Pick<VerificationRun, 'state' | 'transitions'> => {
  if (!STATES.includes(to)) fail(`Unknown state ${to}.`, 'INVALID_STATE')
  if (run.state !== to && !LEGAL_TRANSITIONS[run.state].some((state) => state === to)) fail(`Illegal transition ${run.state} -> ${to}.`, 'INVALID_STATE')
  const event: StateTransition = { from: run.state, to, at: new Date().toISOString(), actor, ...(reason ? { reason } : {}) }
  return { ...run, state: to, transitions: [...run.transitions, event] }
}

export const assertHuman = (actor: string): void => {
  if (actor !== 'human') fail('This action requires --by human.', 'HUMAN_APPROVAL_REQUIRED')
}

export const approvedDecision = (decision: string): boolean => {
  if (!DECISIONS.has(decision)) fail('Decision must be approved or rejected.', 'INVALID_INPUT')
  return ['approved', 'approve', 'yes', 'ok'].includes(decision)
}
