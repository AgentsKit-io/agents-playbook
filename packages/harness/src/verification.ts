import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { createRun, saveRun, setLatest } from './runs.js'
import { loadConfig } from './config.js'
import { fail } from './errors.js'
import { parseStructuredEvidence, validateEvidence } from './evidence.js'
import { assertHuman, approvedDecision, transition } from './state-machine.js'
import { sourceSnapshot } from './source.js'
import { cleanConfiguredArtifacts, loadLatestRun, readRun } from './files.js'
import type { CheckResult, LoadedConfig, VerificationCheck, VerificationRun } from './types.js'

const now = (): string => new Date().toISOString()
const requireRun = (run: VerificationRun | null): VerificationRun => run ?? fail('No verification run exists.', 'NO_RUN')

interface CommandResult { readonly exitCode: number; readonly timedOut: boolean; readonly stdout: string; readonly stderr: string; readonly durationMs: number }

const runCommand = (check: VerificationCheck, cwd: string): Promise<CommandResult> => new Promise((resolveResult) => {
  const started = Date.now()
  const child = spawn(check.command, { cwd, shell: true, env: process.env })
  let stdout = ''
  let stderr = ''
  let timedOut = false
  const timer = setTimeout(() => { timedOut = true; child.kill('SIGTERM') }, check.timeoutMs)
  child.stdout.on('data', (chunk: Buffer) => { stdout += chunk.toString() })
  child.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString() })
  child.on('close', (exitCode) => { clearTimeout(timer); resolveResult({ exitCode: exitCode ?? 1, timedOut, stdout, stderr, durationMs: Date.now() - started }) })
})

const currentBinding = async (loaded: LoadedConfig): Promise<{ readonly source: Awaited<ReturnType<typeof sourceSnapshot>>; readonly configHash: string }> => ({ source: await sourceSnapshot(loaded.root, loaded.stateDir), configHash: loaded.configHash })

const staleRun = (loaded: LoadedConfig, run: VerificationRun, reason: string): never => {
  const stale = transition(run, 'STALE', reason)
  saveRun(loaded.stateDir, stale as VerificationRun); setLatest(loaded.stateDir, stale as VerificationRun)
  return fail(reason, 'STALE')
}

const isFresh = async (loaded: LoadedConfig, run: VerificationRun): Promise<boolean> => {
  const current = await currentBinding(loaded)
  return current.configHash === run.configHash && current.source.revision === run.sourceRevision && current.source.statusHash === run.sourceStatusHash
}

export const planRun = async ({ configPath, decision, actor = 'human', allowDirty = false }: { readonly configPath: string; readonly decision: string; readonly actor?: string; readonly allowDirty?: boolean }): Promise<VerificationRun> => {
  assertHuman(actor)
  if (!approvedDecision(decision)) fail('Contract was not approved.', 'CLARIFYING')
  const loaded = loadConfig(configPath)
  if (loaded.config.contract.ambiguities.length) fail(`Unresolved ambiguities remain: ${loaded.config.contract.ambiguities.join(' | ')}`, 'CLARIFYING')
  const baseline = await sourceSnapshot(loaded.root, loaded.stateDir)
  const configRelative = relative(loaded.root, loaded.absolute)
  const meaningful = baseline.status.split('\n').filter(Boolean).filter((line) => !line.endsWith(` ${configRelative}`) && !line.endsWith(` ${configRelative.replaceAll('/', '\\')}`))
  if (meaningful.length && !allowDirty) fail(`Worktree is dirty before planning:\n${meaningful.join('\n')}\nUse --allow-dirty only with explicit human authorization.`, 'WORKTREE_DIRTY')
  const previous = loadLatestRun(loaded.stateDir)
  if (previous && !['STALE', 'SUPERSEDED'].includes(previous.state)) fail(`An active run already exists: ${previous.runId} (${previous.state}).`, 'ACTIVE_RUN')
  return createRun({ loaded, baseline, supersedes: previous?.runId, dirtyBaselineAuthorized: allowDirty })
}

