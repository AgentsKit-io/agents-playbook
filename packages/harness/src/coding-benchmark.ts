import { fail } from './errors.js'

export type ExternalCodingBenchmarkStatus = 'ok' | 'partial' | 'fail' | 'timeout'

export interface ExternalCodingBenchmarkRow {
  readonly providerId: string
  readonly status: ExternalCodingBenchmarkStatus
  readonly completenessScore: number
  readonly fileEditCount: number
  readonly summary: string
  readonly durationMs?: number
  readonly inputTokens?: number
  readonly outputTokens?: number
  readonly costUsd?: number
  readonly successPassed?: boolean
}

export interface ExternalCodingBenchmarkReport {
  readonly kind: string
  readonly prompt: string
  readonly dryRun: boolean
  readonly isolateWorktrees: boolean
  readonly repoRoot: string
  readonly rows: readonly ExternalCodingBenchmarkRow[]
}

const text = (value: unknown, label: string): string => {
  if (typeof value !== 'string' || !value.trim()) fail(`${label} must be a non-empty string.`, 'INVALID_INPUT')
  return (value as string).trim()
}

const numberValue = (value: unknown, label: string, integer = false): number => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || (integer && !Number.isInteger(value))) fail(`${label} must be a non-negative ${integer ? 'integer' : 'number'}.`, 'INVALID_INPUT')
  return value as number
}

/**
 * Validates the stable report shape emitted by AgentsKit OS coding benchmarks.
 * Provider heuristics remain observations; this function never grants human acceptance.
 */
export const validateExternalCodingBenchmarkReport = (value: unknown): ExternalCodingBenchmarkReport => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) fail('coding benchmark report must be an object.', 'INVALID_INPUT')
  const raw = value as Record<string, unknown>
  if (!['edit', 'fix-bug', 'add-feature', 'refactor', 'add-test', 'review-pr', 'free-form'].includes(text(raw['kind'], 'report.kind'))) fail('report.kind is not a supported coding task kind.', 'INVALID_INPUT')
  if (typeof raw['dryRun'] !== 'boolean' || typeof raw['isolateWorktrees'] !== 'boolean') fail('report.dryRun and report.isolateWorktrees must be booleans.', 'INVALID_INPUT')
  if (!Array.isArray(raw['rows']) || raw['rows'].length === 0) fail('report.rows must contain at least one provider result.', 'INVALID_INPUT')
  const rows = (raw['rows'] as unknown[]).map((item: unknown, index: number) => {
    if (typeof item !== 'object' || item === null || Array.isArray(item)) fail(`report.rows[${index}] must be an object.`, 'INVALID_INPUT')
    const row = item as Record<string, unknown>
    const status = text(row['status'], `report.rows[${index}].status`)
    if (!['ok', 'partial', 'fail', 'timeout'].includes(status)) fail(`report.rows[${index}].status is invalid.`, 'INVALID_INPUT')
    const completenessScore = numberValue(row['completenessScore'], `report.rows[${index}].completenessScore`)
    if (completenessScore > 100) fail(`report.rows[${index}].completenessScore must be between 0 and 100.`, 'INVALID_INPUT')
    const optional = (key: string): number | undefined => row[key] === undefined ? undefined : numberValue(row[key], `report.rows[${index}].${key}`)
    return {
      providerId: text(row['providerId'], `report.rows[${index}].providerId`),
      status: status as ExternalCodingBenchmarkStatus,
      completenessScore,
      fileEditCount: numberValue(row['fileEditCount'], `report.rows[${index}].fileEditCount`, true),
      summary: text(row['summary'], `report.rows[${index}].summary`),
      ...(optional('durationMs') === undefined ? {} : { durationMs: optional('durationMs') }),
      ...(optional('inputTokens') === undefined ? {} : { inputTokens: optional('inputTokens') }),
      ...(optional('outputTokens') === undefined ? {} : { outputTokens: optional('outputTokens') }),
      ...(optional('costUsd') === undefined ? {} : { costUsd: optional('costUsd') }),
      ...(row['successPassed'] === undefined ? {} : typeof row['successPassed'] !== 'boolean' ? fail(`report.rows[${index}].successPassed must be a boolean.`, 'INVALID_INPUT') : { successPassed: row['successPassed'] }),
    }
  })
  if (new Set(rows.map((row) => row.providerId)).size !== rows.length) fail('coding benchmark provider ids must be unique.', 'INVALID_INPUT')
  return { kind: text(raw['kind'], 'report.kind'), prompt: text(raw['prompt'], 'report.prompt'), dryRun: raw['dryRun'] as boolean, isolateWorktrees: raw['isolateWorktrees'] as boolean, repoRoot: text(raw['repoRoot'], 'report.repoRoot'), rows }
}
