import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, it } from 'vitest'
import { benchmarkRuns, loadBenchmarkManifest, recordBenchmarkObservation, validateBenchmarkManifest } from '../src/index.js'

const writeRun = (stateDir: string, runId: string, state: string, extra: Record<string, unknown> = {}): void => {
  mkdirSync(join(stateDir, 'runs', runId), { recursive: true })
  writeFileSync(join(stateDir, 'runs', runId, 'run.json'), JSON.stringify({
    type: 'agentskit-harness-run', schemaVersion: 1, runId, project: 'metrics-fixture', state, configHash: 'config', contractHash: 'contract', sourceRevision: 'revision', sourceStatusHash: 'status', baseline: { revision: 'revision', status: 'status', statusHash: 'status' }, contractApproval: { actor: 'human', at: '2026-01-01T00:00:00.000Z', contractHash: 'contract' }, checks: [{ id: 'check', category: 'logic', status: state === 'STALE' ? 'failed' : 'passed', evidence: { status: 'passed', criteria: ['outcome'] } }], outcomes: [{ id: 'outcome', statement: 'Fixture outcome.', checks: ['check'], status: state === 'STALE' ? 'failed' : 'passed' }], transitions: [], evidenceReferences: [], contextSnapshots: [], metrics: { totalDurationMs: 100, budgetExceeded: false }, ...extra
  }, null, 2))
}

it('aggregates historical runs and exposes retry, stale, evidence, and duration metrics', () => {
  const stateDir = mkdtempSync(join(tmpdir(), 'agentskit-harness-metrics-'))
  writeRun(stateDir, '1-first', 'COMPLETE', { humanApproval: { actor: 'human', at: '2026-01-01T00:00:00.000Z', sourceRevision: 'revision', contractHash: 'contract' } })
  writeRun(stateDir, '2-retry', 'AWAITING_HUMAN_APPROVAL', { supersedes: '1-first', metrics: { totalDurationMs: 300, budgetExceeded: false } })
  writeRun(stateDir, '3-stale', 'STALE', { metrics: undefined })
  const report = benchmarkRuns(stateDir)
  expect(report.runs.map((run) => run.runId)).toEqual(['1-first', '2-retry', '3-stale'])
  expect(report.summary.totalRuns).toBe(3)
  expect(report.summary.completeRuns).toBe(1)
  expect(report.summary.retriedRuns).toBe(1)
  expect(report.summary.staleRuns).toBe(1)
  expect(report.summary.effectiveRunCount).toBe(2)
  expect(report.summary.effectiveCompleteRuns).toBe(0)
  expect(report.summary.effectiveCompletionRate).toBe(0)
  expect(report.summary.effectiveCheckPassRate).toBe(0.5)
  expect(report.summary.effectiveOutcomePassRate).toBe(0.5)
  expect(report.summary.effectiveEvidenceCoverageRate).toBe(1)
  expect(report.summary.checkPassRate).toBe(0.6667)
  expect(report.summary.evidenceCoverageRate).toBe(1)
  expect(report.summary.averageDurationMs).toBe(200)
  expect(report.summary.medianDurationMs).toBe(200)
})

