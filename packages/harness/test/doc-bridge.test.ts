import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, it } from 'vitest'
import { createDocBridgeContextProvider } from '../src/index.js'

it('resolves real indexed knowledge with a stable source and snapshot hash', async () => {
  const root = mkdtempSync(join(tmpdir(), 'agentskit-harness-doc-bridge-test-'))
  mkdirSync(join(root, '.doc-bridge'), { recursive: true })
  writeFileSync(join(root, '.doc-bridge', 'index.json'), JSON.stringify({ schemaVersion: 1, contentHash: 'a'.repeat(64), contentHashAlgo: 'sha256-normalized-v1', knowledge: [{ id: 'playbook-harness', type: 'guide', title: 'Harness guide', path: 'content/docs/harness.md', body: 'Portable harness verification' }, { id: 'other', type: 'guide', title: 'Other', path: 'content/docs/other.md', body: 'Unrelated content' }] }))
  const provider = createDocBridgeContextProvider({ root })
  const first = await provider.resolve({ query: 'harness', scope: ['playbook'] })
  const second = await provider.resolve({ query: 'harness', scope: ['playbook'] })
  expect(first.references.map((reference) => reference.id)).toEqual(['playbook-harness'])
  expect(first.sourceHash).toBe('a'.repeat(64))
  expect(first.snapshotHash).toBe(second.snapshotHash)
  expect(first.references[0]?.uri).toBe('doc-bridge://content/docs/harness.md')
})

it('fails clearly when the configured index is missing', async () => {
  const provider = createDocBridgeContextProvider({ root: mkdtempSync(join(tmpdir(), 'agentskit-harness-doc-bridge-missing-')) })
  await expect(provider.resolve({ query: 'harness' })).rejects.toThrow()
})
