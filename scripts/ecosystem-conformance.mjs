// One bounded command that validates the cross-ecosystem contracts locally.
// Reuses existing commands (gates, onboarding proof, Doc Bridge, harness) and
// prints criterion-level JSON evidence. Fails closed: any failed, timed-out,
// over-limit, or unsupported criterion exits non-zero.
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { isMainModule, moduleDir, removePath, safeEnv, spawnProcess, tempDir } from '@agentskit/cross-platform'

const root = resolve(moduleDir(import.meta.url), '..')

export const LIMITS = Object.freeze({
  criterionTimeoutMs: 180_000,
  totalTimeoutMs: 600_000,
  outputBytes: 64 * 1024,
  maxOldSpaceMb: 512,
  concurrency: 1,
  network: 'offline (best effort: offline flags and a dead proxy; not a sandbox)',
})

export const PROTOCOL_CHILD = 'scripts/conformance-protocol-child.mjs'
const FAKE_TOKEN = 'AKIA1234567890ABCDEF' // allow-secret: synthetic redaction probe

function childEnv() {
  const dead = 'http://127.0.0.1:9'
  return safeEnv({
    extra: {
      NODE_OPTIONS: `--max-old-space-size=${LIMITS.maxOldSpaceMb}`,
      npm_config_offline: 'true',
      HTTP_PROXY: dead,
      HTTPS_PROXY: dead,
      ALL_PROXY: dead,
      NO_PROXY: '',
      CI: 'true',
    },
  })
}

async function collect(stream, cap) {
  if (!stream) return { text: '', truncated: false }
  const chunks = []
  let size = 0
  let truncated = false
  for await (const chunk of stream) {
    if (size < cap) chunks.push(chunk.subarray(0, cap - size))
    else truncated = true
    size += chunk.length
    if (size > cap) truncated = true
  }
  return { text: Buffer.concat(chunks).toString('utf8'), truncated }
}

/** Run one command under the limits; never throws. */
export async function runBounded(command, args, { cwd = root, timeoutMs = LIMITS.criterionTimeoutMs, env = childEnv() } = {}) {
  let child
  try {
    child = spawnProcess(command, args, { cwd, env, stdin: 'ignore', stdout: 'pipe', stderr: 'pipe', timeoutMs, killGraceMs: 1000 })
  } catch (error) {
    return { code: null, termination: 'spawn-error', output: String(error.message), truncated: false }
  }
  const [out, err, status] = await Promise.all([
    collect(child.stdout, LIMITS.outputBytes),
    collect(child.stderr, LIMITS.outputBytes),
    child.exited.catch((error) => ({ code: null, termination: 'spawn-error', error })),
  ])
  return {
    code: status.code,
    termination: status.termination ?? null,
    output: `${out.text}${err.text}`,
    truncated: out.truncated || err.truncated,
  }
}

const NODE = process.execPath

function commandCriterion(id, group, command, args) {
  return {
    id,
    group,
    async run() {
      const r = await runBounded(command, args)
      if (r.termination) return { status: 'failed', failures: [`${r.termination} after ${LIMITS.criterionTimeoutMs}ms limit`] }
      if (r.truncated) return { status: 'failed', failures: [`output exceeded ${LIMITS.outputBytes} bytes`] }
      if (r.code !== 0) return { status: 'failed', failures: [`exit ${r.code}: ${command} ${args.join(' ')}`] }
      return { status: 'passed', failures: [] }
    },
  }
}

async function withTempDir(fn) {
  const dir = mkdtempSync(join(tempDir(), 'playbook-conformance-'))
  let result
  try {
    result = await fn(dir)
  } finally {
    await removePath(dir)
  }
  return { ...result, cleanup: { removed: !existsSync(dir), kind: 'temp-dir' } }
}

