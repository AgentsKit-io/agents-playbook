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

export interface DockerMount {
  readonly source: string
  readonly target: string
  readonly readOnly?: boolean
}

export interface DockerToolDefinition {
  readonly toolId: string
  readonly image: string
  readonly command: readonly string[]
  readonly args?: readonly string[]
  readonly cwd?: string
  readonly env?: Readonly<Record<string, string>>
  readonly mounts?: readonly DockerMount[]
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

const positiveNumber = (value: number | string, label: string): string => {
  const normalized = String(value).trim()
  if (!normalized || !/^(?:\d+(?:\.\d+)?|\.\d+)$/.test(normalized) || Number(normalized) <= 0) fail(`${label} must be positive.`, 'INVALID_INPUT')
  return normalized
}

const absolutePath = (value: string, label: string): string => {
  const normalized = required(value, label)
  if (!normalized.startsWith('/') || normalized.includes(',')) fail(`${label} must be an absolute path without commas.`, 'INVALID_INPUT')
  return normalized
}

const dockerEnvironment = (env: Readonly<Record<string, string>> | undefined, label: string): readonly string[] => {
  if (env === undefined) return []
  if (typeof env !== 'object' || env === null || Array.isArray(env)) fail(`${label} must be an object.`, 'INVALID_INPUT')
  return Object.entries(env).map(([key, value]) => {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key) || typeof value !== 'string') fail(`${label} must contain valid string environment entries.`, 'INVALID_INPUT')
    return `${key}=${value}`
  })
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

export const createDockerToolRuntime = ({
  tools,
  timeoutMs = 30_000,
  maxOutputBytes = 1_048_576,
  dockerCommand = 'docker',
  memoryLimit = '512m',
  cpus = 1,
  pidsLimit = 128,
  user = '65532:65532',
  pull = 'never',
}: {
  readonly tools: readonly DockerToolDefinition[]
  readonly timeoutMs?: number
  readonly maxOutputBytes?: number
  readonly dockerCommand?: string
  readonly memoryLimit?: string
  readonly cpus?: number | string
  readonly pidsLimit?: number
  readonly user?: string
  readonly pull?: 'never' | 'missing' | 'always'
}): ToolRuntime => {
  if (!Array.isArray(tools)) fail('Docker runtime tools must be an array.', 'INVALID_INPUT')
  const command = required(dockerCommand, 'dockerCommand')
  const memory = required(memoryLimit, 'memoryLimit')
  const cpu = positiveNumber(cpus, 'cpus')
  if (!Number.isInteger(pidsLimit) || pidsLimit < 1) fail('pidsLimit must be a positive integer.', 'INVALID_INPUT')
  const normalizedUser = required(user, 'user')
  if (normalizedUser.includes(' ')) fail('user must not contain spaces.', 'INVALID_INPUT')
  if (pull !== 'never' && pull !== 'missing' && pull !== 'always') fail('pull must be never, missing, or always.', 'INVALID_INPUT')
  const normalized = tools.map((tool, index) => {
    if (typeof tool !== 'object' || tool === null || Array.isArray(tool)) fail(`tools[${index}] must be an object.`, 'INVALID_INPUT')
    const toolId = required(tool.toolId, `tools[${index}].toolId`)
    const image = required(tool.image, `tools[${index}].image`)
    if (!Array.isArray(tool.command) || tool.command.length === 0 || tool.command.some((part) => typeof part !== 'string' || !part.trim())) fail(`tools[${index}].command must be a non-empty string array.`, 'INVALID_INPUT')
    if (tool.args !== undefined && (!Array.isArray(tool.args) || tool.args.some((arg) => typeof arg !== 'string'))) fail(`tools[${index}].args must contain strings.`, 'INVALID_INPUT')
    const env = dockerEnvironment(tool.env, `tools[${index}].env`)
    if (tool.mounts !== undefined && !Array.isArray(tool.mounts)) fail(`tools[${index}].mounts must be an array.`, 'INVALID_INPUT')
    const mounts = (tool.mounts ?? []).map((mount, mountIndex) => {
      if (typeof mount !== 'object' || mount === null || Array.isArray(mount)) fail(`tools[${index}].mounts[${mountIndex}] must be an object.`, 'INVALID_INPUT')
      const source = absolutePath(mount.source, `tools[${index}].mounts[${mountIndex}].source`)
      const target = absolutePath(mount.target, `tools[${index}].mounts[${mountIndex}].target`)
      if (mount.readOnly !== undefined && typeof mount.readOnly !== 'boolean') fail(`tools[${index}].mounts[${mountIndex}].readOnly must be boolean.`, 'INVALID_INPUT')
      return `type=bind,src=${source},dst=${target}${mount.readOnly === false ? '' : ',readonly'}`
    })
    return {
      toolId,
      command,
      args: [
        'run', '--rm', '--init', '--pull', pull, '--network', 'none', '--read-only', '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges',
        '--pids-limit', String(pidsLimit), '--memory', memory, '--cpus', cpu, '--user', normalizedUser,
        ...(tool.cwd ? ['--workdir', absolutePath(tool.cwd, `tools[${index}].cwd`)] : []),
        ...env.flatMap((entry) => ['--env', entry]),
        ...mounts.flatMap((mount) => ['--mount', mount]),
        image,
        ...tool.command,
        ...(tool.args ?? []),
      ],
    }
  })
  if (new Set(normalized.map((tool) => tool.toolId)).size !== normalized.length) fail('Docker runtime tools must have unique ids.', 'INVALID_INPUT')
  return createProcessToolRuntime({ tools: normalized, timeoutMs, maxOutputBytes })
}
