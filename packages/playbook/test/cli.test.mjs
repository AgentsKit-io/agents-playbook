import { execFile } from 'node:child_process'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { promisify } from 'node:util'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import assert from 'node:assert/strict'

const execute = promisify(execFile)
const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const cli = resolve(packageRoot, 'bin/agents-playbook.mjs')

async function fixture(source) {
  const root = await mkdtemp(join(tmpdir(), 'agents-playbook-cli-'))
  await mkdir(join(root, 'src'))
  await writeFile(join(root, 'src', 'index.ts'), source)
  return root
}

test('renders help and version', async () => {
  const help = await execute(process.execPath, [cli, '--help'])
  const version = await execute(process.execPath, [cli, '--version'])
  assert.match(help.stdout, /@agentskit\/playbook run/)
  assert.equal(version.stdout, '0.1.0\n')
})

test('lists every gate as JSON', async () => {
  const result = await execute(process.execPath, [cli, 'list', '--json'])
  const gates = JSON.parse(result.stdout)
  assert.equal(gates.length, 12)
  assert.ok(gates.some((gate) => gate.name === 'no-any'))
})

test('runs a selected gate against an isolated repository', async () => {
  const root = await fixture('export const answer: number = 42\n')
  try {
    const result = await execute(process.execPath, [cli, 'run', 'no-any', '--cwd', root])
    assert.match(result.stdout, /PASS no-any/)
    assert.match(result.stdout, /1\/1 gates passed/)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('explicit gate names take precedence over the fast subset', async () => {
  const root = await fixture('export const unsafe: any = 42\n')
  try {
    await assert.rejects(
      execute(process.execPath, [cli, 'run', 'no-any', '--fast', '--cwd', root]),
      (error) => error.code === 1 && /FAIL no-any/.test(error.stdout),
    )
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('returns a failure when a gate finds a violation', async () => {
  const root = await fixture('export const unsafe: any = 42\n')
  try {
    await assert.rejects(
      execute(process.execPath, [cli, 'run', 'no-any', '--cwd', root]),
      (error) => error.code === 1 && /FAIL no-any/.test(error.stdout) && /any.*type position/.test(error.stderr),
    )
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('detects any in a type alias', async () => {
  const root = await fixture('export type Unsafe = any\n')
  try {
    await assert.rejects(
      execute(process.execPath, [cli, 'run', 'no-any', '--cwd', root]),
      (error) => error.code === 1 && /FAIL no-any/.test(error.stdout),
    )
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('enforces the no-any escape-hatch budget', async () => {
  const root = await fixture('export const unsafe: any = 42 // allow-any: legacy\n')
  try {
    await assert.rejects(
      execute(process.execPath, [cli, 'run', 'no-any', '--cwd', root]),
      (error) => error.code === 1 && /escape-hatch budget exceeded/.test(error.stderr),
    )
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('accepts a file exactly at its line budget', async () => {
  const root = await fixture('export const line = 1\n'.repeat(500))
  try {
    const result = await execute(process.execPath, [cli, 'run', 'file-size', '--cwd', root])
    assert.match(result.stdout, /PASS file-size/)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('compiles configured regex source strings', async () => {
  const root = await fixture('export const color = "#ffffff"\n')
  try {
    await writeFile(join(root, '.quality-gates.json'), JSON.stringify({ gates: { tokens: { exempt: ['src/index\\.ts$'] } } }))
    const result = await execute(process.execPath, [cli, 'run', 'tokens', '--cwd', root])
    assert.match(result.stdout, /PASS tokens/)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('redacts detected secrets', async () => {
  const token = 'AKIA1234567890ABCDEF'
  const root = await fixture(`export const credential = "${token}"\n`)
  try {
    await assert.rejects(
      execute(process.execPath, [cli, 'run', 'secrets', '--cwd', root]),
      (error) => error.code === 1 && /value redacted/.test(error.stderr) && !error.stderr.includes(token),
    )
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('rejects secret scan paths outside the repository', async () => {
  const root = await fixture('export const answer = 42\n')
  try {
    await writeFile(join(root, '.quality-gates.json'), JSON.stringify({ gates: { secrets: { scan: ['../'] } } }))
    await assert.rejects(
      execute(process.execPath, [cli, 'run', 'secrets', '--cwd', root]),
      (error) => error.code === 1 && /escapes the repository/.test(error.stderr),
    )
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('detects native elements in normalized surface paths', async () => {
  const root = await mkdtemp(join(tmpdir(), 'agents-playbook-cli-'))
  try {
    await mkdir(join(root, 'apps', 'web', 'components'), { recursive: true })
    await writeFile(join(root, 'apps', 'web', 'components', 'button.tsx'), 'export function Button() { return <button>Go</button> }\n')
    await assert.rejects(
      execute(process.execPath, [cli, 'run', 'native-html', '--cwd', root]),
      (error) => error.code === 1 && /native <button>/.test(error.stderr),
    )
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('rejects unknown gates with an actionable usage error', async () => {
  await assert.rejects(
    execute(process.execPath, [cli, 'run', 'missing']),
    (error) => error.code === 2 && /agents-playbook list/.test(error.stderr),
  )
})

test('forwards the PR intent base and fails closed when it is invalid', async () => {
  const root = await fixture('export const answer: number = 42\n')
  try {
    await writeFile(join(root, 'pr-intent.yaml'), 'summary: test\npillar: quality\nphase: test\nsub-unit: cli\ntype: feature\n')
    await assert.rejects(
      execute(process.execPath, [cli, 'run', 'pr-intent', '--base=missing-ref', '--cwd', root]),
      (error) => error.code === 1 && /diff unverified/.test(error.stdout) === false && /Could not run git diff/.test(error.stderr),
    )
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('prints completions for bash, zsh, and fish', async () => {
  for (const shell of ['bash', 'zsh', 'fish']) {
    const result = await execute(process.execPath, [cli, 'completion', shell])
    assert.match(result.stdout, /agents-playbook/)
  }
})
