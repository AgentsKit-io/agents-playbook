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
  expect(report.summary.checkPassRate).toBe(0.6667)
  expect(report.summary.evidenceCoverageRate).toBe(1)
  expect(report.summary.averageDurationMs).toBe(200)
  expect(report.summary.medianDurationMs).toBe(200)
})

it('compares a bound harness task with an explicit baseline and does not invent missing baselines', () => {
  const stateDir = mkdtempSync(join(tmpdir(), 'agentskit-harness-comparison-'))
  writeRun(stateDir, '1-harness', 'COMPLETE', { benchmark: { suiteId: 'suite', taskId: 'task', mode: 'harness' }, metrics: { totalDurationMs: 200, budgetExceeded: false } })
  const manifest = validateBenchmarkManifest({ type: 'agentskit-harness-benchmark-manifest', schemaVersion: 1, suiteId: 'suite', name: 'Fixture', tasks: [{ id: 'task', title: 'Task', acceptanceCriteria: ['criterion'] }], observations: [{ taskId: 'task', mode: 'baseline', status: 'passed', source: 'manual-fixture', recordedAt: '2026-01-01T00:00:00.000Z', attempts: 1, durationMs: 100 }] })
  const report = benchmarkRuns(stateDir, manifest)
  expect(report.manifest).toEqual({ suiteId: 'suite', taskCount: 1, baselineCount: 1, comparableTaskCount: 1 })
  expect(report.comparisons[0]).toMatchObject({ taskId: 'task', comparable: true, durationDeltaMs: 100, attemptDelta: 0 })
})

it('returns an empty, typed report when no runs exist', () => {
  const report = benchmarkRuns(mkdtempSync(join(tmpdir(), 'agentskit-harness-empty-metrics-')))
  expect(report.summary.totalRuns).toBe(0)
  expect(report.summary.checkPassRate).toBeNull()
  expect(report.summary.stateCounts.COMPLETE).toBe(0)
})

it('validates a benchmark manifest task identity', () => {
  const manifest = validateBenchmarkManifest({ type: 'agentskit-harness-benchmark-manifest', schemaVersion: 1, suiteId: 'suite', name: 'Fixture', tasks: [{ id: 'task', title: 'Task', acceptanceCriteria: ['criterion'] }], observations: [] })
  expect(manifest.tasks[0]?.id).toBe('task')
})

it('records one atomic baseline observation and rejects duplicates', () => {
  const manifestPath = join(mkdtempSync(join(tmpdir(), 'agentskit-harness-baseline-record-')), 'manifest.json')
  writeFileSync(manifestPath, JSON.stringify({ type: 'agentskit-harness-benchmark-manifest', schemaVersion: 1, suiteId: 'suite', name: 'Fixture', tasks: [{ id: 'task', title: 'Task', acceptanceCriteria: ['criterion'] }], observations: [] }))
  const recorded = recordBenchmarkObservation(manifestPath, { taskId: 'task', status: 'passed', source: 'manual-run-1', recordedAt: '2026-01-01T00:00:00.000Z', attempts: 2, durationMs: 100, reviewMinutes: 5, escapedIncomplete: 1 })
  expect(recorded.observations[0]).toMatchObject({ taskId: 'task', source: 'manual-run-1', attempts: 2, durationMs: 100, reviewMinutes: 5, escapedIncomplete: 1 })
  expect(loadBenchmarkManifest(manifestPath).observations).toHaveLength(1)
  expect(() => recordBenchmarkObservation(manifestPath, { taskId: 'task', status: 'passed', source: 'manual-run-2' })).toThrow(/already has an observation/)
})
