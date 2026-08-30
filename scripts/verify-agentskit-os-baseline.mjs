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
    const providerReport = validateExternalCodingBenchmarkReport(report.providerReport)
    if (JSON.stringify(report.providerIds) !== JSON.stringify(providerReport.rows.map((row) => row.providerId))) failures.push(`provider identity mismatch: ${task.id}`)
    if (report.validation?.command === undefined || report.validation?.exitCode === undefined) failures.push(`validation evidence is missing: ${task.id}`)
    const validationIsRecorded = report.validation?.status === 'passed' || report.validation?.status === 'failed'
    const validationExitIsConsistent = report.validation?.status === 'passed' ? report.validation.exitCode === 0 : report.validation?.exitCode !== 0
    if (requireValidation && (!validationIsRecorded || !validationExitIsConsistent || !Array.isArray(report.evidence) || report.evidence.length !== task.acceptanceCriteria.length || report.evidence.some((entry) => !['passed', 'failed'].includes(entry.status) || !task.acceptanceCriteria.includes(entry.criterion)))) failures.push(`baseline acceptance evidence is incomplete: ${task.id}`)
  } catch (error) { failures.push(`${task.id}: ${error instanceof Error ? error.message : String(error)}`) }
}

const observations = new Map(manifest.observations.map((observation) => [observation.taskId, observation]))
if (observations.size !== manifest.tasks.length || manifest.tasks.some((task) => !observations.has(task.id))) failures.push('manifest observations do not cover every baseline task.')
console.log(JSON.stringify({ status: failures.length ? 'failed' : 'passed', criteria: requireValidation ? ['baseline-corpus', 'baseline-evidence', 'baseline-integrity'] : ['baseline-corpus', 'baseline-integrity'], suiteId: manifest.suiteId, taskCount: manifest.tasks.length, baselineCount: manifest.observations.length, comparableTaskCount: 0, measurement: 'baseline recorded; improvement unavailable until harness-equivalent runs exist', ...(failures.length ? { failures } : {}) }))
process.exitCode = failures.length ? 1 : 0
