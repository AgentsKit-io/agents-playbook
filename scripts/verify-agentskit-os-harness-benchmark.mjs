#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const manifestPath = resolve(root, process.argv.includes('--manifest') ? process.argv[process.argv.indexOf('--manifest') + 1] : 'benchmarks/agentskit-os-phase-28.json')
const runner = resolve(root, 'scripts/run-agentskit-os-harness-benchmark.mjs')
const baselineRunner = resolve(root, 'scripts/run-agentskit-os-baseline.mjs')
const targetPath = process.argv.includes('--target') ? process.argv[process.argv.indexOf('--target') + 1] : undefined
const failures = []
try {
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
  if (manifest.type !== 'agentskit-harness-benchmark-manifest' || !Array.isArray(manifest.tasks) || !manifest.tasks.length) failures.push('benchmark manifest is not a non-empty harness manifest')
  if (manifest.tasks?.some((task) => !task.id || !Array.isArray(task.acceptanceCriteria) || !task.acceptanceCriteria.length)) failures.push('every task must have an id and acceptance criteria')
} catch (error) { failures.push(error instanceof Error ? error.message : String(error)) }
const result = spawnSync(process.execPath, [runner, '--manifest', manifestPath, '--self-test'], { cwd: root, encoding: 'utf8' })
if (result.status !== 0) failures.push(result.stderr.trim() || 'harness benchmark self-test failed')
let evidence
try { evidence = JSON.parse(result.stdout.trim().split(/\r?\n/).at(-1)) } catch { failures.push('harness benchmark self-test did not emit JSON evidence') }
if (evidence?.status !== 'passed') failures.push('harness benchmark self-test did not pass')
if (!targetPath) failures.push('--target is required for executable surface validation.')
else {
  const surfaceResult = spawnSync(process.execPath, [baselineRunner, '--manifest', manifestPath, '--target', targetPath, '--self-test'], { cwd: root, encoding: 'utf8' })
  if (surfaceResult.status !== 0) failures.push(surfaceResult.stderr.trim() || 'surface validation self-test failed')
  let surfaceEvidence
  try { surfaceEvidence = JSON.parse(surfaceResult.stdout.trim().split(/\r?\n/).at(-1)) } catch { failures.push('surface validation self-test did not emit JSON evidence') }
  if (surfaceEvidence?.status !== 'passed') failures.push('surface validation self-test did not pass')
}
console.log(JSON.stringify(failures.length ? { status: 'failed', criteria: ['harness-runner', 'measurement-integrity', 'executable-surfaces'], failures } : { status: 'passed', criteria: ['harness-runner', 'measurement-integrity', 'executable-surfaces'], suiteId: evidence.suiteId, taskCount: evidence.taskCount, comparableTaskCount: 0, measurement: 'paired improvement remains unavailable until human-approved COMPLETE runs exist' }))
process.exitCode = failures.length ? 1 : 0
