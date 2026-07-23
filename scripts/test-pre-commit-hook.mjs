import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { chmod, copyFile, mkdir, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { promisify } from 'node:util'
import { resolveNpxCommand } from './resolve-npx-command.mjs'

const execute = promisify(execFile)
const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const preCommit = process.env.PRE_COMMIT ?? 'pre-commit'

async function git(cwd, ...args) {
  return execute('git', args, { cwd })
}

async function initializeRepository(cwd) {
  await git(cwd, 'init', '--initial-branch=main')
  await git(cwd, 'config', 'user.name', 'AgentsKit CI')
  await git(cwd, 'config', 'user.email', 'ci@agentskit.io')
}

async function commitAll(cwd, message) {
  await git(cwd, 'add', '.')
  await git(cwd, 'commit', '-m', message)
}

function consumerConfig(provider, revision, args) {
  const lines = [
    'repos:',
    `  - repo: ${pathToFileURL(provider).href}`,
    `    rev: ${revision}`,
    '    hooks:',
    '      - id: agentskit-playbook',
  ]
  if (args.length > 0) lines.push(`        args: [${args.join(', ')}]`)
  return `${lines.join('\n')}\n`
}

const temporaryRoot = await mkdtemp(join(tmpdir(), 'agentskit-playbook-pre-commit-'))
const provider = join(temporaryRoot, 'provider')
const consumer = join(temporaryRoot, 'consumer')

try {
  const simulatedWindowsNode = join(temporaryRoot, 'node', 'node.exe')
  const simulatedWindowsNpx = join(temporaryRoot, 'node', 'node_modules', 'npm', 'bin', 'npx-cli.js')
  await mkdir(dirname(simulatedWindowsNpx), { recursive: true })
  await writeFile(simulatedWindowsNpx, '')
  assert.deepEqual(
    resolveNpxCommand({ platform: 'win32', nodeExecutable: simulatedWindowsNode }),
    { command: simulatedWindowsNode, args: [simulatedWindowsNpx] },
  )

  await mkdir(provider)
  await mkdir(consumer)
  await copyFile(join(repositoryRoot, '.pre-commit-hooks.yaml'), join(provider, '.pre-commit-hooks.yaml'))
  await mkdir(join(provider, 'scripts'))
  await copyFile(
    join(repositoryRoot, 'scripts', 'run-pre-commit-hook.mjs'),
    join(provider, 'scripts', 'run-pre-commit-hook.mjs'),
  )
  await copyFile(
    join(repositoryRoot, 'scripts', 'resolve-npx-command.mjs'),
    join(provider, 'scripts', 'resolve-npx-command.mjs'),
  )
  await chmod(join(provider, 'scripts', 'run-pre-commit-hook.mjs'), 0o755)
  await initializeRepository(provider)
  await commitAll(provider, 'test: add provider manifest')
  const { stdout: revisionOutput } = await git(provider, 'rev-parse', 'HEAD')
  const revision = revisionOutput.trim()

  await initializeRepository(consumer)
  await mkdir(join(consumer, 'src'))
  await writeFile(join(consumer, 'src', 'index.ts'), 'export const answer: number = 42\n')
  await writeFile(join(consumer, '.pre-commit-config.yaml'), consumerConfig(provider, revision, []))
  await commitAll(consumer, 'test: add clean fixture')

  await execute(preCommit, ['validate-manifest', join(provider, '.pre-commit-hooks.yaml')])
  const defaultRun = await execute(preCommit, ['run', '--all-files'], { cwd: consumer })
  assert.match(defaultRun.stdout, /AgentsKit Playbook quality gates.*Passed/s)

  await writeFile(join(consumer, '.pre-commit-config.yaml'), consumerConfig(provider, revision, ['no-any']))
  const customRun = await execute(preCommit, ['run', '--all-files'], { cwd: consumer })
  assert.match(customRun.stdout, /AgentsKit Playbook quality gates.*Passed/s)

  await writeFile(join(consumer, 'src', 'scratch.ts'), 'export type UntrackedUnsafe = any\n')
  const untrackedRun = await execute(preCommit, ['run', '--all-files'], { cwd: consumer })
  assert.match(untrackedRun.stdout, /AgentsKit Playbook quality gates.*Passed/s)

  await mkdir(join(consumer, 'src', 'api'))
  const externalViolation = join(temporaryRoot, 'outside.ts')
  const linkBlob = join(temporaryRoot, 'link-target.txt')
  await writeFile(externalViolation, "throw new Error('outside staged snapshot')\n")
  await writeFile(linkBlob, externalViolation)
  const { stdout: linkHashOutput } = await git(consumer, 'hash-object', '-w', linkBlob)
  await git(
    consumer,
    'update-index',
    '--add',
    '--cacheinfo',
    `120000,${linkHashOutput.trim()},src/api/leak.ts`,
  )
  await git(consumer, 'checkout-index', '--force', 'src/api/leak.ts')
  await writeFile(join(consumer, '.pre-commit-config.yaml'), consumerConfig(provider, revision, ['error-raw']))
  const symlinkRun = await execute(preCommit, ['run', '--all-files'], { cwd: consumer })
  assert.match(symlinkRun.stdout, /AgentsKit Playbook quality gates.*Passed/s)

  await writeFile(join(consumer, 'src', 'index.ts'), 'export type UnstagedUnsafe = any\n')
  await writeFile(join(consumer, '.pre-commit-config.yaml'), consumerConfig(provider, revision, ['no-any']))
  const unstagedRun = await execute(preCommit, ['run', '--all-files'], { cwd: consumer })
  assert.match(unstagedRun.stdout, /AgentsKit Playbook quality gates.*Passed/s)

  await git(consumer, 'add', 'src/index.ts')
  await assert.rejects(
    execute(preCommit, ['run', '--all-files'], { cwd: consumer }),
    (error) => error.code === 1 && /AgentsKit Playbook quality gates.*Failed/s.test(error.stdout) && /FAIL no-any/.test(error.stdout),
  )

  const failedCheckoutTemp = join(temporaryRoot, 'failed-checkout-temp')
  await mkdir(failedCheckoutTemp)
  await assert.rejects(
    execute(process.execPath, [join(repositoryRoot, 'scripts', 'run-pre-commit-hook.mjs')], {
      cwd: temporaryRoot,
      env: {
        ...process.env,
        TMPDIR: failedCheckoutTemp,
        TEMP: failedCheckoutTemp,
        TMP: failedCheckoutTemp,
      },
    }),
    (error) => error.code !== 0,
  )
  assert.deepEqual(await readdir(failedCheckoutTemp), [])

  process.stdout.write(
    'pre-commit provider: manifest, defaults, overrides, hermetic staged isolation, cleanup, and failure propagation passed.\n',
  )
} finally {
  await rm(temporaryRoot, { recursive: true, force: true })
}
