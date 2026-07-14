import { expect, test } from '@playwright/test'

const ask = async (page: import('@playwright/test').Page, question: string) => {
  await page.getByRole('button', { name: 'Ask Playbook' }).click()
  const input = page.getByRole('textbox', { name: 'Ask a question' })
  await expect(input).toBeFocused()
  await input.fill(question)
  await input.press('Enter')
}

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => localStorage.clear())
  await page.reload()
})

test('answers exact facts locally without a backend request', async ({ page }) => {
  let backendRequests = 0
  await page.route('https://ask.agentskit.io/**', async (route) => {
    backendRequests += 1
    await route.abort()
  })
  await ask(page, 'ADR Pattern')
  await expect(page.locator('[data-ak-message="assistant"]')).toContainText('ADR Pattern')
  await expect(page.locator('[data-ak-answer-path="local"]')).toHaveText('instant · local')
  expect(backendRequests).toBe(0)
})

test('renders deterministic choices for an ambiguous alias', async ({ page }) => {
  await ask(page, 'universal')
  await expect(page.getByText('More than one exact local answer matches.').first()).toBeVisible()
  await expect(page.getByRole('button', { name: /Architecture — Universal Principles/ })).toBeVisible()
  await expect(page.locator('[data-ak-answer-path="local"]')).toBeVisible()
})

test('marks backend provenance only after a response is observed', async ({ page }) => {
  await page.route('https://ask.agentskit.io/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'text/plain',
      body: '## Combined approach\n\nUse **ADR** and governance together.\n\n```ts\nconst ready = true\n```',
    })
  })
  await ask(page, 'How should architecture and governance work together in my unusual migration?')
  await expect(page.locator('[data-ak-message="assistant"]')).toContainText('Combined approach')
  await expect(page.locator('[data-ak-message="assistant"] pre code')).toContainText('const ready = true')
  await expect(page.locator('[data-ak-answer-path="backend"]')).toHaveText('grounded · backend')
})

test('retries local artifacts after a transient first-load failure', async ({ page }) => {
  let artifactRequests = 0
  let backendRequests = 0
  await page.route('**/deterministic/*.json', async (route) => {
    artifactRequests += 1
    if (artifactRequests === 1) await route.fulfill({ status: 503, body: '{}' })
    else await route.continue()
  })
  await page.route('https://ask.agentskit.io/**', async (route) => {
    backendRequests += 1
    await route.abort()
  })

  await page.getByRole('button', { name: 'Ask Playbook' }).click()
  await expect(page.getByRole('textbox', { name: 'Ask a question' })).toBeVisible()
  await page.getByRole('button', { name: 'Close' }).click()
  await page.waitForTimeout(1_100)
  await ask(page, 'ADR Pattern')

  await expect(page.locator('[data-ak-answer-path="local"]')).toHaveText('instant · local')
  expect(artifactRequests).toBeGreaterThanOrEqual(4)
  expect(backendRequests).toBe(0)
})

test('labels a successful backend answer in degraded artifact mode', async ({ page }) => {
  await page.route('**/deterministic/*.json', (route) => route.fulfill({ status: 503, body: '{}' }))
  await page.route('https://ask.agentskit.io/**', (route) => route.fulfill({
    status: 200,
    contentType: 'text/plain',
    body: 'Degraded mode still returns a verified backend stream.',
  }))
  await ask(page, 'ADR Pattern')
  await expect(page.locator('[data-ak-message="assistant"]')).toContainText('Degraded mode')
  await expect(page.locator('[data-ak-answer-path="backend"]')).toHaveText('grounded · backend')
})

test('keeps backend failures truthful and the mobile dialog inside the viewport', async ({ page, isMobile }) => {
  await page.route('https://ask.agentskit.io/**', (route) => route.fulfill({ status: 503, body: 'unavailable' }))
  await ask(page, 'Synthesize a novel policy that is not in this corpus')
  await expect(page.locator('[data-ak-answer-path="pending"]')).toHaveText('consulting backend')
  await expect(page.getByRole('alert').filter({ hasText: 'Ask request failed' })).toBeVisible()
  if (isMobile) {
    const box = await page.getByRole('dialog', { name: 'Ask the Playbook' }).boundingBox()
    const viewport = page.viewportSize()
    expect(box).not.toBeNull()
    expect(viewport).not.toBeNull()
    expect(box!.x).toBeGreaterThanOrEqual(0)
    expect(box!.y).toBeGreaterThanOrEqual(0)
    expect(box!.x + box!.width).toBeLessThanOrEqual(viewport!.width)
    expect(box!.y + box!.height).toBeLessThanOrEqual(viewport!.height)
  }
})
