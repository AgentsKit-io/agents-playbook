import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'

export function resolveNpxCommand({
  platform = process.platform,
  nodeExecutable = process.execPath,
  pathExists = existsSync,
} = {}) {
  if (platform !== 'win32') return { command: 'npx', args: [] }

  const cli = join(dirname(nodeExecutable), 'node_modules', 'npm', 'bin', 'npx-cli.js')
  if (!pathExists(cli)) {
    throw new Error(`Unable to locate the npm CLI beside Node.js: ${cli}`)
  }
  return { command: nodeExecutable, args: [cli] }
}
