import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fail } from './errors.js'
import type { LoadedConfig, VerificationRun } from './types.js'

export const readJson = (path: string): unknown => JSON.parse(readFileSync(path, 'utf8')) as unknown
export const writeJson = (path: string, value: unknown): void => {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

export const pathInside = (root: string, candidate: string): boolean => {
  const rel = relative(resolve(root), resolve(candidate))
  return rel === '' || (!rel.startsWith(`..${sep}`) && rel !== '..' && !rel.startsWith(sep))
}

export const latestPath = (stateDir: string): string => join(stateDir, 'latest.json')
export const runPath = (stateDir: string, runId: string): string => join(stateDir, 'runs', runId, 'run.json')
export const saveRun = (stateDir: string, run: VerificationRun): void => writeJson(runPath(stateDir, run.runId), run)
export const readRun = (stateDir: string, runId: string): VerificationRun => readJson(runPath(stateDir, runId)) as VerificationRun

export const loadLatestRun = (stateDir: string): VerificationRun | null => {
  if (!existsSync(latestPath(stateDir))) return null
  const pointer = readJson(latestPath(stateDir)) as { readonly runId: string }
  return readRun(stateDir, pointer.runId)
}

export const setLatest = (stateDir: string, run: VerificationRun): void => writeJson(latestPath(stateDir), {
  runId: run.runId,
  path: relative(resolve(stateDir, '..', '..'), runPath(stateDir, run.runId)),
  updatedAt: new Date().toISOString(),
})

export const cleanConfiguredArtifacts = (loaded: LoadedConfig): { readonly cleaned: readonly string[] } => {
  const roots = loaded.config.cleanup?.roots ?? []
  for (const root of roots) {
    const target = resolve(loaded.root, root)
    if (!pathInside(loaded.root, target)) fail(`Cleanup root escapes project root: ${root}`, 'INVALID_CONFIG')
    if (existsSync(target)) for (const entry of readdirSync(target)) rmSync(join(target, entry), { recursive: true, force: true })
  }
  return { cleaned: roots }
}

export const fileContents = (path: string): string => readFileSync(path, 'utf8')