it('compares a bound harness task with an explicit baseline and does not invent missing baselines', () => {
  const stateDir = mkdtempSync(join(tmpdir(), 'agentskit-harness-comparison-'))
  writeRun(stateDir, '1-harness', 'COMPLETE', { benchmark: { suiteId: 'suite', taskId: 'task', mode: 'harness' }, transitions: [{ from: null, to: 'PLANNED', at: '2026-01-01T00:00:00.000Z' }, { from: 'VERIFYING', to: 'AWAITING_HUMAN_APPROVAL', at: '2026-01-01T00:00:00.000Z' }, { from: 'AWAITING_HUMAN_APPROVAL', to: 'COMPLETE', at: '2026-01-01T00:02:00.000Z' }], humanApproval: { actor: 'human', at: '2026-01-01T00:02:00.000Z', sourceRevision: 'revision', contractHash: 'contract' }, metrics: { totalDurationMs: 200, budgetExceeded: false } })
  const manifest = validateBenchmarkManifest({ type: 'agentskit-harness-benchmark-manifest', schemaVersion: 1, suiteId: 'suite', name: 'Fixture', policy: { minComparableTasks: 1, maxDurationRegressionRate: 0.2, minCompletedRunsPerTask: 1, requireZeroEscapedIncomplete: true }, tasks: [{ id: 'task', title: 'Task', acceptanceCriteria: ['criterion'] }], observations: [{ taskId: 'task', mode: 'baseline', status: 'passed', source: 'manual-fixture', recordedAt: '2026-01-01T00:00:00.000Z', attempts: 1, durationMs: 100, reviewMinutes: 1, escapedIncomplete: 1, evidence: [{ criterion: 'criterion', status: 'passed', source: 'manual-fixture' }] }] })
  const report = benchmarkRuns(stateDir, manifest)
  expect(report.manifest).toEqual({ suiteId: 'suite', taskCount: 1, baselineCount: 1, comparableTaskCount: 1 })
  expect(report.comparisons[0]).toMatchObject({ taskId: 'task', comparable: true, confidence: 'reliable', baselineEvidenceCoverageRate: 1, improvement: { durationRate: -1, duration: 'regressed', attemptsRate: 0, attempts: 'unchanged', reviewRate: -1, review: 'regressed', escapedIncompleteRate: 1, escapedIncomplete: 'improved' }, durationDeltaMs: 100, attemptDelta: 0, reviewDeltaMinutes: 1, escapedIncompleteDelta: -1, harness: { attempts: 1, retryCount: 0, completedRuns: 1, checkPassRate: 1, outcomePassRate: 1, evidenceCoverageRate: 1, escapedIncomplete: 0, humanReviewMinutes: 2 } })
  expect(report.qualityGate).toMatchObject({ status: 'failed', confidence: 'reliable', comparableTaskCount: 1, durationRegressionTaskIds: ['task'], escapedIncompleteTaskIds: [] })
})

it('does not compare an explicit baseline with an incomplete harness run', () => {
  const stateDir = mkdtempSync(join(tmpdir(), 'agentskit-harness-incomplete-comparison-'))
  writeRun(stateDir, '1-blocked', 'BLOCKED', { benchmark: { suiteId: 'suite', taskId: 'task', mode: 'harness' } })
  const manifest = validateBenchmarkManifest({ type: 'agentskit-harness-benchmark-manifest', schemaVersion: 1, suiteId: 'suite', name: 'Fixture', tasks: [{ id: 'task', title: 'Task', acceptanceCriteria: ['criterion'] }], observations: [{ taskId: 'task', mode: 'baseline', status: 'passed', source: 'manual-fixture', recordedAt: '2026-01-01T00:00:00.000Z', evidence: [{ criterion: 'criterion', status: 'passed', source: 'manual-fixture' }] }] })
  const comparison = benchmarkRuns(stateDir, manifest).comparisons[0]
  expect(comparison).toMatchObject({ comparable: false, comparability: 'harness-not-complete', harness: { latestState: 'BLOCKED', checkPassRate: 1 } })
})

it('uses independent completed samples for confidence and median duration', () => {
  const stateDir = mkdtempSync(join(tmpdir(), 'agentskit-harness-samples-'))
  for (const [runId, duration] of [['1-sample', 300], ['2-sample', 100], ['3-sample', 200]] as const) writeRun(stateDir, runId, 'COMPLETE', { benchmark: { suiteId: 'suite', taskId: 'task', mode: 'harness' }, metrics: { totalDurationMs: duration, budgetExceeded: false } })
  const manifest = validateBenchmarkManifest({ type: 'agentskit-harness-benchmark-manifest', schemaVersion: 1, suiteId: 'suite', name: 'Fixture', policy: { minComparableTasks: 1, maxDurationRegressionRate: 0.2, minCompletedRunsPerTask: 3, requireZeroEscapedIncomplete: true }, tasks: [{ id: 'task', title: 'Task', acceptanceCriteria: ['criterion'] }], observations: [{ taskId: 'task', mode: 'baseline', status: 'passed', source: 'manual-fixture', recordedAt: '2026-01-01T00:00:00.000Z', attempts: 1, durationMs: 150, evidence: [{ criterion: 'criterion', status: 'passed', source: 'manual-fixture' }] }] })
  const comparison = benchmarkRuns(stateDir, manifest).comparisons[0]
  expect(comparison).toMatchObject({ confidence: 'reliable', durationDeltaMs: 50, improvement: { durationRate: -0.3333, duration: 'regressed', attemptsRate: 0, attempts: 'unchanged' }, harness: { attempts: 1, retryCount: 0, completedRuns: 3, durationSamplesMs: [300, 100, 200], medianDurationMs: 200 } })
})

