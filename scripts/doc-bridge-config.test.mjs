import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const config = JSON.parse(readFileSync(new URL('../doc-bridge.config.json', import.meta.url), 'utf8'))

describe('doc-bridge config', () => {
  it('declares the published guide folders as reader content', () => {
    const exclude = config.analysis.documents.exclude
    expect(exclude.map((entry) => entry.pattern)).toEqual([
      'content/docs/pillars/**',
      'content/docs/phases/**',
      'content/docs/prompts/**',
      'content/docs/templates/**',
    ])
    for (const entry of exclude) {
      expect(entry.reason).toBe(
        "Published Playbook guides for readers; they give advice for other repositories and do not describe this repository's code.",
      )
    }
  })
})
