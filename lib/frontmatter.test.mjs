import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { frontmatterString, parseFrontmatter } from './frontmatter.mjs'

const tempDirs = []

afterEach(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})

describe('shared frontmatter parser', () => {
  it('parses folded descriptions, block lists, CRLF files, and BOM files', () => {
    const dir = mkdtempSync(join(tmpdir(), 'playbook-frontmatter-'))
    tempDirs.push(dir)

    const crlfPath = join(dir, 'folded.md')
    writeFileSync(crlfPath, '---\r\ntitle: Folded guide\r\ndescription: >\r\n  A folded\r\n  description.\r\ntags:\r\n  - yaml\r\n  - markdown\r\n---\r\nBody\r\n')
    const crlf = parseFrontmatter(readFileSync(crlfPath, 'utf8'))
    expect(frontmatterString(crlf, 'description')).toBe('A folded description.')
    expect(crlf.tags).toEqual(['yaml', 'markdown'])

    const bomPath = join(dir, 'bom.md')
    writeFileSync(bomPath, '\uFEFF---\ndescription: |\n  A literal\n  description.\n---\nBody\n')
    const bom = parseFrontmatter(readFileSync(bomPath, 'utf8'))
    expect(frontmatterString(bom, 'description')).toBe('A literal\ndescription.')
  })
})
