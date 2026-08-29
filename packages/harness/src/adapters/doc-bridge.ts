import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { hashJson } from '../hash.js'
import type { ContextProvider, ContextQuery, ContextReference } from '../context.js'

interface IndexEntry { readonly id?: unknown; readonly type?: unknown; readonly title?: unknown; readonly path?: unknown; readonly description?: unknown; readonly body?: unknown; readonly tags?: unknown }
interface IndexDocument { readonly contentHash?: unknown; readonly knowledge?: unknown }

const index = (root: string, indexPath: string): IndexDocument => JSON.parse(readFileSync(resolve(root, indexPath), 'utf8')) as IndexDocument
const text = (entry: IndexEntry): string => [entry.id, entry.type, entry.title, entry.path, entry.description, entry.body, ...(Array.isArray(entry.tags) ? entry.tags : [])].filter((value): value is string => typeof value === 'string').join(' ').toLowerCase()
const sourceHash = (document: IndexDocument): string => typeof document.contentHash === 'string' && document.contentHash.length > 0 ? document.contentHash : hashJson(document)
const matches = (entry: IndexEntry, query: ContextQuery): boolean => {
  const needle = query.query.trim().toLowerCase()
  const scopes = query.scope?.map((scope) => scope.toLowerCase()) ?? []
  const value = text(entry)
  return Boolean(needle && value.includes(needle) && (scopes.length === 0 || scopes.some((scope) => value.includes(scope))))
}

export interface DocBridgeContextProviderOptions {
  readonly root: string
  readonly indexPath?: string
}

export const createDocBridgeContextProvider = ({ root, indexPath = '.doc-bridge/index.json' }: DocBridgeContextProviderOptions): ContextProvider => ({
  id: 'doc-bridge',
  version: '1.0.0',
  resolve: async (query) => {
    const document = index(root, indexPath)
    const contentHash = sourceHash(document)
    const entries = Array.isArray(document.knowledge) ? document.knowledge.filter((value): value is IndexEntry => typeof value === 'object' && value !== null && !Array.isArray(value)).filter((entry) => matches(entry, query)).sort((left, right) => String(left.id ?? '').localeCompare(String(right.id ?? ''))).slice(0, 8) : []
    const references: ContextReference[] = entries.flatMap((entry) => typeof entry.id === 'string' && typeof entry.path === 'string' ? [{ id: entry.id, uri: `doc-bridge://${entry.path}`, ...(typeof entry.title === 'string' ? { title: entry.title } : {}), contentHash }] : [])
    return { providerId: 'doc-bridge', query, references, sourceHash: contentHash, snapshotHash: hashJson({ providerId: 'doc-bridge', query, references, sourceHash: contentHash }), resolvedAt: new Date().toISOString() }
  },
})
