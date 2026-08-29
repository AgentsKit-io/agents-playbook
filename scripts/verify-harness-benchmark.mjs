#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const cli = resolve(root, 'packages/harness/dist/cli.js')
const manifest = resolve(root, 'benchmarks/harness-phase-3.json')
const result = spawnSync(process.execPath, [cli, 'benchmark', '--manifest', manifest, '--config', resolve(root, '.codex/verification.json'), '--json'], { cwd: root, encoding: 'utf8' })
const output = result.stdout.trim().split(/\r?\n/).at(-1)
const report = output ? JSON.parse(output) : undefined
const failures = []
if (result.status !== 0) failures.push(result.stderr || 'benchmark CLI failed')
const taskCount = JSON.parse(readFileSync(manifest, 'utf8')).tasks.length
if (report?.manifest?.suiteId !== 'agentskit-harness-phase-3') failures.push('benchmark manifest was not loaded')
if (report?.manifest?.taskCount !== taskCount) failures.push('benchmark task corpus was not preserved')
if (!Array.isArray(report?.comparisons) || report.comparisons.length !== taskCount) failures.push('benchmark comparisons do not cover the corpus')
console.log(JSON.stringify(failures.length ? { status: 'failed', criteria: ['metrics'], failures } : { status: 'passed', criteria: ['metrics'], taskCount, comparableTaskCount: report.manifest.comparableTaskCount }))
process.exitCode = failures.length ? 1 : 0
