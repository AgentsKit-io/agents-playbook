import { expect, it } from 'vitest'
import { createToolRuntime } from '../src/index.js'

const request = { actionId: 'action', turnId: 'turn', toolId: 'shell', argumentsHash: 'hash', arguments: { command: 'echo ok' } } as const

it('executes a registered tool and returns only a result hash', async () => {
  const runtime = createToolRuntime({ tools: [{ toolId: 'shell', execute: async ({ arguments: input, signal }) => ({ input, aborted: signal.aborted }) }] })
  const result = await runtime.execute(request)
  expect(result.status).toBe('completed')
  expect(result).not.toHaveProperty('result')
  expect(result).toHaveProperty('resultHash')
})

it('returns structured failures for missing and timed-out tools', async () => {
  const runtime = createToolRuntime({ timeoutMs: 5, tools: [{ toolId: 'slow', execute: async () => new Promise((resolve) => setTimeout(resolve, 30)) }] })
  await expect(runtime.execute({ ...request, toolId: 'missing' })).resolves.toMatchObject({ status: 'failed', errorCode: 'TOOL_NOT_FOUND', retryable: false })
  await expect(runtime.execute({ ...request, toolId: 'slow' })).resolves.toMatchObject({ status: 'failed', errorCode: 'TIMEOUT', retryable: true })
})

it('rejects invalid runtime definitions', () => {
  expect(() => createToolRuntime({ tools: [{ toolId: 'shell', execute: () => 'ok' }, { toolId: 'shell', execute: () => 'duplicate' }] })).toThrow(/unique ids/)
  expect(() => createToolRuntime({ tools: [], timeoutMs: 0 })).toThrow(/timeoutMs/)
})
