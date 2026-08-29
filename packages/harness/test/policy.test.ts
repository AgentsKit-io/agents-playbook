import { expect, it } from 'vitest'
import { createPolicyGate } from '../src/index.js'

const request = { actionId: 'action', turnId: 'turn', toolId: 'shell', argumentsHash: 'hash' } as const

it('uses the first matching rule and denies tools without an explicit rule', () => {
  const gate = createPolicyGate({ rules: [
    { id: 'block-shell', effect: 'block', toolIds: ['shell'], reason: 'shell disabled' },
    { id: 'allow-shell', effect: 'allow', toolIds: ['shell'], reason: 'unreachable allow' },
    { id: 'allow-read', effect: 'allow', toolIds: ['read'], reason: 'read allowed' },
  ] })
  expect(gate.evaluate(request)).toEqual({ decision: 'block', policyId: 'block-shell', reason: 'shell disabled' })
  expect(gate.evaluate({ ...request, toolId: 'read' })).toEqual({ decision: 'allow', policyId: 'allow-read', reason: 'read allowed' })
  expect(gate.evaluate({ ...request, toolId: 'network' })).toEqual({ decision: 'block', policyId: 'default-deny', reason: 'No policy rule allows tool: network.' })
})

it('rejects malformed policy rules at construction time', () => {
  expect(() => createPolicyGate({ rules: [{ id: 'duplicate', effect: 'allow', toolIds: ['shell'], reason: 'ok' }, { id: 'duplicate', effect: 'block', toolIds: ['read'], reason: 'no' }] })).toThrow(/unique ids/)
  expect(() => createPolicyGate({ rules: [{ id: 'empty', effect: 'allow', toolIds: [], reason: 'missing tools' }] })).toThrow(/toolIds/)
  expect(() => createPolicyGate({ rules: [{ id: 'empty', effect: 'allow', toolIds: ['shell'], reason: '' }] })).toThrow(/reason/)
})