it('does not claim duration improvement from an incomplete baseline', () => {
  const stateDir = mkdtempSync(join(tmpdir(), 'agentskit-harness-incomplete-baseline-'))
  writeRun(stateDir, '1-harness', 'COMPLETE', { benchmark: { suiteId: 'suite', taskId: 'task', mode: 'harness' }, metrics: { totalDurationMs: 100, budgetExceeded: false } })
  const manifest = validateBenchmarkManifest({ type: 'agentskit-harness-benchmark-manifest', schemaVersion: 1, suiteId: 'suite', name: 'Fixture', policy: { minComparableTasks: 1, maxDurationRegressionRate: 0.2, minCompletedRunsPerTask: 1, minBaselineSamplesPerTask: 1, requireZeroEscapedIncomplete: true }, tasks: [{ id: 'task', title: 'Task', acceptanceCriteria: ['criterion'] }], observations: [{ taskId: 'task', mode: 'baseline', status: 'failed', source: 'fixture', recordedAt: '2026-01-01T00:00:00.000Z', durationMs: 200, escapedIncomplete: 1, evidence: [{ criterion: 'criterion', status: 'passed', source: 'fixture' }] }] })
  const comparison = benchmarkRuns(stateDir, manifest).comparisons[0]
  expect(comparison).toMatchObject({ comparable: false, baselineDeliveryComplete: false, comparability: 'baseline-incomplete', improvement: { duration: 'unavailable', escapedIncomplete: 'improved' }, escapedIncompleteDelta: -1 })
})

it('reports artifact acceptance without making an incomplete baseline comparable', () => {
  const stateDir = mkdtempSync(join(tmpdir(), 'agentskit-harness-artifact-acceptance-'))
  writeRun(stateDir, '1-harness', 'COMPLETE', { benchmark: { suiteId: 'suite', taskId: 'task', mode: 'harness' } })
  const manifest = validateBenchmarkManifest({ type: 'agentskit-harness-benchmark-manifest', schemaVersion: 1, suiteId: 'suite', name: 'Fixture', tasks: [{ id: 'task', title: 'Task', acceptanceCriteria: ['criterion'] }], observations: [{ taskId: 'task', status: 'failed', source: 'fixture', recordedAt: '2026-01-01T00:00:00.000Z', durationMs: 200, artifactAcceptanceRate: 0.6667, evidence: [{ criterion: 'criterion', status: 'passed', source: 'fixture' }] }] })
  const comparison = benchmarkRuns(stateDir, manifest).comparisons[0]
  expect(comparison).toMatchObject({ comparable: false, comparability: 'baseline-incomplete', baselineArtifactAcceptanceRate: 0.6667, improvement: { duration: 'unavailable' } })
})

