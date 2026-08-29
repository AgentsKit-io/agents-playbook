import { execFile, spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

export const STATES = Object.freeze([
  'CLARIFYING', 'PLANNED', 'IMPLEMENTING', 'VERIFYING',
  'AWAITING_HUMAN_APPROVAL', 'AWAITING_AUTHORIZATION', 'COMPLETE',
  'BLOCKED', 'STALE', 'CANCELLED', 'SUPERSEDED',
])

export const LEGAL_TRANSITIONS = Object.freeze({
  CLARIFYING: ['PLANNED', 'BLOCKED', 'CANCELLED'],
  PLANNED: ['IMPLEMENTING', 'CLARIFYING', 'STALE', 'CANCELLED'],
  IMPLEMENTING: ['VERIFYING', 'CLARIFYING', 'STALE', 'CANCELLED'],
  VERIFYING: ['AWAITING_HUMAN_APPROVAL', 'BLOCKED', 'STALE', 'CANCELLED'],
  AWAITING_HUMAN_APPROVAL: ['AWAITING_AUTHORIZATION', 'COMPLETE', 'IMPLEMENTING', 'STALE', 'CANCELLED'],
  AWAITING_AUTHORIZATION: ['COMPLETE', 'IMPLEMENTING', 'STALE', 'CANCELLED'],
  COMPLETE: ['STALE', 'SUPERSEDED'],
  BLOCKED: ['SUPERSEDED'],
  STALE: ['SUPERSEDED', 'PLANNED'],
  CANCELLED: ['SUPERSEDED'],
  SUPERSEDED: [],
})

const SURFACES = ['logic', 'endpoint', 'database', 'cli', 'mcp', 'ui', 'docs']
const CATEGORIES = new Set(['build', 'test', 'lint', 'logic', 'endpoint', 'database', 'cli', 'mcp', 'ui', 'docs', 'custom'])
const REAL_CATEGORIES = new Set(['endpoint', 'database', 'cli', 'mcp', 'ui'])
const DECISIONS = new Set(['approved', 'approve', 'yes', 'ok', 'rejected', 'reject', 'no'])

const fail = (message, code = 'HARNESS_ERROR') => {
  const error = new Error(message)
  error.code = code
  throw error
}

const sha256 = (value) => createHash('sha256').update(value).digest('hex')
const hashJson = (value) => sha256(JSON.stringify(value))
const now = () => new Date().toISOString()
const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'))
const writeJson = (path, value) => {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}
const pathInside = (root, candidate) => {
  const rel = relative(resolve(root), resolve(candidate))
  return rel === '' || (!rel.startsWith(`..${sep}`) && rel !== '..' && !rel.startsWith(sep))
}

const configPaths = (configPath) => {
  const absolute = resolve(configPath)
  const configDir = dirname(absolute)
  const raw = readJson(absolute)
  const root = resolve(configDir, raw.root ?? '.')
  return { absolute, root, stateDir: resolve(root, raw.stateDir ?? join('.codex', 'verification')) }
}

const assertObject = (value, label) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(`${label} must be an object.`, 'INVALID_CONFIG')
}

const requiredSurface = (value, name) => {
  if (typeof value === 'boolean') return { required: value, ...(value ? {} : { reason: `${name} is not applicable.` }) }
  assertObject(value, `surfaces.${name}`)
  if (typeof value.required !== 'boolean') fail(`surfaces.${name}.required must be boolean.`, 'INVALID_CONFIG')
  if (!value.required && typeof value.reason !== 'string') fail(`surfaces.${name}.reason is required when not applicable.`, 'INVALID_CONFIG')
  return { required: value.required, ...(value.reason ? { reason: value.reason } : {}) }
}

