import { spawn } from 'node:child_process'
import { hashJson } from './hash.js'
import { fail } from './errors.js'

export interface ToolExecutionRequest {
  readonly actionId: string
  readonly turnId: string
  readonly toolId: string
  readonly argumentsHash: string
  readonly arguments: unknown
  readonly signal: AbortSignal
}

export interface ToolDefinition {
  readonly toolId: string
  readonly execute: (request: ToolExecutionRequest) => Promise<unknown> | unknown
}

export interface ToolRuntime {
  execute(request: Omit<ToolExecutionRequest, 'signal'>): Promise<ToolExecutionResult>
}

export interface ProcessToolDefinition {
  readonly toolId: string
  readonly command: string
  readonly args?: readonly string[]
  readonly cwd?: string
  readonly env?: Readonly<Record<string, string>>
}

export type ToolExecutionResult =
  | { readonly status: 'completed'; readonly resultHash: string; readonly durationMs: number }
  | { readonly status: 'failed'; readonly errorCode: string; readonly retryable: boolean; readonly durationMs: number }

const required = (value: string, label: string): string => {
  if (typeof value !== 'string' || !value.trim()) fail(`${label} is required.`, 'INVALID_INPUT')
  return value.trim()
}

const duration = (value: number): number => {
  if (!Number.isFinite(value) || value < 0) fail('Tool durationMs must be a non-negative number.', 'INVALID_INPUT')
  return value
}

export const createToolRuntime = ({ tools, timeoutMs = 30_000 }: { readonly tools: readonly ToolDefinition[]; readonly timeoutMs?: number }): ToolRuntime => {
  if (!Array.isArray(tools)) fail('Runtime tools must be an array.', 'INVALID_INPUT')
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1) fail('Runtime timeoutMs must be a positive integer.', 'INVALID_INPUT')
  const normalized = tools.map((tool, index) => {
    if (typeof tool !== 'object' || tool === null || Array.isArray(tool)) fail(`tools[${index}] must be an object.`, 'INVALID_INPUT')
    const toolId = required(tool.toolId, `tools[${index}].toolId`)
    if (typeof tool.execute !== 'function') fail(`tools[${index}].execute is required.`, 'INVALID_INPUT')
    return { toolId, execute: tool.execute }
  })
  if (new Set(normalized.map((tool) => tool.toolId)).size !== normalized.length) fail('Runtime tools must have unique ids.', 'INVALID_INPUT')
  return {
    execute: async (request) => {
      const started = Date.now()
      const actionId = required(request.actionId, 'request.actionId')
      const turnId = required(request.turnId, 'request.turnId')
      const toolId = required(request.toolId, 'request.toolId')
      const argumentsHash = required(request.argumentsHash, 'request.argumentsHash')
      const tool = normalized.find((candidate) => candidate.toolId === toolId)
      if (!tool) return { status: 'failed', errorCode: 'TOOL_NOT_FOUND', retryable: false, durationMs: duration(Date.now() - started) }
      const controller = new AbortController()
      let timedOut = false
      let timer: NodeJS.Timeout | undefined
      try {
        const timeout = new Promise<never>((_, reject) => {
          timer = setTimeout(() => { timedOut = true; controller.abort(); reject(new Error('Tool execution timed out.')) }, timeoutMs)
        })
        const result = await Promise.race([Promise.resolve(tool.execute({ actionId, turnId, toolId, argumentsHash, arguments: request.arguments, signal: controller.signal })), timeout])
        return { status: 'completed', resultHash: hashJson(result === undefined ? null : result), durationMs: duration(Date.now() - started) }
      } catch {
        return { status: 'failed', errorCode: timedOut ? 'TIMEOUT' : 'RUNTIME_ERROR', retryable: true, durationMs: duration(Date.now() - started) }
      } finally {
        if (timer) clearTimeout(timer)
      }
    },
  }
}

