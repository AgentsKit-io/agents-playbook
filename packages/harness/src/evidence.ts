import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { sha256 } from './hash.js'
import { pathInside } from './files.js'
import type { EvidenceArtifact, StructuredEvidence, VerificationCheck } from './types.js'

export const parseStructuredEvidence = (stdout: string): StructuredEvidence | null => {
  for (const line of stdout.split(/\r?\n/).map((item) => item.trim()).filter(Boolean).reverse()) {
    try {
      const value: unknown = JSON.parse(line)
      if (typeof value === 'object' && value !== null && !Array.isArray(value) && typeof (value as Record<string, unknown>)['status'] === 'string') return value as StructuredEvidence
    } catch {}
  }
  return null
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)
const viewportValid = (viewport: unknown): boolean => typeof viewport === 'string' || (isRecord(viewport) && typeof viewport['width'] === 'number' && viewport['width'] > 0 && typeof viewport['height'] === 'number' && viewport['height'] > 0)

export const validateEvidence = (root: string, check: VerificationCheck, evidence: StructuredEvidence | null, outcomeIds: readonly string[]): string[] => {
  if (!evidence || evidence.status !== 'passed') return ['structured evidence did not pass']
  if (!Array.isArray(evidence.criteria) || !evidence.criteria.every((id): id is string => typeof id === 'string') || outcomeIds.some((id) => !evidence.criteria.includes(id))) return [`evidence must map criteria: ${outcomeIds.join(', ')}`]
  const failures: string[] = []
  if (check.category === 'ui') {
    if (evidence.capability !== 'real-browser') failures.push('UI evidence must declare capability real-browser')
    if (!Array.isArray(evidence.artifacts) || evidence.artifacts.length === 0) failures.push('UI evidence requires screenshot artifacts')
  }
  const artifacts = Array.isArray(evidence.artifacts) ? evidence.artifacts : []
  for (const artifactValue of artifacts) {
    if (!isRecord(artifactValue) || typeof artifactValue['path'] !== 'string' || typeof artifactValue['sha256'] !== 'string') {
      failures.push('artifact requires string path and sha256')
      continue
    }
    const artifact = artifactValue as unknown as EvidenceArtifact
    const artifactPath = join(root, artifact.path)
    if (!pathInside(root, artifactPath)) failures.push(`artifact path escapes project root: ${artifact.path}`)
    else if (!existsSync(artifactPath) || sha256(readFileSync(artifactPath)) !== artifact.sha256) failures.push(`artifact hash mismatch: ${artifact.path}`)
    if (check.category === 'ui' && (artifact.type !== 'screenshot' || !viewportValid(artifact.viewport))) failures.push(`UI artifact requires type=screenshot and viewport: ${artifact.path}`)
  }
  return failures
}
