// Compares the internal factory manual with the public edition.
// Usage: node scripts/check-factory-manual-sync.mjs <internal-manual.md> [--write-drift <file>]
// Exit 0 = in sync, 1 = internal manual changed, 2 = usage error.
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { normalizeEol, splitLines } from '@agentskit/cross-platform'

const PUBLIC_PAGE = 'content/docs/factory-manual.mdx'
const KEY = 'factory-manual-source-sha256'

export function normalize(text) {
  return splitLines(normalizeEol(text)).map((l) => l.trimEnd()).join('\n').trim() + '\n'
}
export const hashManual = (text) => createHash('sha256').update(normalize(text)).digest('hex')
export function recordedHash(page) {
  return page.match(new RegExp(`^${KEY}:\\s*(\\S+)\\s*$`, 'm'))?.[1] ?? null
}
export const headings = (text) => splitLines(text).filter((l) => /^#{1,3}\s/.test(l)).map((l) => l.trim())

export function compare(internal, page) {
  const current = hashManual(internal)
  const recorded = recordedHash(page)
  return { current, recorded, inSync: current === recorded }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [source, flag, driftFile] = process.argv.slice(2)
  if (!source) {
    console.error('usage: check-factory-manual-sync.mjs <internal-manual.md> [--write-drift <file>]')
    process.exit(2)
  }
  const internal = readFileSync(source, 'utf8')
  const result = compare(internal, readFileSync(PUBLIC_PAGE, 'utf8'))
  if (result.inSync) {
    console.log('factory manual in sync')
    process.exit(0)
  }
  console.log(`factory manual drift: recorded ${result.recorded ?? 'none'}, internal ${result.current}`)
  if (flag === '--write-drift' && driftFile) {
    // Only section headings and the hash are written: the internal body is never copied into this public repo.
    writeFileSync(driftFile, [
      '# Factory manual drift',
      '',
      'The internal manual changed. Update `content/docs/factory-manual.mdx` (public, no secrets or customer names),',
      `set \`${KEY}\` to the hash below, then delete this file.`,
      '',
      `New source hash: \`${result.current}\``,
      '',
      '## Internal section headings',
      '',
      ...headings(normalize(internal)).map((h) => `- ${h}`),
      '',
    ].join('\n'))
  }
  process.exit(1)
}
