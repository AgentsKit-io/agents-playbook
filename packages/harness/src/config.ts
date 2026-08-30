import { dirname, resolve } from 'node:path'
import { REAL_CATEGORIES } from './constants.js'
import { resolveProfile } from './profiles.js'
import { fail } from './errors.js'
import { hashJson } from './hash.js'
import { pathInside, readJson } from './files.js'
import type { CheckCategory, ContractOutcome, LoadedConfig, SurfaceName, SurfaceRequirement, TaskContract, TrackingConfig, VerificationCheck, VerificationConfig } from './types.js'
import { CHECK_CATEGORIES, SURFACE_NAMES } from './types.js'

interface RawRecord { readonly [key: string]: unknown }
interface RawScope extends RawRecord { readonly inScope?: unknown; readonly outOfScope?: unknown }
interface RawContract extends RawRecord { readonly intent?: unknown; readonly scope?: unknown; readonly ambiguities?: unknown; readonly outcomes?: unknown }
interface RawCheck extends RawRecord { readonly id?: unknown; readonly category?: unknown; readonly command?: unknown; readonly required?: unknown; readonly timeoutMs?: unknown; readonly execution?: unknown; readonly capabilities?: unknown; readonly evidence?: unknown }
interface RawTracking extends RawRecord { readonly required?: unknown; readonly target?: unknown; readonly reason?: unknown }
interface RawConfig extends RawRecord { readonly schemaVersion?: unknown; readonly project?: unknown; readonly root?: unknown; readonly stateDir?: unknown; readonly profile?: unknown; readonly profiles?: unknown; readonly contract?: unknown; readonly checks?: unknown; readonly surfaces?: unknown; readonly tracking?: unknown; readonly budget?: unknown; readonly cleanup?: unknown }
interface RawBudget extends RawRecord { readonly maxDurationMs?: unknown }
interface RawCleanup extends RawRecord { readonly roots?: unknown }
interface RawBenchmark extends RawRecord { readonly suiteId?: unknown; readonly taskId?: unknown; readonly mode?: unknown }

const isRecord = (value: unknown): value is RawRecord => typeof value === 'object' && value !== null && !Array.isArray(value)
const stringValue = (value: unknown, label: string): string => {
  if (typeof value !== 'string') return fail(`${label} is required.`, 'INVALID_CONFIG')
  const result = value.trim()
  if (!result) return fail(`${label} is required.`, 'INVALID_CONFIG')
  return result
}
const stringArray = (value: unknown, label: string): string[] => {
  if (!Array.isArray(value)) fail(`${label} must be an array of non-empty strings.`, 'INVALID_CONFIG')
  const items: unknown[] = value as unknown[]
  if (!items.every((item: unknown): item is string => typeof item === 'string' && Boolean(item.trim()))) fail(`${label} must be an array of non-empty strings.`, 'INVALID_CONFIG')
  return items.map((item: unknown) => stringValue(item, label))
}
const asRecord = (value: unknown, label: string): RawRecord => {
  if (!isRecord(value)) fail(`${label} must be an object.`, 'INVALID_CONFIG')
  return value as RawRecord
}
const surface = (value: unknown, name: SurfaceName): SurfaceRequirement => {
  if (typeof value === 'boolean') return value ? { required: true } : { required: false, reason: `${name} is not applicable.` }
  const record = asRecord(value, `surfaces.${name}`)
  if (typeof record['required'] !== 'boolean') fail(`surfaces.${name}.required must be boolean.`, 'INVALID_CONFIG')
  if (!record['required'] && typeof record['reason'] !== 'string') fail(`surfaces.${name}.reason is required when not applicable.`, 'INVALID_CONFIG')
  return { required: record['required'] as boolean, ...(typeof record['reason'] === 'string' ? { reason: record['reason'] } : {}) }
}