it('fails closed when the baseline has fewer samples than policy requires', () => {
  const stateDir = mkdtempSync(join(tmpdir(), 'agentskit-harness-baseline-samples-'))
  writeRun(stateDir, '1-sample', 'COMPLETE', { benchmark: { suiteId: 'suite', taskId: 'task', mode: 'harness' } })
  const manifest = validateBenchmarkManifest({ type: 'agentskit-harness-benchmark-manifest', schemaVersion: 1, suiteId: 'suite', name: 'Fixture', policy: { minComparableTasks: 1, maxDurationRegressionRate: 0.2, minCompletedRunsPerTask: 1, minBaselineSamplesPerTask: 3, requireZeroEscapedIncomplete: true }, tasks: [{ id: 'task', title: 'Task', acceptanceCriteria: ['criterion'] }], observations: [{ taskId: 'task', mode: 'baseline', status: 'passed', source: 'manual-fixture', recordedAt: '2026-01-01T00:00:00.000Z', durationMs: 100, evidence: [{ criterion: 'criterion', status: 'passed', source: 'manual-fixture' }] }] })
  const report = benchmarkRuns(stateDir, manifest)
  expect(report.comparisons[0]).toMatchObject({ comparable: false, comparability: 'baseline-samples-insufficient', baselineSampleCount: 1, confidence: 'insufficient' })
  expect(report.qualityGate).toMatchObject({ status: 'insufficient-data', confidence: 'insufficient', reasons: ['requires at least 1 comparable tasks', 'requires 3 baseline samples per task: task (1/3)'] })
})

it('requires complete criterion evidence before comparing a baseline', () => {
  const stateDir = mkdtempSync(join(tmpdir(), 'agentskit-harness-evidence-comparison-'))
  writeRun(stateDir, '1-harness', 'COMPLETE', { benchmark: { suiteId: 'suite', taskId: 'task', mode: 'harness' } })
  const manifest = validateBenchmarkManifest({ type: 'agentskit-harness-benchmark-manifest', schemaVersion: 1, suiteId: 'suite', name: 'Fixture', tasks: [{ id: 'task', title: 'Task', acceptanceCriteria: ['criterion', 'second'] }], observations: [{ taskId: 'task', status: 'passed', source: 'fixture', recordedAt: '2026-01-01T00:00:00.000Z', evidence: [{ criterion: 'criterion', status: 'passed', source: 'fixture' }] }] })
  const comparison = benchmarkRuns(stateDir, manifest).comparisons[0]
  expect(comparison).toMatchObject({ comparable: false, comparability: 'baseline-evidence-missing', baselineEvidenceCoverageRate: 0.5, improvement: { duration: 'unavailable', attempts: 'unavailable', review: 'unavailable' } })
})

it('returns an empty, typed report when no runs exist', () => {
  const report = benchmarkRuns(mkdtempSync(join(tmpdir(), 'agentskit-harness-empty-metrics-')))
  expect(report.summary.totalRuns).toBe(0)
  expect(report.summary.checkPassRate).toBeNull()
  expect(report.summary.stateCounts.COMPLETE).toBe(0)
  expect(report.qualityGate).toMatchObject({ status: 'insufficient-data', confidence: 'insufficient', comparableTaskCount: 0 })
})

it('ignores verification runs written by the outer Doc Bridge harness', () => {
  const stateDir = mkdtempSync(join(tmpdir(), 'agentskit-harness-foreign-run-'))
  mkdirSync(join(stateDir, 'runs', 'outer-run'), { recursive: true })
  writeFileSync(join(stateDir, 'runs', 'outer-run', 'run.json'), JSON.stringify({ type: 'verification-run', state: 'VERIFYING' }))
  const report = benchmarkRuns(stateDir)
  expect(report.runs).toHaveLength(0)
})

it('validates a benchmark manifest task identity', () => {
  const manifest = validateBenchmarkManifest({ type: 'agentskit-harness-benchmark-manifest', schemaVersion: 1, suiteId: 'suite', name: 'Fixture', tasks: [{ id: 'task', title: 'Task', acceptanceCriteria: ['criterion'] }], observations: [] })
  expect(manifest.tasks[0]?.id).toBe('task')
})

