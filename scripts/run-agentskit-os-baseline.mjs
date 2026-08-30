#!/usr/bin/env node
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { chmodSync, cpSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { pathToFileURL } from 'node:url'
import { loadBenchmarkManifest } from '../packages/harness/dist/index.js'

const arg = (name, fallback) => {
  const index = process.argv.indexOf(name)
  return index === -1 ? fallback : process.argv[index + 1]
}
const root = resolve(import.meta.dirname, '..')
const osRoot = resolve(arg('--target', process.env.AGENTSKIT_OS_ROOT ?? ''))
const manifest = loadBenchmarkManifest(resolve(root, arg('--manifest', 'benchmarks/agentskit-os-phase-28.json')))
const taskId = arg('--task-id')
const tasks = taskId ? manifest.tasks.filter((task) => task.id === taskId) : manifest.tasks
if (taskId && tasks.length !== 1) throw new Error(`unknown benchmark task: ${taskId}`)
const outputDir = resolve(root, arg('--output', 'benchmarks/agentskit-os-phase-29-baseline'))
const harnessMode = process.argv.includes('--harness')
const harnessCli = resolve(root, 'packages/harness/dist/cli.js')
const providerIds = (arg('--provider', process.env.AGENTSKIT_OS_PROVIDER ?? 'codex') ?? 'codex').split(',').map((value) => value.trim()).filter(Boolean)
if (!process.env.AGENTSKIT_OS_ROOT && !arg('--target')) throw new Error('--target or AGENTSKIT_OS_ROOT is required.')
if (!providerIds.length) throw new Error('at least one provider is required.')

const fixture = join(osRoot, 'packages/os-templates/templates/coding/dev-orchestrator-benchmark-demo/fixtures')
const providerModule = await import(pathToFileURL(join(osRoot, 'packages/os-coding-agents/dist/index.js')).href)
const orchestratorModule = await import(pathToFileURL(join(osRoot, 'packages/os-dev-orchestrator/dist/index.js')).href)
const vitest = resolve(arg('--vitest', join(osRoot, 'node_modules/.bin/vitest')))
mkdirSync(outputDir, { recursive: true })

const hashFile = (path) => createHash('sha256').update(readFileSync(path)).digest('hex')
const taskKind = (kind) => kind === 'test' ? 'add-test' : kind
const writeFixtureTests = (runRoot) => {
  mkdirSync(join(runRoot, 'tests'), { recursive: true })
  writeFileSync(join(runRoot, 'tests/slice-window.test.ts'), `import { describe, expect, it } from 'vitest'\nimport { slidingWindow } from '../src/slice-window'\n\ndescribe('slidingWindow', () => {\n  it('returns the happy path', () => { expect(slidingWindow([1, 2, 3], 2)).toEqual([[1, 2]]) })\n})\n`)
  writeFileSync(join(runRoot, 'tests/format-report.test.ts'), `import { expect, it } from 'vitest'\nimport { formatReport } from '../src/format-report'\n\nit('keeps compact JSON as the default', () => { const report = { providerId: 'codex', status: 'ok', costUsd: 0, durationMs: 1 }; expect(formatReport(report)).toBe(JSON.stringify(report)) })\n`)
}
const gitInit = (runRoot) => {
  const git = (args) => execFileSync('git', ['-C', runRoot, ...args], { encoding: 'utf8', stdio: 'pipe' })
  git(['init', '-q'])
  git(['config', 'user.email', 'harness-phase-29@example.invalid'])
  git(['config', 'user.name', 'Harness Phase 29'])
  git(['add', '.'])
  git(['commit', '-qm', 'fixture baseline'])
}
const writeBaselineContract = (runRoot, task, stateDir = '.codex/verification/baseline') => {
  mkdirSync(join(runRoot, '.codex'), { recursive: true })
  writeFileSync(join(runRoot, '.codex/verification.json'), JSON.stringify({
    schemaVersion: 1,
    project: `agentskit-os-baseline-${task.id}`,
    root: '..',
    stateDir,
    profile: 'strict',
    contract: { intent: `Complete baseline task ${task.id}.`, scope: { inScope: [`task:${task.id}`], outOfScope: ['unrelated changes'] }, ambiguities: [], outcomes: [{ id: 'task', statement: 'Complete the task and its fixture tests.', checks: ['fixture-tests'] }] },
    surfaces: { logic: true, endpoint: { required: false, reason: 'No endpoint.' }, database: { required: false, reason: 'No database.' }, cli: { required: false, reason: 'No CLI.' }, mcp: { required: false, reason: 'No MCP.' }, ui: { required: false, reason: 'No UI.' }, docs: { required: false, reason: 'No docs.' } },
    checks: [{ id: 'fixture-tests', category: 'logic', command: `${vitest} run --reporter=dot && node -e \"console.log(JSON.stringify({status:'passed',criteria:['task']}))\"`, evidence: 'structured' }],
    tracking: { required: false, reason: 'Baseline is local and not tracked externally.' },
  }, null, 2) + '\n')
}
const writeHarnessCliShim = (runRoot) => {
  const bin = join(runRoot, '.codex/bin/ak-verify')
  mkdirSync(join(runRoot, '.codex/bin'), { recursive: true })
  writeFileSync(bin, `#!/bin/sh\nexec "${process.execPath}" "${harnessCli}" --config "${join(runRoot, '.codex/verification.json')}" "$@"\n`)
  chmodSync(bin, 0o755)
}
const prepareHarnessLifecycle = (runRoot, allowDirty = false) => {
  const config = join(runRoot, '.codex/verification.json')
  execFileSync(process.execPath, [harnessCli, '--config', config, 'plan', 'prepared', '--by', 'ci', ...(allowDirty ? ['--allow-dirty'] : [])], { cwd: runRoot, encoding: 'utf8', stdio: 'pipe' })
  execFileSync(process.execPath, [harnessCli, '--config', config, 'start'], { cwd: runRoot, encoding: 'utf8', stdio: 'pipe' })
}
const verifyFinalHarnessLifecycle = (runRoot, task) => {
  writeBaselineContract(runRoot, task, '.codex/verification/final')
  prepareHarnessLifecycle(runRoot, true)
  const config = join(runRoot, '.codex/verification.json')
  try {
    return JSON.parse(execFileSync(process.execPath, [harnessCli, '--config', config, 'verify', '--json'], { cwd: runRoot, encoding: 'utf8' }).trim().split(/\r?\n/).at(-1))
  } catch (error) {
    return { state: 'BLOCKED', error: error instanceof Error ? error.message : String(error) }
  }
}
const providersFor = (runRoot) => providerIds.map((providerId) => providerModule.createBuiltinCodingAgentProvider(providerId, { env: { PATH: `${join(runRoot, '.codex/bin')}:${process.env.PATH ?? ''}` } }))
const runTests = (runRoot) => {
  const result = execFileSync(vitest, ['run', '--reporter=dot'], { cwd: runRoot, encoding: 'utf8', env: { ...process.env, CI: '1' }, stdio: 'pipe' })
  return { status: 'passed', command: `${vitest} run --reporter=dot`, exitCode: 0, output: result.slice(-2000) }
}
const validateTask = (task, runRoot, beforeSourceHash, testResult) => {
  const failures = []
  const sourcePath = join(runRoot, 'src/slice-window.ts')
  const formatterPath = join(runRoot, 'src/format-report.ts')
  const testsPath = join(runRoot, 'tests/slice-window.test.ts')
  if (task.id === 'bug-off-by-one' && !/i\s*<=\s*xs\.length\s*-\s*n/.test(readFileSync(sourcePath, 'utf8'))) failures.push('final-window implementation check failed')
  if (task.id === 'bug-off-by-one' && !readFileSync(testsPath, 'utf8').includes('[3, 4]')) failures.push('regression test does not assert the final window')
  if (task.id === 'test-coverage-gap') {
    if (hashFile(sourcePath) !== beforeSourceHash) failures.push('source changed during test-only task')
    for (const token of ['empty', 'larger', '<=', 'exactly']) if (!readFileSync(testsPath, 'utf8').toLowerCase().includes(token)) failures.push(`boundary test marker missing: ${token}`)
  }
  if (task.id === 'feat-formatter' && !/pretty/.test(readFileSync(formatterPath, 'utf8'))) failures.push('pretty mode implementation check failed')
  if (task.id === 'feat-formatter' && !/pretty/.test(readFileSync(join(runRoot, 'tests/format-report.test.ts'), 'utf8'))) failures.push('pretty mode test check failed')
  return { status: failures.length ? 'failed' : testResult.status, command: testResult.command, exitCode: failures.length ? 1 : testResult.exitCode, failures }
}

const reports = []
for (const task of tasks) {
  const runRoot = mkdtempSync(join(tmpdir(), `agentskit-os-phase-29-${task.id}-`))
  cpSync(join(fixture, 'src'), join(runRoot, 'src'), { recursive: true })
  writeFixtureTests(runRoot)
  writeFileSync(join(runRoot, 'package.json'), JSON.stringify({ type: 'module', scripts: { test: 'vitest run' } }, null, 2))
  writeBaselineContract(runRoot, task)
  if (harnessMode) writeHarnessCliShim(runRoot)
  gitInit(runRoot)
  if (harnessMode) prepareHarnessLifecycle(runRoot)
  const beforeSourceHash = hashFile(join(runRoot, 'src/slice-window.ts'))
  const basePrompt = readFileSync(join(osRoot, task.prompt.path), 'utf8')
  const prompt = harnessMode ? `${basePrompt}\n\nAgentsKit Harness requirements:\n- inspect the task and its acceptance criteria before editing;\n- implement the complete task, including required tests;\n- run the relevant real validation commands before reporting completion;\n- if any criterion is not proven, report the delivery as incomplete and continue resolving it.\n\nAcceptance criteria:\n${task.acceptanceCriteria.map((criterion) => `- ${criterion}`).join('\n')}` : basePrompt
  const startedAt = Date.now()
  const report = await orchestratorModule.runCodingAgentBenchmark({ repoRoot: runRoot, providers: providersFor(runRoot), kind: taskKind(task.kind), prompt, dryRun: false, isolateWorktrees: false, timeoutMs: 180_000 })
  const row = report.rows[0]
  let testResult
  try { testResult = runTests(runRoot) } catch (error) { testResult = { status: 'failed', command: `${vitest} run --reporter=dot`, exitCode: error.status ?? 1, output: String(error.stdout ?? error.message ?? error) } }
  const validation = validateTask(task, runRoot, beforeSourceHash, testResult)
  const artifactValidated = validation.status === 'passed'
  const harnessVerification = harnessMode ? verifyFinalHarnessLifecycle(runRoot, task) : undefined
  const delegatedApprovalReady = harnessVerification?.state === 'AWAITING_HUMAN_APPROVAL'
  const deliveryComplete = artifactValidated && (row?.status === 'ok' || delegatedApprovalReady)
  const evidenceSource = relative(root, join(outputDir, `${task.id}.json`)).replaceAll('\\', '/')
  const evidence = task.acceptanceCriteria.map((criterion) => ({ criterion, status: artifactValidated ? 'passed' : 'failed', source: evidenceSource }))
  const observation = { type: 'agentskit-harness-baseline-observation', schemaVersion: 1, suiteId: manifest.suiteId, taskId: task.id, sourceRevision: manifest.provenance?.revision, providerIds, recordedAt: new Date().toISOString(), attempts: 1, durationMs: row?.durationMs ?? Date.now() - startedAt, status: deliveryComplete ? 'passed' : 'failed', escapedIncomplete: deliveryComplete ? 0 : 1, providerReport: report, ...(harnessVerification ? { harnessVerification } : {}), validation, evidence, criteria: deliveryComplete ? ['task-delivery'] : [] }
  writeFileSync(join(outputDir, `${task.id}.json`), `${JSON.stringify(observation, null, 2)}\n`)
  reports.push({ taskId: task.id, status: observation.status, durationMs: observation.durationMs, escapedIncomplete: observation.escapedIncomplete })
}
const allPassed = reports.every((report) => report.status === 'passed')
console.log(JSON.stringify({ status: allPassed ? 'passed' : 'failed', criteria: allPassed ? ['task-delivery'] : [], suiteId: manifest.suiteId, providerIds, reports, outputDir }))
