import { existsSync, mkdtempSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { fail } from './errors.js'
import { readJson, readRun } from './files.js'
import { RUN_STATES } from './types.js'
import type { BenchmarkBinding, RunState, VerificationRun } from './types.js'

export const BENCHMARK_SCHEMA_VERSION = 1 as const

export type BenchmarkObservationStatus = 'passed' | 'failed' | 'blocked' | 'not-run'
export type BenchmarkImprovementDirection = 'improved' | 'regressed' | 'unchanged' | 'unavailable'
export type BenchmarkConfidence = 'insufficient' | 'directional' | 'reliable'

export interface BenchmarkPolicy {
  readonly minComparableTasks: number
  readonly maxDurationRegressionRate: number
  readonly minCompletedRunsPerTask: number
  readonly minBaselineSamplesPerTask: number
  readonly requireZeroEscapedIncomplete: boolean
}

export interface BenchmarkQualityGate {
  readonly status: 'passed' | 'failed' | 'insufficient-data'
  readonly confidence: BenchmarkConfidence
  readonly comparableTaskCount: number
  readonly policy: BenchmarkPolicy
  readonly durationRegressionTaskIds: readonly string[]
  readonly escapedIncompleteTaskIds: readonly string[]
  readonly reasons: readonly string[]
}

export interface BenchmarkTask {
  readonly id: string
  readonly title: string
  readonly acceptanceCriteria: readonly string[]
  readonly kind?: string
  readonly prompt?: BenchmarkTaskFile
  readonly source?: BenchmarkTaskSource
  readonly scope?: BenchmarkTaskScope
}

export interface BenchmarkTaskFile {
  readonly path: string
  readonly sha256: string
}

export interface BenchmarkTaskSource {
  readonly repository: string
  readonly path: string
  readonly revision: string
}

export interface BenchmarkSuiteSource {
  readonly repository: string
  readonly revision: string
  readonly taskDefinition: string
}

export interface BenchmarkTaskScope {
  readonly read: readonly string[]
  readonly write: readonly string[]
}

export interface BenchmarkObservation {
  readonly taskId: string
  readonly mode: 'baseline'
  readonly status: BenchmarkObservationStatus
  readonly source: string
  readonly recordedAt: string
  readonly attempts?: number
  readonly durationMs?: number
  readonly durationSamplesMs?: readonly number[]
  /** Fraction of repeated samples whose task artifact passed acceptance validation. */
  readonly artifactAcceptanceRate?: number
  /** Fraction of repeated samples whose verification protocol completed. */
  readonly protocolCompletionRate?: number
  readonly reviewMinutes?: number
  readonly escapedIncomplete?: number
  readonly evidence?: readonly BenchmarkObservationEvidence[]
  readonly evidenceDigest?: string
}

export interface BenchmarkObservationEvidence {
  readonly criterion: string
  readonly status: BenchmarkObservationStatus
  readonly source: string
}

export interface BenchmarkManifest {
  readonly type: 'agentskit-harness-benchmark-manifest'
  readonly schemaVersion: typeof BENCHMARK_SCHEMA_VERSION
  readonly suiteId: string
  readonly name: string
  readonly provenance?: BenchmarkSuiteSource
  readonly tasks: readonly BenchmarkTask[]
  readonly observations: readonly BenchmarkObservation[]
  readonly policy?: BenchmarkPolicy
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
  /** Optional artifact outcome emitted by structured benchmark evidence. */
  readonly artifactAcceptanceRate?: number
  readonly escapedIncomplete?: number
  readonly humanApproved: boolean
  readonly humanReviewMinutes?: number
  readonly authorized: boolean
  readonly benchmark?: BenchmarkBinding
}

export interface BenchmarkComparison {
  readonly taskId: string
  readonly title: string
  readonly comparability: 'comparable' | 'missing-baseline' | 'baseline-not-run' | 'baseline-evidence-missing' | 'baseline-incomplete' | 'baseline-samples-insufficient' | 'harness-not-run' | 'harness-not-complete'
  readonly comparable: boolean
  readonly baselineDeliveryComplete: boolean
  readonly baseline?: BenchmarkObservation
  readonly baselineEvidenceCoverageRate: number | null
  readonly baselineSampleCount: number
  readonly baselineArtifactAcceptanceRate: number | null
  readonly baselineProtocolCompletionRate: number | null
  readonly baselineMedianDurationMs?: number
  readonly improvement: {
    readonly durationRate: number | null
    readonly duration: BenchmarkImprovementDirection
    readonly attemptsRate: number | null
    readonly attempts: BenchmarkImprovementDirection
    readonly reviewRate: number | null
    readonly review: BenchmarkImprovementDirection
    readonly artifactAcceptanceRate: number | null
    readonly artifactAcceptance: BenchmarkImprovementDirection
    readonly artifactAcceptanceDelta: number | null
    readonly protocolCompletionRate: number | null
    readonly protocolCompletion: BenchmarkImprovementDirection
    readonly protocolCompletionDelta: number | null
    readonly escapedIncompleteRate: number | null
    readonly escapedIncomplete: BenchmarkImprovementDirection
  }
  readonly harness: {
    readonly attempts: number
    readonly retryCount: number
    readonly completedRuns: number
    readonly durationSamplesMs: readonly number[]
    readonly medianDurationMs?: number
    readonly latestState: RunState | 'NOT_RUN'
    readonly latestRunId?: string
    readonly latestDurationMs?: number
    readonly checkPassRate: number | null
    readonly outcomePassRate: number | null
    readonly evidenceCoverageRate: number | null
    readonly artifactAcceptanceRate?: number
    readonly artifactAcceptanceSampleCount: number
    readonly protocolCompletionRate: number | null
    readonly protocolCompletionSampleCount: number
    readonly humanApproved: boolean
    readonly escapedIncomplete?: number
    readonly humanReviewMinutes?: number
  }
  readonly confidence: BenchmarkConfidence
  readonly durationDeltaMs?: number
  readonly attemptDelta?: number
  readonly reviewDeltaMinutes?: number
  readonly escapedIncompleteDelta?: number
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
  readonly effectiveRunCount: number
  readonly effectiveCompleteRuns: number
  readonly effectiveCompletionRate: number | null
  readonly effectiveCheckPassRate: number | null
  readonly effectiveOutcomePassRate: number | null
  readonly effectiveEvidenceCoverageRate: number | null
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
  readonly qualityGate: BenchmarkQualityGate
}

export interface BenchmarkObservationInput {
  readonly taskId: string
  readonly status: BenchmarkObservationStatus
  readonly source: string
  readonly recordedAt?: string
  readonly attempts?: number
  readonly durationMs?: number
  readonly durationSamplesMs?: readonly number[]
  readonly artifactAcceptanceRate?: number
  readonly protocolCompletionRate?: number
  readonly reviewMinutes?: number
  readonly escapedIncomplete?: number
  readonly evidence?: readonly BenchmarkObservationEvidence[]
  readonly evidenceDigest?: string
}

const percentage = (part: number, total: number): number | null => total ? Number((part / total).toFixed(4)) : null
const DEFAULT_POLICY: BenchmarkPolicy = { minComparableTasks: 3, maxDurationRegressionRate: 0.2, minCompletedRunsPerTask: 3, minBaselineSamplesPerTask: 3, requireZeroEscapedIncomplete: true }
const improvementRate = (baseline: number | undefined, current: number | undefined): number | null => baseline === undefined || current === undefined || baseline === 0 ? null : Number(((baseline - current) / baseline).toFixed(4))
const increaseRate = (baseline: number | undefined, current: number | undefined): number | null => baseline === undefined || current === undefined || baseline === 0 ? null : Number(((current - baseline) / baseline).toFixed(4))
const increaseDelta = (baseline: number | undefined, current: number | null): number | null => baseline === undefined || current === null ? null : Number((current - baseline).toFixed(4))
const increaseDirection = (rate: number | null, delta: number | null): BenchmarkImprovementDirection => delta === null ? improvementDirection(rate) : delta > 0 ? 'improved' : delta < 0 ? 'regressed' : 'unchanged'
const improvementDirection = (rate: number | null): BenchmarkImprovementDirection => rate === null ? 'unavailable' : rate > 0 ? 'improved' : rate < 0 ? 'regressed' : 'unchanged'
const count = <T>(items: readonly T[], predicate: (item: T) => boolean): number => items.filter(predicate).length
const median = (values: readonly number[]): number | null => {
  if (!values.length) return null
  const sorted = [...values].sort((left, right) => left - right)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[middle] ?? null : ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2
}
const reviewMinutes = (run: VerificationRun): number | undefined => {
  if (!run.humanApproval) return undefined
  const reviewStart = run.transitions.find((transition) => transition.to === 'AWAITING_HUMAN_APPROVAL')?.at
  if (!reviewStart) return undefined
  const elapsed = Date.parse(run.humanApproval.at) - Date.parse(reviewStart)
  return Number.isFinite(elapsed) && elapsed >= 0 ? Number((elapsed / 60_000).toFixed(2)) : undefined
}
const confidence = (comparable: boolean, completedRuns: number, policy: BenchmarkPolicy): BenchmarkConfidence => !comparable ? 'insufficient' : completedRuns >= policy.minCompletedRunsPerTask ? 'reliable' : 'directional'

const artifactAcceptanceRate = (run: VerificationRun): number | undefined => {
  const rates = run.checks.flatMap((check) => {
    const evidence = check.evidence
    if (!evidence) return []
    const direct = typeof evidence['artifactAcceptanceRate'] === 'number' ? [evidence['artifactAcceptanceRate']] : []
    const reports = Array.isArray(evidence['reports']) ? evidence['reports'].flatMap((report) => typeof report === 'object' && report !== null && typeof report['artifactAcceptanceRate'] === 'number' ? [report['artifactAcceptanceRate']] : []) : []
    return [...direct, ...reports].filter((rate) => Number.isFinite(rate) && rate >= 0 && rate <= 1)
  })
  return rates.length ? Number((rates.reduce((total, rate) => total + rate, 0) / rates.length).toFixed(4)) : undefined
}

const projectRun = (run: VerificationRun): BenchmarkRun => {
  const checks = { total: run.checks.length, passed: count(run.checks, (check) => check.status === 'passed'), failed: count(run.checks, (check) => check.status === 'failed') }
  const outcomes = { total: run.outcomes.length, passed: count(run.outcomes, (outcome) => outcome.status === 'passed'), failed: count(run.outcomes, (outcome) => outcome.status === 'failed') }
  const evidence = { total: run.checks.length, attached: count(run.checks, (check) => check.evidence !== undefined) }
  const acceptanceRate = artifactAcceptanceRate(run)
  const humanReviewMinutes = reviewMinutes(run)
  const escapedIncomplete = run.state === 'COMPLETE' && checks.failed === 0 && outcomes.failed === 0 && evidence.attached === evidence.total ? 0 : undefined
  return { runId: run.runId, state: run.state, sourceRevision: run.sourceRevision, configHash: run.configHash, contractHash: run.contractHash, ...(run.supersedes ? { supersedes: run.supersedes } : {}), ...(run.metrics ? { durationMs: run.metrics.totalDurationMs } : {}), checks, outcomes, evidence, ...(acceptanceRate === undefined ? {} : { artifactAcceptanceRate: acceptanceRate }), ...(escapedIncomplete === undefined ? {} : { escapedIncomplete }), humanApproved: run.humanApproval !== undefined, ...(humanReviewMinutes === undefined ? {} : { humanReviewMinutes }), authorized: run.authorization !== undefined, ...(run.benchmark ? { benchmark: run.benchmark } : {}) }
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
  const superseded = new Set(runs.flatMap((run) => run.supersedes ? [run.supersedes] : []))
  const effectiveRuns = runs.filter((run) => !superseded.has(run.runId))
  const effectiveChecksTotal = effectiveRuns.reduce((total, run) => total + run.checks.total, 0)
  const effectiveChecksPassed = effectiveRuns.reduce((total, run) => total + run.checks.passed, 0)
  const effectiveOutcomesTotal = effectiveRuns.reduce((total, run) => total + run.outcomes.total, 0)
  const effectiveOutcomesPassed = effectiveRuns.reduce((total, run) => total + run.outcomes.passed, 0)
  const effectiveEvidenceTotal = effectiveRuns.reduce((total, run) => total + run.evidence.total, 0)
  const effectiveEvidenceAttached = effectiveRuns.reduce((total, run) => total + run.evidence.attached, 0)
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
    effectiveRunCount: effectiveRuns.length,
    effectiveCompleteRuns: count(effectiveRuns, (run) => run.state === 'COMPLETE'),
    effectiveCompletionRate: percentage(count(effectiveRuns, (run) => run.state === 'COMPLETE'), effectiveRuns.length),
    effectiveCheckPassRate: percentage(effectiveChecksPassed, effectiveChecksTotal),
    effectiveOutcomePassRate: percentage(effectiveOutcomesPassed, effectiveOutcomesTotal),
    effectiveEvidenceCoverageRate: percentage(effectiveEvidenceAttached, effectiveEvidenceTotal),
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
    try {
      const candidate = readJson(join(runsDir, entry.name, 'run.json')) as { readonly type?: unknown }
      return candidate.type === 'agentskit-harness-run' ? readRun(stateDir, entry.name) : undefined
    } catch (error) { return fail(`Benchmark could not read run ${entry.name}: ${error instanceof Error ? error.message : String(error)}`, 'HARNESS_ERROR') }
  }).filter((run): run is VerificationRun => run !== undefined)
}

