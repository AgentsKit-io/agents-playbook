import { readFileSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, it } from 'vitest'
import { FileEventStore, createPluginRegistry, createPluginSlot, loadConfig, planRun, startRun, verifyRun } from '../src/index.js'
import type { HarnessPlugin, VerificationCheck } from '../src/index.js'

const quote = (value: string): string => `'${value.replaceAll("'", "'\"'\"'")}'`
const evidenceCommand = (value: unknown): string => `${quote(process.execPath)} -e ${quote(`console.log(${JSON.stringify(JSON.stringify(value))})`)}`

it('mounts dependency-ordered plugins and removes their contributions on dispose', () => {
  const slot = createPluginSlot<{ readonly name: string }>('test.provider')
  const mounted: string[] = []
  const cleaned: string[] = []
  const registry = createPluginRegistry()
  const base: HarnessPlugin = { id: 'base', version: '1.0.0', apiVersion: 1, apply: (context) => { mounted.push('base'); context.register(slot, 'base', { name: 'base' }); context.effect(() => cleaned.push('base')) } }
  const consumer: HarnessPlugin = { id: 'consumer', version: '1.0.0', apiVersion: 1, requires: ['base'], apply: (context) => { mounted.push('consumer'); context.register(slot, 'consumer', { name: 'consumer' }); context.effect(() => cleaned.push('consumer')) } }
  registry.register(consumer); registry.register(base); registry.mount()
  expect(mounted).toEqual(['base', 'consumer'])
  expect(registry.contributions(slot).map((item) => item.value.name)).toEqual(['base', 'consumer'])
  registry.dispose()
  expect(cleaned).toEqual(['consumer', 'base'])
  expect(registry.contributions(slot)).toEqual([])
})

it('rejects missing dependencies, cycles, and duplicate contributions', () => {
  const slot = createPluginSlot<string>('test.provider')
  const missing = createPluginRegistry()
  missing.register({ id: 'consumer', version: '1.0.0', apiVersion: 1, requires: ['missing'], apply: () => {} })
  expect(() => missing.mount()).toThrow(/dependency is missing/)
  const cycle = createPluginRegistry()
  cycle.register({ id: 'a', version: '1.0.0', apiVersion: 1, requires: ['b'], apply: () => {} })
  cycle.register({ id: 'b', version: '1.0.0', apiVersion: 1, requires: ['a'], apply: () => {} })
  expect(() => cycle.mount()).toThrow(/dependency cycle/)
  const duplicate = createPluginRegistry()
  duplicate.register({ id: 'a', version: '1.0.0', apiVersion: 1, apply: (context) => { context.register(slot, 'same', 'first'); context.register(slot, 'same', 'second') } })
  expect(() => duplicate.mount()).toThrow(/contribution already exists/)
})

it('records an ordered append-only lifecycle log bound to a real verification run', async () => {
  const root = mkdtempSync(join(tmpdir(), 'agentskit-harness-event-test-'))
  mkdirSync(join(root, '.codex'), { recursive: true })
  const check: VerificationCheck = { id: 'logic', category: 'logic', command: evidenceCommand({ status: 'passed', criteria: ['outcome'] }), required: true, timeoutMs: 120_000, evidence: 'structured' }
  const configPath = join(root, '.codex', 'verification.json')
  writeFileSync(configPath, JSON.stringify({ schemaVersion: 1, project: 'event-fixture', root: '..', profile: 'strict', contract: { intent: 'Validate event logging.', scope: { inScope: ['fixture'], outOfScope: ['production'] }, ambiguities: [], outcomes: [{ id: 'outcome', statement: 'The fixture passes.', checks: ['logic'] }] }, surfaces: { logic: true, endpoint: false, database: false, cli: false, mcp: false, ui: false, docs: false }, checks: [check], tracking: { required: false, reason: 'fixture' } }, null, 2))
  const planned = await planRun({ configPath, decision: 'approved' })
  startRun(loadConfig(configPath))
  const verified = await verifyRun({ configPath })
  const events = new FileEventStore(join(root, '.codex', 'verification')).read(planned.runId)
  expect(verified.state).toBe('AWAITING_HUMAN_APPROVAL')
  expect(events.map((event) => event.type)).toEqual(['run.created', 'state.transitioned', 'state.transitioned', 'state.transitioned', 'state.transitioned'])
  expect(events.map((event) => event.sequence)).toEqual([1, 2, 3, 4, 5])
  expect(events.every((event) => event.runId === planned.runId && event.configHash === planned.configHash && event.sourceRevision === verified.sourceRevision)).toBe(true)
  const lines = readFileSync(join(root, '.codex', 'verification', 'runs', planned.runId, 'events.ndjson'), 'utf8').trim().split('\n')
  expect(lines).toHaveLength(events.length)
})
