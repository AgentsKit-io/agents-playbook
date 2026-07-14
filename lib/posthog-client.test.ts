import { describe, expect, it } from 'vitest'
import { isPostHogConfigured } from './posthog-client'

describe('PostHog configuration', () => {
  it('requires an explicit opt-in and a non-placeholder project key', () => {
    expect(isPostHogConfigured({ enabled: undefined, key: 'phc_live' })).toBe(false)
    expect(isPostHogConfigured({ enabled: 'false', key: 'phc_live' })).toBe(false)
    expect(isPostHogConfigured({ enabled: 'true', key: undefined })).toBe(false)
    expect(isPostHogConfigured({ enabled: 'true', key: 'phc_...' })).toBe(false)
    expect(isPostHogConfigured({ enabled: 'true', key: 'phc_live' })).toBe(true)
  })
})
