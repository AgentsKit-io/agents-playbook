import { createPluginRegistry, CONTEXT_PROVIDER_SLOT } from '../src/index.js'
import type { ContextProvider } from '../src/index.js'
import { expect, it } from 'vitest'

it('resolves a provenance-bearing provider through the optional plugin seam', async () => {
  const registry = createPluginRegistry()
  const provider: ContextProvider = {
    id: 'fixture-context', version: '1.0.0',
    resolve: async (query) => ({ providerId: 'fixture-context', query, references: [{ id: 'doc-1', uri: 'doc://fixture', contentHash: 'hash' }], snapshotHash: 'snapshot-hash', resolvedAt: '2026-08-29T00:00:00.000Z' }),
  }
  registry.register({ id: 'context-fixture', version: '1.0.0', apiVersion: 1, apply: (context) => { context.register(CONTEXT_PROVIDER_SLOT, provider.id, provider) } })
  registry.mount()
  const resolved = await registry.contributions(CONTEXT_PROVIDER_SLOT)[0]?.value.resolve({ query: 'ownership', scope: ['playbook'] })
  expect(resolved?.providerId).toBe('fixture-context')
  expect(resolved?.references[0]?.contentHash).toBe('hash')
  registry.dispose()
})
