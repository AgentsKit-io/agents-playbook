import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fail } from './errors.js'
import { readRun } from './files.js'
import { RUN_STATES } from './types.js'
import type { BenchmarkBinding, RunState, VerificationRun } from './types.js'

export const BENCHMARK_SCHEMA_VERSION = 1 as const

export type BenchmarkObservationStatus = 'passed' | 'failed' | 'blocked' | 'not-run'

export interface BenchmarkTask {
  readonly id: string
  readonly title: string
  readonly acceptanceCriteria: readonly string[]
}

export interface BenchmarkObservation {
  readonly taskId: string
  readonly mode: 'baseline'
  readonly status: BenchmarkObservationStatus
  readonly source: string
  readonly recordedAt: string
  readonly attempts?: number
  readonly durationMs?: number
  readonly reviewMinutes?: number
  readonly escapedIncomplete?: number
}

export interface BenchmarkManifest {
  readonly type: 'agentskit-harness-benchmark-manifest'
  readonly schemaVersion: typeof BENCHMARK_SCHEMA_VERSION
  readonly suiteId: string
  readonly name: string
  readonly tasks: readonly BenchmarkTask[]
  readonly observations: readonly BenchmarkObservation[]
}

export interface BenchmarkRun {
  readonly runId: string
  readonly state: RunState
  readonly sourceRevision: string
  readonly configHash: string
  readonly contractHash: string
  readonly supersedes?: string
  readonly durationMs?: number
  readonly checks: { readonly total: number; readonly passed: number; readonly failed: number }
  readonly outcomes: { readonly total: number; readonly passed: number; readonly failed: number }
  readonly evidence: { readonly total: number; readonly attached: number }
  readonly humanApproved: boolean
  readonly authorized: boolean
  readonly benchmark?: BenchmarkBinding
}

export interface BenchmarkComparison {
  readonly taskId: string
  readonly title: string
  readonly comparable: boolean
  readonly baseline?: BenchmarkObservation
  readonly harness: {
    readonly attempts: number
    readonly latestState: RunState | 'NOT_RUN'
    readonly latestRunId?: string
    readonly latestDurationMs?: number
    readonly humanApproved: boolean
  }
  readonly durationDeltaMs?: number
  readonly attemptDelta?: number
}

export interface BenchmarkSummary {
  readonly totalRuns: number
  readonly stateCounts: Readonly<Record<RunState, number>>
  readonly completeRuns: number
  readonly retriedRuns: number
  readonly staleRuns: number
  readonly firstAttemptRuns: number
  readonly humanApprovedRuns: number
  readonly authorizedRuns: number
  readonly checkPassRate: number | null
  readonly outcomePassRate: number | null
  readonly evidenceCoverageRate: number | null
  readonly firstAttemptApprovalRate: number | null
  readonly retryRate: number | null
  readonly staleRate: number | null
  readonly averageDurationMs: number | null
  readonly medianDurationMs: number | null
}

export interface BenchmarkReport {
  readonly type: 'agentskit-harness-benchmark'
  readonly schemaVersion: typeof BENCHMARK_SCHEMA_VERSION
  readonly stateDir: string
  readonly generatedAt: string
  readonly runs: readonly BenchmarkRun[]
  readonly summary: BenchmarkSummary
  readonly manifest?: { readonly suiteId: string; readonly taskCount: number; readonly baselineCount: number; readonly comparableTaskCount: number }
  readonly comparisons: readonly BenchmarkComparison[]
}

const percentage = (part: number, total: number): number | null => total ? Number((part / total).toFixed(4)) : null
const count = <T>(items: readonly T[], predicate: (item: T) => boolean): number => items.filter(predicate).length
const median = (values: readonly number[]): number | null => {
  if (!values.length) return null
  const sorted = [...values].sort((left, right) => left - right)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[middle] ?? null : ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2
}

const projectRun = (run: VerificationRun): BenchmarkRun => {
  const checks = { total: run.checks.length, passed: count(run.checks, (check) => check.status === 'passed'), failed: count(run.checks, (check) => check.status === 'failed') }
  const outcomes = { total: run.outcomes.length, passed: count(run.outcomes, (outcome) => outcome.status === 'passed'), failed: count(run.outcomes, (outcome) => outcome.status === 'failed') }
  const evidence = { total: run.checks.length, attached: count(run.checks, (check) => check.evidence !== undefined) }
  return { runId: run.runId, state: run.state, sourceRevision: run.sourceRevision, configHash: run.configHash, contractHash: run.contractHash, ...(run.supersedes ? { supersedes: run.supersedes } : {}), ...(run.metrics ? { durationMs: run.metrics.totalDurationMs } : {}), checks, outcomes, evidence, humanApproved: run.humanApproval !== undefined, authorized: run.authorization !== undefined, ...(run.benchmark ? { benchmark: run.benchmark } : {}) }
}