const nonEmptyString = (value: unknown, label: string): string => {
  if (typeof value !== 'string') return fail(`${label} must be a non-empty string.`, 'INVALID_CONFIG')
  const result = value.trim()
  if (!result) return fail(`${label} must be a non-empty string.`, 'INVALID_CONFIG')
  return result
}

const sha256 = (value: unknown, label: string): string | undefined => {
  if (value === undefined) return undefined
  const result = nonEmptyString(value, label)
  if (!/^[a-f0-9]{64}$/.test(result)) return fail(`${label} must be a lowercase SHA-256 digest.`, 'INVALID_CONFIG')
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

const nonNegativeInteger = (value: unknown, label: string): number | undefined => {
  const result = nonNegativeNumber(value, label)
  if (result !== undefined && !Number.isInteger(result)) return fail(`${label} must be an integer.`, 'INVALID_CONFIG')
  return result
}

const rate = (value: unknown, label: string): number | undefined => {
  const result = nonNegativeNumber(value, label)
  if (result !== undefined && result > 1) return fail(`${label} must be between 0 and 1.`, 'INVALID_CONFIG')
  return result
}

const timestamp = (value: unknown, label: string): string => {
  const result = nonEmptyString(value, label)
  if (!Number.isFinite(Date.parse(result))) return fail(`${label} must be a valid timestamp.`, 'INVALID_CONFIG')
  return result
}

const relativePath = (value: unknown, label: string): string => {
  const result = nonEmptyString(value, label)
  if (result.startsWith('/') || result.split('/').includes('..')) return fail(`${label} must be a repository-relative path.`, 'INVALID_CONFIG')
  return result
}

const taskFile = (value: unknown, label: string): BenchmarkTaskFile | undefined => {
  if (value === undefined) return undefined
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return fail(`${label} must be an object.`, 'INVALID_CONFIG')
  const raw = value as Record<string, unknown>
  return { path: relativePath(raw['path'], `${label}.path`), sha256: sha256(raw['sha256'], `${label}.sha256`) ?? fail(`${label}.sha256 is required.`, 'INVALID_CONFIG') }
}

const taskSource = (value: unknown, label: string): BenchmarkTaskSource | undefined => {
  if (value === undefined) return undefined
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return fail(`${label} must be an object.`, 'INVALID_CONFIG')
  const raw = value as Record<string, unknown>
  return { repository: nonEmptyString(raw['repository'], `${label}.repository`), path: relativePath(raw['path'], `${label}.path`), revision: nonEmptyString(raw['revision'], `${label}.revision`) }
}

const suiteSource = (value: unknown, label: string): BenchmarkSuiteSource | undefined => {
  if (value === undefined) return undefined
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return fail(`${label} must be an object.`, 'INVALID_CONFIG')
  const raw = value as Record<string, unknown>
  return { repository: nonEmptyString(raw['repository'], `${label}.repository`), revision: nonEmptyString(raw['revision'], `${label}.revision`), taskDefinition: relativePath(raw['taskDefinition'], `${label}.taskDefinition`) }
}

const taskScope = (value: unknown, label: string): BenchmarkTaskScope | undefined => {
  if (value === undefined) return undefined
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return fail(`${label} must be an object.`, 'INVALID_CONFIG')
  const raw = value as Record<string, unknown>
  return { read: stringList(raw['read'], `${label}.read`), write: stringList(raw['write'], `${label}.write`) }
}

const benchmarkPolicy = (value: unknown): BenchmarkPolicy | undefined => {
  if (value === undefined) return undefined
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return fail('benchmark.policy must be an object.', 'INVALID_CONFIG')
  const raw = value as Record<string, unknown>
  const minComparableTasks = nonNegativeInteger(raw['minComparableTasks'], 'benchmark.policy.minComparableTasks')
  const maxDurationRegressionRate = nonNegativeNumber(raw['maxDurationRegressionRate'], 'benchmark.policy.maxDurationRegressionRate')
  const minCompletedRunsPerTask = nonNegativeInteger(raw['minCompletedRunsPerTask'], 'benchmark.policy.minCompletedRunsPerTask')
  const minBaselineSamplesPerTask = nonNegativeInteger(raw['minBaselineSamplesPerTask'] ?? 1, 'benchmark.policy.minBaselineSamplesPerTask')
  if (minComparableTasks === undefined || minComparableTasks < 1) return fail('benchmark.policy.minComparableTasks must be at least 1.', 'INVALID_CONFIG')
  if (maxDurationRegressionRate === undefined || maxDurationRegressionRate > 1) return fail('benchmark.policy.maxDurationRegressionRate must be between 0 and 1.', 'INVALID_CONFIG')
  if (minCompletedRunsPerTask === undefined || minCompletedRunsPerTask < 1) return fail('benchmark.policy.minCompletedRunsPerTask must be at least 1.', 'INVALID_CONFIG')
  if (minBaselineSamplesPerTask === undefined || minBaselineSamplesPerTask < 1) return fail('benchmark.policy.minBaselineSamplesPerTask must be at least 1.', 'INVALID_CONFIG')
  if (typeof raw['requireZeroEscapedIncomplete'] !== 'boolean') return fail('benchmark.policy.requireZeroEscapedIncomplete must be boolean.', 'INVALID_CONFIG')
  return { minComparableTasks, maxDurationRegressionRate, minCompletedRunsPerTask, minBaselineSamplesPerTask, requireZeroEscapedIncomplete: raw['requireZeroEscapedIncomplete'] }
}

export const validateBenchmarkManifest = (value: unknown): BenchmarkManifest => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) fail('benchmark manifest must be an object.', 'INVALID_CONFIG')
  const raw = value as Record<string, unknown>
  if (raw['type'] !== 'agentskit-harness-benchmark-manifest' || raw['schemaVersion'] !== BENCHMARK_SCHEMA_VERSION) fail('benchmark manifest type or schemaVersion is invalid.', 'INVALID_CONFIG')
  const rawTasks = Array.isArray(raw['tasks']) && raw['tasks'].length ? raw['tasks'] : fail('benchmark manifest tasks must be non-empty.', 'INVALID_CONFIG')
  const tasks = rawTasks.map((item, index) => {
    if (typeof item !== 'object' || item === null || Array.isArray(item)) fail(`benchmark.tasks[${index}] must be an object.`, 'INVALID_CONFIG')
    const task = item as Record<string, unknown>
    const kind = task['kind'] === undefined ? undefined : nonEmptyString(task['kind'], `benchmark.tasks[${index}].kind`)
    const prompt = taskFile(task['prompt'], `benchmark.tasks[${index}].prompt`)
    const source = taskSource(task['source'], `benchmark.tasks[${index}].source`)
    const scope = taskScope(task['scope'], `benchmark.tasks[${index}].scope`)
    return { id: nonEmptyString(task['id'], `benchmark.tasks[${index}].id`), title: nonEmptyString(task['title'], `benchmark.tasks[${index}].title`), acceptanceCriteria: stringList(task['acceptanceCriteria'], `benchmark.tasks[${index}].acceptanceCriteria`), ...(kind === undefined ? {} : { kind }), ...(prompt === undefined ? {} : { prompt }), ...(source === undefined ? {} : { source }), ...(scope === undefined ? {} : { scope }) }
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
    const task = tasks.find((candidate) => candidate.id === taskId) ?? fail(`benchmark observation references unknown task: ${taskId}.`, 'INVALID_CONFIG')
    const attempts = nonNegativeInteger(observation['attempts'], `benchmark.observations[${index}].attempts`)
    const durationMs = nonNegativeNumber(observation['durationMs'], `benchmark.observations[${index}].durationMs`)
    const durationSamplesMs = observation['durationSamplesMs'] === undefined ? undefined : Array.isArray(observation['durationSamplesMs']) ? observation['durationSamplesMs'].map((sample, sampleIndex) => nonNegativeNumber(sample, `benchmark.observations[${index}].durationSamplesMs[${sampleIndex}]`) ?? fail(`benchmark.observations[${index}].durationSamplesMs must contain numbers.`, 'INVALID_CONFIG')) : fail(`benchmark.observations[${index}].durationSamplesMs must be an array.`, 'INVALID_CONFIG')
    if (durationSamplesMs && !durationSamplesMs.length) fail(`benchmark.observations[${index}].durationSamplesMs must not be empty.`, 'INVALID_CONFIG')
    const artifactAcceptanceRate = rate(observation['artifactAcceptanceRate'], `benchmark.observations[${index}].artifactAcceptanceRate`)
    const protocolCompletionRate = rate(observation['protocolCompletionRate'], `benchmark.observations[${index}].protocolCompletionRate`)
    const reviewMinutes = nonNegativeNumber(observation['reviewMinutes'], `benchmark.observations[${index}].reviewMinutes`)
    const escapedIncomplete = nonNegativeInteger(observation['escapedIncomplete'], `benchmark.observations[${index}].escapedIncomplete`)
    const evidenceDigest = sha256(observation['evidenceDigest'], `benchmark.observations[${index}].evidenceDigest`)
    const rawEvidence = observation['evidence'] === undefined ? undefined : Array.isArray(observation['evidence']) ? observation['evidence'] : fail(`benchmark.observations[${index}].evidence must be an array.`, 'INVALID_CONFIG')
    const evidence = rawEvidence?.map((item, evidenceIndex) => {
      if (typeof item !== 'object' || item === null || Array.isArray(item)) fail(`benchmark.observations[${index}].evidence[${evidenceIndex}] must be an object.`, 'INVALID_CONFIG')
      const entry = item as Record<string, unknown>
      const criterion = nonEmptyString(entry['criterion'], `benchmark.observations[${index}].evidence[${evidenceIndex}].criterion`)
      if (!task.acceptanceCriteria.includes(criterion)) fail(`benchmark evidence references unknown criterion: ${criterion}.`, 'INVALID_CONFIG')
      const evidenceStatus = entry['status']
      if (!['passed', 'failed', 'blocked', 'not-run'].includes(String(evidenceStatus))) fail(`benchmark.observations[${index}].evidence[${evidenceIndex}].status is invalid.`, 'INVALID_CONFIG')
      return { criterion, status: evidenceStatus as BenchmarkObservationStatus, source: nonEmptyString(entry['source'], `benchmark.observations[${index}].evidence[${evidenceIndex}].source`) }
    })
    if (evidence && new Set(evidence.map((entry) => entry.criterion)).size !== evidence.length) fail(`benchmark.observations[${index}].evidence criteria must be unique.`, 'INVALID_CONFIG')
    return { taskId, mode: 'baseline' as const, status: status as BenchmarkObservationStatus, source: nonEmptyString(observation['source'], `benchmark.observations[${index}].source`), recordedAt: timestamp(observation['recordedAt'], `benchmark.observations[${index}].recordedAt`), ...(attempts === undefined ? {} : { attempts }), ...(durationMs === undefined ? {} : { durationMs }), ...(durationSamplesMs === undefined ? {} : { durationSamplesMs }), ...(artifactAcceptanceRate === undefined ? {} : { artifactAcceptanceRate }), ...(protocolCompletionRate === undefined ? {} : { protocolCompletionRate }), ...(reviewMinutes === undefined ? {} : { reviewMinutes }), ...(escapedIncomplete === undefined ? {} : { escapedIncomplete }), ...(evidence === undefined ? {} : { evidence }), ...(evidenceDigest === undefined ? {} : { evidenceDigest }) }
  })
  if (new Set(observations.map((observation) => observation.taskId)).size !== observations.length) fail('benchmark allows at most one baseline observation per task.', 'INVALID_CONFIG')
  const provenance = suiteSource(raw['provenance'], 'benchmark.provenance')
  const policy = benchmarkPolicy(raw['policy'])
  return { type: 'agentskit-harness-benchmark-manifest', schemaVersion: BENCHMARK_SCHEMA_VERSION, suiteId: nonEmptyString(raw['suiteId'], 'benchmark.suiteId'), name: nonEmptyString(raw['name'], 'benchmark.name'), ...(provenance === undefined ? {} : { provenance }), tasks, observations, ...(policy === undefined ? {} : { policy }) }
}

