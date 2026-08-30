import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, it } from 'vitest'
import { inspectEventLogLock, recoverEventLogLock } from '../src/index.js'

const lock = (root: string, runId: string): string => {
  const runDir = join(root, 'runs', runId)
  mkdirSync(runDir, { recursive: true })
  return join(runDir, 'events.ndjson.lock')
}
const old = '2020-01-01T00:00:00.000Z'

it('recovers only an old lock owned by a dead process', () => {
  const stateDir = mkdtempSync(join(tmpdir(), 'agentskit-harness-lock-test-'))
  const path = lock(stateDir, 'stale')
  writeFileSync(path, JSON.stringify({ pid: 2_147_483_647, at: old }))
  expect(inspectEventLogLock(stateDir, 'stale')).toMatchObject({ status: 'locked', lock: { pid: 2_147_483_647, at: old } })
  expect(recoverEventLogLock({ stateDir, runId: 'stale', actor: 'human', maxAgeMs: 1 })).toMatchObject({ status: 'recovered', path, lock: { pid: 2_147_483_647 } })
  expect(inspectEventLogLock(stateDir, 'stale')).toMatchObject({ status: 'unlocked', path })
})

it('keeps live, young, malformed, and agent-requested locks fail-closed', () => {
  const stateDir = mkdtempSync(join(tmpdir(), 'agentskit-harness-lock-test-'))
  const livePath = lock(stateDir, 'live')
  writeFileSync(livePath, JSON.stringify({ pid: process.pid, at: old }))
  expect(() => recoverEventLogLock({ stateDir, runId: 'live', actor: 'human', maxAgeMs: 1 })).toThrow(/still alive/)
  const youngPath = lock(stateDir, 'young')
  writeFileSync(youngPath, JSON.stringify({ pid: 2_147_483_647, at: new Date().toISOString() }))
  expect(() => recoverEventLogLock({ stateDir, runId: 'young', actor: 'human' })).toThrow(/not old enough/)
  const malformedPath = lock(stateDir, 'malformed')
  writeFileSync(malformedPath, 'busy')
  expect(() => inspectEventLogLock(stateDir, 'malformed')).toThrow(/metadata is invalid/)
  expect(() => recoverEventLogLock({ stateDir, runId: 'live', actor: 'agent', maxAgeMs: 1 })).toThrow(/human actor/)
})
