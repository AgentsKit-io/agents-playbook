import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const packageRoot = resolve(import.meta.dirname, '../packages/harness')
const cli = resolve(packageRoot, 'dist/cli.js')
const root = mkdtempSync(join(tmpdir(), 'agentskit-harness-context-cli-'))
const configPath = join(root, '.codex', 'verification.json')
const indexPath = join(root, '.doc-bridge', 'index.json')
const snapshotPath = join(root, 'context.json')
const run = (args) => {
  const result = spawnSync(process.execPath, [cli, ...args, '--config', configPath, '--json'], { cwd: root, encoding: 'utf8' })
  if (result.status !== 0) throw new Error(`ak-harness ${args.join(' ')} failed: ${result.stderr || result.stdout}`)
  return JSON.parse(result.stdout.trim().split(/\r?\n/).at(-1))
}

try {
  if (!existsSync(cli)) throw new Error(`missing built CLI: ${cli}`)
  mkdirSync(join(root, '.codex'), { recursive: true })
  mkdirSync(join(root, '.doc-bridge'), { recursive: true })
  writeFileSync(configPath, JSON.stringify({ schemaVersion: 1, project: 'context-cli-fixture', root: '..', profile: 'strict', contract: { intent: 'Exercise context CLI.', scope: { inScope: ['fixture'], outOfScope: ['production'] }, ambiguities: [], outcomes: [{ id: 'context-cli', statement: 'Context is attached.', checks: ['fixture-check'] }] }, surfaces: { logic: true, endpoint: { required: false, reason: 'fixture' }, database: { required: false, reason: 'fixture' }, cli: { required: false, reason: 'fixture' }, mcp: { required: false, reason: 'fixture' }, ui: { required: false, reason: 'fixture' }, docs: { required: false, reason: 'fixture' } }, checks: [{ id: 'fixture-check', category: 'logic', command: 'true', evidence: 'structured' }], tracking: { required: false, reason: 'fixture' } }, null, 2))
  writeFileSync(indexPath, JSON.stringify({ contentHash: 'b'.repeat(64), knowledge: [{ id: 'playbook-harness', path: 'content/docs/harness.mdx', title: 'Harness', description: 'Portable harness playbook context' }] }))
  const snapshot = run(['context', 'resolve', 'harness', '--scope', 'playbook'])
  if (snapshot.providerId !== 'doc-bridge' || snapshot.references.length !== 1 || snapshot.sourceHash !== 'b'.repeat(64)) throw new Error('context resolve did not return the indexed snapshot')
  writeFileSync(snapshotPath, JSON.stringify(snapshot, null, 2))
  const planned = run(['plan', 'approved', '--context-file', snapshotPath])
  if (!planned.contextHash || planned.contextSnapshots.length !== 1) throw new Error('plan did not attach the context snapshot')
  console.log(JSON.stringify({ status: 'passed', criteria: ['context-cli'], runId: planned.runId, contextHash: planned.contextHash }))
} catch (error) {
  console.log(JSON.stringify({ status: 'failed', criteria: ['context-cli'], failures: [error instanceof Error ? error.message : String(error)] }))
  process.exitCode = 1
} finally {
  rmSync(root, { recursive: true, force: true })
}
