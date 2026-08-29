import { createPluginSlot } from './plugins.js'

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
  readonly snapshotHash: string
  readonly resolvedAt: string
}

export interface ContextProvider {
  readonly id: string
  readonly version: string
  readonly resolve: (query: ContextQuery) => Promise<ContextSnapshot>
}

export const CONTEXT_PROVIDER_SLOT = createPluginSlot<ContextProvider>('context.provider')
