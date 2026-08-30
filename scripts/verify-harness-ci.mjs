import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const workflow = readFileSync(resolve(import.meta.dirname, '../.github/workflows/ci.yml'), 'utf8')
const evidenceScript = readFileSync(resolve(import.meta.dirname, 'run-harness-ci-evidence.mjs'), 'utf8')
const required = [
  'node-version: 22',
  '- run: pnpm install --frozen-lockfile',
  '- run: pnpm harness:test',
  '- run: pnpm harness:cli',
  '- run: node scripts/verify-harness-consumer.mjs',
  '- run: node scripts/run-harness-ci-evidence.mjs',
  'uses: actions/upload-artifact@v4',
  'path: .codex/verification/harness-phase-24',
]
const failures = required.filter((entry) => !workflow.includes(entry)).map((entry) => `missing CI step: ${entry}`)
if (!evidenceScript.includes("run(['plan', 'prepared', '--by', 'ci'])")) failures.push('CI evidence must use automated preparation')
if (evidenceScript.includes("run(['plan', 'approved', '--by', 'human'])")) failures.push('CI evidence must not impersonate human approval')
console.log(JSON.stringify(failures.length ? { status: 'failed', criteria: ['ci-evidence'], failures } : { status: 'passed', criteria: ['ci-evidence'] }))
process.exitCode = failures.length ? 1 : 0
