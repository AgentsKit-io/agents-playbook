import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { createDeterministicAnswerResolver } from '@agentskit/chat'
import { verifyLocalKnowledgeArtifactSync } from '@agentskit/chat/protocol'
import { createPlaybookDiscoveryArtifact, createPlaybookSiteConfig } from './playbook-discovery.mjs'

const ROOT = join(import.meta.dirname, '..', '..')

describe('Playbook deterministic discovery', () => {
  it('builds a bounded, verified artifact matching the committed files', async () => {
    const result = await createPlaybookDiscoveryArtifact(ROOT)
    const config = createPlaybookSiteConfig(result.artifact.contentHash)
    const verified = verifyLocalKnowledgeArtifactSync(result.artifact, {
      expectedContentHash: config.artifact.contentHash,
      expectedSiteId: config.siteId,
    })
    expect(verified.ok).toBe(true)
    expect(result.artifact.entries).toHaveLength(150)
    expect(result.bytes).toBeLessThan(512 * 1024)
    expect(result.serialized).toBe(readFileSync(join(ROOT, 'public/deterministic/knowledge.json'), 'utf8'))
    expect(`${JSON.stringify(config, null, 2)}\n`).toBe(readFileSync(join(ROOT, 'public/deterministic/site-config.json'), 'utf8'))
  })

  it('answers known patterns, scripts, and commands locally and clarifies ambiguous slugs', async () => {
    const result = await createPlaybookDiscoveryArtifact(ROOT)
    const verified = verifyLocalKnowledgeArtifactSync(result.artifact, {
      expectedContentHash: result.artifact.contentHash,
      expectedSiteId: 'playbook',
    })
    if (!verified.ok) throw new Error(verified.diagnostic.message)
    const resolver = createDeterministicAnswerResolver(verified.value, {
      expectedContentHash: result.artifact.contentHash,
      expectedSiteId: 'playbook',
    })

    expect(resolver.resolve('ADR Pattern')).toMatchObject({ outcome: 'answer', provenance: { source: 'local' } })
    expect(resolver.resolve('check-no-any.example.mjs')).toMatchObject({ outcome: 'answer', provenance: { source: 'local' } })
    expect(resolver.resolve('onboard my agent')).toMatchObject({ outcome: 'answer', provenance: { source: 'local' } })
    expect(resolver.resolve('universal')).toMatchObject({ outcome: 'choices', confidence: { basis: 'ambiguous' } })
    expect(resolver.resolve('How should I adapt several patterns to a Rust monorepo?')).toMatchObject({ outcome: 'escalation', reason: 'miss' })
  })
})
