import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const workflow = readFileSync(resolve(import.meta.dirname, '../.github/workflows/ci.yml'), 'utf8')
const required = [
  'node-version: 22',
  '- run: pnpm install --frozen-lockfile',
  '- run: pnpm harness:test',
  '- run: pnpm harness:cli',
  '- run: node scripts/verify-harness-consumer.mjs',
]
const failures = required.filter((entry) => !workflow.includes(entry)).map((entry) => `missing CI step: ${entry}`)
console.log(JSON.stringify(failures.length ? { status: 'failed', criteria: ['ci-dogfood'], failures } : { status: 'passed', criteria: ['ci-dogfood'] }))
process.exitCode = failures.length ? 1 : 0
