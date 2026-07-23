#!/usr/bin/env node

import { copyFile, mkdir, readFile, readdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const check = process.argv.includes('--check')
const sourceRoot = resolve(root, 'content/docs/scripts')
const targetRoot = resolve(root, 'packages/playbook/gates')
const manifest = JSON.parse(await readFile(resolve(root, 'packages/playbook/gate-manifest.json'), 'utf8'))
const names = manifest.map(({ name }) => name).sort()
const sourceNames = (await readdir(sourceRoot))
  .map((file) => file.match(/^check-(.+)\.example\.mjs$/)?.[1])
  .filter((name) => name && name !== 'quality-gates')
  .sort()
const targetNames = (await readdir(targetRoot))
  .map((file) => file.match(/^check-(.+)\.mjs$/)?.[1])
  .filter(Boolean)
  .sort()

if (JSON.stringify(names) !== JSON.stringify(sourceNames)) {
  process.stderr.write(`Gate manifest does not match canonical scripts.\nManifest: ${names.join(', ')}\nScripts: ${sourceNames.join(', ')}\n`)
  process.exit(1)
}
if (check && JSON.stringify(names) !== JSON.stringify(targetNames)) {
  process.stderr.write(`Packaged gate set does not match the manifest.\nManifest: ${names.join(', ')}\nPackaged: ${targetNames.join(', ')}\n`)
  process.exit(1)
}

await mkdir(targetRoot, { recursive: true })
for (const name of names) {
  const source = resolve(sourceRoot, `check-${name}.example.mjs`)
  const target = resolve(targetRoot, `check-${name}.mjs`)
  if (check) {
    let targetBody = ''
    try {
      targetBody = await readFile(target, 'utf8')
    } catch {}
    const sourceBody = await readFile(source, 'utf8')
    if (targetBody !== sourceBody) {
      process.stderr.write(`Package gate is stale: gates/check-${name}.mjs\nRun: pnpm sync:playbook-package\n`)
      process.exitCode = 1
    }
  } else {
    await copyFile(source, target)
  }
}

if (!process.exitCode && !check) process.stdout.write(`Playbook package gates are synchronized (${names.length}).\n`)
