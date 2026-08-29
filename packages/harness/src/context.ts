import { readFileSync } from 'node:fs'
import { createPluginSlot } from './plugins.js'
import { hashJson } from './hash.js'
import { fail } from './errors.js'

export interface ContextQuery {
  readonly query: string
  readonly scope?: readonly string[]
  readonly sourceRevision?: string
}

export interface ContextReference {
  readonly id: string
  readonly uri: string
  readonly title?: string
  readonly version?: string
  readonly contentHash?: string
}

export interface ContextSnapshot {
  readonly providerId: string
  readonly query: ContextQuery
  readonly references: readonly ContextReference[]
  readonly sourceHash: string
  readonly snapshotHash: string
  readonly resolvedAt: string
}

export interface ContextProvider {
  readonly id: string
  readonly version: string
  readonly resolve: (query: ContextQuery) => Promise<ContextSnapshot>
}

export const hashContextSnapshot = ({ providerId, query, references, sourceHash }: Pick<ContextSnapshot, 'providerId' | 'query' | 'references' | 'sourceHash'>): string => hashJson({ providerId, query, references, sourceHash })
export const hashContextSnapshots = (snapshots: readonly ContextSnapshot[]): string => hashJson(snapshots.map(({ providerId, query, references, sourceHash, snapshotHash }) => ({ providerId, query, references, sourceHash, snapshotHash })))

const record = (value: unknown, label: string): Record<string, unknown> => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) fail(`${label} must be an object.`, 'INVALID_INPUT')
  return value as Record<string, unknown>
}
const requiredString = (value: unknown, label: string): string => {
  if (typeof value !== 'string' || !value.trim()) fail(`${label} must be a non-empty string.`, 'INVALID_INPUT')
  return value as string
}
const contextSnapshot = (value: unknown, index: number): ContextSnapshot => {
  const raw = record(value, `context snapshot ${index}`)
  const rawQuery = record(raw['query'], `context snapshot ${index}.query`)
  const rawReferences = raw['references']
  if (!Array.isArray(rawReferences)) fail(`context snapshot ${index}.references must be an array.`, 'INVALID_INPUT')
  const references = (rawReferences as unknown[]).map((reference: unknown, referenceIndex: number) => {
    const rawReference = record(reference, `context snapshot ${index}.references[${referenceIndex}]`)
    return {
      id: requiredString(rawReference['id'], `context snapshot ${index}.references[${referenceIndex}].id`),
      uri: requiredString(rawReference['uri'], `context snapshot ${index}.references[${referenceIndex}].uri`),
      ...(typeof rawReference['title'] === 'string' ? { title: rawReference['title'] } : {}),
      ...(typeof rawReference['version'] === 'string' ? { version: rawReference['version'] } : {}),
      ...(typeof rawReference['contentHash'] === 'string' ? { contentHash: rawReference['contentHash'] } : {}),
    }
  })
  const scope = rawQuery['scope'] === undefined ? undefined : Array.isArray(rawQuery['scope']) && rawQuery['scope'].every((item) => typeof item === 'string') ? rawQuery['scope'] : fail(`context snapshot ${index}.query.scope must be an array of strings.`, 'INVALID_INPUT')
  const snapshot = {
    providerId: requiredString(raw['providerId'], `context snapshot ${index}.providerId`),
    query: { query: requiredString(rawQuery['query'], `context snapshot ${index}.query.query`), ...(scope ? { scope } : {}), ...(typeof rawQuery['sourceRevision'] === 'string' ? { sourceRevision: rawQuery['sourceRevision'] } : {}) },
    references,
    sourceHash: requiredString(raw['sourceHash'], `context snapshot ${index}.sourceHash`),
    snapshotHash: requiredString(raw['snapshotHash'], `context snapshot ${index}.snapshotHash`),
    resolvedAt: requiredString(raw['resolvedAt'], `context snapshot ${index}.resolvedAt`),
  }
  if (snapshot.snapshotHash !== hashContextSnapshot(snapshot)) fail(`context snapshot ${index}.snapshotHash does not match its contents.`, 'INVALID_INPUT')
  return snapshot
}

export const readContextSnapshots = (path: string): readonly ContextSnapshot[] => {
  const value = JSON.parse(readFileSync(path, 'utf8')) as unknown
  return (Array.isArray(value) ? value : [value]).map(contextSnapshot)
}

export const CONTEXT_PROVIDER_SLOT = createPluginSlot<ContextProvider>('context.provider')