export const CRITERIA = [
  {
    id: 'lifecycle-protocol',
    group: 'lifecycle',
    // Shared AgentsKit Chat turn fixtures decoded by the shared protocol decoder.
    async run() {
      const r = await runBounded(NODE, [PROTOCOL_CHILD])
      if (r.termination) return { status: 'failed', failures: [`${r.termination} after ${LIMITS.criterionTimeoutMs}ms limit`] }
      if (r.truncated) return { status: 'failed', failures: [`output exceeded ${LIMITS.outputBytes} bytes`] }
      let report
      try {
        report = JSON.parse(r.output)
      } catch {
        return { status: 'failed', failures: [`protocol child exit ${r.code}: unparseable output`] }
      }
      const failures = report.failures ?? []
      if (r.code !== 0 && failures.length === 0) failures.push(`protocol child exit ${r.code}`)
      return { status: failures.length ? 'failed' : 'passed', failures }
    },
  },
  {
    id: 'lifecycle-cancellation',
    group: 'lifecycle',
    // @agentskit/chat@0.6.0 publishes no cancellation fixture; fail closed.
    async run() {
      return { status: 'unsupported', failures: ['missing upstream fixture: @agentskit/chat/protocol/fixtures has no cancellation (cancel/abort turn event) fixture'] }
    },
  },
  {
    id: 'runner-cancellation',
    group: 'lifecycle',
    // The runner's own bound: a runaway child must be killed at the timeout.
    async run() {
      const r = await runBounded(NODE, ['-e', 'setInterval(() => {}, 1000)'], { timeoutMs: 500 })
      return r.termination === 'timeout'
        ? { status: 'passed', failures: [] }
        : { status: 'failed', failures: [`runaway child was not terminated (termination=${r.termination})`] }
    },
  },
  {
    id: 'redaction',
    group: 'trust-boundary',
    async run() {
      const gate = join(root, 'packages/playbook/gates/check-secrets.mjs')
      return withTempDir(async (dir) => {
        mkdirSync(join(dir, 'src'))
        writeFileSync(join(dir, 'src', 'clean.ts'), 'export const answer = 42\n')
        const clean = await runBounded(NODE, [gate], { cwd: dir })
        writeFileSync(join(dir, 'src', 'leak.ts'), `export const credential = "${FAKE_TOKEN}"\n`)
        const leak = await runBounded(NODE, [gate], { cwd: dir })
        const failures = []
        if (clean.code !== 0) failures.push('clean fixture was rejected by the secrets gate')
        if (leak.code !== 1) failures.push(`secret fixture was not rejected (exit ${leak.code})`)
        if (leak.output.includes(FAKE_TOKEN)) failures.push('secret value leaked into gate output')
        if (!/value redacted/.test(leak.output)) failures.push('gate output does not state the value was redacted')
        return { status: failures.length ? 'failed' : 'passed', failures }
      })
    },
  },
  {
    id: 'trust-boundary-evidence',
    group: 'trust-boundary',
    // No AgentsKit package publishes a shared boundary evidence contract yet; fail closed.
    async run() {
      return { status: 'unsupported', failures: ['missing upstream contract: no shared trust-boundary evidence contract is published by AgentsKit'] }
    },
  },
  commandCriterion('clean-consumer', 'consumer', 'pnpm', ['test:onboarding']),
  commandCriterion('doc-bridge-config', 'documentation', 'pnpm', ['check:doc-bridge-config']),
  commandCriterion('doc-bridge-index', 'documentation', 'pnpm', ['docs:bridge:index']),
  commandCriterion('doc-bridge-gate', 'documentation', 'pnpm', ['docs:bridge:gate']),
  commandCriterion('harness-doctor', 'documentation', 'pnpm', ['harness:doctor']),
]

async function revisions() {
  const out = {}
  const head = await runBounded('git', ['rev-parse', 'HEAD'], { timeoutMs: 10_000 })
  out.playbook = head.code === 0 ? head.output.trim() : 'unknown'
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
  for (const name of Object.keys({ ...pkg.dependencies, ...pkg.devDependencies }).filter((n) => n.startsWith('@agentskit/')).sort()) {
    try {
      out[name] = JSON.parse(readFileSync(join(root, 'node_modules', name, 'package.json'), 'utf8')).version
    } catch {
      out[name] = 'not-installed'
    }
  }
  return out
}

/** Run every criterion in order and return the evidence document. */
export async function runConformance({ criteria = CRITERIA, totalTimeoutMs = LIMITS.totalTimeoutMs, now = Date.now } = {}) {
  const deadline = now() + totalTimeoutMs
  const results = []
  for (const criterion of criteria) {
    let outcome
    if (now() >= deadline) outcome = { status: 'failed', failures: ['total time budget exhausted before running'] }
    else {
      try {
        outcome = await criterion.run()
      } catch (error) {
        outcome = { status: 'failed', failures: [`runner error: ${error.message}`] }
      }
    }
    results.push({
      id: criterion.id,
      group: criterion.group,
      status: outcome.status,
      failures: outcome.failures ?? [],
      cleanup: outcome.cleanup ?? { removed: true, kind: 'none' },
    })
  }
  const passed = results.every((r) => r.status === 'passed')
  return {
    schemaVersion: 1,
    command: 'pnpm conformance',
    status: passed ? 'passed' : 'failed',
    revisions: await revisions(),
    limits: LIMITS,
    unsupported: results.filter((r) => r.status === 'unsupported').map((r) => r.id),
    criteria: results,
  }
}

if (isMainModule(import.meta.url)) {
  const evidence = await runConformance()
  const json = `${JSON.stringify(evidence, null, 2)}\n`
  const outIndex = process.argv.indexOf('--out')
  if (outIndex > 0 && process.argv[outIndex + 1]) writeFileSync(resolve(process.argv[outIndex + 1]), json)
  process.stdout.write(json)
  // --allow-unsupported: exit 0 when the only non-passing criteria are unsupported (still listed in the evidence).
  const onlyUnsupported = evidence.criteria.every((c) => c.status === 'passed' || c.status === 'unsupported')
  process.exit(evidence.status === 'passed' || (process.argv.includes('--allow-unsupported') && onlyUnsupported) ? 0 : 1)
}