export const startRun = (loaded: LoadedConfig): VerificationRun => {
  const run = requireRun(loadLatestRun(loaded.stateDir))
  const next = transition(run, 'IMPLEMENTING', 'Implementation started.', 'agent') as VerificationRun
  saveRun(loaded.stateDir, next); setLatest(loaded.stateDir, next); return next
}

export const verifyRun = async ({ configPath }: { readonly configPath: string }): Promise<VerificationRun> => {
  const loaded = loadConfig(configPath)
  const run = requireRun(loadLatestRun(loaded.stateDir))
  if (!['IMPLEMENTING', 'VERIFYING'].includes(run.state)) {
    if (['AWAITING_HUMAN_APPROVAL', 'AWAITING_AUTHORIZATION', 'COMPLETE'].includes(run.state) && !(await isFresh(loaded, run))) staleRun(loaded, run, 'Run is stale because source or contract changed.')
    fail(`Cannot verify from ${run.state}.`, 'INVALID_STATE')
  }
  if (run.configHash !== loaded.configHash) staleRun(loaded, run, 'Run is stale because the verification contract changed.')
  const binding = await currentBinding(loaded)
  let current = { ...transition(run, 'VERIFYING', 'Verification started.', 'agent'), sourceRevision: binding.source.revision, sourceStatusHash: binding.source.statusHash } as VerificationRun
  saveRun(loaded.stateDir, current)
  const checkDir = join(loaded.stateDir, 'runs', current.runId, 'checks')
  mkdirSync(checkDir, { recursive: true })
  const outcomesByCheck = new Map(loaded.config.checks.map((check) => [check.id, loaded.config.contract.outcomes.filter((outcome) => outcome.checks.includes(check.id)).map((outcome) => outcome.id)]))
  let totalDurationMs = 0
  for (const check of loaded.config.checks) {
    const result = await runCommand(check, loaded.root)
    totalDurationMs += result.durationMs
    const stdoutPath = join(checkDir, `${check.id}.stdout`)
    const stderrPath = join(checkDir, `${check.id}.stderr`)
    writeFileSync(stdoutPath, result.stdout, 'utf8'); writeFileSync(stderrPath, result.stderr, 'utf8')
    const evidence = parseStructuredEvidence(result.stdout)
    const failures = result.exitCode === 0 && !result.timedOut && evidence ? validateEvidence(loaded.root, check, evidence, outcomesByCheck.get(check.id) ?? []) : [result.timedOut ? 'check timed out' : result.exitCode !== 0 ? `exit code ${result.exitCode}` : 'missing final structured evidence']
    const nextCheck: CheckResult = { id: check.id, category: check.category, status: failures.length ? 'failed' : 'passed', exitCode: result.exitCode, durationMs: result.durationMs, ...(evidence ? { evidence } : {}), ...(failures.length ? { failures } : {}) }
    current = { ...current, evidenceReferences: [...current.evidenceReferences, { checkId: check.id, stdout: relative(loaded.stateDir, stdoutPath), stderr: relative(loaded.stateDir, stderrPath) }], checks: current.checks.map((item) => item.id === check.id ? nextCheck : item) } as VerificationRun
    saveRun(loaded.stateDir, current)
  }
  const statuses = new Map(current.checks.map((check) => [check.id, check.status]))
  const budgetExceeded = loaded.config.budget?.maxDurationMs !== undefined && totalDurationMs > loaded.config.budget.maxDurationMs
  const allPassed = loaded.config.checks.every((check) => statuses.get(check.id) === 'passed') && !budgetExceeded
  current = { ...current, outcomes: current.outcomes.map((outcome) => ({ ...outcome, status: outcome.checks.every((id) => statuses.get(id) === 'passed') ? 'passed' : 'failed' })), metrics: { totalDurationMs, budgetExceeded } } as VerificationRun
  const nextState = allPassed ? 'AWAITING_HUMAN_APPROVAL' : 'BLOCKED'
  current = { ...transition(current, nextState, allPassed ? 'All configured checks passed; human approval is required.' : budgetExceeded ? 'Verification budget was exceeded.' : 'A configured check failed or lacked structured evidence.', 'harness') } as VerificationRun
  saveRun(loaded.stateDir, current); setLatest(loaded.stateDir, current); return current
}

