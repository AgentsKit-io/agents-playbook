import { execFileSync } from 'node:child_process'
import { readFileSync, readdirSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { auditReadme } from './lib/readme-standard.mjs'

const root = new URL('..', import.meta.url).pathname.replace(/\/$/, '')

describe('README Standard v1', () => {
  it('passes every declared dimension, budget, example, and freshness gate', () => {
    const config = JSON.parse(readFileSync(`${root}/readme-standard-v1.json`, 'utf8'))
    expect(auditReadme(root, config, new Date('2026-07-14T12:00:00Z'))).toEqual({ ok: true, failures: [] })
  })

  it('runs the primary verification example', () => {
    expect(execFileSync(process.execPath, ['examples/verify-playbook.mjs'], { cwd: root, encoding: 'utf8' })).toMatch(/^Verified 153 local Playbook answers\./)
  })

  it('keeps generated guide claims aligned and volatile counts out of the visual', () => {
    const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
      entry.isDirectory() ? walk(`${dir}/${entry.name}`) : /\.mdx?$/.test(entry.name) ? [`${dir}/${entry.name}`] : [],
    )
    const guideCount = walk(`${root}/content/docs`).length
    const readme = readFileSync(`${root}/README.md`, 'utf8')
    const flow = readFileSync(`${root}/docs/assets/playbook-flow.svg`, 'utf8')
    expect(readme).toContain(`| Human and agent guides | ${guideCount} |`)
    expect(flow).not.toMatch(/\d+ guides|\d+ local answers/)
  })
})