export const loadBenchmarkManifest = (path: string): BenchmarkManifest => {
  try { return validateBenchmarkManifest(JSON.parse(readFileSync(path, 'utf8')) as unknown) } catch (error) { if (error instanceof SyntaxError) return fail(`Invalid benchmark manifest JSON: ${error.message}`, 'INVALID_CONFIG'); throw error }
}

export const recordBenchmarkObservation = (path: string, input: BenchmarkObservationInput): BenchmarkManifest => {
  const originalContent = readFileSync(path, 'utf8')
  const manifest = loadBenchmarkManifest(path)
  const taskId = nonEmptyString(input.taskId, 'benchmark observation.taskId')
  if (!manifest.tasks.some((task) => task.id === taskId)) fail(`benchmark observation references unknown task: ${taskId}.`, 'INVALID_INPUT')
  if (manifest.observations.some((observation) => observation.taskId === taskId)) fail(`benchmark already has an observation for task: ${taskId}.`, 'INVALID_INPUT')
  const observation = validateBenchmarkManifest({
    ...manifest,
    observations: [...manifest.observations, {
      taskId,
      mode: 'baseline',
      status: input.status,
      source: input.source,
      recordedAt: input.recordedAt ?? new Date().toISOString(),
      ...(input.attempts === undefined ? {} : { attempts: input.attempts }),
      ...(input.durationMs === undefined ? {} : { durationMs: input.durationMs }),
      ...(input.durationSamplesMs === undefined ? {} : { durationSamplesMs: input.durationSamplesMs }),
      ...(input.artifactAcceptanceRate === undefined ? {} : { artifactAcceptanceRate: input.artifactAcceptanceRate }),
      ...(input.protocolCompletionRate === undefined ? {} : { protocolCompletionRate: input.protocolCompletionRate }),
      ...(input.reviewMinutes === undefined ? {} : { reviewMinutes: input.reviewMinutes }),
      ...(input.escapedIncomplete === undefined ? {} : { escapedIncomplete: input.escapedIncomplete }),
      ...(input.evidence === undefined ? {} : { evidence: input.evidence }),
      ...(input.evidenceDigest === undefined ? {} : { evidenceDigest: input.evidenceDigest }),
    }],
  })
  const temporaryRoot = mkdtempSync(join(tmpdir(), 'agentskit-harness-baseline-'))
  const temporaryPath = join(temporaryRoot, 'manifest.json')
  try {
    writeFileSync(temporaryPath, `${JSON.stringify(observation, null, 2)}\n`, 'utf8')
    if (readFileSync(path, 'utf8') !== originalContent) fail('benchmark manifest changed while recording an observation.', 'STALE')
    renameSync(temporaryPath, path)
  } finally {
    rmSync(temporaryRoot, { recursive: true, force: true })
  }
  return observation
}

