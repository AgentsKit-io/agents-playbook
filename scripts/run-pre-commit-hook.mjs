#!/usr/bin/env node
import { lstatSync, mkdtempSync, readlinkSync, rmSync, unlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'

const snapshot = mkdtempSync(join(tmpdir(), 'agentskit-playbook-staged-'))
const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx'
let exitCode = 1

function replaceStagedSymlinks() {
  const result = spawnSync('git', ['ls-files', '--stage', '-z'], { encoding: 'utf8' })
  if (result.error) throw result.error
  if (result.status !== 0) return result.status ?? 1

  for (const record of result.stdout.split('\0')) {
    if (!record.startsWith('120000 ')) continue
    const separator = record.indexOf('\t')
    if (separator === -1) continue
    const path = join(snapshot, record.slice(separator + 1))
    if (!lstatSync(path).isSymbolicLink()) continue
    const target = readlinkSync(path)
    unlinkSync(path)
    writeFileSync(path, target)
  }
  return 0
}

try {
  const checkout = spawnSync('git', ['checkout-index', '--all', `--prefix=${snapshot.replaceAll('\\', '/')}/`], {
    stdio: 'inherit',
  })
  if (checkout.error) throw checkout.error
  const normalized = checkout.status === 0 ? replaceStagedSymlinks() : checkout.status
  if (normalized === 0) {
    const result = spawnSync(
      npx,
      ['--yes', '@agentskit/playbook@0.1.0', 'run', ...process.argv.slice(2), '--cwd', snapshot],
      { stdio: 'inherit' },
    )
    if (result.error) throw result.error
    exitCode = result.status ?? 1
  } else {
    exitCode = normalized ?? 1
  }
} finally {
  rmSync(snapshot, { recursive: true, force: true })
}

process.exitCode = exitCode
