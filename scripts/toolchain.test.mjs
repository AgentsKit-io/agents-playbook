import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
const deps = { ...pkg.dependencies, ...pkg.devDependencies }

describe('toolchain majors', () => {
  it('runs vitest 5 with any @vitest/* companions on 5', () => {
    const family = Object.entries(deps).filter(
      ([name]) => name === 'vitest' || name.startsWith('@vitest/'),
    )
    expect(deps.vitest).toBeDefined()
    for (const [, range] of family) expect(range).toMatch(/^[\^~]?5\./)
  })

  it('holds typescript at 5.x until next build can load next.config.ts on 7', () => {
    expect(deps.typescript).toMatch(/^[\^~]?5\./)
  })
})
