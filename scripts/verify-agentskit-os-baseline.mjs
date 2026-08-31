#!/usr/bin/env node
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { loadBenchmarkManifest, validateExternalCodingBenchmarkReport } from '../packages/harness/dist/index.js'

const arg = (name, fallback) => {
  const index = process.argv.indexOf(name)
  return index === -1 ? fallback : process.argv[index + 1]
}
const root = resolve(import.meta.dirname, '..')
const manifest = loadBenchmarkManifest(resolve(root, arg('--manifest', 'benchmarks/agentskit-os-phase-28.json')))
const targetPath = arg('--target', process.env.AGENTSKIT_OS_ROOT)
const reportsDir = resolve(root, arg('--reports', 'benchmarks/agentskit-os-phase-29-baseline'))
const requireValidation = process.argv.includes('--require-validation')
const failures = []
const median = (values) => {
  const sorted = [...values].sort((left, right) => left - right)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
}
if (!targetPath) failures.push('AGENTSKIT_OS_ROOT or --target is required.')
const target = targetPath ? resolve(targetPath) : undefined
if (target && !existsSync(target)) failures.push(`AgentsKit OS target does not exist: ${target}`)
if (target && manifest.provenance) {
  let revision
  try { revision = execFileSync('git', ['-C', target, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim() } catch { failures.push('could not resolve the target source revision.') }
  if (revision !== manifest.provenance.revision) failures.push(`source revision mismatch: manifest=${manifest.provenance.revision} target=${revision}`)
  for (const task of manifest.tasks) {
    const promptPath = resolve(target, task.prompt?.path ?? '')
    if (!task.prompt || !existsSync(promptPath)) failures.push(`prompt is missing: ${task.id}`)
    else if (createHash('sha256').update(readFileSync(promptPath)).digest('hex') !== task.prompt.sha256) failures.push(`prompt digest mismatch: ${task.id}`)
  }
}

for (const task of manifest.tasks) {
  const path = resolve(reportsDir, `${task.id}.json`)
  if (!existsSync(path)) { failures.push(`baseline report is missing: ${task.id}`); continue }
  try {
    const report = JSON.parse(readFileSync(path, 'utf8'))
    if (report.type !== 'agentskit-harness-baseline-observation' || report.schemaVersion !== 1) failures.push(`invalid baseline envelope: ${task.id}`)
    if (report.suiteId !== manifest.suiteId || report.taskId !== task.id || report.sourceRevision !== manifest.provenance?.revision) failures.push(`baseline identity mismatch: ${task.id}`)
    if (!Number.isInteger(report.attempts) || report.attempts < 1 || !Number.isFinite(report.durationMs) || report.durationMs < 0) failures.push(`baseline metrics are invalid: ${task.id}`)
    const samples = report.providerReport?.samples
    if (!Array.isArray(samples) || samples.length === 0) failures.push(`baseline samples are missing: ${task.id}`)
    else {
      const providerReports = samples.map((sample) => validateExternalCodingBenchmarkReport(sample.providerReport))
      const providerIds = providerReports[0]?.rows.map((row) => row.providerId) ?? []
      if (JSON.stringify(report.providerIds) !== JSON.stringify(providerIds) || providerReports.some((providerReport) => JSON.stringify(providerReport.rows.map((row) => row.providerId)) !== JSON.stringify(providerIds))) failures.push(`provider identity mismatch: ${task.id}`)
      if (!Array.isArray(report.durationSamplesMs) || report.durationSamplesMs.length !== samples.length || report.durationMs !== median(report.durationSamplesMs)) failures.push(`baseline duration samples are inconsistent: ${task.id}`)
      const artifactSamples = samples.filter((sample) => sample.validation?.status === 'passed').length
      const expectedArtifactAcceptanceRate = Number((artifactSamples / samples.length).toFixed(4))
      if (report.artifactAcceptanceRate !== expectedArtifactAcceptanceRate) failures.push(`artifact acceptance rate is inconsistent: ${task.id}`)
      const protocolSamples = samples.filter((sample) => sample.protocolComplete === true).length
      const expectedProtocolCompletionRate = Number((protocolSamples / samples.length).toFixed(4))
      if (report.protocolCompletionRate !== expectedProtocolCompletionRate) failures.push(`protocol completion rate is inconsistent: ${task.id}`)
      const invalidValidation = samples.some((sample) => sample.validation?.command === undefined || sample.validation?.exitCode === undefined || !['passed', 'failed'].includes(sample.validation?.status) || (sample.validation.status === 'passed' ? sample.validation.exitCode !== 0 : sample.validation.exitCode === 0))
      if (requireValidation && (invalidValidation || !Array.isArray(report.evidence) || report.evidence.length !== task.acceptanceCriteria.length || report.evidence.some((entry) => !['passed', 'failed'].includes(entry.status) || !task.acceptanceCriteria.includes(entry.criterion)))) failures.push(`baseline acceptance evidence is incomplete: ${task.id}`)
    }
  } catch (error) { failures.push(`${task.id}: ${error instanceof Error ? error.message : String(error)}`) }
}

const observations = new Map(manifest.observations.map((observation) => [observation.taskId, observation]))
if (observations.size !== manifest.tasks.length || manifest.tasks.some((task) => !observations.has(task.id))) failures.push('manifest observations do not cover every baseline task.')
console.log(JSON.stringify({ status: failures.length ? 'failed' : 'passed', criteria: ['replicated-baseline'], suiteId: manifest.suiteId, taskCount: manifest.tasks.length, baselineCount: manifest.observations.length, comparableTaskCount: 0, measurement: 'baseline recorded; improvement unavailable until harness-equivalent runs exist', ...(failures.length ? { failures } : {}) }))
process.exitCode = failures.length ? 1 : 0