const comparisons = (runs: readonly BenchmarkRun[], manifest: BenchmarkManifest, policy: BenchmarkPolicy): readonly BenchmarkComparison[] => manifest.tasks.map((task) => {
  const taskRuns = runs.filter((run) => run.benchmark?.suiteId === manifest.suiteId && run.benchmark.taskId === task.id)
  const latest = taskRuns.at(-1)
  const baseline = manifest.observations.find((observation) => observation.taskId === task.id)
  const coveredCriteria = new Set((baseline?.evidence ?? []).map((entry) => entry.criterion))
  const baselineEvidenceCoverageRate = baseline ? percentage(coveredCriteria.size, task.acceptanceCriteria.length) : null
  const baselineEvidenceComplete = baselineEvidenceCoverageRate === 1
  const baselineEvidencePassed = baselineEvidenceComplete && (baseline?.evidence?.every((entry) => entry.status === 'passed') ?? false)
  const baselineDeliveryComplete = baseline?.status === 'passed' && baselineEvidencePassed
  const baselineDurationSamples = baseline?.durationSamplesMs ?? (baseline?.durationMs === undefined ? [] : [baseline.durationMs])
  const baselineMedianDurationMs = median(baselineDurationSamples)
  const baselineSamplesSufficient = baselineDurationSamples.length >= policy.minBaselineSamplesPerTask
  const comparable = baseline !== undefined && baseline.status !== 'not-run' && baselineEvidenceComplete && baselineDeliveryComplete && baselineSamplesSufficient && latest?.state === 'COMPLETE'
  const comparability = comparable ? 'comparable' : baseline === undefined ? 'missing-baseline' : baseline.status === 'not-run' ? 'baseline-not-run' : !baselineEvidenceComplete ? 'baseline-evidence-missing' : latest === undefined ? 'harness-not-run' : latest.state !== 'COMPLETE' ? 'harness-not-complete' : !baselineDeliveryComplete ? 'baseline-incomplete' : 'baseline-samples-insufficient'
  const completedTaskRuns = taskRuns.filter((run) => run.state === 'COMPLETE')
  const durationSamplesMs = completedTaskRuns.flatMap((run) => run.durationMs === undefined ? [] : [run.durationMs])
  const medianDurationMs = median(durationSamplesMs)
  const retryCount = count(taskRuns, (run) => run.supersedes !== undefined)
  const attempts = retryCount + (taskRuns.length ? 1 : 0)
  const durationRate = comparable ? improvementRate(baselineMedianDurationMs ?? undefined, medianDurationMs ?? undefined) : null
  const attemptsRate = comparable ? improvementRate(baseline?.attempts, attempts) : null
  const reviewRate = comparable ? improvementRate(baseline?.reviewMinutes, latest?.humanReviewMinutes) : null
  const acceptanceSamples = taskRuns.flatMap((run) => run.artifactAcceptanceRate === undefined ? [] : [run.artifactAcceptanceRate])
  const harnessArtifactAcceptanceRate = acceptanceSamples.length ? Number((acceptanceSamples.reduce((total, rate) => total + rate, 0) / acceptanceSamples.length).toFixed(4)) : null
  const artifactAcceptanceImprovementRate = increaseRate(baseline?.artifactAcceptanceRate, harnessArtifactAcceptanceRate ?? undefined)
  const artifactAcceptanceDelta = increaseDelta(baseline?.artifactAcceptanceRate, harnessArtifactAcceptanceRate)
  const completedRuns = completedTaskRuns.length
  const harnessProtocolCompletionRate = taskRuns.length ? percentage(completedRuns, taskRuns.length) : null
  const protocolCompletionImprovementRate = increaseRate(baseline?.protocolCompletionRate, harnessProtocolCompletionRate ?? undefined)
  const protocolCompletionDelta = increaseDelta(baseline?.protocolCompletionRate, harnessProtocolCompletionRate)
  const escapedIncompleteRate = improvementRate(baseline?.escapedIncomplete, latest?.escapedIncomplete)
  return { taskId: task.id, title: task.title, comparability, comparable, baselineDeliveryComplete, baselineEvidenceCoverageRate, baselineSampleCount: baselineDurationSamples.length, baselineArtifactAcceptanceRate: baseline?.artifactAcceptanceRate ?? null, baselineProtocolCompletionRate: baseline?.protocolCompletionRate ?? null, ...(baselineMedianDurationMs === null ? {} : { baselineMedianDurationMs }), improvement: { durationRate, duration: improvementDirection(durationRate), attemptsRate, attempts: improvementDirection(attemptsRate), reviewRate, review: improvementDirection(reviewRate), artifactAcceptanceRate: artifactAcceptanceImprovementRate, artifactAcceptance: increaseDirection(artifactAcceptanceImprovementRate, artifactAcceptanceDelta), artifactAcceptanceDelta, protocolCompletionRate: protocolCompletionImprovementRate, protocolCompletion: increaseDirection(protocolCompletionImprovementRate, protocolCompletionDelta), protocolCompletionDelta, escapedIncompleteRate, escapedIncomplete: improvementDirection(escapedIncompleteRate) }, ...(baseline ? { baseline } : {}), harness: { attempts, retryCount, completedRuns, durationSamplesMs, ...(medianDurationMs === null ? {} : { medianDurationMs }), ...(harnessArtifactAcceptanceRate === null ? {} : { artifactAcceptanceRate: harnessArtifactAcceptanceRate }), artifactAcceptanceSampleCount: acceptanceSamples.length, protocolCompletionRate: harnessProtocolCompletionRate, protocolCompletionSampleCount: taskRuns.length, latestState: latest?.state ?? 'NOT_RUN', ...(latest ? { latestRunId: latest.runId } : {}), ...(latest?.durationMs === undefined ? {} : { latestDurationMs: latest.durationMs }), checkPassRate: latest ? percentage(latest.checks.passed, latest.checks.total) : null, outcomePassRate: latest ? percentage(latest.outcomes.passed, latest.outcomes.total) : null, evidenceCoverageRate: latest ? percentage(latest.evidence.attached, latest.evidence.total) : null, ...(latest?.escapedIncomplete === undefined ? {} : { escapedIncomplete: latest.escapedIncomplete }), ...(latest?.humanReviewMinutes === undefined ? {} : { humanReviewMinutes: latest.humanReviewMinutes }), humanApproved: latest?.humanApproved ?? false }, confidence: confidence(comparable, completedRuns, policy), ...(comparable && baselineMedianDurationMs !== null && medianDurationMs !== null ? { durationDeltaMs: medianDurationMs - baselineMedianDurationMs } : {}), ...(comparable && baseline?.attempts !== undefined ? { attemptDelta: attempts - baseline.attempts } : {}), ...(comparable && baseline?.reviewMinutes !== undefined && latest?.humanReviewMinutes !== undefined ? { reviewDeltaMinutes: latest.humanReviewMinutes - baseline.reviewMinutes } : {}), ...(baseline?.escapedIncomplete !== undefined && latest?.escapedIncomplete !== undefined ? { escapedIncompleteDelta: latest.escapedIncomplete - baseline.escapedIncomplete } : {}) }
})