const validateConfig = (raw) => {
  assertObject(raw, 'verification config')
  if (raw.schemaVersion !== 1) fail('verification config schemaVersion must be 1.', 'INVALID_CONFIG')
  if (typeof raw.project !== 'string' || !raw.project.trim()) fail('verification config project is required.', 'INVALID_CONFIG')
  assertObject(raw.contract, 'contract')
  if (typeof raw.contract.intent !== 'string' || !raw.contract.intent.trim()) fail('contract.intent is required.', 'INVALID_CONFIG')
  if (!Array.isArray(raw.contract.ambiguities)) fail('contract.ambiguities must be an array.', 'INVALID_CONFIG')
  if (raw.contract.ambiguities.some((item) => typeof item !== 'string' || !item.trim())) fail('contract.ambiguities must contain non-empty strings.', 'INVALID_CONFIG')
  assertObject(raw.contract.scope, 'contract.scope')
  for (const key of ['inScope', 'outOfScope']) if (!Array.isArray(raw.contract.scope[key])) fail(`contract.scope.${key} must be an array.`, 'INVALID_CONFIG')
  if (!Array.isArray(raw.contract.outcomes) || raw.contract.outcomes.length === 0) fail('contract.outcomes is required.', 'INVALID_CONFIG')
  if (!Array.isArray(raw.checks) || raw.checks.length === 0) fail('at least one check is required.', 'INVALID_CONFIG')

  const checks = raw.checks.map((check, index) => {
    assertObject(check, `checks[${index}]`)
    if (typeof check.id !== 'string' || !check.id.trim()) fail(`checks[${index}].id is required.`, 'INVALID_CONFIG')
    if (!CATEGORIES.has(check.category)) fail(`checks[${index}].category is invalid.`, 'INVALID_CONFIG')
    if (typeof check.command !== 'string' || !check.command.trim()) fail(`checks[${index}].command is required.`, 'INVALID_CONFIG')
    if (REAL_CATEGORIES.has(check.category) && check.execution !== 'real') fail(`checks[${index}] must declare execution: real.`, 'INVALID_CONFIG')
    if (check.evidence !== 'structured') fail(`checks[${index}] must declare evidence: structured.`, 'INVALID_CONFIG')
    if (check.capabilities !== undefined && (!Array.isArray(check.capabilities) || check.capabilities.some((item) => typeof item !== 'string'))) fail(`checks[${index}].capabilities must be strings.`, 'INVALID_CONFIG')
    if (check.category === 'ui' && !check.capabilities?.includes('real-browser')) fail(`checks[${index}] must declare real-browser.`, 'INVALID_CONFIG')
    if (check.category === 'ui' && !check.capabilities?.includes('screenshot')) fail(`checks[${index}] must declare screenshot.`, 'INVALID_CONFIG')
    return { required: true, timeoutMs: 120000, ...check }
  })
  if (new Set(checks.map((check) => check.id)).size !== checks.length) fail('check ids must be unique.', 'INVALID_CONFIG')
  const checkIds = new Set(checks.map((check) => check.id))
  const outcomes = raw.contract.outcomes.map((outcome, index) => {
    assertObject(outcome, `contract.outcomes[${index}]`)
    if (typeof outcome.id !== 'string' || !outcome.id.trim()) fail(`contract.outcomes[${index}].id is required.`, 'INVALID_CONFIG')
    if (typeof outcome.statement !== 'string' || !outcome.statement.trim()) fail(`contract.outcomes[${index}].statement is required.`, 'INVALID_CONFIG')
    if (!Array.isArray(outcome.checks) || outcome.checks.length === 0 || outcome.checks.some((id) => !checkIds.has(id))) fail(`contract.outcomes[${index}].checks must reference known checks.`, 'INVALID_CONFIG')
    return { id: outcome.id, statement: outcome.statement, checks: [...new Set(outcome.checks)] }
  })
  if (new Set(outcomes.map((outcome) => outcome.id)).size !== outcomes.length) fail('outcome ids must be unique.', 'INVALID_CONFIG')
  const mappedChecks = new Set(outcomes.flatMap((outcome) => outcome.checks))
  if (checks.some((check) => check.required && !mappedChecks.has(check.id))) fail('every required check must map to an outcome.', 'INVALID_CONFIG')

  const surfaces = {}
  for (const name of SURFACES) surfaces[name] = requiredSurface(raw.surfaces?.[name] ?? (name === 'logic'), name)
  for (const [name, surface] of Object.entries(surfaces)) {
    const hasCheck = checks.some((check) => check.required && check.category === name)
    if (surface.required && !hasCheck) fail(`required surface ${name} has no required check.`, 'INVALID_CONFIG')
  }
  if (raw.tracking?.required && typeof raw.tracking.target !== 'string') fail('tracking.target is required when tracking is enabled.', 'INVALID_CONFIG')
  if (raw.budget?.maxDurationMs !== undefined && (!Number.isInteger(raw.budget.maxDurationMs) || raw.budget.maxDurationMs < 1)) fail('budget.maxDurationMs must be a positive integer.', 'INVALID_CONFIG')
  return { ...raw, contract: { ...raw.contract, outcomes }, checks, surfaces }
}

