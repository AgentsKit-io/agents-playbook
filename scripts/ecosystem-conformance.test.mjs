import { describe, expect, it } from 'vitest'
import { CRITERIA, LIMITS, runBounded, runConformance } from './ecosystem-conformance.mjs'

describe('ecosystem conformance runner', () => {
  it('kills a runaway child at the timeout', async () => {
    const r = await runBounded(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { timeoutMs: 300 })
    expect(r.termination).toBe('timeout')
  })

  it('caps captured output', async () => {
    const r = await runBounded(process.execPath, ['-e', `process.stdout.write('x'.repeat(${LIMITS.outputBytes * 2}))`])
    expect(r.truncated).toBe(true)
    expect(r.output.length).toBeLessThanOrEqual(LIMITS.outputBytes * 2)
  })

  it('fails closed on unsupported, failing, and throwing criteria, deterministically', async () => {
    const criteria = [
      { id: 'a', group: 'g', run: async () => ({ status: 'passed', failures: [] }) },
      { id: 'b', group: 'g', run: async () => ({ status: 'unsupported', failures: ['missing'] }) },
      { id: 'c', group: 'g', run: async () => { throw new Error('boom') } },
    ]
    const first = await runConformance({ criteria })
    const second = await runConformance({ criteria })
    expect(first).toEqual(second)
    expect(first.status).toBe('failed')
    expect(first.unsupported).toEqual(['b'])
    expect(first.criteria.map((c) => c.status)).toEqual(['passed', 'unsupported', 'failed'])
  })

  it('fails remaining criteria when the total budget is exhausted', async () => {
    const result = await runConformance({ criteria: CRITERIA.slice(0, 1), totalTimeoutMs: -1 })
    expect(result.criteria[0].status).toBe('failed')
  })

  it('redaction criterion passes and cleans its temp dir', async () => {
    const result = await runConformance({ criteria: CRITERIA.filter((c) => c.id === 'redaction') })
    expect(result.criteria[0]).toMatchObject({ status: 'passed', cleanup: { removed: true } })
  })

  it('lifecycle criterion runs the shared fixture and passes', async () => {
    const result = await runConformance({ criteria: CRITERIA.filter((c) => c.id === 'lifecycle-cancellation') })
    expect(result.criteria[0]).toMatchObject({ status: 'passed', failures: [] })
  })
})