export const benchmarkRuns = (stateDir: string, manifest?: BenchmarkManifest): BenchmarkReport => {
  const runs = readRuns(stateDir).map(projectRun).sort((left, right) => left.runId.localeCompare(right.runId))
  const policy = manifest?.policy ?? DEFAULT_POLICY
  const reportComparisons = manifest ? comparisons(runs, manifest, policy) : []
  const comparable = reportComparisons.filter((comparison) => comparison.comparable)
  const durationRegressionTaskIds = comparable.filter((comparison) => (comparison.improvement.durationRate ?? 0) < -policy.maxDurationRegressionRate).map((comparison) => comparison.taskId)
  const escapedIncompleteTaskIds = comparable.filter((comparison) => comparison.harness.escapedIncomplete !== 0).map((comparison) => comparison.taskId)
  const reasons = []
  if (comparable.length < policy.minComparableTasks) reasons.push(`requires at least ${policy.minComparableTasks} comparable tasks`)
  const incompleteBaselineTaskIds = reportComparisons.filter((comparison) => comparison.comparability === 'baseline-incomplete').map((comparison) => comparison.taskId)
  if (incompleteBaselineTaskIds.length) reasons.push(`baseline delivery incomplete: ${incompleteBaselineTaskIds.join(', ')}`)
  const baselineSampleGaps = reportComparisons.filter((comparison) => comparison.baselineSampleCount < policy.minBaselineSamplesPerTask).map((comparison) => `${comparison.taskId} (${comparison.baselineSampleCount}/${policy.minBaselineSamplesPerTask})`)
  if (baselineSampleGaps.length) reasons.push(`requires ${policy.minBaselineSamplesPerTask} baseline samples per task: ${baselineSampleGaps.join(', ')}`)
  if (durationRegressionTaskIds.length) reasons.push(`duration regression exceeds ${policy.maxDurationRegressionRate * 100}%: ${durationRegressionTaskIds.join(', ')}`)
  if (policy.requireZeroEscapedIncomplete && escapedIncompleteTaskIds.length) reasons.push(`escaped incomplete delivery: ${escapedIncompleteTaskIds.join(', ')}`)
  const confidenceLevel: BenchmarkConfidence = comparable.length < policy.minComparableTasks ? 'insufficient' : comparable.every((comparison) => comparison.confidence === 'reliable') ? 'reliable' : 'directional'
  const qualityGate: BenchmarkQualityGate = { status: comparable.length < policy.minComparableTasks ? 'insufficient-data' : reasons.length ? 'failed' : 'passed', confidence: confidenceLevel, comparableTaskCount: comparable.length, policy, durationRegressionTaskIds, escapedIncompleteTaskIds, reasons }
  return { type: 'agentskit-harness-benchmark', schemaVersion: BENCHMARK_SCHEMA_VERSION, stateDir, generatedAt: new Date().toISOString(), runs, summary: summarize(runs), comparisons: reportComparisons, qualityGate, ...(manifest ? { manifest: { suiteId: manifest.suiteId, taskCount: manifest.tasks.length, baselineCount: manifest.observations.length, comparableTaskCount: comparable.length } } : {}) }
}
