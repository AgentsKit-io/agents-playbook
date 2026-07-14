import { describe, expect, it, vi } from 'vitest'
import type { AdapterFactory, AdapterRequest, StreamChunk } from '@agentskit/core'
import { createPlaybookDiscoveryAdapter, loadPlaybookDiscovery } from './discovery'
import siteConfig from '../public/deterministic/site-config.json'
import artifact from '../public/deterministic/knowledge.json'

const request = (content: string): AdapterRequest => ({
  messages: [{ id: 'user-1', role: 'user', content, status: 'complete', createdAt: new Date('2026-07-14T00:00:00Z') }],
})

const read = async (adapter: AdapterFactory, content: string): Promise<StreamChunk[]> => {
  const chunks: StreamChunk[] = []
  for await (const chunk of adapter.createSource(request(content)).stream()) chunks.push(chunk)
  return chunks
}

describe('Playbook discovery adapter', () => {
  it('loads both artifacts and fails closed when either is unavailable', async () => {
    const ok = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify(siteConfig)))
      .mockResolvedValueOnce(new Response(JSON.stringify(artifact)))
    expect(await loadPlaybookDiscovery(ok)).toEqual({ siteConfig, artifact })

    const unavailable = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response('{}', { status: 503 }))
      .mockResolvedValueOnce(new Response('{}'))
    expect(await loadPlaybookDiscovery(unavailable)).toBeNull()
  })

  it('keeps exact facts local and escalates semantic synthesis with context', async () => {
    const backend = vi.fn((incoming: AdapterRequest) => ({
      abort() {},
      async *stream() {
        expect(incoming.context?.metadata?.['agentskit.chat.escalation']).toMatchObject({ outcome: 'escalation', reason: 'miss' })
        yield { type: 'text' as const, content: 'Apply ADR and RFC patterns together.' }
        yield { type: 'done' as const }
      },
    }))
    const decisions: string[] = []
    const result = createPlaybookDiscoveryAdapter({
      inputs: { siteConfig, artifact },
      fallback: { createSource: backend },
      onDecision: (decision) => { decisions.push(`${decision.outcome}:${decision.confidence.basis}`) },
    })

    const local = await read(result.adapter, 'ADR Pattern')
    expect(backend).not.toHaveBeenCalled()
    expect(local.some((chunk) => chunk.type === 'text' && chunk.content?.includes('ADR Pattern'))).toBe(true)

    await read(result.adapter, 'How should I combine architecture and governance for this repository?')
    expect(backend).toHaveBeenCalledTimes(1)
    expect(decisions).toContain('answer:exact')
    expect(decisions).toContain('escalation:miss')
    expect(decisions.some((decision) => decision.startsWith('answer:backend'))).toBe(true)
  })

  it('keeps degraded provenance truthful and only grounds a completed response', async () => {
    const onBackendStart = vi.fn()
    const onBackendAnswer = vi.fn()
    const complete: AdapterFactory = {
      createSource: () => ({ abort() {}, async *stream() {
        yield { type: 'text' as const, content: 'bounded answer' }
        yield { type: 'done' as const }
      } }),
    }
    const degraded = createPlaybookDiscoveryAdapter({
      inputs: null,
      fallback: complete,
      onBackendStart,
      onBackendAnswer,
    })
    await read(degraded.adapter, 'ADR Pattern')
    expect(onBackendStart).toHaveBeenCalledTimes(1)
    expect(onBackendAnswer).toHaveBeenCalledTimes(1)

    const partialFailure: AdapterFactory = {
      createSource: () => ({ abort() {}, async *stream() {
        yield { type: 'text' as const, content: 'partial' }
        yield { type: 'error' as const, content: 'failed' }
      } }),
    }
    const failedAnswer = vi.fn()
    await read(createPlaybookDiscoveryAdapter({ inputs: null, fallback: partialFailure, onBackendAnswer: failedAnswer }).adapter, 'ADR Pattern')
    expect(failedAnswer).not.toHaveBeenCalled()
  })

  it('preserves the AgentsKit Chat backend session across deterministic escalation', async () => {
    const createSourceForSession = vi.fn((_request: AdapterRequest, _sessionId: string) => ({
      abort() {},
      async *stream() { yield { type: 'text' as const, content: 'session answer' }; yield { type: 'done' as const } },
    }))
    const fallback = { createSource: vi.fn(), createSourceForSession }
    const result = createPlaybookDiscoveryAdapter({ inputs: { siteConfig, artifact }, fallback })
    const source = result.deterministic?.createSourceForSession(request('novel repository synthesis'), 'session-42')
    if (!source) throw new Error('deterministic adapter unavailable')
    for await (const _chunk of source.stream()) { /* consume */ }
    expect(createSourceForSession).toHaveBeenCalledWith(expect.any(Object), 'session-42')
    expect(fallback.createSource).not.toHaveBeenCalled()
  })
})
