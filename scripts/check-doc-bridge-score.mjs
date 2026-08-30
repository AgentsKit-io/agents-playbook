#!/usr/bin/env node
import { execFileSync } from 'node:child_process'
import { join } from 'node:path'

const output = execFileSync(join(process.cwd(), 'node_modules', '.bin', 'ak-docs'), ['doctor'], {
  cwd: process.cwd(),
  encoding: 'utf8',
})
const report = JSON.parse(output)

if (report.ok !== true || report.score !== 100 || report.grade !== 'A') {
  console.error(`Doc Bridge certification failed: ${report.score ?? 'unknown'}/100 ${report.grade ?? 'unknown'}`)
  process.exit(1)
}

const packages = report.coverage?.packages
if (!packages || packages.total !== packages.withAgentDoc || packages.total !== packages.withHumanDoc) {
  console.error('Doc Bridge ownership coverage is incomplete.')
  process.exit(1)
}

console.log(`Doc Bridge certified: ${report.score}/100 ${report.grade}; ${packages.total}/${packages.total} ownership routes.`)