it('records one atomic baseline observation and rejects duplicates', () => {
  const manifestPath = join(mkdtempSync(join(tmpdir(), 'agentskit-harness-baseline-record-')), 'manifest.json')
  writeFileSync(manifestPath, JSON.stringify({ type: 'agentskit-harness-benchmark-manifest', schemaVersion: 1, suiteId: 'suite', name: 'Fixture', tasks: [{ id: 'task', title: 'Task', acceptanceCriteria: ['criterion'] }], observations: [] }))
  const recorded = recordBenchmarkObservation(manifestPath, { taskId: 'task', status: 'passed', source: 'manual-run-1', recordedAt: '2026-01-01T00:00:00.000Z', attempts: 2, durationMs: 100, reviewMinutes: 5, escapedIncomplete: 1, evidenceDigest: 'a'.repeat(64) })
  expect(recorded.observations[0]).toMatchObject({ taskId: 'task', source: 'manual-run-1', attempts: 2, durationMs: 100, reviewMinutes: 5, escapedIncomplete: 1, evidenceDigest: 'a'.repeat(64) })
  expect(loadBenchmarkManifest(manifestPath).observations).toHaveLength(1)
  expect(() => recordBenchmarkObservation(manifestPath, { taskId: 'task', status: 'passed', source: 'manual-run-2' })).toThrow(/already has an observation/)
  expect(() => validateBenchmarkManifest({ type: 'agentskit-harness-benchmark-manifest', schemaVersion: 1, suiteId: 'suite', name: 'Fixture', tasks: [{ id: 'task', title: 'Task', acceptanceCriteria: ['criterion'] }], observations: [{ taskId: 'task', status: 'passed', source: 'fixture', recordedAt: 'not-a-timestamp' }] })).toThrow(/valid timestamp/)
  expect(() => validateBenchmarkManifest({ type: 'agentskit-harness-benchmark-manifest', schemaVersion: 1, suiteId: 'suite', name: 'Fixture', tasks: [{ id: 'task', title: 'Task', acceptanceCriteria: ['criterion'] }], observations: [{ taskId: 'task', status: 'passed', source: 'fixture', recordedAt: '2026-01-01T00:00:00.000Z', attempts: 1.5 }] })).toThrow(/must be an integer/)
  expect(() => validateBenchmarkManifest({ type: 'agentskit-harness-benchmark-manifest', schemaVersion: 1, suiteId: 'suite', name: 'Fixture', tasks: [{ id: 'task', title: 'Task', acceptanceCriteria: ['criterion'] }], observations: [{ taskId: 'task', status: 'passed', source: 'fixture', recordedAt: '2026-01-01T00:00:00.000Z', evidence: [{ criterion: 'unknown', status: 'passed', source: 'fixture' }] }] })).toThrow(/unknown criterion/)
  expect(() => validateBenchmarkManifest({ type: 'agentskit-harness-benchmark-manifest', schemaVersion: 1, suiteId: 'suite', name: 'Fixture', tasks: [{ id: 'task', title: 'Task', acceptanceCriteria: ['criterion'] }], observations: [{ taskId: 'task', status: 'passed', source: 'fixture', recordedAt: '2026-01-01T00:00:00.000Z', evidence: [{ criterion: 'criterion', status: 'passed', source: 'fixture' }, { criterion: 'criterion', status: 'passed', source: 'fixture' }] }] })).toThrow(/must be unique/)
  expect(() => validateBenchmarkManifest({ type: 'agentskit-harness-benchmark-manifest', schemaVersion: 1, suiteId: 'suite', name: 'Fixture', tasks: [{ id: 'task', title: 'Task', acceptanceCriteria: ['criterion'] }], observations: [{ taskId: 'task', status: 'passed', source: 'fixture', recordedAt: '2026-01-01T00:00:00.000Z', evidenceDigest: 'not-a-digest' }] })).toThrow(/SHA-256 digest/)
  expect(() => validateBenchmarkManifest({ type: 'agentskit-harness-benchmark-manifest', schemaVersion: 1, suiteId: 'suite', name: 'Fixture', tasks: [{ id: 'task', title: 'Task', acceptanceCriteria: ['criterion'] }], observations: [{ taskId: 'task', status: 'passed', source: 'fixture', recordedAt: '2026-01-01T00:00:00.000Z', artifactAcceptanceRate: 1.1 }] })).toThrow(/between 0 and 1/)
})