export const loadConfig = (configPath = '.codex/verification.json') => {
  const paths = configPaths(configPath)
  if (!pathInside(paths.root, paths.stateDir)) fail('stateDir must be inside the project root.', 'INVALID_CONFIG')
  const raw = readJson(paths.absolute)
  const config = validateConfig(raw)
  return { ...paths, config, configHash: hashJson(config) }
}

const git = async (root, args) => {
  try {
    const result = await execFileAsync('git', ['-C', root, ...args], { encoding: 'utf8' })
    return result.stdout.trim()
  } catch {
    return ''
  }
}

const sourceSnapshot = async (root, stateDir) => {
  const revision = await git(root, ['rev-parse', 'HEAD'])
  const stateRelative = relative(root, stateDir).replaceAll('\\', '/')
  const pathspec = ['--', '.']
  if (stateRelative && stateRelative !== '..' && !stateRelative.startsWith('../')) pathspec.push(`:(exclude)${stateRelative}`)
  const status = await git(root, ['status', '--porcelain=v1', '--untracked-files=all', ...pathspec])
  const diff = await git(root, ['diff', '--no-ext-diff', '--binary', 'HEAD', ...pathspec])
  const untracked = (await git(root, ['ls-files', '--others', '--exclude-standard', '-z']))
    .split('\0').filter(Boolean)
    .filter((path) => !stateRelative || (path !== stateRelative && !path.startsWith(`${stateRelative}/`)))
    .map((path) => ({ path, hash: sha256(readFileSync(resolve(root, path))) }))
  const fingerprint = { revision, status, diff, untracked }
  return { revision: revision || `content:${hashJson(fingerprint)}`, status, statusHash: hashJson(fingerprint) }
}

const latestPath = (stateDir) => join(stateDir, 'latest.json')
const runPath = (stateDir, runId) => join(stateDir, 'runs', runId, 'run.json')
const saveRun = (stateDir, run) => writeJson(runPath(stateDir, run.runId), run)
const readRun = (stateDir, runId) => readJson(runPath(stateDir, runId))

export const loadLatestRun = (stateDir) => {
  if (!existsSync(latestPath(stateDir))) return null
  const pointer = readJson(latestPath(stateDir))
  return readRun(stateDir, pointer.runId)
}

const setLatest = (stateDir, run) => writeJson(latestPath(stateDir), { runId: run.runId, path: relative(resolve(stateDir, '..', '..'), runPath(stateDir, run.runId)), updatedAt: now() })
export const transition = (run, to, reason, actor = 'harness') => {
  if (!STATES.includes(to)) fail(`Unknown state ${to}.`, 'INVALID_STATE')
  if (run.state !== to && !LEGAL_TRANSITIONS[run.state]?.includes(to)) fail(`Illegal transition ${run.state} -> ${to}.`, 'INVALID_STATE')
  return { ...run, state: to, transitions: [...run.transitions, { from: run.state, to, at: now(), actor, ...(reason ? { reason } : {}) }] }
}

const newRunId = () => `${Date.now()}-${process.pid}-${Math.random().toString(36).slice(2, 8)}`

export const createRun = async ({ root, stateDir, config, configHash, contractHash, baseline, supersedes }) => {
  const run = {
    type: 'agentskit-harness-run',
    schemaVersion: 1,
    runId: newRunId(),
    project: config.project,
    state: 'PLANNED',
    configHash,
    contractHash,
    sourceRevision: baseline.revision,
    sourceStatusHash: baseline.statusHash,
    baseline,
    contractApproval: { actor: 'human', at: now(), contractHash },
    checks: config.checks.map(({ id, category }) => ({ id, category, status: 'pending' })),
    outcomes: config.contract.outcomes.map(({ id, statement, checks }) => ({ id, statement, checks, status: 'pending' })),
    transitions: [{ from: null, to: 'PLANNED', at: now(), actor: 'human' }],
    evidenceReferences: [],
    ...(supersedes ? { supersedes } : {}),
  }
  saveRun(stateDir, run)
  setLatest(stateDir, run)
  return run
}

const assertDecision = (decision) => {
  if (!DECISIONS.has(decision)) fail('Decision must be approved or rejected.', 'INVALID_INPUT')
  return decision.startsWith('approve') || decision === 'approved' || decision === 'yes' || decision === 'ok'
}

const assertHuman = (actor) => {
  if (actor !== 'human') fail('This action requires --by human.', 'HUMAN_APPROVAL_REQUIRED')
}

