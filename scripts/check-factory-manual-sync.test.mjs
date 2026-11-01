import { describe, expect, it } from 'vitest'
import { compare, hashManual, recordedHash } from './check-factory-manual-sync.mjs'

const page = (h) => `---\ntitle: x\nfactory-manual-source-sha256: ${h}\n---\nbody`

describe('factory manual sync', () => {
  it('is in sync when the recorded hash matches, ignoring whitespace noise', () => {
    expect(compare('# A\r\ntext  \n', page(hashManual('# A\ntext'))).inSync).toBe(true)
  })
  it('detects a change in the internal manual', () => {
    expect(compare('# A\nchanged', page(hashManual('# A\ntext'))).inSync).toBe(false)
  })
  it('treats a missing hash as drift', () => {
    expect(recordedHash('---\ntitle: x\n---')).toBeNull()
    expect(compare('x', '---\n---').inSync).toBe(false)
  })
})

describe('drift file', () => {
  it('never copies internal headings or body', async () => {
    const { mkdtempSync, writeFileSync, readFileSync } = await import('node:fs')
    const { tmpdir } = await import('node:os')
    const { join } = await import('node:path')
    const { runCommand } = await import('@agentskit/cross-platform')
    const dir = mkdtempSync(join(tmpdir(), 'manual-sync-'))
    const src = join(dir, 'internal.md')
    const out = join(dir, 'drift.md')
    writeFileSync(src, '# Secret Heading Zeta\n## Another Private Section\nbody\n')
    const r = await runCommand(process.execPath, ['scripts/check-factory-manual-sync.mjs', src, '--write-drift', out])
    expect(r.code).toBe(1)
    const drift = readFileSync(out, 'utf8')
    expect(drift).toContain(hashManual('# Secret Heading Zeta\n## Another Private Section\nbody\n'))
    expect(drift).not.toMatch(/Secret Heading Zeta|Another Private Section/)
  })
})
