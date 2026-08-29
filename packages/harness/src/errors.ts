export type HarnessErrorCode = 'HARNESS_ERROR' | 'INVALID_CONFIG' | 'INVALID_INPUT' | 'INVALID_STATE' | 'POLICY_BLOCKED' | 'CLARIFYING' | 'STALE' | 'WORKTREE_DIRTY' | 'ACTIVE_RUN' | 'NO_RUN' | 'HUMAN_APPROVAL_REQUIRED'

export class HarnessError extends Error {
  public readonly code: HarnessErrorCode

  public constructor(message: string, code: HarnessErrorCode = 'HARNESS_ERROR') {
    super(message)
    this.name = 'HarnessError'
    this.code = code
  }
}

export const fail = (message: string, code: HarnessErrorCode = 'HARNESS_ERROR'): never => {
  throw new HarnessError(message, code)
}
