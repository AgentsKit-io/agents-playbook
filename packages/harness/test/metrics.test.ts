import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, it } from 'vitest'
import { benchmarkRuns } from '../src/index.js'

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

it('returns an empty, typed report when no runs exist', () => {
  const report = benchmarkRuns(mkdtempSync(join(tmpdir(), 'agentskit-harness-empty-metrics-')))
  expect(report.summary.totalRuns).toBe(0)
  expect(report.summary.checkPassRate).toBeNull()
  expect(report.summary.stateCounts.COMPLETE).toBe(0)
})
