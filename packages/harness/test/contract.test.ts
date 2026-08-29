import { expect, it } from 'vitest'
import { LEGAL_TRANSITIONS, STATES, transition } from '../src/index.js'

it('defines the complete canonical lifecycle and terminal escape', () => {
  const canonical = ['CLARIFYING', 'PLANNED', 'IMPLEMENTING', 'VERIFYING', 'AWAITING_HUMAN_APPROVAL', 'COMPLETE'] as const
  let run = { state: canonical[0], transitions: [] as { to: string }[] }
  for (const state of canonical.slice(1)) run = transition(run, state, 'contract-test')
  expect(run.transitions.map(({ to }) => to)).toEqual(canonical.slice(1))
  expect(STATES.every((state) => state in LEGAL_TRANSITIONS)).toBe(true)
  expect(LEGAL_TRANSITIONS.VERIFYING).toContain('BLOCKED')
  expect(LEGAL_TRANSITIONS.BLOCKED).toContain('SUPERSEDED')
})
