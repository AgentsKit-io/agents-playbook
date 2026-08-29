import assert from 'node:assert/strict'
import { LEGAL_TRANSITIONS, STATES, transition } from '../lib/index.js'

for (const state of STATES) assert.ok(state in LEGAL_TRANSITIONS, `missing transition table for ${state}`)
const canonical = ['CLARIFYING', 'PLANNED', 'IMPLEMENTING', 'VERIFYING', 'AWAITING_HUMAN_APPROVAL', 'COMPLETE']
let run = { state: canonical[0], transitions: [] }
for (const state of canonical.slice(1)) run = transition(run, state, 'contract-check')
assert.deepEqual(run.transitions.map(({ to }) => to), canonical.slice(1))
assert.ok(LEGAL_TRANSITIONS.VERIFYING.includes('BLOCKED'))
assert.ok(LEGAL_TRANSITIONS.BLOCKED.includes('SUPERSEDED'))
console.log(JSON.stringify({ status: 'passed', criteria: ['protocol'] }))
