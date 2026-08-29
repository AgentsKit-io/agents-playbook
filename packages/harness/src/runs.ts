import { hashJson } from './hash.js'
import { saveRun as persistRun, setLatest } from './files.js'
import type { LoadedConfig, SourceSnapshot, VerificationRun } from './types.js'

const now = (): string => new Date().toISOString()
const newRunId = (): string => `${Date.now()}-${process.pid}-${Math.random().toString(36).slice(2, 8)}`

export const saveRun = persistRun
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
