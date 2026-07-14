import type { AdapterFactory } from '@agentskit/core'
import { createDeterministicAnswerAdapter, type AskAdapter, type DeterministicAnswerAdapter } from '@agentskit/chat'
import {
  decodeDeterministicSiteConfig,
  verifyLocalKnowledgeArtifactSync,
  type AnswerResponse,
} from '@agentskit/chat/protocol'

export interface PlaybookDiscoveryInputs {
  readonly siteConfig: unknown
  readonly artifact: unknown
}

export interface PlaybookDiscoveryAdapter {
  readonly adapter: AdapterFactory
  readonly deterministic: DeterministicAnswerAdapter | null
}

export async function loadPlaybookDiscovery(
  fetchImpl: typeof fetch = fetch,
  base = '/deterministic',
): Promise<PlaybookDiscoveryInputs | null> {
  try {
    const signal = AbortSignal.timeout(6_500)
    const [siteConfig, artifact] = await Promise.all([
      fetchImpl(`${base}/site-config.json`, { signal }),
      fetchImpl(`${base}/knowledge.json`, { signal }),
    ])
    if (!siteConfig.ok || !artifact.ok) return null
    const [siteConfigValue, artifactValue] = await Promise.all([siteConfig.json(), artifact.json()])
    return { siteConfig: siteConfigValue, artifact: artifactValue }
  } catch {
    return null
  }
}

export function createPlaybookDiscoveryAdapter({
  inputs,
  fallback,
  onDecision,
  onBackendStart,
  onBackendAnswer,
}: {
  readonly inputs: PlaybookDiscoveryInputs | null
  readonly fallback: AdapterFactory & Partial<Pick<AskAdapter, 'createSourceForSession'>>
  readonly onDecision?: (decision: AnswerResponse) => void | Promise<void>
  readonly onBackendStart?: () => void
  readonly onBackendAnswer?: () => void
}): PlaybookDiscoveryAdapter {
  const observeBackend = (source: ReturnType<AdapterFactory['createSource']>) => ({
    abort: () => source.abort(),
    async *stream() {
      let failed = false
      let hasText = false
      for await (const chunk of source.stream()) {
        if (chunk.type === 'text' && chunk.content?.trim()) hasText = true
        if (chunk.type === 'error') failed = true
        if (chunk.type === 'done' && hasText && !failed) onBackendAnswer?.()
        yield chunk
      }
    },
  })
  const site = decodeDeterministicSiteConfig(inputs?.siteConfig)
  if (!site.ok) {
    const degraded = {
      capabilities: fallback.capabilities,
      createSource: (request: Parameters<AdapterFactory['createSource']>[0]) => {
        onBackendStart?.()
        return observeBackend(fallback.createSource(request))
      },
      createSourceForSession: (request: Parameters<AdapterFactory['createSource']>[0], sessionId: string) => {
        onBackendStart?.()
        return observeBackend(fallback.createSourceForSession?.(request, sessionId) ?? fallback.createSource(request))
      },
    }
    return { adapter: degraded, deterministic: null }
  }
  const artifact = verifyLocalKnowledgeArtifactSync(inputs?.artifact, {
    expectedContentHash: site.value.artifact.contentHash,
    expectedSiteId: site.value.siteId,
  })
  let activeSessionId = 'unscoped'
  const sessionForwardingFallback: AdapterFactory = {
    capabilities: fallback.capabilities,
    createSource: (request) => fallback.createSourceForSession?.(request, activeSessionId) ?? fallback.createSource(request),
  }
  const base = createDeterministicAnswerAdapter({
    artifact: artifact.ok ? artifact.value : null,
    expectedContentHash: site.value.artifact.contentHash,
    expectedSiteId: site.value.siteId,
    fallbackMode: site.value.fallback.mode,
    fallback: sessionForwardingFallback,
    backend: { provider: 'ask-playbook' },
    onDecision,
  })
  const deterministic: DeterministicAnswerAdapter = {
    ...base,
    createSourceForSession: (request, sessionId) => {
      activeSessionId = sessionId
      try {
        return base.createSourceForSession(request, sessionId)
      } finally {
        activeSessionId = 'unscoped'
      }
    },
  }
  return { adapter: deterministic, deterministic }
}
