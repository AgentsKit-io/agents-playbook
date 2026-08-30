import { createPrivateKey, createPublicKey, sign, verify } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join, relative, resolve, sep } from 'node:path'
import { fail } from './errors.js'
import { fileContents, loadLatestRun, pathInside, readJson } from './files.js'
import { sha256 } from './hash.js'
import { reconcileRun } from './verification.js'
import { FileEventStore } from './events.js'
import type { EventLogVerification } from './events.js'
import { loadConfig } from './config.js'
import type { VerificationRun } from './types.js'

export const EVIDENCE_BUNDLE_SCHEMA_VERSION = 1 as const

export interface EvidenceBundleFile {
  readonly path: string
  readonly sha256: string
  readonly contentBase64: string
}

export interface EvidenceBundleSignature {
  readonly algorithm: 'ed25519'
  readonly keyId: string
  readonly publicKeyPem: string
  readonly signatureBase64: string
}

export interface TrustedEvidenceKey {
  readonly keyId: string
  readonly publicKeyPem: string
  readonly status: 'active' | 'revoked'
}

export interface EvidenceBundle {
  readonly type: 'agentskit-harness-evidence-bundle'
  readonly schemaVersion: typeof EVIDENCE_BUNDLE_SCHEMA_VERSION
  readonly runId: string
  readonly signerKeyId: string
  readonly sourceRevision: string
  readonly configHash: string
  readonly contractHash: string
  readonly verificationDigest: string
  readonly eventLog: EventLogVerification
  readonly files: readonly EvidenceBundleFile[]
  readonly payloadHash: string
  readonly signature: EvidenceBundleSignature
}

export interface EvidenceBundleVerification {
  readonly status: 'verified'
  readonly runId: string
  readonly payloadHash: string
  readonly fileCount: number
  readonly signed: true
}

const body = (bundle: EvidenceBundle): Omit<EvidenceBundle, 'payloadHash' | 'signature'> => {
  const { payloadHash: _payloadHash, signature: _signature, ...unsigned } = bundle
  return unsigned
}
const parseBundle = (path: string): EvidenceBundle => {
  try { return JSON.parse(fileContents(path)) as EvidenceBundle } catch (error) { return fail(`Invalid evidence bundle JSON: ${error instanceof Error ? error.message : String(error)}`, 'INVALID_INPUT') }
}
const validDigest = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value)
const validKeyId = (value: unknown): value is string => typeof value === 'string' && /^[A-Za-z0-9._:-]{1,128}$/.test(value)
const requireRun = (run: VerificationRun | null): VerificationRun => run ?? fail('No verification run exists.', 'NO_RUN')
const bundleFile = (stateDir: string, path: string): EvidenceBundleFile => {
  const absolute = resolve(stateDir, path)
  if (!pathInside(stateDir, absolute)) fail(`Evidence path escapes state directory: ${path}`, 'HARNESS_ERROR')
  const content = readFileSync(absolute)
  return { path: relative(stateDir, absolute).split(sep).join('/'), sha256: sha256(content), contentBase64: content.toString('base64') }
}

export const exportEvidenceBundle = async ({ configPath, runId, outputPath, privateKeyPath, keyId }: { readonly configPath: string; readonly runId?: string; readonly outputPath: string; readonly privateKeyPath: string; readonly keyId: string }): Promise<EvidenceBundle> => {
  if (!validKeyId(keyId)) fail('keyId must contain only letters, numbers, dot, underscore, colon, or hyphen.', 'INVALID_INPUT')
  const loaded = loadConfig(configPath)
  const run = requireRun((runId ? readJson(join(loaded.stateDir, 'runs', runId, 'run.json')) : loadLatestRun(loaded.stateDir)) as VerificationRun | null)
  const reconciliation = await reconcileRun({ configPath, runId: run.runId })
  const digest = run.verificationDigest ?? fail('Only a reconciled COMPLETE run can be exported.', 'INVALID_STATE')
  if (reconciliation.state !== 'COMPLETE') fail('Only a reconciled COMPLETE run can be exported.', 'INVALID_STATE')
  const eventLog = new FileEventStore(loaded.stateDir)
  eventLog.read(run.runId)
  const eventVerification = eventLog.verify(run.runId)
  const paths = new Set(['runs/' + run.runId + '/run.json', 'runs/' + run.runId + '/events.ndjson'])
  for (const reference of run.evidenceReferences) { paths.add(reference.stdout); paths.add(reference.stderr) }
  const files = [...paths].map((path) => {
    if (!existsSync(resolve(loaded.stateDir, path))) fail(`Evidence file is missing: ${path}`, 'HARNESS_ERROR')
    return bundleFile(loaded.stateDir, path)
  })
  const privateKey = createPrivateKey(readFileSync(privateKeyPath))
  const unsigned = { type: 'agentskit-harness-evidence-bundle' as const, schemaVersion: EVIDENCE_BUNDLE_SCHEMA_VERSION, runId: run.runId, signerKeyId: keyId, sourceRevision: run.sourceRevision, configHash: run.configHash, contractHash: run.contractHash, verificationDigest: digest, eventLog: eventVerification, files }
  const payloadHash = sha256(JSON.stringify(unsigned))
  const publicKeyPem = createPublicKey(privateKey).export({ type: 'spki', format: 'pem' }).toString()
  const bundle = { ...unsigned, payloadHash, signature: { algorithm: 'ed25519' as const, keyId, publicKeyPem, signatureBase64: sign(null, Buffer.from(payloadHash), privateKey).toString('base64') } }
  writeFileSync(outputPath, `${JSON.stringify(bundle, null, 2)}\n`, 'utf8')
  return bundle
}

