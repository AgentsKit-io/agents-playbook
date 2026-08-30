import { fail } from './errors.js'

export interface PolicyRule {
  readonly id: string
  readonly effect: 'allow' | 'block' | 'approve'
  readonly toolIds: readonly string[]
  readonly reason: string
}

export interface PolicyRequest {
  readonly actionId: string
  readonly turnId: string
  readonly toolId: string
  readonly argumentsHash: string
}

export interface PolicyDecision {
  readonly decision: 'allow' | 'block' | 'approve'
  readonly policyId: string
  readonly reason: string
}

export interface PolicyGate {
  evaluate(request: PolicyRequest): PolicyDecision
}

const required = (value: string, label: string): string => {
  if (typeof value !== 'string' || !value.trim()) fail(`${label} is required.`, 'INVALID_INPUT')
  return value.trim()
}

export const createPolicyGate = ({ rules }: { readonly rules: readonly PolicyRule[] }): PolicyGate => {
  if (!Array.isArray(rules)) fail('Policy rules must be an array.', 'INVALID_INPUT')
  const normalized = rules.map((rule, index) => {
    if (typeof rule !== 'object' || rule === null || Array.isArray(rule)) fail(`rules[${index}] must be an object.`, 'INVALID_INPUT')
    const id = required(rule.id, `rules[${index}].id`)
    if (rule.effect !== 'allow' && rule.effect !== 'block' && rule.effect !== 'approve') fail(`rules[${index}].effect is invalid.`, 'INVALID_INPUT')
    if (!Array.isArray(rule.toolIds) || !rule.toolIds.length || rule.toolIds.some((toolId) => typeof toolId !== 'string' || !toolId.trim())) fail(`rules[${index}].toolIds must contain non-empty strings.`, 'INVALID_INPUT')
    return { id, effect: rule.effect, toolIds: rule.toolIds.map((toolId) => required(toolId, `rules[${index}].toolIds`)), reason: required(rule.reason, `rules[${index}].reason`) }
  })
  if (new Set(normalized.map((rule) => rule.id)).size !== normalized.length) fail('Policy rules must have unique ids.', 'INVALID_INPUT')
  return {
    evaluate: (request) => {
      if (typeof request !== 'object' || request === null || Array.isArray(request)) fail('Policy request must be an object.', 'INVALID_INPUT')
      required(request.actionId, 'request.actionId')
      required(request.turnId, 'request.turnId')
      const toolId = required(request.toolId, 'request.toolId')
      required(request.argumentsHash, 'request.argumentsHash')
      const rule = normalized.find((candidate) => candidate.toolIds.includes(toolId))
      return rule ? { decision: rule.effect, policyId: rule.id, reason: rule.reason } : { decision: 'block', policyId: 'default-deny', reason: `No policy rule allows tool: ${toolId}.` }
    },
  }
}