const assertNoAmbiguities = (config) => {
  if (config.contract.ambiguities.length) fail(`Unresolved ambiguities remain: ${config.contract.ambiguities.join(' | ')}`, 'CLARIFYING')
}

const currentBinding = async ({ root, stateDir, configHash }) => ({ source: await sourceSnapshot(root, stateDir), configHash })

export const planRun = async ({ configPath, decision, actor = 'human', allowDirty = false }) => {
  assertHuman(actor)
  if (!assertDecision(decision)) fail('Contract was not approved.', 'CLARIFYING')
  const loaded = loadConfig(configPath)
  assertNoAmbiguities(loaded.config)
  const baseline = await sourceSnapshot(loaded.root, loaded.stateDir)
  const configRelative = relative(loaded.root, loaded.absolute)
  const meaningfulChanges = baseline.status.split('\n').filter(Boolean).filter((line) => !line.endsWith(` ${configRelative}`) && !line.endsWith(` ${configRelative.replaceAll('/', '\\')}`))
  if (meaningfulChanges.length && !allowDirty) fail(`Worktree is dirty before planning:\n${meaningfulChanges.join('\n')}\nUse --allow-dirty only with explicit human authorization.`, 'WORKTREE_DIRTY')
  const previous = loadLatestRun(loaded.stateDir)
  if (previous && previous.state !== 'STALE' && previous.state !== 'SUPERSEDED') fail(`An active run already exists: ${previous.runId} (${previous.state}).`, 'ACTIVE_RUN')
  let run = await createRun({ ...loaded, contractHash: loaded.configHash, baseline, supersedes: previous?.runId })
  if (allowDirty) {
    run = { ...run, dirtyBaselineAuthorized: true }
    saveRun(loaded.stateDir, run); setLatest(loaded.stateDir, run)
  }
  return run
}

export const startRun = ({ stateDir }) => {
  const run = loadLatestRun(stateDir)
  if (!run) fail('No planned run exists. Run plan first.', 'NO_RUN')
  const next = transition(run, 'IMPLEMENTING', 'Implementation started.', 'agent')
  saveRun(stateDir, next); setLatest(stateDir, next); return next
}

const structuredEvidence = (stdout) => {
  const lines = stdout.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    try {
      const parsed = JSON.parse(lines[index])
      if (parsed && typeof parsed === 'object' && typeof parsed.status === 'string') return parsed
    } catch {}
  }
  return null
}

const runCommand = ({ command, cwd, timeoutMs }) => new Promise((resolveResult) => {
  const started = Date.now()
  const child = spawn(command, { cwd, shell: true, env: process.env })
  let stdout = ''
  let stderr = ''
  let timedOut = false
  const timer = setTimeout(() => { timedOut = true; child.kill('SIGTERM') }, timeoutMs)
  child.stdout.on('data', (chunk) => { stdout += chunk })
  child.stderr.on('data', (chunk) => { stderr += chunk })
  child.on('close', (exitCode, signal) => {
    clearTimeout(timer)
    resolveResult({ exitCode: exitCode ?? 1, signal, timedOut, stdout, stderr, durationMs: Date.now() - started })
  })
})

const hashFile = (path) => sha256(readFileSync(path))
const validateArtifacts = (root, check, evidence, outcomeIds) => {
  if (!evidence || evidence.status !== 'passed') return ['structured evidence did not pass']
  if (!Array.isArray(evidence.criteria) || outcomeIds.some((id) => !evidence.criteria.includes(id))) return [`evidence must map criteria: ${outcomeIds.join(', ')}`]
  const failures = []
  if (check.category === 'ui') {
    if (evidence.capability !== 'real-browser') failures.push('UI evidence must declare capability real-browser')
    if (!Array.isArray(evidence.artifacts) || evidence.artifacts.length === 0) failures.push('UI evidence requires screenshot artifacts')
  }
  for (const artifact of evidence.artifacts ?? []) {
    if (typeof artifact.path !== 'string' || !pathInside(root, join(root, artifact.path))) failures.push(`artifact path escapes project root: ${artifact.path}`)
    else if (!existsSync(join(root, artifact.path))) failures.push(`artifact missing: ${artifact.path}`)
    else if (artifact.sha256 !== hashFile(join(root, artifact.path))) failures.push(`artifact hash mismatch: ${artifact.path}`)
    if (check.category === 'ui' && (!artifact.viewport || typeof artifact.viewport.width !== 'number' || typeof artifact.viewport.height !== 'number')) failures.push(`UI artifact requires viewport: ${artifact.path}`)
  }
  return failures
}

