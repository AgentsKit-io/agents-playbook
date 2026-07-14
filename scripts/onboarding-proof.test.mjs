import { execFileSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = new URL('..', import.meta.url).pathname.replace(/\/$/, '')

describe('Playbook onboarding proof', () => {
  it('keeps every advertised onboarding surface present and connected', () => {
    const required = [
      'content/docs/getting-started.mdx',
      'content/docs/onboard-your-agent.md',
      'content/docs/templates/AGENTS.md.template.md',
      'public/deterministic/knowledge.json',
      'public/deterministic/site-config.json',
      'app/llms.txt/route.ts',
      'app/llms-full.txt/route.ts',
      'app/raw/[...path]/route.ts',
    ]
    expect(required.filter((path) => !existsSync(`${root}/${path}`))).toEqual([])
    const readme = readFileSync(`${root}/README.md`, 'utf8')
    for (const marker of ['Getting started', '/llms.txt', '/llms-full.txt', '/raw/<path>.md']) expect(readme).toContain(marker)
  })

  it('syntax-checks every executable gate in a clean Node process', () => {
    const scripts = readdirSync(`${root}/content/docs/scripts`).filter((path) => path.endsWith('.mjs')).sort()
    expect(scripts).toHaveLength(13)
    for (const script of scripts) {
      expect(() => execFileSync(process.execPath, ['--check', `content/docs/scripts/${script}`], { cwd: root })).not.toThrow()
    }
  })

  it('proves an adopted gate against an isolated starter fixture', () => {
    const fixture = mkdtempSync(join(tmpdir(), 'agents-playbook-onboarding-'))
    try {
      mkdirSync(join(fixture, 'src'))
      mkdirSync(join(fixture, 'scripts'))
      copyFileSync(
        `${root}/content/docs/scripts/check-no-any.example.mjs`,
        join(fixture, 'scripts', 'check-no-any.example.mjs'),
      )
      writeFileSync(join(fixture, 'src', 'good.ts'), 'export const answer: number = 42\n')
      expect(execFileSync(process.execPath, ['scripts/check-no-any.example.mjs'], { cwd: fixture, encoding: 'utf8' })).toContain('no-any: OK')

      writeFileSync(join(fixture, 'src', 'bad.ts'), 'export const unsafe: any = 42\n')
      expect(() => execFileSync(process.execPath, ['scripts/check-no-any.example.mjs'], { cwd: fixture, stdio: 'pipe' })).toThrow()
    } finally {
      rmSync(fixture, { recursive: true, force: true })
    }
  })
})