const summarize = (runs: readonly BenchmarkRun[]): BenchmarkSummary => {
  const stateCounts = Object.fromEntries(RUN_STATES.map((state) => [state, count(runs, (run) => run.state === state)])) as Record<RunState, number>
  const checksTotal = runs.reduce((total, run) => total + run.checks.total, 0)
  const checksPassed = runs.reduce((total, run) => total + run.checks.passed, 0)
  const outcomesTotal = runs.reduce((total, run) => total + run.outcomes.total, 0)
  const outcomesPassed = runs.reduce((total, run) => total + run.outcomes.passed, 0)
  const evidenceTotal = runs.reduce((total, run) => total + run.evidence.total, 0)
  const evidenceAttached = runs.reduce((total, run) => total + run.evidence.attached, 0)
  const firstAttempts = runs.filter((run) => !run.supersedes)
  const durations = runs.flatMap((run) => run.durationMs === undefined ? [] : [run.durationMs])
  return {
    totalRuns: runs.length,
    stateCounts,
    completeRuns: stateCounts.COMPLETE,
    retriedRuns: count(runs, (run) => run.supersedes !== undefined),
    staleRuns: stateCounts.STALE,
    firstAttemptRuns: firstAttempts.length,
    humanApprovedRuns: count(runs, (run) => run.humanApproved),
    authorizedRuns: count(runs, (run) => run.authorized),
    checkPassRate: percentage(checksPassed, checksTotal),
    outcomePassRate: percentage(outcomesPassed, outcomesTotal),
    evidenceCoverageRate: percentage(evidenceAttached, evidenceTotal),
    firstAttemptApprovalRate: percentage(count(firstAttempts, (run) => run.humanApproved), firstAttempts.length),
    retryRate: percentage(count(runs, (run) => run.supersedes !== undefined), runs.length),
    staleRate: percentage(stateCounts.STALE, runs.length),
    averageDurationMs: durations.length ? Math.round(durations.reduce((total, duration) => total + duration, 0) / durations.length) : null,
    medianDurationMs: median(durations),
  }
}

const readRuns = (stateDir: string): VerificationRun[] => {
  const runsDir = join(stateDir, 'runs')
  if (!existsSync(runsDir)) return []
  return readdirSync(runsDir, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => {
    try { return readRun(stateDir, entry.name) } catch (error) { return fail(`Benchmark could not read run ${entry.name}: ${error instanceof Error ? error.message : String(error)}`, 'HARNESS_ERROR') }
  })
}

const nonEmptyString = (value: unknown, label: string): string => {
  if (typeof value !== 'string') return fail(`${label} must be a non-empty string.`, 'INVALID_CONFIG')
  const result = value.trim()
  if (!result) return fail(`${label} must be a non-empty string.`, 'INVALID_CONFIG')
  return result
}

const stringList = (value: unknown, label: string): string[] => {
  if (!Array.isArray(value)) return fail(`${label} must be a non-empty string array.`, 'INVALID_CONFIG')
  const items = value as unknown[]
  if (!items.length || !items.every((item: unknown) => typeof item === 'string' && Boolean(item.trim()))) return fail(`${label} must be a non-empty string array.`, 'INVALID_CONFIG')
  return items.map((item: unknown) => String(item).trim())
}

const nonNegativeNumber = (value: unknown, label: string): number | undefined => {
  if (value === undefined) return undefined
  if (typeof value !== 'number') return fail(`${label} must be a non-negative number.`, 'INVALID_CONFIG')
  if (!Number.isFinite(value) || value < 0) return fail(`${label} must be a non-negative number.`, 'INVALID_CONFIG')
  const result = value
  return result
}

