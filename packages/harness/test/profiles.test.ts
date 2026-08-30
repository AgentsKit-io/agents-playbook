import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, it } from 'vitest'
import { loadConfig } from '../src/index.js'

const config = (profiles: Record<string, unknown>, profile = 'ci'): string => {
  const root = mkdtempSync(join(tmpdir(), 'agentskit-harness-profile-test-'))
  mkdirSync(join(root, '.codex'), { recursive: true })
  const check = { id: 'logic', category: 'logic', command: 'true', evidence: 'structured' }
  const value = { schemaVersion: 1, project: 'profile-fixture', root: '..', profile, profiles, contract: { intent: 'Validate profile composition.', scope: { inScope: ['fixture'], outOfScope: ['production'] }, ambiguities: [], outcomes: [{ id: 'outcome', statement: 'The fixture passes.', checks: ['logic'] }] }, surfaces: { logic: true, endpoint: false, database: false, cli: false, mcp: false, ui: false, docs: false }, checks: [check], tracking: { required: false, reason: 'fixture' } }
  const path = join(root, '.codex', 'verification.json')
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`)
  return path
}

it('resolves inherited overlays deterministically before validation', () => {
  const loaded = loadConfig(config({ base: { budget: { maxDurationMs: 1000 } }, ci: { extends: 'base', checkOverrides: [{ id: 'logic', timeoutMs: 5000 }], cleanup: { roots: ['.codex/verification/tmp'] } } }))
  expect(loaded.config.profile).toBe('ci')
  expect(loaded.config.budget?.maxDurationMs).toBe(1000)
  expect(loaded.config.checks[0]?.timeoutMs).toBe(5000)
  expect(loaded.config.cleanup?.roots).toEqual(['.codex/verification/tmp'])
})

it('rejects missing profiles, inheritance cycles, and unknown check overrides', () => {
  expect(() => loadConfig(config({ base: {} }, 'missing'))).toThrow(/profiles.missing/)
  expect(() => loadConfig(config({ a: { extends: 'b' }, b: { extends: 'a' } }, 'a'))).toThrow(/inheritance cycle/)
  expect(() => loadConfig(config({ ci: { checkOverrides: [{ id: 'unknown', timeoutMs: 10 }] } }))).toThrow(/unknown check/)
})