const parseCheck = (value: unknown, index: number): VerificationCheck => {
  const record = asRecord(value, `checks[${index}]`) as RawCheck
  const id = stringValue(record['id'], `checks[${index}].id`)
  const category = stringValue(record['category'], `checks[${index}].category`)
  if (!(CHECK_CATEGORIES as readonly string[]).includes(category)) fail(`checks[${index}].category is invalid.`, 'INVALID_CONFIG')
  const command = stringValue(record['command'], `checks[${index}].command`)
  if (REAL_CATEGORIES.has(category) && record['execution'] !== 'real') fail(`checks[${index}] must declare execution: real.`, 'INVALID_CONFIG')
  if (record['evidence'] !== 'structured') fail(`checks[${index}] must declare evidence: structured.`, 'INVALID_CONFIG')
  if (record['capabilities'] !== undefined && (!Array.isArray(record['capabilities']) || !record['capabilities'].every((item: unknown) => typeof item === 'string'))) fail(`checks[${index}].capabilities must be strings.`, 'INVALID_CONFIG')
  const capabilities = Array.isArray(record['capabilities']) ? record['capabilities'].filter((item): item is string => typeof item === 'string') : undefined
  if (category === 'ui' && !capabilities?.includes('real-browser')) fail(`checks[${index}] must declare real-browser.`, 'INVALID_CONFIG')
  if (category === 'ui' && !capabilities?.includes('screenshot')) fail(`checks[${index}] must declare screenshot.`, 'INVALID_CONFIG')
  if (record['required'] !== undefined && typeof record['required'] !== 'boolean') fail(`checks[${index}].required must be boolean.`, 'INVALID_CONFIG')
  if (record['timeoutMs'] !== undefined && (!Number.isInteger(record['timeoutMs']) || typeof record['timeoutMs'] !== 'number' || record['timeoutMs'] < 1)) fail(`checks[${index}].timeoutMs must be positive.`, 'INVALID_CONFIG')
  return { id, category: category as CheckCategory, command, required: record['required'] !== false, timeoutMs: typeof record['timeoutMs'] === 'number' ? record['timeoutMs'] : 120_000, ...(record['execution'] === 'real' ? { execution: 'real' } : {}), ...(capabilities ? { capabilities } : {}), evidence: 'structured' }
}

const parseOutcome = (value: unknown, index: number, checks: readonly VerificationCheck[]): ContractOutcome => {
  const record = asRecord(value, `contract.outcomes[${index}]`)
  const id = stringValue(record['id'], `contract.outcomes[${index}].id`)
  const statement = stringValue(record['statement'], `contract.outcomes[${index}].statement`)
  const ids = stringArray(record['checks'], `contract.outcomes[${index}].checks`)
  if (ids.some((checkId) => !checks.some((check) => check.id === checkId))) fail(`contract.outcomes[${index}] references an unknown check.`, 'INVALID_CONFIG')
  return { id, statement, checks: [...new Set(ids)] }
}

