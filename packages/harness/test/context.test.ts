import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createPluginRegistry, CONTEXT_PROVIDER_SLOT, FileEventStore, loadConfig, planRun } from '../src/index.js'
import { hashContextSnapshots } from '../src/context.js'
import type { ContextProvider } from '../src/index.js'
import { expect, it } from 'vitest'

it('resolves a provenance-bearing provider through the optional plugin seam', async () => {
  const registry = createPluginRegistry()
  const provider: ContextProvider = {
    id: 'fixture-context', version: '1.0.0',
    resolve: async (query) => ({ providerId: 'fixture-context', query, references: [{ id: 'doc-1', uri: 'doc://fixture', contentHash: 'hash' }], sourceHash: 'source-hash', snapshotHash: 'snapshot-hash', resolvedAt: '2026-08-29T00:00:00.000Z' }),
  }
  registry.register({ id: 'context-fixture', version: '1.0.0', apiVersion: 1, apply: (context) => { context.register(CONTEXT_PROVIDER_SLOT, provider.id, provider) } })
  registry.mount()
  const resolved = await registry.contributions(CONTEXT_PROVIDER_SLOT)[0]?.value.resolve({ query: 'ownership', scope: ['playbook'] })
  expect(resolved?.providerId).toBe('fixture-context')
  expect(resolved?.references[0]?.contentHash).toBe('hash')
  registry.dispose()
})

it('binds context snapshots to the planned run and lifecycle log', async () => {
  const root = mkdtempSync(join(tmpdir(), 'agentskit-harness-context-binding-test-'))
  mkdirSync(join(root, '.codex'), { recursive: true })
  const configPath = join(root, '.codex', 'verification.json')
  writeFileSync(configPath, JSON.stringify({ schemaVersion: 1, project: 'context-fixture', root: '..', profile: 'strict', contract: { intent: 'Freeze context.', scope: { inScope: ['fixture'], outOfScope: ['production'] }, ambiguities: [], outcomes: [{ id: 'outcome', statement: 'The fixture is valid.', checks: ['logic'] }] }, surfaces: { logic: true, endpoint: false, database: false, cli: false, mcp: false, ui: false, docs: false }, checks: [{ id: 'logic', category: 'logic', command: 'true', evidence: 'structured' }], tracking: { required: false, reason: 'fixture' } }))
  const snapshot = { providerId: 'fixture-context', query: { query: 'ownership', scope: ['playbook'] }, references: [{ id: 'doc-1', uri: 'doc://fixture', contentHash: 'hash' }], sourceHash: 'source-hash', snapshotHash: 'snapshot-hash', resolvedAt: '2026-08-29T00:00:00.000Z' }
  const run = await planRun({ configPath, decision: 'approved', contextSnapshots: [snapshot] })
  expect(run.contextSnapshots).toEqual([snapshot])
  expect(run.contextHash).toMatch(/^[a-f0-9]{64}$/)
  const events = new FileEventStore(join(root, '.codex', 'verification')).read(run.runId)
  expect(events.some((event) => event.type === 'context.attached' && event.payload.snapshotHash === snapshot.snapshotHash)).toBe(true)
  expect(JSON.parse(readFileSync(join(root, '.codex', 'verification', 'runs', run.runId, 'run.json'), 'utf8')).contextHash).toBe(run.contextHash)
})

it('keeps the context hash stable when only resolution time changes', () => {
  const base = { providerId: 'fixture-context', query: { query: 'ownership' }, references: [], sourceHash: 'source-hash', snapshotHash: 'snapshot-hash' }
  expect(hashContextSnapshots([{ ...base, resolvedAt: '2026-08-29T00:00:00.000Z' }])).toBe(hashContextSnapshots([{ ...base, resolvedAt: '2026-08-29T01:00:00.000Z' }]))
})
