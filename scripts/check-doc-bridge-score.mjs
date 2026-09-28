#!/usr/bin/env node
import { join } from 'node:path'
import { runCommand } from '@agentskit/cross-platform'

// node_modules/.bin/ak-docs is ak-docs.cmd on Windows; runCommand resolves the shim.
const doctor = await runCommand(join(process.cwd(), 'node_modules', '.bin', 'ak-docs'), ['doctor'], { cwd: process.cwd() })
if (doctor.code !== 0) {
  process.stderr.write(doctor.stderr)
  console.error(`ak-docs doctor exited with code ${doctor.code}`)
  process.exit(1)
}
const report = JSON.parse(doctor.stdout)

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