export const validateBenchmarkManifest = (value: unknown): BenchmarkManifest => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) fail('benchmark manifest must be an object.', 'INVALID_CONFIG')
  const raw = value as Record<string, unknown>
  if (raw['type'] !== 'agentskit-harness-benchmark-manifest' || raw['schemaVersion'] !== BENCHMARK_SCHEMA_VERSION) fail('benchmark manifest type or schemaVersion is invalid.', 'INVALID_CONFIG')
  const rawTasks = Array.isArray(raw['tasks']) && raw['tasks'].length ? raw['tasks'] : fail('benchmark manifest tasks must be non-empty.', 'INVALID_CONFIG')
  const tasks = rawTasks.map((item, index) => {
    if (typeof item !== 'object' || item === null || Array.isArray(item)) fail(`benchmark.tasks[${index}] must be an object.`, 'INVALID_CONFIG')
    const task = item as Record<string, unknown>
    return { id: nonEmptyString(task['id'], `benchmark.tasks[${index}].id`), title: nonEmptyString(task['title'], `benchmark.tasks[${index}].title`), acceptanceCriteria: stringList(task['acceptanceCriteria'], `benchmark.tasks[${index}].acceptanceCriteria`) }
  })
  if (new Set(tasks.map((task) => task.id)).size !== tasks.length) fail('benchmark task ids must be unique.', 'INVALID_CONFIG')
  const taskIds = new Set(tasks.map((task) => task.id))
  const rawObservations = raw['observations'] === undefined ? [] : Array.isArray(raw['observations']) ? raw['observations'] : fail('benchmark.observations must be an array.', 'INVALID_CONFIG')
  const observations = rawObservations.map((item, index) => {
    if (typeof item !== 'object' || item === null || Array.isArray(item)) fail(`benchmark.observations[${index}] must be an object.`, 'INVALID_CONFIG')
    const observation = item as Record<string, unknown>
    const status = observation['status']
    if (!['passed', 'failed', 'blocked', 'not-run'].includes(String(status))) fail(`benchmark.observations[${index}].status is invalid.`, 'INVALID_CONFIG')
    const taskId = nonEmptyString(observation['taskId'], `benchmark.observations[${index}].taskId`)
    if (!taskIds.has(taskId)) fail(`benchmark observation references unknown task: ${taskId}.`, 'INVALID_CONFIG')
    const attempts = nonNegativeNumber(observation['attempts'], `benchmark.observations[${index}].attempts`)
    const durationMs = nonNegativeNumber(observation['durationMs'], `benchmark.observations[${index}].durationMs`)
    const reviewMinutes = nonNegativeNumber(observation['reviewMinutes'], `benchmark.observations[${index}].reviewMinutes`)
    const escapedIncomplete = nonNegativeNumber(observation['escapedIncomplete'], `benchmark.observations[${index}].escapedIncomplete`)
    return { taskId, mode: 'baseline' as const, status: status as BenchmarkObservationStatus, source: nonEmptyString(observation['source'], `benchmark.observations[${index}].source`), recordedAt: nonEmptyString(observation['recordedAt'], `benchmark.observations[${index}].recordedAt`), ...(attempts === undefined ? {} : { attempts }), ...(durationMs === undefined ? {} : { durationMs }), ...(reviewMinutes === undefined ? {} : { reviewMinutes }), ...(escapedIncomplete === undefined ? {} : { escapedIncomplete }) }
  })
  if (new Set(observations.map((observation) => observation.taskId)).size !== observations.length) fail('benchmark allows at most one baseline observation per task.', 'INVALID_CONFIG')
  return { type: 'agentskit-harness-benchmark-manifest', schemaVersion: BENCHMARK_SCHEMA_VERSION, suiteId: nonEmptyString(raw['suiteId'], 'benchmark.suiteId'), name: nonEmptyString(raw['name'], 'benchmark.name'), tasks, observations }
}

export const loadBenchmarkManifest = (path: string): BenchmarkManifest => {
  try { return validateBenchmarkManifest(JSON.parse(readFileSync(path, 'utf8')) as unknown) } catch (error) { if (error instanceof SyntaxError) return fail(`Invalid benchmark manifest JSON: ${error.message}`, 'INVALID_CONFIG'); throw error }
}

const comparisons = (runs: readonly BenchmarkRun[], manifest: BenchmarkManifest): readonly BenchmarkComparison[] => manifest.tasks.map((task) => {
  const taskRuns = runs.filter((run) => run.benchmark?.suiteId === manifest.suiteId && run.benchmark.taskId === task.id)
  const latest = taskRuns.at(-1)
  const baseline = manifest.observations.find((observation) => observation.taskId === task.id)
  const comparable = baseline !== undefined && baseline.status !== 'not-run' && latest !== undefined
  return { taskId: task.id, title: task.title, comparable, ...(baseline ? { baseline } : {}), harness: { attempts: taskRuns.length, latestState: latest?.state ?? 'NOT_RUN', ...(latest ? { latestRunId: latest.runId } : {}), ...(latest?.durationMs === undefined ? {} : { latestDurationMs: latest.durationMs }), humanApproved: latest?.humanApproved ?? false }, ...(comparable && baseline?.durationMs !== undefined && latest?.durationMs !== undefined ? { durationDeltaMs: latest.durationMs - baseline.durationMs } : {}), ...(comparable && baseline?.attempts !== undefined ? { attemptDelta: taskRuns.length - baseline.attempts } : {}) }
})

export const benchmarkRuns = (stateDir: string, manifest?: BenchmarkManifest): BenchmarkReport => {
  const runs = readRuns(stateDir).map(projectRun).sort((left, right) => left.runId.localeCompare(right.runId))
  const reportComparisons = manifest ? comparisons(runs, manifest) : []
  return { type: 'agentskit-harness-benchmark', schemaVersion: BENCHMARK_SCHEMA_VERSION, stateDir, generatedAt: new Date().toISOString(), runs, summary: summarize(runs), comparisons: reportComparisons, ...(manifest ? { manifest: { suiteId: manifest.suiteId, taskCount: manifest.tasks.length, baselineCount: manifest.observations.length, comparableTaskCount: reportComparisons.filter((comparison) => comparison.comparable).length } } : {}) }
}
