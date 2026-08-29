import { fail } from './errors.js'

type RawRecord = Record<string, unknown>

const isRecord = (value: unknown): value is RawRecord => typeof value === 'object' && value !== null && !Array.isArray(value)
const record = (value: unknown, label: string): RawRecord => {
  if (!isRecord(value)) fail(`${label} must be an object.`, 'INVALID_CONFIG')
  return value as RawRecord
}
const id = (value: unknown, label: string): string => {
  if (typeof value !== 'string' || !value.trim()) fail(`${label} must be a non-empty string.`, 'INVALID_CONFIG')
  return value as string
}
const parents = (value: unknown, label: string): string[] => value === undefined ? [] : Array.isArray(value) ? value.map((item, index) => id(item, `${label}[${index}]`)) : [id(value, label)]

const merge = (base: RawRecord, overlay: RawRecord): RawRecord => {
  const result: RawRecord = { ...base }
  for (const key of ['surfaces', 'budget', 'cleanup'] as const) {
    if (overlay[key] !== undefined) result[key] = { ...(isRecord(result[key]) ? result[key] : {}), ...record(overlay[key], `profile.${key}`) }
  }
  if (overlay['checkOverrides'] !== undefined) {
    if (!Array.isArray(overlay['checkOverrides'])) fail('profile.checkOverrides must be an array.', 'INVALID_CONFIG')
    const checks = Array.isArray(result['checks']) ? [...result['checks']] : []
    for (const [index, value] of (overlay['checkOverrides'] as unknown[]).entries()) {
      const override = record(value, `profile.checkOverrides[${index}]`)
      const checkId = id(override['id'], `profile.checkOverrides[${index}].id`)
      const checkIndex = checks.findIndex((check) => isRecord(check) && check['id'] === checkId)
      if (checkIndex < 0) fail(`profile.checkOverrides references unknown check: ${checkId}.`, 'INVALID_CONFIG')
      checks[checkIndex] = { ...(checks[checkIndex] as RawRecord), ...override }
    }
    result['checks'] = checks
  }
  return result
}

export const resolveProfile = (root: RawRecord): RawRecord => {
  if (root['profiles'] === undefined) return root
  const profileMap = record(root['profiles'], 'profiles')
  const selected = id(root['profile'], 'profile')
  const visiting = new Set<string>()
  const visited = new Map<string, RawRecord>()
  const resolve = (name: string): RawRecord => {
    const cached = visited.get(name)
    if (cached) return cached
    if (visiting.has(name)) fail(`Profile inheritance cycle includes ${name}.`, 'INVALID_CONFIG')
    const definition = record(profileMap[name], `profiles.${name}`)
    visiting.add(name)
    let result: RawRecord = { ...root }
    for (const parent of parents(definition['extends'], `profiles.${name}.extends`)) result = merge(result, resolve(parent))
    result = merge(result, definition)
    visiting.delete(name); visited.set(name, result)
    return result
  }
  return resolve(selected)
}
