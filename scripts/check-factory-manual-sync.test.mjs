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
