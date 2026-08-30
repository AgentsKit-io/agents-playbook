#!/usr/bin/env node
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { benchmarkRuns, loadBenchmarkManifest } from '../packages/harness/dist/index.js'

const root = resolve(import.meta.dirname, '..')
const stateDir = mkdtempSync(join(tmpdir(), 'agentskit-harness-controlled-benchmark-'))
const runId = 'controlled-complete-run'
const runDir = join(stateDir, 'runs', runId)
try {
  mkdirSync(runDir, { recursive: true })
  writeFileSync(join(runDir, 'run.json'), JSON.stringify({
    type: 'agentskit-harness-run', schemaVersion: 1, runId, project: 'controlled-fixture', state: 'COMPLETE',
    configHash: 'config', contractHash: 'contract', sourceRevision: 'revision', sourceStatusHash: 'status',
    baseline: { revision: 'revision', status: 'status', statusHash: 'status' },
    contractApproval: { actor: 'human', at: '2026-08-30T00:00:00.000Z', contractHash: 'contract' },
    checks: [{ id: 'check', category: 'logic', status: 'passed', evidence: { status: 'passed', criteria: ['criterion-one', 'criterion-two'] } }],
    outcomes: [{ id: 'outcome', statement: 'Controlled fixture outcome.', checks: ['check'], status: 'passed' }],
    transitions: [{ from: 'VERIFYING', to: 'AWAITING_HUMAN_APPROVAL', at: '2026-08-30T00:00:00.000Z' }, { from: 'AWAITING_HUMAN_APPROVAL', to: 'COMPLETE', at: '2026-08-30T00:02:00.000Z' }],
    evidenceReferences: [], contextSnapshots: [], metrics: { totalDurationMs: 900, budgetExceeded: false },
    humanApproval: { actor: 'human', at: '2026-08-30T00:02:00.000Z', sourceRevision: 'revision', contractHash: 'contract' },
    benchmark: { suiteId: 'agentskit-harness-phase-22', taskId: 'harness-completion-integrity', mode: 'harness' },
  }, null, 2))
  const manifest = loadBenchmarkManifest(join(root, 'benchmarks/harness-phase-22.json'))
  const comparison = benchmarkRuns(stateDir, manifest).comparisons[0]
  const failures = []
  if (!comparison?.comparable) failures.push('controlled fixture was not comparable')
  if (comparison?.improvement.escapedIncompleteRate !== 1 || comparison.improvement.escapedIncomplete !== 'improved') failures.push('escaped-incomplete improvement was not measured as improved')
  if (comparison?.escapedIncompleteDelta !== -1 || comparison.harness.escapedIncomplete !== 0) failures.push('escaped-incomplete delta or harness value is incorrect')
  console.log(JSON.stringify(failures.length ? { status: 'failed', criteria: ['completion-integrity'], failures } : { status: 'passed', criteria: ['completion-integrity'], baselineEscapedIncomplete: comparison.baseline?.escapedIncomplete, harnessEscapedIncomplete: comparison.harness.escapedIncomplete, escapedIncompleteDelta: comparison.escapedIncompleteDelta, escapedIncompleteRate: comparison.improvement.escapedIncompleteRate }))
  process.exitCode = failures.length ? 1 : 0
} finally {
  rmSync(stateDir, { recursive: true, force: true })
}