export const createProcessToolRuntime = ({ tools, timeoutMs = 30_000, maxOutputBytes = 1_048_576 }: { readonly tools: readonly ProcessToolDefinition[]; readonly timeoutMs?: number; readonly maxOutputBytes?: number }): ToolRuntime => {
  if (!Array.isArray(tools)) fail('Process runtime tools must be an array.', 'INVALID_INPUT')
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1) fail('Process runtime timeoutMs must be a positive integer.', 'INVALID_INPUT')
  if (!Number.isInteger(maxOutputBytes) || maxOutputBytes < 1) fail('Process runtime maxOutputBytes must be a positive integer.', 'INVALID_INPUT')
  const normalized = tools.map((tool, index) => {
    if (typeof tool !== 'object' || tool === null || Array.isArray(tool)) fail(`tools[${index}] must be an object.`, 'INVALID_INPUT')
    const toolId = required(tool.toolId, `tools[${index}].toolId`)
    const command = required(tool.command, `tools[${index}].command`)
    if (tool.args !== undefined && (!Array.isArray(tool.args) || tool.args.some((arg) => typeof arg !== 'string'))) fail(`tools[${index}].args must contain strings.`, 'INVALID_INPUT')
    if (tool.env !== undefined && (typeof tool.env !== 'object' || tool.env === null || Array.isArray(tool.env) || Object.values(tool.env).some((value) => typeof value !== 'string'))) fail(`tools[${index}].env must contain string values.`, 'INVALID_INPUT')
    return { toolId, command, args: tool.args ? [...tool.args] : [], ...(tool.cwd ? { cwd: tool.cwd } : {}), env: tool.env ? { ...tool.env } : { PATH: process.env['PATH'] ?? '' } }
  })
  if (new Set(normalized.map((tool) => tool.toolId)).size !== normalized.length) fail('Process runtime tools must have unique ids.', 'INVALID_INPUT')
  return {
    execute: async (request) => {
      const started = Date.now()
      const actionId = required(request.actionId, 'request.actionId')
      const turnId = required(request.turnId, 'request.turnId')
      const toolId = required(request.toolId, 'request.toolId')
      const argumentsHash = required(request.argumentsHash, 'request.argumentsHash')
      const tool = normalized.find((candidate) => candidate.toolId === toolId)
      if (!tool) return { status: 'failed', errorCode: 'TOOL_NOT_FOUND', retryable: false, durationMs: Date.now() - started }
      let input: string
      try { input = JSON.stringify({ actionId, turnId, toolId, argumentsHash, arguments: request.arguments }) } catch { return { status: 'failed', errorCode: 'SERIALIZATION_ERROR', retryable: false, durationMs: Date.now() - started } }
      return new Promise((resolve) => {
        const child = spawn(tool.command, tool.args, { cwd: tool.cwd, env: tool.env, shell: false, stdio: ['pipe', 'pipe', 'pipe'] })
        let stdout = ''
        let timedOut = false
        let outputLimit = false
        let spawnError = false
        let settled = false
        const timer = setTimeout(() => { timedOut = true; child.kill('SIGKILL') }, timeoutMs)
        const finish = (result: ToolExecutionResult): void => { if (settled) return; settled = true; clearTimeout(timer); resolve(result) }
        child.stdout.on('data', (chunk: Buffer) => { stdout += chunk.toString(); if (Buffer.byteLength(stdout) > maxOutputBytes) { outputLimit = true; child.kill('SIGKILL') } })
        child.stderr.on('data', (chunk: Buffer) => { if (chunk.length > maxOutputBytes) { outputLimit = true; child.kill('SIGKILL') } })
        child.on('error', () => { spawnError = true })
        child.on('close', (code) => {
          const durationMs = Date.now() - started
          if (timedOut) return finish({ status: 'failed', errorCode: 'TIMEOUT', retryable: true, durationMs })
          if (outputLimit) return finish({ status: 'failed', errorCode: 'OUTPUT_LIMIT', retryable: false, durationMs })
          if (spawnError || code === null) return finish({ status: 'failed', errorCode: 'PROCESS_ERROR', retryable: true, durationMs })
          if (code !== 0) return finish({ status: 'failed', errorCode: 'PROCESS_EXIT', retryable: false, durationMs })
          finish({ status: 'completed', resultHash: hashJson(stdout.trim() || null), durationMs })
        })
        child.stdin.on('error', () => { spawnError = true })
        child.stdin.end(input)
      })
    },
  }
}
