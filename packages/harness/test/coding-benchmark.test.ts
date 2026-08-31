import { expect, it } from 'vitest'
import { validateExternalCodingBenchmarkReport, validateBenchmarkManifest } from '../src/index.js'

it('validates an AgentsKit OS benchmark report without granting acceptance', () => {
  const report = validateExternalCodingBenchmarkReport({
    kind: 'edit', prompt: 'Fix it', dryRun: false, isolateWorktrees: true, repoRoot: '/repo',
    rows: [{ providerId: 'codex', status: 'ok', completenessScore: 100, fileEditCount: 2, summary: 'done', successPassed: true }],
  })
  expect(report.rows[0]?.successPassed).toBe(true)
})

it('rejects duplicate providers and preserves manifest provenance', () => {
  expect(() => validateExternalCodingBenchmarkReport({
    kind: 'edit', prompt: 'Fix it', dryRun: true, isolateWorktrees: true, repoRoot: '/repo',
    rows: [
      { providerId: 'codex', status: 'ok', completenessScore: 100, fileEditCount: 0, summary: 'done' },
      { providerId: 'codex', status: 'fail', completenessScore: 0, fileEditCount: 0, summary: 'failed' },
    ],
  })).toThrow(/provider ids must be unique/)
  const manifest = validateBenchmarkManifest({
    type: 'agentskit-harness-benchmark-manifest', schemaVersion: 1, suiteId: 'suite', name: 'Suite',
    provenance: { repository: 'repo', revision: 'abc', taskDefinition: 'fixtures/tasks.json' },
    tasks: [{ id: 'task', title: 'Task', kind: 'edit', surfaces: ['logic'], prompt: { path: 'fixtures/task.md', sha256: 'a'.repeat(64) }, source: { repository: 'repo', path: 'fixtures/task.md', revision: 'abc' }, scope: { read: ['src/**'], write: ['src/**'] }, acceptanceCriteria: ['done'] }],
    observations: [],
  })
  expect(manifest.provenance?.revision).toBe('abc')
  expect(manifest.tasks[0]?.prompt?.sha256).toBe('a'.repeat(64))
  expect(manifest.tasks[0]?.surfaces).toEqual(['logic'])
})

it('rejects unknown or duplicate benchmark surfaces', () => {
  const base = { type: 'agentskit-harness-benchmark-manifest', schemaVersion: 1, suiteId: 'suite', name: 'Suite', tasks: [{ id: 'task', title: 'Task', acceptanceCriteria: ['done'] }], observations: [] }
  expect(() => validateBenchmarkManifest({ ...base, tasks: [{ ...base.tasks[0], surfaces: ['unknown'] }] })).toThrow(/unknown surface/)
  expect(() => validateBenchmarkManifest({ ...base, tasks: [{ ...base.tasks[0], surfaces: ['logic', 'logic'] }] })).toThrow(/unique surfaces/)
})