export const verifyEvidenceBundle = (path: string, { trustedKeys = [] }: { readonly trustedKeys?: readonly TrustedEvidenceKey[] } = {}): EvidenceBundleVerification => {
  const bundle = parseBundle(path)
  if (bundle.type !== 'agentskit-harness-evidence-bundle' || bundle.schemaVersion !== EVIDENCE_BUNDLE_SCHEMA_VERSION || !bundle.runId || !validKeyId(bundle.signerKeyId) || !validDigest(bundle.payloadHash) || bundle.signature?.algorithm !== 'ed25519' || bundle.signature.keyId !== bundle.signerKeyId || typeof bundle.signature.publicKeyPem !== 'string' || typeof bundle.signature.signatureBase64 !== 'string' || !Array.isArray(bundle.files)) fail('Evidence bundle metadata is invalid.', 'HARNESS_ERROR')
  if (trustedKeys.length) {
    const trusted = trustedKeys.find((key) => key.keyId === bundle.signerKeyId)
    if (!trusted) return fail(`Evidence bundle key is not trusted: ${bundle.signerKeyId}`, 'HARNESS_ERROR')
    if (trusted.status === 'revoked') fail(`Evidence bundle key is revoked: ${bundle.signerKeyId}`, 'HARNESS_ERROR')
    if (trusted.publicKeyPem !== bundle.signature.publicKeyPem) fail(`Evidence bundle key does not match trust store: ${bundle.signerKeyId}`, 'HARNESS_ERROR')
  }
  const paths = new Set<string>()
  for (const file of bundle.files) {
    if (!file || typeof file.path !== 'string' || paths.has(file.path) || !validDigest(file.sha256) || typeof file.contentBase64 !== 'string') fail('Evidence bundle file metadata is invalid.', 'HARNESS_ERROR')
    paths.add(file.path)
    const content = Buffer.from(file.contentBase64, 'base64')
    if (sha256(content) !== file.sha256) fail(`Evidence bundle file hash mismatch: ${file.path}`, 'HARNESS_ERROR')
  }
  if (!paths.has(`runs/${bundle.runId}/run.json`) || !paths.has(`runs/${bundle.runId}/events.ndjson`)) fail('Evidence bundle is missing the run projection or event log.', 'HARNESS_ERROR')
  if (sha256(JSON.stringify(body(bundle))) !== bundle.payloadHash) fail('Evidence bundle payload hash mismatch.', 'HARNESS_ERROR')
  let valid = false
  try { valid = verify(null, Buffer.from(bundle.payloadHash), createPublicKey(bundle.signature.publicKeyPem), Buffer.from(bundle.signature.signatureBase64, 'base64')) } catch { valid = false }
  if (!valid) fail('Evidence bundle signature is invalid.', 'HARNESS_ERROR')
  return { status: 'verified', runId: bundle.runId, payloadHash: bundle.payloadHash, fileCount: bundle.files.length, signed: true }
}

export const readEvidenceTrustStore = (path: string): readonly TrustedEvidenceKey[] => {
  const value = readJson(path) as { readonly schemaVersion?: unknown; readonly keys?: unknown }
  if (value.schemaVersion !== 1 || !Array.isArray(value.keys)) fail('Evidence trust store must contain schemaVersion 1 and a keys array.', 'INVALID_INPUT')
  return (value.keys as readonly unknown[]).map((key: unknown, index: number) => {
    if (typeof key !== 'object' || key === null || Array.isArray(key) || !validKeyId((key as Record<string, unknown>)['keyId']) || typeof (key as Record<string, unknown>)['publicKeyPem'] !== 'string' || ((key as Record<string, unknown>)['status'] !== 'active' && (key as Record<string, unknown>)['status'] !== 'revoked')) fail(`Invalid evidence trust store key at index ${index}.`, 'INVALID_INPUT')
    return key as TrustedEvidenceKey
  })
}
