#!/usr/bin/env node
import { execFileSync, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { chmodSync, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { pathToFileURL } from 'node:url'
import { loadBenchmarkManifest, recordBenchmarkObservation } from '../packages/harness/dist/index.js'

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
const recordManifestPath = arg('--record-manifest') ? resolve(root, arg('--record-manifest')) : undefined
const repeatCount = Number(arg('--repeats', '1'))
const harnessMode = process.argv.includes('--harness')
const harnessCli = resolve(root, 'packages/harness/dist/cli.js')
const providerIds = (arg('--provider', process.env.AGENTSKIT_OS_PROVIDER ?? 'codex') ?? 'codex').split(',').map((value) => value.trim()).filter(Boolean)
if (!process.env.AGENTSKIT_OS_ROOT && !arg('--target')) throw new Error('--target or AGENTSKIT_OS_ROOT is required.')
if (!providerIds.length) throw new Error('at least one provider is required.')
if (!Number.isInteger(repeatCount) || repeatCount < 1) throw new Error('--repeats must be a positive integer.')
if (recordManifestPath && tasks.length !== manifest.tasks.length) throw new Error('--record-manifest requires all manifest tasks; remove --task-id.')

const fixture = join(osRoot, 'packages/os-templates/templates/coding/dev-orchestrator-benchmark-demo/fixtures')
const providerModule = await import(pathToFileURL(join(osRoot, 'packages/os-coding-agents/dist/index.js')).href)
const orchestratorModule = await import(pathToFileURL(join(osRoot, 'packages/os-dev-orchestrator/dist/index.js')).href)
const vitest = resolve(arg('--vitest', join(osRoot, 'node_modules/.bin/vitest')))
mkdirSync(outputDir, { recursive: true })

const hashFile = (path) => createHash('sha256').update(readFileSync(path)).digest('hex')
const median = (values) => {
  const sorted = [...values].sort((left, right) => left - right)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
}
const taskKind = (kind) => kind === 'test' ? 'add-test' : kind
const writeFixtureTests = (runRoot) => {
  mkdirSync(join(runRoot, 'tests'), { recursive: true })
  writeFileSync(join(runRoot, 'tests/slice-window.test.ts'), `import { describe, expect, it } from 'vitest'\nimport { slidingWindow } from '../src/slice-window'\n\ndescribe('slidingWindow', () => {\n  it('returns the happy path', () => { expect(slidingWindow([1, 2, 3], 2)).toEqual([[1, 2]]) })\n})\n`)
  writeFileSync(join(runRoot, 'tests/format-report.test.ts'), `import { expect, it } from 'vitest'\nimport { formatReport } from '../src/format-report'\n\nit('keeps compact JSON as the default', () => { const report = { providerId: 'codex', status: 'ok', costUsd: 0, durationMs: 1 }; expect(formatReport(report)).toBe(JSON.stringify(report)) })\n`)
  writeFileSync(join(runRoot, 'tests/report-cli.test.mjs'), `import { expect, it } from 'vitest'\nimport { spawnSync } from 'node:child_process'\n\nconst report = { providerId: 'codex', status: 'ok', costUsd: 0, durationMs: 1 }\nit('keeps compact JSON as the CLI default', () => { const result = spawnSync(process.execPath, ['src/report-cli.mjs'], { input: JSON.stringify(report), encoding: 'utf8' }); expect(result.status).toBe(0); expect(JSON.parse(result.stdout)).toEqual(report) })\n`)
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
  const cliPath = join(runRoot, 'src/report-cli.mjs')
  const cliTestsPath = join(runRoot, 'tests/report-cli.test.mjs')
  const readmePath = join(runRoot, 'README.md')
  if (task.id === 'bug-off-by-one' && !/i\s*<=\s*xs\.length\s*-\s*n/.test(readFileSync(sourcePath, 'utf8'))) failures.push('final-window implementation check failed')
  if (task.id === 'bug-off-by-one' && !readFileSync(testsPath, 'utf8').includes('[3, 4]')) failures.push('regression test does not assert the final window')
  if (task.id === 'test-coverage-gap') {
    if (hashFile(sourcePath) !== beforeSourceHash) failures.push('source changed during test-only task')
    const tests = readFileSync(testsPath, 'utf8')
    if (!/slidingWindow\(\s*\[\s*\]\s*,/.test(tests)) failures.push('empty-input boundary test missing')
    if (!/slidingWindow\(\s*\[\s*1\s*,\s*2\s*\]\s*,\s*3\s*\)/.test(tests)) failures.push('larger-n boundary test missing')
    if (!/slidingWindow\(\s*\[[^\]]+\]\s*,\s*(?:0|-\d+)\s*\)/.test(tests)) failures.push('non-positive-n boundary test missing')
    if (!/slidingWindow\(\s*\[\s*1\s*,\s*2\s*(?:,\s*3\s*)?\]\s*,\s*(?:2|3)\s*\)/.test(tests)) failures.push('equal-length boundary test missing')
  }
  if (task.id === 'feat-formatter' && !/pretty/.test(readFileSync(formatterPath, 'utf8'))) failures.push('pretty mode implementation check failed')
  if (task.id === 'feat-formatter' && !/pretty/.test(readFileSync(join(runRoot, 'tests/format-report.test.ts'), 'utf8'))) failures.push('pretty mode test check failed')
  if (task.id === 'feat-cli-pretty') {
    if (!existsSync(cliPath)) failures.push('CLI entrypoint is missing')
    else {
      const source = readFileSync(cliPath, 'utf8')
      if (!source.includes('--pretty')) failures.push('CLI pretty flag is missing')
      const report = JSON.stringify({ providerId: 'codex', status: 'ok', costUsd: 0.01, durationMs: 12 })
      const compact = spawnSync(process.execPath, [cliPath], { input: report, encoding: 'utf8' })
      if (compact.status !== 0 || JSON.stringify(JSON.parse(compact.stdout)) !== report) failures.push('CLI compact output is not parseable or changed')
      const pretty = spawnSync(process.execPath, [cliPath, '--pretty'], { input: report, encoding: 'utf8' })
      if (pretty.status !== 0 || !['Provider:', 'Status:', 'Cost (USD):', 'Duration (ms):'].every((label) => pretty.stdout.includes(label))) failures.push('CLI pretty output is incomplete')
      const invalid = spawnSync(process.execPath, [cliPath], { input: '{invalid', encoding: 'utf8' })
      if (invalid.status === 0 || !invalid.stderr.trim()) failures.push('CLI invalid input is not rejected with stderr evidence')
    }
    if (!existsSync(cliTestsPath) || !readFileSync(cliTestsPath, 'utf8').includes('--pretty')) failures.push('CLI tests do not cover pretty mode')
  }
  if (task.id === 'docs-api-contract') {
    if (hashFile(sourcePath) !== beforeSourceHash) failures.push('source changed during documentation task')
    if (!existsSync(readmePath)) failures.push('fixture README is missing')
    else {
      const docs = readFileSync(readmePath, 'utf8')
      for (const phrase of ['slidingWindow(xs, n)', 'n <= 0', 'n > xs.length', 'n === xs.length', 'vitest run']) if (!docs.includes(phrase)) failures.push(`documentation contract is missing: ${phrase}`)
    }
  }
  return { status: failures.length ? 'failed' : testResult.status, command: testResult.command, exitCode: failures.length ? 1 : testResult.exitCode, failures }
}

if (process.argv.includes('--self-test')) {
  const validationRoot = mkdtempSync(join(tmpdir(), 'agentskit-harness-surface-validation-'))
  try {
    cpSync(join(fixture, 'src'), join(validationRoot, 'src'), { recursive: true })
    mkdirSync(join(validationRoot, 'tests'), { recursive: true })
    writeFileSync(join(validationRoot, 'src/report-cli.mjs'), `const input = await new Promise((resolve) => { let value = ''; process.stdin.on('data', (chunk) => { value += chunk }); process.stdin.on('end', () => resolve(value)) })\ntry { const report = JSON.parse(input); if (process.argv.includes('--pretty')) process.stdout.write(\`Provider: \${report.providerId}\\nStatus: \${report.status}\\nCost (USD): \${report.costUsd}\\nDuration (ms): \${report.durationMs}\\n\`); else process.stdout.write(JSON.stringify(report)) } catch (error) { process.stderr.write(String(error)); process.exitCode = 1 }\n`)
    writeFileSync(join(validationRoot, 'tests/report-cli.test.mjs'), "it('covers --pretty', () => {})\n")
    const passed = { status: 'passed', command: 'self-test', exitCode: 0 }
    const sourceHash = hashFile(join(validationRoot, 'src/slice-window.ts'))
    if (validateTask({ id: 'feat-cli-pretty' }, validationRoot, sourceHash, passed).status !== 'passed') throw new Error('CLI surface validator rejected a valid implementation')
    writeFileSync(join(validationRoot, 'README.md'), '# API contract\nslidingWindow(xs, n)\nn <= 0\nn > xs.length\nn === xs.length\nvitest run\n')
    if (validateTask({ id: 'docs-api-contract' }, validationRoot, sourceHash, passed).status !== 'passed') throw new Error('documentation surface validator rejected a valid contract')
  } finally { rmSync(validationRoot, { recursive: true, force: true }) }
  console.log(JSON.stringify({ status: 'passed', criteria: ['executable-surfaces'], surfaces: ['cli', 'docs'] }))
  process.exit(0)
}

const reports = []
const observations = []
for (const task of tasks) {
  const samples = []
  for (let sample = 1; sample <= repeatCount; sample += 1) {
    const startedAt = Date.now()
    const runRoot = mkdtempSync(join(tmpdir(), `agentskit-os-phase-29-${task.id}-sample-${sample}-`))
    cpSync(join(fixture, 'src'), join(runRoot, 'src'), { recursive: true })
    cpSync(join(fixture, 'README.md'), join(runRoot, 'README.md'))
    writeFixtureTests(runRoot)
    writeFileSync(join(runRoot, 'package.json'), JSON.stringify({ type: 'module', scripts: { test: 'vitest run' } }, null, 2))
    writeBaselineContract(runRoot, task)
    if (harnessMode) writeHarnessCliShim(runRoot)
    gitInit(runRoot)
    if (harnessMode) prepareHarnessLifecycle(runRoot)
    const beforeSourceHash = hashFile(join(runRoot, 'src/slice-window.ts'))
    const basePrompt = readFileSync(join(osRoot, task.prompt.path), 'utf8')
    const prompt = harnessMode ? `${basePrompt}\n\nAgentsKit Harness requirements:\n- inspect the task and its acceptance criteria before editing;\n- implement the complete task, including required tests;\n- run the relevant real validation commands before reporting completion;\n- if any criterion is not proven, report the delivery as incomplete and continue resolving it.\n\nAcceptance criteria:\n${task.acceptanceCriteria.map((criterion) => `- ${criterion}`).join('\n')}` : basePrompt
    const report = await orchestratorModule.runCodingAgentBenchmark({ repoRoot: runRoot, providers: providersFor(runRoot), kind: taskKind(task.kind), prompt, dryRun: false, isolateWorktrees: false, timeoutMs: 180_000 })
    const row = report.rows[0]
    let testResult
    try { testResult = runTests(runRoot) } catch (error) { testResult = { status: 'failed', command: `${vitest} run --reporter=dot`, exitCode: error.status ?? 1, output: String(error.stdout ?? error.message ?? error) } }
    const validation = validateTask(task, runRoot, beforeSourceHash, testResult)
    const artifactValidated = validation.status === 'passed'
    const harnessVerification = harnessMode ? verifyFinalHarnessLifecycle(runRoot, task) : undefined
    const delegatedApprovalReady = harnessVerification?.state === 'AWAITING_HUMAN_APPROVAL'
    const protocolComplete = row?.status === 'ok' || delegatedApprovalReady
    const deliveryComplete = artifactValidated && protocolComplete
    samples.push({ sample, status: deliveryComplete ? 'passed' : 'failed', durationMs: Date.now() - startedAt, ...(row?.durationMs === undefined ? {} : { providerDurationMs: row.durationMs }), protocolComplete, escapedIncomplete: deliveryComplete ? 0 : 1, providerReport: report, ...(harnessVerification ? { harnessVerification } : {}), validation })
  }
  const evidenceSource = relative(root, join(outputDir, `${task.id}.json`)).replaceAll('\\', '/')
  const artifactValidated = samples.every((sample) => sample.validation.status === 'passed')
  const artifactAcceptanceRate = Number((samples.filter((sample) => sample.validation.status === 'passed').length / samples.length).toFixed(4))
  const protocolCompletionRate = Number((samples.filter((sample) => sample.protocolComplete).length / samples.length).toFixed(4))
  const observation = { type: 'agentskit-harness-baseline-observation', schemaVersion: 1, suiteId: manifest.suiteId, taskId: task.id, sourceRevision: manifest.provenance?.revision, providerIds, recordedAt: new Date().toISOString(), attempts: 1, durationMs: median(samples.map((sample) => sample.durationMs)), durationSamplesMs: samples.map((sample) => sample.durationMs), artifactAcceptanceRate, protocolCompletionRate, status: samples.every((sample) => sample.status === 'passed') ? 'passed' : 'failed', escapedIncomplete: samples.reduce((total, sample) => total + sample.escapedIncomplete, 0), providerReport: { repeats: repeatCount, samples }, evidence: task.acceptanceCriteria.map((criterion) => ({ criterion, status: artifactValidated ? 'passed' : 'failed', source: evidenceSource })), criteria: artifactValidated ? ['task-delivery'] : [] }
  writeFileSync(join(outputDir, `${task.id}.json`), `${JSON.stringify(observation, null, 2)}\n`)
  observations.push({ taskId: task.id, status: observation.status, source: evidenceSource, recordedAt: observation.recordedAt, attempts: observation.attempts, durationMs: observation.durationMs, durationSamplesMs: observation.durationSamplesMs, artifactAcceptanceRate: observation.artifactAcceptanceRate, protocolCompletionRate: observation.protocolCompletionRate, escapedIncomplete: observation.escapedIncomplete, evidence: observation.evidence })
  reports.push({ taskId: task.id, status: observation.status, durationMs: observation.durationMs, durationSamplesMs: observation.durationSamplesMs, artifactAcceptanceRate: observation.artifactAcceptanceRate, protocolCompletionRate: observation.protocolCompletionRate, escapedIncomplete: observation.escapedIncomplete })
}
if (recordManifestPath) {
  const temporaryRoot = mkdtempSync(join(tmpdir(), 'agentskit-os-baseline-manifest-'))
  const temporaryManifest = join(temporaryRoot, 'manifest.json')
  try {
    writeFileSync(temporaryManifest, `${JSON.stringify({ ...manifest, observations: [] }, null, 2)}\n`)
    for (const observation of observations) recordBenchmarkObservation(temporaryManifest, observation)
    renameSync(temporaryManifest, recordManifestPath)
  } finally { rmSync(temporaryRoot, { recursive: true, force: true }) }
}
const allPassed = reports.every((report) => report.status === 'passed')
console.log(JSON.stringify({ status: allPassed ? 'passed' : 'failed', criteria: allPassed ? ['task-delivery'] : [], suiteId: manifest.suiteId, providerIds, repeats: repeatCount, reports, outputDir, ...(recordManifestPath ? { recordManifestPath } : {}) }))
