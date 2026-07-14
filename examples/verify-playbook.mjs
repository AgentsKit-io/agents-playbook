import { readFileSync } from 'node:fs'
import { decodeDeterministicSiteConfig, verifyLocalKnowledgeArtifactSync } from '@agentskit/chat/protocol'

const config = JSON.parse(readFileSync(new URL('../public/deterministic/site-config.json', import.meta.url)))
const artifact = JSON.parse(readFileSync(new URL('../public/deterministic/knowledge.json', import.meta.url)))
const site = decodeDeterministicSiteConfig(config)
if (!site.ok) throw new Error(site.diagnostic.message)
const verified = verifyLocalKnowledgeArtifactSync(artifact, {
  expectedContentHash: site.value.artifact.contentHash,
  expectedSiteId: site.value.siteId,
})
if (!verified.ok) throw new Error(verified.diagnostic.message)
console.log(`Verified ${verified.value.entries.length} local Playbook answers.`)
