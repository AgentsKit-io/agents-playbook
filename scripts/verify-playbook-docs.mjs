import { spawnProcess } from '@agentskit/cross-platform'

const commands = [
  ['pnpm', ['check:doc-bridge-config']],
  ['pnpm', ['check:readme-standard']],
]
const failures = []
for (const [command, args] of commands) {
  // pnpm is pnpm.cmd on Windows; spawnProcess resolves the shim without a shell.
  const result = await spawnProcess(command, args, { stdin: 'inherit', stdout: 'inherit', stderr: 'inherit' }).exited.catch(() => ({ code: 1 }))
  if (result.code !== 0) failures.push(`${command} ${args.join(' ')}`)
}
if (failures.length) {
  console.log(JSON.stringify({ status: 'failed', criteria: ['docs'], failures }))
  process.exit(1)
}
console.log(JSON.stringify({ status: 'passed', criteria: ['docs'] }))
