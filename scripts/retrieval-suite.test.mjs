import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const suite = JSON.parse(readFileSync(resolve('docs/bench/retrieval-suite-v1.json'), 'utf8'))

describe('retrieval benchmark suite', () => {
  it('declares between 20 and 40 uniquely identified cases', () => {
    expect(suite.evalFormatVersion).toBe('2026-04')
    expect(suite.cases.length).toBeGreaterThanOrEqual(20)
    expect(suite.cases.length).toBeLessThanOrEqual(40)
    expect(new Set(suite.cases.map((entry) => entry.id)).size).toBe(suite.cases.length)
  })

  it('only expects repository paths that exist', () => {
    for (const entry of suite.cases) {
      for (const target of entry.metadata.expectedTargets) {
        expect(existsSync(resolve(target)), `${entry.id}: ${target}`).toBe(true)
      }
    }
  })

  it('keeps the portable regex consistent with the expected targets', () => {
    for (const entry of suite.cases) {
      const pattern = new RegExp(entry.expected.regex.body)
      for (const target of entry.metadata.expectedTargets) expect(pattern.test(target), `${entry.id}: ${target}`).toBe(true)
    }
  })

  it('covers every question kind and writes no approved baseline', () => {
    const kinds = new Set(suite.cases.map((entry) => entry.metadata.kind))
    expect([...kinds].sort()).toEqual(['ownership', 'path', 'question', 'symbol'])
    expect(existsSync(resolve('docs/bench/retrieval-baseline-v1.json'))).toBe(false)
  })
})