export const verifyRun = async ({ configPath }) => {
  const loaded = loadConfig(configPath)
  const run = loadLatestRun(loaded.stateDir)
  if (!run) fail('No run exists. Run plan first.', 'NO_RUN')
  if (!['IMPLEMENTING', 'VERIFYING'].includes(run.state)) {
    if (['AWAITING_HUMAN_APPROVAL', 'AWAITING_AUTHORIZATION', 'COMPLETE'].includes(run.state)) {
      const binding = await currentBinding({ root: loaded.root, stateDir: loaded.stateDir, configHash: loaded.configHash })
      if (binding.configHash !== run.configHash || binding.source.revision !== run.sourceRevision || binding.source.statusHash !== run.sourceStatusHash) {
        const stale = transition(run, 'STALE', 'Verification inputs changed after the run was created.')
        saveRun(loaded.stateDir, stale); setLatest(loaded.stateDir, stale)
        fail('Run is stale because source or contract changed.', 'STALE')
      }
    }
    fail(`Cannot verify from ${run.state}.`, 'INVALID_STATE')
  }
  if (run.configHash !== loaded.configHash) {
    const stale = transition(run, 'STALE', 'Verification contract changed after the run was created.')
    saveRun(loaded.stateDir, stale); setLatest(loaded.stateDir, stale)
    fail('Run is stale because the verification contract changed.', 'STALE')
  }
  const binding = await sourceSnapshot(loaded.root, loaded.stateDir)
  let current = { ...transition(run, 'VERIFYING', 'Verification started.', 'agent'), sourceRevision: binding.revision, sourceStatusHash: binding.statusHash }
  saveRun(loaded.stateDir, current)
  const checkDir = join(loaded.stateDir, 'runs', current.runId, 'checks')
  mkdirSync(checkDir, { recursive: true })
  const outcomesByCheck = new Map(loaded.config.checks.map((check) => [check.id, loaded.config.contract.outcomes.filter((outcome) => outcome.checks.includes(check.id)).map((outcome) => outcome.id)]))
  let totalDurationMs = 0
  for (const check of loaded.config.checks) {
    const result = await runCommand({ command: check.command, cwd: loaded.root, timeoutMs: check.timeoutMs })
    totalDurationMs += result.durationMs
    writeFileSync(join(checkDir, `${check.id}.stdout`), result.stdout, 'utf8')
    writeFileSync(join(checkDir, `${check.id}.stderr`), result.stderr, 'utf8')
    const evidence = structuredEvidence(result.stdout)
    const failures = result.exitCode === 0 && !result.timedOut && evidence ? validateArtifacts(loaded.root, check, evidence, outcomesByCheck.get(check.id) ?? []) : [result.timedOut ? 'check timed out' : result.exitCode !== 0 ? `exit code ${result.exitCode}` : 'missing final structured evidence']
    const passed = failures.length === 0
    current = {
      ...current,
      evidenceReferences: [...current.evidenceReferences, {
        checkId: check.id,
        stdout: relative(loaded.stateDir, join(checkDir, `${check.id}.stdout`)),
        stderr: relative(loaded.stateDir, join(checkDir, `${check.id}.stderr`)),
      }],
      checks: current.checks.map((item) => item.id === check.id ? { ...item, status: passed ? 'passed' : 'failed', exitCode: result.exitCode, durationMs: result.durationMs, evidence: evidence ?? undefined, failures: failures.length ? failures : undefined } : item),
    }
    saveRun(loaded.stateDir, current)
  }
  const checkStatus = new Map(current.checks.map((check) => [check.id, check.status]))
  const budgetExceeded = loaded.config.budget?.maxDurationMs !== undefined && totalDurationMs > loaded.config.budget.maxDurationMs
  const allPassed = loaded.config.checks.every((check) => checkStatus.get(check.id) === 'passed') && !budgetExceeded
  current = { ...current, outcomes: current.outcomes.map((outcome) => ({ ...outcome, status: outcome.checks.every((id) => checkStatus.get(id) === 'passed') ? 'passed' : 'failed' })), metrics: { totalDurationMs, budgetExceeded } }
  current = transition(current, allPassed ? 'AWAITING_HUMAN_APPROVAL' : 'BLOCKED', allPassed ? 'All required checks passed; human approval is required.' : budgetExceeded ? 'Verification budget was exceeded.' : 'A required check failed or lacked structured evidence.', 'harness')
  saveRun(loaded.stateDir, current); setLatest(loaded.stateDir, current)
  return current
}

