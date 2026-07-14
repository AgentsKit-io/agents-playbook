import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import {
  DETERMINISTIC_ARTIFACT_MAX_BYTES,
  DETERMINISTIC_KNOWLEDGE_PROTOCOL,
  DETERMINISTIC_KNOWLEDGE_PROTOCOL_VERSION,
  DETERMINISTIC_SITE_PROTOCOL,
  DETERMINISTIC_SITE_PROTOCOL_VERSION,
  LocalKnowledgeArtifactSchema,
  computeLocalKnowledgeArtifactContentHash,
  normalizeKnowledgeKey,
} from '@agentskit/chat/protocol'

const SITE = 'https://playbook.agentskit.io'
const DOCS_ROOT = join('content', 'docs')

const unquote = (value) => value.replace(/^(['"])(.*)\1$/, '$2')

const frontmatterValue = (body, key) => {
  const block = body.match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1] ?? ''
  return unquote(block.match(new RegExp(`^${key}:\\s*(.+)$`, 'm'))?.[1]?.trim() ?? '')
}

const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
  const path = join(dir, entry.name)
  return entry.isDirectory() ? walk(path) : [/\.mdx?$/, /\.mjs$/].some((pattern) => pattern.test(entry.name)) ? [path] : []
})

const routeFor = (path) => relative(DOCS_ROOT, path)
  .split(sep)
  .join('/')
  .replace(/\.mdx?$/, '')
  .replace(/\/index$/, '')
  .replace(/^(index|README)$/, '')

const rawHrefFor = (path) => `${SITE}/raw/${relative(DOCS_ROOT, path).split(sep).join('/')}`

const unique = (values) => {
  const seen = new Set()
  return values.filter((value) => {
    const normalized = normalizeKnowledgeKey(value)
    if (!normalized || seen.has(normalized)) return false
    seen.add(normalized)
    return true
  })
}

const contentRevision = (root) => {
  const metadata = JSON.parse(readFileSync(join(root, 'scripts', 'discovery-metadata.json'), 'utf8'))
  if (typeof metadata.generatedAt !== 'string' || Number.isNaN(Date.parse(metadata.generatedAt))) {
    throw new Error('scripts/discovery-metadata.json must contain a valid generatedAt timestamp')
  }
  return metadata.generatedAt
}

