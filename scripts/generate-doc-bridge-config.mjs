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

const infrastructureOwnership = {
  'pre-commit-provider': ['.pre-commit-hooks.yaml', 'Versioned pre-commit provider manifest.'],
  'project-automation': ['scripts', 'Repository automation, generators, and integration tests.'],
  'continuous-integration': ['.github/workflows', 'Continuous-integration workflows.'],
  'project-manifest': ['package.json', 'Project commands, dependencies, and runtime contract.'],
  'project-readme': ['README.md', 'Repository introduction and adoption path.'],
  changelog: ['CHANGELOG.md', 'Release-facing project change history.'],
  'readme-standard': ['readme-standard-v1.json', 'README Standard evidence and freshness hashes.'],
  'doc-bridge-config': ['doc-bridge.config.json', 'Generated Doc Bridge routing configuration.'],
}

for (const [id, [path, purpose]] of Object.entries(infrastructureOwnership)) {
  ownership[id] = {
    path,
    purpose,
    agentDoc: 'content/docs/scripts/index.md',
    humanDoc: `${site}/docs/scripts`,
    checks: ['pnpm check:all'],
  }
}

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
      root: 'content/docs',
      index: 'content/docs/index.mdx',
      include: ['**/*.md', '**/*.mdx'],
      exclude: ['**/node_modules/**'],
    },
    human: { plugin: 'fumadocs', options: { contentDir: 'content/docs', urlPrefix: '/docs' } },
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
  gates: { preset: 'standard' },
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
