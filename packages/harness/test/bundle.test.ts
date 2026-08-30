import { createHash } from 'node:crypto'
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, it } from 'vitest'
import { approveRun, exportEvidenceBundle, loadConfig, planRun, startRun, verifyEvidenceBundle, verifyRun } from '../src/index.js'
import { generateKeyPairSync } from 'node:crypto'

const quote = (value: string): string => `'${value.replaceAll("'", "'\"'\"'")}'`

it('exports a complete run and rejects bundle tampering', async () => {
  const root = mkdtempSync(join(tmpdir(), 'agentskit-harness-bundle-test-'))
  const stateDir = join(root, '.codex', 'verification')
  const configPath = join(root, '.codex', 'verification.json')
  mkdirSync(join(root, '.codex'), { recursive: true })
  const output = JSON.stringify({ status: 'passed', criteria: ['outcome'] })
  const command = `${quote(process.execPath)} -e ${quote(`console.log(${JSON.stringify(output)})`)}`
  writeFileSync(configPath, JSON.stringify({ schemaVersion: 1, project: 'bundle-fixture', root: '..', profile: 'strict', contract: { intent: 'Export evidence.', scope: { inScope: ['fixture'], outOfScope: [] }, ambiguities: [], outcomes: [{ id: 'outcome', statement: 'Fixture passes.', checks: ['logic'] }] }, surfaces: { logic: true, endpoint: false, database: false, cli: false, mcp: false, ui: false, docs: false }, checks: [{ id: 'logic', category: 'logic', command, evidence: 'structured' }], tracking: { required: false, reason: 'fixture' } }))
  const { privateKey } = generateKeyPairSync('ed25519')
  const privateKeyPath = join(root, 'private.pem')
  writeFileSync(privateKeyPath, privateKey.export({ type: 'pkcs8', format: 'pem' }))
  const bundlePath = join(root, 'evidence.json')
  await planRun({ configPath, decision: 'approved' })
  startRun(loadConfig(configPath))
  const verified = await verifyRun({ configPath })
  await approveRun({ configPath, decision: 'approved' })
  const bundle = await exportEvidenceBundle({ configPath, outputPath: bundlePath, privateKeyPath })
  expect(bundle.runId).toBe(verified.runId)
  expect(verifyEvidenceBundle(bundlePath)).toMatchObject({ status: 'verified', runId: verified.runId, signed: true })
  const tampered = JSON.parse(readFileSync(bundlePath, 'utf8')) as { files: Array<{ contentBase64: string }> }
  tampered.files[0]!.contentBase64 = Buffer.from('tampered').toString('base64')
  writeFileSync(bundlePath, JSON.stringify(tampered))
  expect(() => verifyEvidenceBundle(bundlePath)).toThrow(/hash mismatch|payload hash mismatch|signature is invalid/)
  expect(createHash('sha256').update(readFileSync(privateKeyPath)).digest('hex')).toHaveLength(64)
  void stateDir
})