const assertFresh = async (loaded, run) => {
  const current = await currentBinding({ root: loaded.root, stateDir: loaded.stateDir, configHash: loaded.configHash })
  if (current.configHash !== run.configHash) {
    const stale = transition(run, 'STALE', 'Verification contract changed after the run was created.')
    saveRun(loaded.stateDir, stale); setLatest(loaded.stateDir, stale)
    fail('Run is stale because the verification contract changed.', 'STALE')
  }
  if (current.source.revision !== run.sourceRevision || current.source.statusHash !== run.sourceStatusHash) {
    const stale = transition(run, 'STALE', 'Source or worktree changed after verification.')
    saveRun(loaded.stateDir, stale); setLatest(loaded.stateDir, stale)
    fail('Run is stale because source or worktree changed after verification.', 'STALE')
  }
}

export const approveRun = async ({ configPath, runId, decision, actor = 'human' }) => {
  assertHuman(actor)
  const loaded = loadConfig(configPath)
  const run = runId ? readRun(loaded.stateDir, runId) : loadLatestRun(loaded.stateDir)
  if (!run) fail('Run not found.', 'NO_RUN')
  if (run.state !== 'AWAITING_HUMAN_APPROVAL') fail(`Cannot approve from ${run.state}.`, 'INVALID_STATE')
  await assertFresh(loaded, run)
  if (!assertDecision(decision)) {
    const blocked = transition(run, 'BLOCKED', 'Human rejected the verification result.', 'human')
    saveRun(loaded.stateDir, blocked); setLatest(loaded.stateDir, blocked); return blocked
  }
  const nextState = loaded.config.tracking?.required ? 'AWAITING_AUTHORIZATION' : 'COMPLETE'
  const next = { ...transition(run, nextState, 'Human approved the verification result.', 'human'), humanApproval: { actor, at: now(), sourceRevision: run.sourceRevision, contractHash: run.contractHash } }
  saveRun(loaded.stateDir, next); setLatest(loaded.stateDir, next); return next
}

export const authorizeRun = async ({ configPath, runId, decision, actor = 'human' }) => {
  assertHuman(actor)
  const loaded = loadConfig(configPath)
  const run = runId ? readRun(loaded.stateDir, runId) : loadLatestRun(loaded.stateDir)
  if (!run) fail('Run not found.', 'NO_RUN')
  if (run.state !== 'AWAITING_AUTHORIZATION') fail(`Cannot authorize from ${run.state}.`, 'INVALID_STATE')
  await assertFresh(loaded, run)
  if (!assertDecision(decision)) {
    const blocked = transition(run, 'BLOCKED', 'Human rejected external tracking authorization.', 'human')
    saveRun(loaded.stateDir, blocked); setLatest(loaded.stateDir, blocked); return blocked
  }
  const next = { ...transition(run, 'COMPLETE', 'External tracking was authorized.', 'human'), authorization: { actor, at: now(), target: loaded.config.tracking.target, sourceRevision: run.sourceRevision, contractHash: run.contractHash } }
  saveRun(loaded.stateDir, next); setLatest(loaded.stateDir, next); return next
}

export const retryRun = async ({ configPath }) => {
  const loaded = loadConfig(configPath)
  const previous = loadLatestRun(loaded.stateDir)
  if (!previous || !['BLOCKED', 'STALE', 'CANCELLED'].includes(previous.state)) fail(`Cannot retry from ${previous?.state ?? 'no run'}.`, 'INVALID_STATE')
  const baseline = await sourceSnapshot(loaded.root, loaded.stateDir)
  let run = await createRun({ ...loaded, contractHash: loaded.configHash, baseline, supersedes: previous.runId })
  run = transition(run, 'IMPLEMENTING', 'Retry started after a previous attempt.', 'agent')
  saveRun(loaded.stateDir, run); setLatest(loaded.stateDir, run)
  return run
}

export const cleanTaskArtifacts = ({ configPath }) => {
  const loaded = loadConfig(configPath)
  for (const root of loaded.config.cleanup?.roots ?? []) {
    const target = resolve(loaded.root, root)
    if (!pathInside(loaded.root, target)) fail(`Cleanup root escapes project root: ${root}`, 'INVALID_CONFIG')
    if (existsSync(target)) for (const entry of readdirSync(target)) rmSync(join(target, entry), { recursive: true, force: true })
  }
  return { cleaned: loaded.config.cleanup?.roots ?? [] }
}
