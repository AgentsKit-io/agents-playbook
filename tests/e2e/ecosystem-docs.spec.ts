import { expect, test, type Page } from '@playwright/test'

// The shell bar is #ak-eco. The shell footer also has a navigation labelled
// "AgentsKit ecosystem", so the bar is located by id, not by role and name.

const PRODUCT_LABELS = ['AgentsKit', 'Registry', 'Chat', 'Doc Bridge', 'Code Review', 'Harness']

// Below 768px shell v1 collapses the product links behind an "Ecosystem"
// disclosure button; open it so the links can be asserted.
async function openProductMenu(page: Page) {
  // The shell renders asynchronously; wait for the bar before deciding.
  await expect(page.locator('nav#ak-eco .ak-eco-link').first()).toBeAttached()
  const toggle = page.locator('nav#ak-eco .ak-eco-toggle')
  if (!(await toggle.isVisible())) return
  if ((await toggle.getAttribute('aria-expanded')) !== 'true') await toggle.click()
  await expect(toggle).toHaveAttribute('aria-expanded', 'true')
}

test('renders public product navigation and the shared ecosystem showcase', async ({ page }) => {
  await page.goto('/')

  const bar = page.locator('nav#ak-eco')
  await openProductMenu(page)
  for (const label of PRODUCT_LABELS) {
    const productLink = bar.locator('.ak-eco-link', { hasText: label })
    await expect(productLink).toBeVisible()
    await expect(productLink).not.toHaveAttribute('target', '_blank')
  }
  await expect(bar.locator('.ak-eco-link', { hasText: 'Playbook' })).toHaveCount(0)
  await expect(bar.locator('[aria-current="page"]')).toHaveCount(0)
  await expect(page.locator('agentskit-footer[current="playbook"]')).toBeAttached()
  await expect(page.locator('agentskit-aurora')).toHaveCount(1)

  await expect(page.locator('agentskit-ecosystem[current="playbook"]')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Build the agent. Then take it all the way.' })).toBeVisible()
})

test('keeps the ecosystem bar inside the mobile viewport', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'mobile layout contract')
  await page.goto('/docs')
  const viewport = page.viewportSize()
  expect(viewport).not.toBeNull()

  // Shell v1 owns the mobile menu: a 44px disclosure toggle that reveals the
  // product links. The host only checks touch targets and that the bar never
  // widens the page, open or closed.
  const toggle = page.locator('nav#ak-eco .ak-eco-toggle')
  await expect(toggle).toBeVisible()
  await expect(toggle).toHaveAttribute('aria-expanded', 'false')
  expect((await toggle.boundingBox())!.height).toBeGreaterThanOrEqual(44)

  await openProductMenu(page)
  for (const link of await page.locator('nav#ak-eco').getByRole('link').all()) {
    const box = await link.boundingBox()
    expect(box).not.toBeNull()
    expect(box!.height).toBeGreaterThanOrEqual(44)
  }

  const bodyWidth = await page.evaluate(() => document.documentElement.scrollWidth)
  expect(bodyWidth).toBeLessThanOrEqual(viewport!.width)

  await page.keyboard.press('Escape')
  await expect(toggle).toHaveAttribute('aria-expanded', 'false')
})

test('certifies ecosystem layout across required mobile and desktop widths', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'one browser certifies explicit viewport widths')
  for (const width of [320, 375, 768, 1280, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/')
    const bar = page.locator('nav#ak-eco')
    await openProductMenu(page)
    await expect(bar.locator('.ak-eco-link', { hasText: 'AgentsKit' }).first()).toBeInViewport()
    const bodyWidth = await page.evaluate(() => document.documentElement.scrollWidth)
    expect(bodyWidth).toBeLessThanOrEqual(width)
    await expect(page.getByRole('heading', { name: 'Build the agent. Then take it all the way.' })).toBeVisible()
  }
})

test('publishes the agent route, canonical raw root, and contextual handoffs', async ({ page }) => {
  await page.goto('/for-agents')
  await expect(page).toHaveURL(/\/docs\/for-agents$/)
  await expect(page.getByRole('heading', { name: 'For agents', exact: true })).toBeVisible()

  await page.goto('/docs')
  await expect(page.getByRole('link', { name: 'View raw .md' })).toHaveAttribute('href', '/raw/index.md')
  const handoff = page.getByRole('heading', { name: 'Continue when the problem changes' }).locator('..')
  await expect(handoff.getByRole('link')).toHaveCount(3)
  await expect(handoff.getByRole('link').first()).toHaveCSS('text-decoration-line', 'none')
  await expect(handoff).toContainText('Doc Bridge')
  await expect(handoff).toContainText('AgentsKit Chat')
  await expect(handoff).toContainText('AgentsKit Code Review')
  await expect(handoff).not.toContainText('AgentsKit OS')
})
