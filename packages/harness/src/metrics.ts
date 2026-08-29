import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fail } from './errors.js'
import { readRun } from './files.js'
import { RUN_STATES } from './types.js'
import type { RunState, VerificationRun } from './types.js'

export const BENCHMARK_SCHEMA_VERSION = 1 as const

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
  return { runId: run.runId, state: run.state, sourceRevision: run.sourceRevision, configHash: run.configHash, contractHash: run.contractHash, ...(run.supersedes ? { supersedes: run.supersedes } : {}), ...(run.metrics ? { durationMs: run.metrics.totalDurationMs } : {}), checks, outcomes, evidence, humanApproved: run.humanApproval !== undefined, authorized: run.authorization !== undefined }
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

export const benchmarkRuns = (stateDir: string): BenchmarkReport => {
  const runs = readRuns(stateDir).map(projectRun).sort((left, right) => left.runId.localeCompare(right.runId))
  return { type: 'agentskit-harness-benchmark', schemaVersion: BENCHMARK_SCHEMA_VERSION, stateDir, generatedAt: new Date().toISOString(), runs, summary: summarize(runs) }
}
