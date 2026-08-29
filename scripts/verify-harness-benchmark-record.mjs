#!/usr/bin/env node
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const cli = resolve(root, 'packages/harness/dist/cli.js')
const fixture = mkdtempSync(join(tmpdir(), 'agentskit-harness-benchmark-cli-'))
const manifest = join(fixture, 'manifest.json')
writeFileSync(manifest, JSON.stringify({ type: 'agentskit-harness-benchmark-manifest', schemaVersion: 1, suiteId: 'cli-suite', name: 'CLI fixture', tasks: [{ id: 'task', title: 'Task', acceptanceCriteria: ['criterion'] }], observations: [] }))
const record = spawnSync(process.execPath, [cli, 'benchmark', 'baseline', 'task', '--manifest', manifest, '--status', 'passed', '--source', 'cli-fixture', '--recorded-at', '2026-01-01T00:00:00.000Z', '--attempts', '1', '--duration-ms', '100', '--review-minutes', '3', '--escaped-incomplete', '0', '--json'], { cwd: root, encoding: 'utf8' })
const duplicate = spawnSync(process.execPath, [cli, 'benchmark', 'baseline', 'task', '--manifest', manifest, '--status', 'passed', '--source', 'duplicate', '--json'], { cwd: root, encoding: 'utf8' })
const failures = []
if (record.status !== 0) failures.push(record.stderr || 'baseline record command failed')
const updated = JSON.parse(readFileSync(manifest, 'utf8'))
if (updated.observations?.length !== 1 || updated.observations[0]?.source !== 'cli-fixture') failures.push('baseline observation was not persisted')
if (duplicate.status === 0) failures.push('duplicate baseline was accepted')
rmSync(fixture, { recursive: true, force: true })
console.log(JSON.stringify(failures.length ? { status: 'failed', criteria: ['benchmark-comparability'], failures } : { status: 'passed', criteria: ['benchmark-comparability'], observationCount: updated.observations.length }))
process.exitCode = failures.length ? 1 : 0
