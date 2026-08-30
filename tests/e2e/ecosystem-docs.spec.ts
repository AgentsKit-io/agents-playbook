import { expect, test } from '@playwright/test'

const PRODUCT_LABELS = ['AgentsKit', 'Registry', 'Chat', 'Playbook', 'Doc Bridge', 'AKOS']

test('renders six-product navigation and the shared ecosystem showcase', async ({ page }) => {
  await page.goto('/')

  const bar = page.getByRole('navigation', { name: 'AgentsKit ecosystem' })
  for (const label of PRODUCT_LABELS) {
    const productLink = bar.locator('.ak-eco-link', { hasText: label })
    await expect(productLink).toBeVisible()
    await expect(productLink).not.toHaveAttribute('target', '_blank')
  }
  await expect(bar.locator('.ak-eco-link', { hasText: 'Playbook' })).toHaveAttribute('aria-current', 'page')

  await expect(page.locator('agentskit-ecosystem[current="playbook"]')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Build the agent. Then take it all the way.' })).toBeVisible()
})

test('keeps the ecosystem bar inside the mobile viewport', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'mobile layout contract')
  await page.goto('/docs')
  const viewport = page.viewportSize()
  expect(viewport).not.toBeNull()

  for (const link of await page.getByRole('navigation', { name: 'AgentsKit ecosystem' }).getByRole('link').all()) {
    const box = await link.boundingBox()
    expect(box).not.toBeNull()
    expect(box!.height).toBeGreaterThanOrEqual(44)
  }

  const bar = page.getByRole('navigation', { name: 'AgentsKit ecosystem' })
  const flow = await bar.evaluate((element) => {
    const style = getComputedStyle(element)
    return { display: style.display, flexWrap: style.flexWrap, overflowX: style.overflowX }
  })
  expect(flow).toEqual({ display: 'flex', flexWrap: 'nowrap', overflowX: 'auto' })

  const current = await bar.locator('[aria-current="page"]').boundingBox()
  expect(current).not.toBeNull()
  expect(current!.x).toBeGreaterThanOrEqual(0)
  expect(current!.x + current!.width).toBeLessThanOrEqual(viewport!.width)
})

test('certifies ecosystem layout across required mobile and desktop widths', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'one browser certifies explicit viewport widths')
  for (const width of [320, 375, 768, 1280, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/')
    const bar = page.getByRole('navigation', { name: 'AgentsKit ecosystem' })
    await expect(bar.locator('.ak-eco-link', { hasText: 'Playbook' })).toBeInViewport()
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
  await expect(handoff.getByRole('link')).toHaveCount(4)
  await expect(handoff.getByRole('link').first()).toHaveCSS('text-decoration-line', 'none')
  await expect(handoff).toContainText('Doc Bridge')
  await expect(handoff).toContainText('AgentsKit Chat')
  await expect(handoff).toContainText('AgentsKit Code Review')
  await expect(handoff).toContainText('AgentsKit OS')
})
