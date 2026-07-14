#!/usr/bin/env node
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createPlaybookDiscoveryArtifact, createPlaybookSiteConfig } from './lib/playbook-discovery.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = join(root, 'public', 'deterministic')
const result = await createPlaybookDiscoveryArtifact(root)
const config = createPlaybookSiteConfig(result.artifact.contentHash)

mkdirSync(outDir, { recursive: true })
writeFileSync(join(outDir, 'knowledge.json'), result.serialized)
writeFileSync(join(outDir, 'site-config.json'), `${JSON.stringify(config, null, 2)}\n`)

console.log(`Playbook discovery: ${result.artifact.entries.length} entries, ${result.bytes} bytes, ${result.artifact.contentHash}`)
