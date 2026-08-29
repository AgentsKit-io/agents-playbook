#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const cli = resolve(root, 'packages/harness/dist/cli.js')
const manifest = resolve(root, process.env.HARNESS_BENCHMARK_MANIFEST ?? 'benchmarks/harness-phase-9.json')
const manifestInput = JSON.parse(readFileSync(manifest, 'utf8'))
const result = spawnSync(process.execPath, [cli, 'benchmark', '--manifest', manifest, '--config', resolve(root, '.codex/verification.json'), '--json'], { cwd: root, encoding: 'utf8' })
const output = result.stdout.trim().split(/\r?\n/).at(-1)
const report = output ? JSON.parse(output) : undefined
const failures = []
if (result.status !== 0) failures.push(result.stderr || 'benchmark CLI failed')
const taskCount = JSON.parse(readFileSync(manifest, 'utf8')).tasks.length
if (report?.manifest?.suiteId !== manifestInput.suiteId) failures.push('benchmark manifest was not loaded')
if (report?.manifest?.taskCount !== taskCount) failures.push('benchmark task corpus was not preserved')
if (!Array.isArray(report?.comparisons) || report.comparisons.length !== taskCount) failures.push('benchmark comparisons do not cover the corpus')
if (report?.comparisons?.some((comparison) => comparison.comparability !== 'missing-baseline')) failures.push('missing baseline was not reported honestly')
console.log(JSON.stringify(failures.length ? { status: 'failed', criteria: ['benchmark-evidence'], failures } : { status: 'passed', criteria: ['benchmark-evidence'], taskCount, comparableTaskCount: report.manifest.comparableTaskCount }))
process.exitCode = failures.length ? 1 : 0