export const validateConfig = (rawValue: unknown): VerificationConfig => {
  const raw = resolveProfile(asRecord(rawValue, 'verification config')) as RawConfig
  if (raw['schemaVersion'] !== 1) fail('verification config schemaVersion must be 1.', 'INVALID_CONFIG')
  const project = stringValue(raw['project'], 'verification config project')
  const contractRaw = asRecord(raw['contract'], 'contract') as RawContract
  const rawChecks = raw['checks']
  const checks = Array.isArray(rawChecks) ? rawChecks.map(parseCheck) : fail('checks must be a non-empty array.', 'INVALID_CONFIG')
  if (!checks.length || new Set(checks.map((check) => check.id)).size !== checks.length) fail('check ids must be unique.', 'INVALID_CONFIG')
  const scopeRaw = asRecord(contractRaw['scope'], 'contract.scope') as RawScope
  const scope = { inScope: stringArray(scopeRaw['inScope'], 'contract.scope.inScope'), outOfScope: stringArray(scopeRaw['outOfScope'], 'contract.scope.outOfScope') }
  const ambiguities = stringArray(contractRaw['ambiguities'], 'contract.ambiguities')
  const rawOutcomes = contractRaw['outcomes']
  const outcomes = Array.isArray(rawOutcomes) ? rawOutcomes.map((outcome, index) => parseOutcome(outcome, index, checks)) : fail('contract.outcomes must be a non-empty array.', 'INVALID_CONFIG')
  if (!outcomes.length || new Set(outcomes.map((outcome) => outcome.id)).size !== outcomes.length) fail('outcome ids must be unique.', 'INVALID_CONFIG')
  const mapped = new Set(outcomes.flatMap((outcome) => outcome.checks))
  if (checks.some((check) => check.required && !mapped.has(check.id))) fail('every required check must map to an outcome.', 'INVALID_CONFIG')
  const rawSurfaces = isRecord(raw['surfaces']) ? raw['surfaces'] : undefined
  const surfaces = Object.fromEntries(SURFACE_NAMES.map((name) => [name, surface(rawSurfaces?.[name] ?? (name === 'logic'), name)])) as Record<SurfaceName, SurfaceRequirement>
  for (const name of SURFACE_NAMES) if (surfaces[name].required && !checks.some((check) => check.required && check.category === name)) fail(`required surface ${name} has no required check.`, 'INVALID_CONFIG')
  const trackingRaw = isRecord(raw['tracking']) ? raw['tracking'] as RawTracking : { required: false, reason: 'tracking is not configured for this run.' }
  if (trackingRaw['required'] === true && typeof trackingRaw['target'] !== 'string') fail('tracking.target is required when tracking is enabled.', 'INVALID_CONFIG')
  if (trackingRaw['required'] !== true && typeof trackingRaw['reason'] !== 'string') fail('tracking.reason is required when tracking is disabled.', 'INVALID_CONFIG')
  const budgetRaw = raw['budget'] === undefined ? undefined : asRecord(raw['budget'], 'budget') as RawBudget
  if (budgetRaw && budgetRaw['maxDurationMs'] !== undefined && (!Number.isInteger(budgetRaw['maxDurationMs']) || typeof budgetRaw['maxDurationMs'] !== 'number' || budgetRaw['maxDurationMs'] < 1)) fail('budget.maxDurationMs must be positive.', 'INVALID_CONFIG')
  const cleanupRaw = raw['cleanup'] === undefined ? undefined : asRecord(raw['cleanup'], 'cleanup') as RawCleanup
  const cleanup = cleanupRaw ? { roots: cleanupRaw['roots'] === undefined ? undefined : stringArray(cleanupRaw['roots'], 'cleanup.roots') } : undefined
  const benchmarkRaw = raw['benchmark'] === undefined ? undefined : asRecord(raw['benchmark'], 'benchmark') as RawBenchmark
  const benchmark = benchmarkRaw ? { suiteId: stringValue(benchmarkRaw['suiteId'], 'benchmark.suiteId'), taskId: stringValue(benchmarkRaw['taskId'], 'benchmark.taskId'), mode: benchmarkRaw['mode'] === 'harness' ? 'harness' as const : fail('benchmark.mode must be harness.', 'INVALID_CONFIG') } : undefined
  const contract: TaskContract = { intent: stringValue(contractRaw['intent'], 'contract.intent'), scope, ambiguities, outcomes }
  const tracking: TrackingConfig = { required: trackingRaw['required'] === true, ...(typeof trackingRaw['target'] === 'string' ? { target: trackingRaw['target'] } : {}), ...(typeof trackingRaw['reason'] === 'string' ? { reason: trackingRaw['reason'] } : {}) }
  return { schemaVersion: 1, project, ...(typeof raw['root'] === 'string' ? { root: raw['root'] } : {}), ...(typeof raw['stateDir'] === 'string' ? { stateDir: raw['stateDir'] } : {}), profile: typeof raw['profile'] === 'string' ? raw['profile'] : 'strict', contract, surfaces, checks, tracking, ...(budgetRaw ? { budget: { maxDurationMs: budgetRaw['maxDurationMs'] as number | undefined } } : {}), ...(cleanup ? { cleanup } : {}), ...(benchmark ? { benchmark } : {}) }
}

export const loadConfig = (configPath = '.codex/verification.json'): LoadedConfig => {
  const absolute = resolve(configPath)
  const raw = readJson(absolute)
  const rawRecord = asRecord(raw, 'verification config')
  const root = resolve(dirname(absolute), typeof rawRecord['root'] === 'string' ? rawRecord['root'] : '.')
  const stateDir = resolve(root, typeof rawRecord['stateDir'] === 'string' ? rawRecord['stateDir'] : '.codex/verification')
  if (!pathInside(root, stateDir)) fail('stateDir must be inside the project root.', 'INVALID_CONFIG')
  const config = validateConfig(raw)
  return { absolute, root, stateDir, config, configHash: hashJson(config) }
}
