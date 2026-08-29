import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const packageRoot = resolve(root, 'packages/harness')
const packageJson = JSON.parse(readFileSync(resolve(packageRoot, 'package.json'), 'utf8'))
const requiredFiles = ['README.md', 'CHANGELOG.md', 'CONTRIBUTING.md', 'CODE_OF_CONDUCT.md', 'SECURITY.md', 'LICENSE', 'tsconfig.json', 'tsup.config.ts', 'src/index.ts', 'src/cli.ts']
const failures = requiredFiles.filter((file) => !existsSync(resolve(packageRoot, file))).map((file) => `missing ${file}`)
for (const field of ['name', 'version', 'description', 'type', 'main', 'types', 'exports', 'files', 'engines', 'scripts', 'license', 'repository']) if (!(field in packageJson)) failures.push(`package.json missing ${field}`)
if (packageJson.type !== 'module') failures.push('package must be ESM')
if (packageJson.engines?.node !== '>=22') failures.push('package must require Node.js >=22')
if (!packageJson.bin?.['ak-harness'] || !packageJson.bin?.['ak-verify']) failures.push('package must expose ak-harness and ak-verify')
console.log(JSON.stringify(failures.length ? { status: 'failed', criteria: ['docs'], failures } : { status: 'passed', criteria: ['docs'] }))
process.exitCode = failures.length ? 1 : 0
