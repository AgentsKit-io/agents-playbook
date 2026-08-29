import { hashJson } from './hash.js'
import { saveRun as persistRun, setLatest } from './files.js'
import { FileEventStore } from './events.js'
import type { LoadedConfig, SourceSnapshot, VerificationRun } from './types.js'

const now = (): string => new Date().toISOString()
const newRunId = (): string => `${Date.now()}-${process.pid}-${Math.random().toString(36).slice(2, 8)}`

export const saveRun = (stateDir: string, run: VerificationRun): void => {
  persistRun(stateDir, run)
  const store = new FileEventStore(stateDir)
  const events = store.read(run.runId)
  if (!events.some((event) => event.type === 'run.created')) store.append({ runId: run.runId, sourceRevision: run.sourceRevision, configHash: run.configHash, type: 'run.created', payload: { project: run.project, baselineRevision: run.baseline.revision, baselineStatusHash: run.baseline.statusHash } })
  const loggedTransitions = new Set(events.filter((event) => event.type === 'state.transitioned').map((event) => event.payload.transitionIndex))
  run.transitions.forEach((transition, transitionIndex) => {
    if (loggedTransitions.has(transitionIndex)) return
    store.append({ runId: run.runId, sourceRevision: run.sourceRevision, configHash: run.configHash, type: 'state.transitioned', payload: { from: transition.from, to: transition.to, actor: transition.actor ?? 'harness', ...(transition.reason ? { reason: transition.reason } : {}), transitionIndex } })
  })
}
export { setLatest }

export const createRun = async ({ loaded, baseline, supersedes, dirtyBaselineAuthorized }: { readonly loaded: LoadedConfig; readonly baseline: SourceSnapshot; readonly supersedes?: string; readonly dirtyBaselineAuthorized?: boolean }): Promise<VerificationRun> => {
  const run: VerificationRun = {
    type: 'agentskit-harness-run', schemaVersion: 1, runId: newRunId(), project: loaded.config.project, state: 'PLANNED', configHash: loaded.configHash, contractHash: hashJson(loaded.config.contract), sourceRevision: baseline.revision, sourceStatusHash: baseline.statusHash, baseline,
    contractApproval: { actor: 'human', at: now(), contractHash: hashJson(loaded.config.contract) },
    checks: loaded.config.checks.map(({ id, category }) => ({ id, category, status: 'pending' })),
    outcomes: loaded.config.contract.outcomes.map(({ id, statement, checks }) => ({ id, statement, checks, status: 'pending' })),
    transitions: [{ from: null, to: 'PLANNED', at: now(), actor: 'human' }], evidenceReferences: [],
    ...(supersedes ? { supersedes } : {}), ...(dirtyBaselineAuthorized ? { dirtyBaselineAuthorized: true } : {}),
  }
  saveRun(loaded.stateDir, run); setLatest(loaded.stateDir, run); return run
}
