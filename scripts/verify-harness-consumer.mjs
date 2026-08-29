import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const packageRoot = resolve(import.meta.dirname, '../packages/harness')
const consumerRoot = mkdtempSync(join(tmpdir(), 'agentskit-harness-consumer-'))
const run = (command, args, cwd) => {
  const result = spawnSync(command, args, { cwd, encoding: 'utf8' })
  if (result.status !== 0) throw new Error(`${command} ${args.join(' ')} failed: ${result.stderr || result.stdout}`)
  return result.stdout.trim()
}

try {
  const packedName = run('npm', ['pack', '--pack-destination', consumerRoot, '--silent'], packageRoot)
  const tarball = join(consumerRoot, packedName.split(/\r?\n/).at(-1))
  if (!existsSync(tarball)) throw new Error(`npm pack did not produce ${tarball}`)
  run('npm', ['init', '-y', '--silent'], consumerRoot)
  run('npm', ['install', '--ignore-scripts', '--no-audit', '--no-fund', tarball], consumerRoot)
  const probe = "import { STATES, LEGAL_TRANSITIONS } from '@agentskit/harness'; if (!STATES.includes('AWAITING_HUMAN_APPROVAL') || !LEGAL_TRANSITIONS.VERIFYING.includes('AWAITING_HUMAN_APPROVAL')) process.exit(1)"
  run(process.execPath, ['--input-type=module', '-e', probe], consumerRoot)
  run(join(consumerRoot, 'node_modules/.bin/ak-harness'), ['--version'], consumerRoot)
  run(join(consumerRoot, 'node_modules/.bin/ak-verify'), ['--help'], consumerRoot)
  console.log(JSON.stringify({ status: 'passed', criteria: ['package'] }))
} catch (error) {
  console.log(JSON.stringify({ status: 'failed', criteria: ['package'], failures: [error instanceof Error ? error.message : String(error)] }))
  process.exitCode = 1
} finally {
  rmSync(consumerRoot, { recursive: true, force: true })
}
