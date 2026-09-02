import { createHash, generateKeyPairSync } from 'node:crypto'
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, it } from 'vitest'
import { approveRun, exportEvidenceBundle, loadConfig, planRun, startRun, verifyEvidenceBundle, verifyRun } from '../src/index.js'

const quote = (value: string): string => `'${value.replaceAll("'", "'\"'\"'")}'`

it('exports a complete run, verifies a trust store, rejects revoked keys, and supports rotation', async () => {
  const root = mkdtempSync(join(tmpdir(), 'agentskit-harness-bundle-test-'))
  const stateDir = join(root, '.codex', 'verification')
  const configPath = join(root, '.codex', 'verification.json')
  mkdirSync(join(root, '.codex'), { recursive: true })
  const output = JSON.stringify({ status: 'passed', criteria: ['outcome'] })
  const command = `${quote(process.execPath)} -e ${quote(`console.log(${JSON.stringify(output)})`)}`
  writeFileSync(configPath, JSON.stringify({ schemaVersion: 1, project: 'bundle-fixture', root: '..', profile: 'strict', contract: { intent: 'Export evidence.', scope: { inScope: ['fixture'], outOfScope: [] }, ambiguities: [], outcomes: [{ id: 'outcome', statement: 'Fixture passes.', checks: ['logic'] }] }, surfaces: { logic: true, endpoint: false, database: false, cli: false, mcp: false, ui: false, docs: false }, checks: [{ id: 'logic', category: 'logic', command, evidence: 'structured' }], tracking: { required: false, reason: 'fixture' } }))
  const { privateKey, publicKey } = generateKeyPairSync('ed25519')
  const privateKeyPath = join(root, 'private.pem')
  writeFileSync(privateKeyPath, privateKey.export({ type: 'pkcs8', format: 'pem' }))
  const bundlePath = join(root, 'evidence.json')
  await planRun({ configPath, decision: 'approved' })
  startRun(loadConfig(configPath))
  const verified = await verifyRun({ configPath })
  await approveRun({ configPath, decision: 'approved' })
  const bundle = await exportEvidenceBundle({ configPath, outputPath: bundlePath, privateKeyPath, keyId: 'fixture-v1' })
  expect(bundle.runId).toBe(verified.runId)
  expect(verifyEvidenceBundle(bundlePath)).toMatchObject({ status: 'verified', runId: verified.runId, signed: true })
  const publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' }).toString()
  const trustStore = [{ keyId: 'fixture-v1', publicKeyPem, status: 'active' as const }]
  expect(verifyEvidenceBundle(bundlePath, { trustedKeys: trustStore })).toMatchObject({ status: 'verified', runId: verified.runId })
  expect(() => verifyEvidenceBundle(bundlePath, { trustedKeys: [{ ...trustStore[0]!, status: 'revoked' }] })).toThrow(/revoked/)
  expect(() => verifyEvidenceBundle(bundlePath, { trustedKeys: [{ ...trustStore[0]!, keyId: 'unknown' }] })).toThrow(/not trusted/)
  const rotated = generateKeyPairSync('ed25519')
  const rotatedPrivateKeyPath = join(root, 'rotated-private.pem')
  const rotatedBundlePath = join(root, 'rotated-evidence.json')
  writeFileSync(rotatedPrivateKeyPath, rotated.privateKey.export({ type: 'pkcs8', format: 'pem' }))
  await exportEvidenceBundle({ configPath, outputPath: rotatedBundlePath, privateKeyPath: rotatedPrivateKeyPath, keyId: 'fixture-v2' })
  expect(verifyEvidenceBundle(rotatedBundlePath, { trustedKeys: [{ ...trustStore[0]!, status: 'revoked' }, { keyId: 'fixture-v2', publicKeyPem: rotated.publicKey.export({ type: 'spki', format: 'pem' }).toString(), status: 'active' }] })).toMatchObject({ status: 'verified', runId: verified.runId })
  const tampered = JSON.parse(readFileSync(bundlePath, 'utf8')) as { files: Array<{ contentBase64: string }> }
  tampered.files[0]!.contentBase64 = Buffer.from('tampered').toString('base64')
  writeFileSync(bundlePath, JSON.stringify(tampered))
  expect(() => verifyEvidenceBundle(bundlePath)).toThrow(/hash mismatch|payload hash mismatch|signature is invalid/)
  expect(createHash('sha256').update(readFileSync(privateKeyPath)).digest('hex')).toHaveLength(64)
  void stateDir
}, 20_000)
