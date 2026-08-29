import { spawnSync } from 'node:child_process'

const commands = [
  ['pnpm', ['check:doc-bridge-config']],
  ['pnpm', ['check:readme-standard']],
]
const failures = []
for (const [command, args] of commands) {
  const result = spawnSync(command, args, { stdio: 'inherit', encoding: 'utf8' })
  if (result.status !== 0) failures.push(`${command} ${args.join(' ')}`)
}
if (failures.length) {
  console.log(JSON.stringify({ status: 'failed', criteria: ['docs'], failures }))
  process.exit(1)
}
console.log(JSON.stringify({ status: 'passed', criteria: ['docs'] }))
