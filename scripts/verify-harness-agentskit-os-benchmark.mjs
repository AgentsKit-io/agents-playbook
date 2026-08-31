#!/usr/bin/env node
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { loadBenchmarkManifest, validateExternalCodingBenchmarkReport } from '../packages/harness/dist/index.js'

const valueFor = (name) => {
  const index = process.argv.indexOf(name)
  return index === -1 ? undefined : process.argv[index + 1]
}
const root = resolve(import.meta.dirname, '..')
const manifestPath = resolve(root, valueFor('--manifest') ?? 'benchmarks/agentskit-os-phase-28.json')
const targetPath = valueFor('--target')
const reportPath = valueFor('--report')
const requiredSurfaces = (valueFor('--require-surface-coverage') ?? '').split(',').map((surface) => surface.trim()).filter(Boolean)
const failures = []
const manifest = loadBenchmarkManifest(manifestPath)

if (requiredSurfaces.length) {
  const covered = new Set(manifest.tasks.flatMap((task) => task.surfaces ?? []))
  if (manifest.tasks.some((task) => !task.surfaces?.length)) failures.push('every task must declare at least one benchmark surface.')
  for (const surface of requiredSurfaces) if (!covered.has(surface)) failures.push(`benchmark surface is not covered: ${surface}`)
}

if (!targetPath?.trim()) failures.push('AGENTSKIT_OS_ROOT is required for a real benchmark bridge check.')
const target = targetPath?.trim() ? resolve(targetPath) : undefined
if (target && !existsSync(target)) failures.push(`AgentsKit OS target does not exist: ${target}`)

if (target) {
  const provenance = manifest.provenance
  if (!provenance) failures.push('benchmark manifest is missing suite provenance.')
  else {
    let revision
    try { revision = execFileSync('git', ['-C', target, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim() } catch { failures.push('could not resolve the AgentsKit OS source revision.') }
    if (revision && revision !== provenance.revision) failures.push(`source revision mismatch: manifest=${provenance.revision} target=${revision}`)
    const definitionPath = resolve(target, provenance.taskDefinition)
    if (!existsSync(definitionPath)) failures.push(`task definition does not exist: ${provenance.taskDefinition}`)
    else {
      const definition = JSON.parse(readFileSync(definitionPath, 'utf8'))
      if (!Array.isArray(definition.tasks) || definition.tasks.length !== manifest.tasks.length) failures.push('manifest task count does not match the AgentsKit OS task definition.')
      for (const task of manifest.tasks) {
        if (task.source?.repository !== provenance.repository || task.source?.revision !== provenance.revision || task.source?.path !== task.prompt?.path) failures.push(`task provenance mismatch: ${task.id}`)
        const sourceTask = definition.tasks.find((candidate) => candidate?.id === task.id)
        if (!sourceTask) { failures.push(`task is missing from AgentsKit OS definition: ${task.id}`); continue }
        if (task.kind !== sourceTask.kind) failures.push(`task kind mismatch: ${task.id}`)
        if (!task.prompt?.path.endsWith(`/${sourceTask.promptFile}`)) failures.push(`prompt path mismatch: ${task.id}`)
        if (JSON.stringify(task.scope?.read) !== JSON.stringify(sourceTask.readScope) || JSON.stringify(task.scope?.write) !== JSON.stringify(sourceTask.writeScope)) failures.push(`scope mismatch: ${task.id}`)
        const promptPath = resolve(target, task.prompt?.path ?? '')
        if (!task.prompt || !existsSync(promptPath)) failures.push(`prompt does not exist: ${task.id}`)
        else {
          const digest = createHash('sha256').update(readFileSync(promptPath)).digest('hex')
          if (digest !== task.prompt.sha256) failures.push(`prompt digest mismatch: ${task.id}`)
        }
      }
    }
  }
}

let report
if (reportPath !== undefined) {
  if (!reportPath.trim()) failures.push('--report must point to a real JSON report.')
  else if (!existsSync(resolve(reportPath))) failures.push(`benchmark report does not exist: ${reportPath}`)
  else {
    try {
      report = validateExternalCodingBenchmarkReport(JSON.parse(readFileSync(resolve(reportPath), 'utf8')))
      if (target && resolve(report.repoRoot) !== target) failures.push('benchmark report repoRoot does not match the target repository.')
    } catch (error) { failures.push(error instanceof Error ? error.message : String(error)) }
  }
}

const output = {
  status: failures.length ? 'failed' : 'passed',
  criteria: report ? ['benchmark-corpus', 'agentskit-os-bridge'] : ['benchmark-corpus'],
  suiteId: manifest.suiteId,
  taskCount: manifest.tasks.length,
  baselineCount: manifest.observations.length,
  comparableTaskCount: 0,
  measurement: manifest.observations.length === 0 ? 'unavailable: no controlled baseline or harness-complete observations recorded' : 'available only for tasks with complete criterion evidence',
  ...(report ? { providerCount: report.rows.length, providerStatuses: Object.fromEntries(report.rows.map((row) => [row.providerId, row.status])), humanAcceptance: 'required' } : {}),
  ...(failures.length ? { failures } : {}),
}
console.log(JSON.stringify(output))
process.exitCode = failures.length ? 1 : 0