const assertFresh = async (loaded: LoadedConfig, run: VerificationRun): Promise<void> => {
  if (!(await isFresh(loaded, run))) staleRun(loaded, run, 'Run is stale because source or worktree changed after verification.')
}

export const approveRun = async ({ configPath, runId, decision, actor = 'human' }: { readonly configPath: string; readonly runId?: string; readonly decision: string; readonly actor?: string }): Promise<VerificationRun> => {
  assertHuman(actor); const loaded = loadConfig(configPath); const run = requireRun(runId ? readRun(loaded.stateDir, runId) : loadLatestRun(loaded.stateDir))
  if (run.state !== 'AWAITING_HUMAN_APPROVAL') fail(`Cannot approve from ${run.state}.`, 'INVALID_STATE')
  await assertFresh(loaded, run)
  if (!approvedDecision(decision)) { const blocked = transition(run, 'BLOCKED', 'Human rejected the verification result.', 'human') as VerificationRun; saveRun(loaded.stateDir, blocked); setLatest(loaded.stateDir, blocked); return blocked }
  const nextState = loaded.config.tracking.required ? 'AWAITING_AUTHORIZATION' : 'COMPLETE'
  const next = { ...transition(run, nextState, 'Human approved the verification result.', 'human'), humanApproval: { actor: 'human', at: now(), sourceRevision: run.sourceRevision, contractHash: run.contractHash } } as VerificationRun
  saveRun(loaded.stateDir, next); setLatest(loaded.stateDir, next); return next
}

export const authorizeRun = async ({ configPath, runId, decision, actor = 'human' }: { readonly configPath: string; readonly runId?: string; readonly decision: string; readonly actor?: string }): Promise<VerificationRun> => {
  assertHuman(actor); const loaded = loadConfig(configPath); const run = requireRun(runId ? readRun(loaded.stateDir, runId) : loadLatestRun(loaded.stateDir))
  if (run.state !== 'AWAITING_AUTHORIZATION') fail(`Cannot authorize from ${run.state}.`, 'INVALID_STATE')
  await assertFresh(loaded, run)
  if (!approvedDecision(decision)) { const blocked = transition(run, 'BLOCKED', 'Human rejected external tracking authorization.', 'human') as VerificationRun; saveRun(loaded.stateDir, blocked); setLatest(loaded.stateDir, blocked); return blocked }
  if (!loaded.config.tracking.target) fail('tracking.target is required when authorizing.', 'INVALID_CONFIG')
  const next = { ...transition(run, 'COMPLETE', 'External tracking was authorized.', 'human'), authorization: { actor: 'human', at: now(), target: loaded.config.tracking.target, sourceRevision: run.sourceRevision, contractHash: run.contractHash } } as VerificationRun
  saveRun(loaded.stateDir, next); setLatest(loaded.stateDir, next); return next
}

export const retryRun = async ({ configPath }: { readonly configPath: string }): Promise<VerificationRun> => {
  const loaded = loadConfig(configPath); const previous = loadLatestRun(loaded.stateDir)
  const previousRun = requireRun(previous)
  if (!['BLOCKED', 'STALE', 'CANCELLED'].includes(previousRun.state)) fail(`Cannot retry from ${previousRun.state}.`, 'INVALID_STATE')
  const baseline = await sourceSnapshot(loaded.root, loaded.stateDir)
  const run = await createRun({ loaded, baseline, supersedes: previousRun.runId, dirtyBaselineAuthorized: previousRun.dirtyBaselineAuthorized })
  const next = transition(run, 'IMPLEMENTING', 'Retry started after a previous attempt.', 'agent') as VerificationRun
  saveRun(loaded.stateDir, next); setLatest(loaded.stateDir, next); return next
}

export const cleanTaskArtifacts = (configPath: string): { readonly cleaned: readonly string[] } => cleanConfiguredArtifacts(loadConfig(configPath))
