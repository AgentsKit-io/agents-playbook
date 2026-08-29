import { execFile } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { relative, resolve } from 'node:path'
import { promisify } from 'node:util'
import { hashJson, sha256 } from './hash.js'
import type { SourceSnapshot } from './types.js'

const execFileAsync = promisify(execFile)
const git = async (root: string, args: readonly string[]): Promise<string> => {
  try { return (await execFileAsync('git', ['-C', root, ...args], { encoding: 'utf8' })).stdout.trim() } catch { return '' }
}

export const sourceSnapshot = async (root: string, stateDir: string): Promise<SourceSnapshot> => {
  const revision = await git(root, ['rev-parse', 'HEAD'])
  const stateRelative = relative(root, stateDir).replaceAll('\\', '/')
  const pathspec = ['--', '.']
  if (stateRelative && stateRelative !== '..' && !stateRelative.startsWith('../')) pathspec.push(`:(exclude)${stateRelative}`)
  const status = await git(root, ['status', '--porcelain=v1', '--untracked-files=all', ...pathspec])
  const diff = await git(root, ['diff', '--no-ext-diff', '--binary', 'HEAD', ...pathspec])
  const untrackedPaths = (await git(root, ['ls-files', '--others', '--exclude-standard', '-z'])).split('\0').filter(Boolean).filter((path) => !stateRelative || (path !== stateRelative && !path.startsWith(`${stateRelative}/`)))
  const untracked = untrackedPaths.map((path) => ({ path, hash: sha256(readFileSync(resolve(root, path))) }))
  const fingerprint = { revision, status, diff, untracked }
  return { revision: revision || `content:${hashJson(fingerprint)}`, status, statusHash: hashJson(fingerprint) }
}
