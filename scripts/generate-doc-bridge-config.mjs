#!/usr/bin/env node
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

const root = process.cwd()
const docsRoot = join(root, 'content', 'docs')
const site = 'https://playbook.agentskit.io'
const check = process.argv.includes('--check')

const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
  const path = join(dir, entry.name)
  return entry.isDirectory() ? walk(path) : /\.mdx?$/.test(entry.name) ? [path] : []
})

const unquote = (value) => value.replace(/^(['"])(.*)\1$/, '$2')
const metadata = (path) => {
  const body = readFileSync(path, 'utf8')
  const block = body.match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1] ?? ''
  const get = (key) => unquote(block.match(new RegExp(`^${key}:\\s*(.+)$`, 'm'))?.[1]?.trim() ?? '')
  return { title: get('title'), description: get('description') }
}

const files = walk(docsRoot).sort()
const basenames = files.map((path) => path.split(sep).at(-1)?.replace(/\.mdx?$/, '') ?? '')
const counts = new Map(basenames.map((name) => [name, basenames.filter((candidate) => candidate === name).length]))
const ownership = {}

for (const path of files) {
  const sourcePath = relative(root, path).split(sep).join('/')
  const route = relative(docsRoot, path).split(sep).join('/').replace(/\.mdx?$/, '').replace(/\/index$/, '').replace(/^(index|README)$/, '')
  const basename = path.split(sep).at(-1)?.replace(/\.mdx?$/, '') ?? route
  const id = route === '' ? 'playbook' : counts.get(basename) === 1 ? basename : route.replaceAll('/', '--')
  const { title, description } = metadata(path)
  ownership[id] = {
    path: sourcePath,
    purpose: description || title || `Agents Playbook guide: ${id}`,
    // Doc Bridge treats the corpus index as navigation rather than a dedicated
    // agent guide. Route the root package to the onboarding guide so doctor can
    // prove that every ownership entry has actionable agent context.
    agentDoc: route === '' ? 'content/docs/getting-started.mdx' : sourcePath,
    humanDoc: route ? `${site}/docs/${route}` : `${site}/docs`,
    checks: ['pnpm check:all'],
  }
}

const config = {
  schemaVersion: 1,
  project: { name: 'agents-playbook' },
  corpus: {
    agent: {
      root: 'docs/for-agents',
      index: 'docs/for-agents/INDEX.md',
      include: ['**/*.md'],
      exclude: ['**/node_modules/**'],
    },
    human: {
      // The public site is Fumadocs, but the bridge reads the same source tree
      // directly so every guide remains discoverable even when meta groups are
      // used for presentation-only navigation.
      plugin: 'plain-markdown',
      options: {
        contentDir: 'content/docs',
        urlPrefix: '/docs',
      },
    },
  },
  routing: { options: { ownership } },
  index: {
    outFile: '.doc-bridge/index.json',
    llmsTxt: {
      enabled: true,
      outFile: '.doc-bridge/llms.txt',
      preamble: 'Agents Playbook documents production practices for software built with AI coding agents.',
    },
    capabilities: { enabled: true, outFile: '.doc-bridge/capabilities.json' },
  },
  gates: { preset: 'standard', include: ['documentation-standard-v1'] },
  conformance: {
    documentationStandardV1: {
      rawSources: ['README.md', 'content/docs/index.mdx', 'content/docs/for-agents.mdx', 'docs/for-agents/INDEX.md'],
      contributionPaths: ['CONTRIBUTING.md', 'content/docs/contributing.mdx'],
      metadata: [
        {
          path: 'app/layout.tsx',
          contains: ['export const metadata', 'title:', 'description:', 'openGraph:', 'twitter:'],
        },
      ],
      links: [
        { url: 'https://www.agentskit.io/docs', paths: ['README.md', 'content/docs/for-agents.mdx'] },
        { url: 'https://registry.agentskit.io/docs', paths: ['README.md', 'content/docs/for-agents.mdx'] },
        { url: 'https://chat.agentskit.io/docs', paths: ['README.md', 'content/docs/for-agents.mdx'] },
        { url: 'https://agentskit-io.github.io/doc-bridge/', paths: ['README.md', 'content/docs/for-agents.mdx'] },
        { url: 'https://github.com/AgentsKit-io/code-review-cli#readme', paths: ['README.md', 'content/docs/for-agents.mdx'] },
        { url: 'https://akos.agentskit.io/docs', paths: ['README.md', 'content/docs/for-agents.mdx'] },
      ],
      ecosystemContract: {
        manifest: 'ecosystem.json',
        claims: 'ecosystem-claims.json',
        productId: 'playbook',
      },
      quickstarts: [
        {
          id: 'adopt-playbook',
          doc: 'content/docs/getting-started.mdx',
          test: 'scripts/onboarding-proof.test.mjs',
          command: 'pnpm test:onboarding',
          testContains: [
            'content/docs/getting-started.mdx',
            'proves an adopted gate against an isolated starter fixture',
          ],
        },
      ],
      visuals: ['docs/assets/playbook-flow.svg'],
      diagrams: [
        { path: 'content/docs/discovery.mdx', contains: ['```mermaid'] },
      ],
    },
  },
  surfaces: {
    cli: { bin: 'ak-docs', defaultFormat: 'json' },
    mcp: { enabled: true, transport: 'stdio' },
  },
}

const serialized = `${JSON.stringify(config, null, 2)}\n`
const target = join(root, 'doc-bridge.config.json')
if (check) {
  if (readFileSync(target, 'utf8') !== serialized) {
    console.error('doc-bridge.config.json is stale; run pnpm docs:bridge:config')
    process.exit(1)
  }
  console.log(`Doc Bridge config is current for ${files.length} guides.`)
} else {
  writeFileSync(target, serialized)
  console.log(`Doc Bridge config generated for ${files.length} guides.`)
}
