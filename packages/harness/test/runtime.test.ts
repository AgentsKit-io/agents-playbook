import { expect, it } from 'vitest'
import { createDockerToolRuntime, createProcessToolRuntime, createToolRuntime } from '../src/index.js'

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

it('executes a real child process without a shell and hashes its output', async () => {
  const script = "process.stdin.resume(); process.stdin.on('end', () => process.stdout.write('raw-process-result'))"
  const runtime = createProcessToolRuntime({ tools: [{ toolId: 'node', command: process.execPath, args: ['-e', script] }] })
  const result = await runtime.execute({ ...request, toolId: 'node' })
  expect(result.status).toBe('completed')
  expect(result).not.toHaveProperty('stdout')
  expect(result).not.toHaveProperty('result')
})

it('kills timed-out and oversized child processes with recoverable evidence', async () => {
  const slow = createProcessToolRuntime({ timeoutMs: 10, tools: [{ toolId: 'slow', command: process.execPath, args: ['-e', 'setTimeout(() => {}, 1000)'] }] })
  await expect(slow.execute({ ...request, toolId: 'slow' })).resolves.toMatchObject({ status: 'failed', errorCode: 'TIMEOUT', retryable: true })
  const noisy = createProcessToolRuntime({ maxOutputBytes: 4, tools: [{ toolId: 'noisy', command: process.execPath, args: ['-e', "process.stdout.write('too much output')"] }] })
  await expect(noisy.execute({ ...request, toolId: 'noisy' })).resolves.toMatchObject({ status: 'failed', errorCode: 'OUTPUT_LIMIT', retryable: false })
})

it('returns structured failures for non-zero child exits', async () => {
  const runtime = createProcessToolRuntime({ tools: [{ toolId: 'fail', command: process.execPath, args: ['-e', 'process.exit(3)'] }] })
  await expect(runtime.execute({ ...request, toolId: 'fail' })).resolves.toMatchObject({ status: 'failed', errorCode: 'PROCESS_EXIT', retryable: false })
})

it('executes a real tool inside the default Docker sandbox', async () => {
  const script = "import('node:fs').then(async ({writeFileSync}) => { if (process.getuid?.() !== 65532) process.exit(2); try { writeFileSync('/agentskit-harness-write-test', 'blocked'); process.exit(3) } catch {} try { await fetch('http://example.com'); process.exit(4) } catch { process.stdout.write('docker-sandbox-ok') } })"
  const runtime = createDockerToolRuntime({
    timeoutMs: 30_000,
    maxOutputBytes: 1024,
    tools: [{ toolId: 'docker-node', image: 'node:22.13.0-bookworm-slim', command: ['node', '-e', script] }],
  })
  const result = await runtime.execute({ ...request, toolId: 'docker-node' })
  expect(result.status).toBe('completed')
  expect(result).not.toHaveProperty('stdout')
  expect(result).not.toHaveProperty('result')
})

it('rejects unsafe or incomplete Docker definitions', () => {
  expect(() => createDockerToolRuntime({ tools: [{ toolId: 'empty', image: 'alpine:3.21', command: [] }] })).toThrow(/non-empty string array/)
  expect(() => createDockerToolRuntime({ tools: [{ toolId: 'mount', image: 'alpine:3.21', command: ['/bin/true'], mounts: [{ source: 'relative', target: '/work' }] }] })).toThrow(/absolute path/)
  expect(() => createDockerToolRuntime({ tools: [{ toolId: 'bad-mounts', image: 'alpine:3.21', command: ['/bin/true'], mounts: {} as never }] })).toThrow(/mounts must be an array/)
})