const pageEntry = (root, path) => {
  const body = readFileSync(path, 'utf8')
  const relativePath = relative(join(root, DOCS_ROOT), path).split(sep).join('/')
  const route = routeFor(path)
  const slug = route.split('/').at(-1) ?? route
  const title = frontmatterValue(body, 'title') || body.match(/^#\s+(.+)$/m)?.[1]?.trim() || slug
  const description = frontmatterValue(body, 'description') || `Agents Playbook source: ${title}.`
  const type = frontmatterValue(body, 'type') || (path.endsWith('.mjs') ? 'Gate Script' : 'Documentation')
  const isScript = path.endsWith('.mjs')
  const entryId = `doc:${(route || 'index').replaceAll('/', ':')}`
  const pageHref = isScript ? `${SITE}/raw/${relativePath}` : route ? `${SITE}/docs/${route}` : `${SITE}/docs`
  const aliases = unique([
    route,
    relativePath,
    slug,
    title,
    title.replace(/\s+pattern$/iu, ''),
    title.replace(/\s+template$/iu, ''),
    title.replace(/^system prompt\s*[—-]\s*/iu, ''),
    `playbook ${title}`,
    isScript ? `run ${slug}` : '',
  ])
  return {
    id: entryId,
    kind: isScript ? 'command' : 'document',
    label: title,
    match: { type: 'exact', values: aliases },
    answer: {
      markdown: [
        `## ${title}`,
        '',
        description,
        '',
        `Type: **${type}**`,
        isScript ? `Run after copying: \`node ${relativePath}\`` : undefined,
        '',
        `[Open the canonical ${isScript ? 'source' : 'guide'}](${pageHref})`,
        isScript ? undefined : `[Read raw Markdown](${rawHrefFor(path)})`,
      ].filter((line) => line !== undefined).join('\n'),
      citations: [{ id: entryId, title, href: pageHref }],
    },
  }
}

const fixedEntries = [
  {
    id: 'command:onboard', kind: 'command', label: 'Onboard a coding agent',
    values: ['onboard my agent', 'onboard a coding agent', 'playbook onboarding', 'adopt the playbook'],
    markdown: 'Start with the copy-ready onboarding prompt. It asks your coding agent to read the full bundle, audit the repository, rank gaps by risk, and wait for approval before changing code.',
    title: 'Onboard your agent', href: `${SITE}/docs/onboard-your-agent`,
  },
  {
    id: 'command:bundle', kind: 'command', label: 'Fetch the Playbook bundle',
    values: ['fetch playbook', 'download playbook', 'playbook bundle', 'curl playbook'],
    markdown: 'Fetch the complete LLM-readable corpus with `curl https://playbook.agentskit.io/llms-full.txt` or download `playbook-bundle.zip` for local indexing.',
    title: 'Playbook machine-readable bundle', href: `${SITE}/llms-full.txt`,
  },
  {
    id: 'nav:contribute', kind: 'contribution', label: 'Contribute a production-earned pattern',
    values: ['contribute', 'contribute a pattern', 'playbook contribution', 'add a playbook pattern'],
    markdown: 'Contributions are welcome when a pattern is backed by a reproducible production lesson. Follow the contribution guide, include the failure mode and enforcement evidence, then open a pull request.',
    title: 'Contribute to Agents Playbook', href: 'https://github.com/AgentsKit-io/agents-playbook/blob/main/CONTRIBUTING.md',
  },
  {
    id: 'ecosystem:agentskit', kind: 'ecosystem', label: 'AgentsKit framework',
    values: ['agentskit', 'agentskit framework', 'framework'],
    markdown: 'AgentsKit is the parent framework. Use it to build the agents and runtimes governed by Playbook patterns.',
    title: 'AgentsKit documentation', href: 'https://www.agentskit.io/docs',
  },
  {
    id: 'ecosystem:registry', kind: 'ecosystem', label: 'AgentsKit Registry',
    values: ['registry', 'agentskit registry', 'ready agents'],
    markdown: 'Use the Registry to install validated, readable agent source, then apply Playbook gates and review patterns as you adapt it.',
    title: 'AgentsKit Registry', href: 'https://registry.agentskit.io',
  },
  {
    id: 'ecosystem:chat', kind: 'ecosystem', label: 'AgentsKit Chat',
    values: ['agentskit chat', 'agentschat', 'chat framework'],
    markdown: 'AgentsKit Chat powers this local-first assistant and turns one behavior definition into native chat experiences across supported interfaces.',
    title: 'AgentsKit Chat', href: 'https://github.com/AgentsKit-io/agentskit-chat',
  },
  {
    id: 'ecosystem:doc-bridge', kind: 'ecosystem', label: 'Doc Bridge',
    values: ['doc bridge', 'doc-bridge', 'documentation bridge'],
    markdown: 'Doc Bridge validates the Playbook corpus, machine-readable index, ownership routes, and agent handoffs.',
    title: 'Doc Bridge', href: 'https://github.com/AgentsKit-io/doc-bridge',
  },
].map((entry) => ({
  id: entry.id,
  kind: entry.kind,
  label: entry.label,
  match: { type: 'exact', values: entry.values },
  answer: { markdown: entry.markdown, citations: [{ id: entry.id, title: entry.title, href: entry.href }] },
}))

export const createPlaybookDiscoveryArtifact = async (root) => {
  const docs = walk(join(root, DOCS_ROOT)).sort().map((path) => pageEntry(root, path))
  const artifactWithoutHash = {
    protocol: DETERMINISTIC_KNOWLEDGE_PROTOCOL,
    version: DETERMINISTIC_KNOWLEDGE_PROTOCOL_VERSION,
    artifactId: 'agents-playbook',
    siteId: 'playbook',
    generatedAt: contentRevision(root),
    entries: [...docs, ...fixedEntries],
  }
  const contentHash = await computeLocalKnowledgeArtifactContentHash(artifactWithoutHash)
  const artifact = LocalKnowledgeArtifactSchema.parse({ ...artifactWithoutHash, contentHash })
  const serialized = `${JSON.stringify(artifact, null, 2)}\n`
  const bytes = new TextEncoder().encode(serialized).byteLength
  if (bytes > DETERMINISTIC_ARTIFACT_MAX_BYTES) {
    throw new Error(`Playbook discovery artifact is ${bytes} bytes; limit is ${DETERMINISTIC_ARTIFACT_MAX_BYTES}`)
  }
  return { artifact, serialized, bytes }
}

export const createPlaybookSiteConfig = (contentHash) => ({
  protocol: DETERMINISTIC_SITE_PROTOCOL,
  version: DETERMINISTIC_SITE_PROTOCOL_VERSION,
  siteId: 'playbook',
  artifact: { href: '/deterministic/knowledge.json', contentHash },
  fallback: { mode: 'backend' },
})
