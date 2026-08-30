import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { expect, it } from 'vitest'
import { sourceSnapshot } from '../src/source.js'

it('ignores untracked directories while hashing untracked files', async () => {
  const root = mkdtempSync(join(tmpdir(), 'agentskit-harness-source-'))
  const git = (args: string[]) => execFileSync('git', ['-C', root, ...args], { stdio: 'pipe' })
  git(['init', '-q'])
  git(['config', 'user.email', 'harness@example.invalid'])
  git(['config', 'user.name', 'Harness'])
  writeFileSync(join(root, 'tracked.txt'), 'tracked')
  git(['add', '.'])
  git(['commit', '-qm', 'fixture'])
  mkdirSync(join(root, 'node_modules/package'), { recursive: true })
  writeFileSync(join(root, 'node_modules/package/index.js'), 'temporary')
  writeFileSync(join(root, 'untracked.txt'), 'evidence')

  const snapshot = await sourceSnapshot(root, join(root, '.codex/verification'))

  expect(snapshot.statusHash).toMatch(/^[a-f0-9]{64}$/)
})
