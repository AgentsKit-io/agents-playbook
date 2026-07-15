import { expect, test } from '@playwright/test'

const PRODUCT_LABELS = ['AgentsKit', 'Registry', 'Chat', 'Playbook', 'Doc Bridge', 'Code Review', 'AKOS']

test('renders seven-product navigation and six Playbook continuation cards', async ({ page }) => {
  await page.goto('/')

  const bar = page.getByRole('navigation', { name: 'AgentsKit ecosystem' })
  for (const label of PRODUCT_LABELS) {
    await expect(bar.getByRole('link', { name: label, exact: true })).toBeVisible()
    await expect(bar.getByRole('link', { name: label, exact: true })).not.toHaveAttribute('target', '_blank')
  }
  await expect(bar.getByRole('link', { name: 'Playbook', exact: true })).toHaveAttribute('aria-current', 'page')

  const section = page.getByRole('heading', { name: 'One workflow. Six useful next steps.' }).locator('..')
  const peerLinks = section.getByRole('link')
  await expect(peerLinks).toHaveCount(6)
  await expect(peerLinks).toContainText(['AgentsKit', 'AgentsKit Registry', 'AgentsKit Chat', 'Doc Bridge', 'AgentsKit Code Review', 'AgentsKit OS'])
  await expect(page.getByText(/build with AgentsKit.*connect docs through Doc Bridge.*enterprise scale with AKOS/)).toBeVisible()
})

test('keeps the ecosystem bar inside the mobile viewport', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'mobile layout contract')
  await page.goto('/docs')
  const viewport = page.viewportSize()
  expect(viewport).not.toBeNull()

  for (const link of await page.getByRole('navigation', { name: 'AgentsKit ecosystem' }).getByRole('link').all()) {
    const box = await link.boundingBox()
    expect(box).not.toBeNull()
    expect(box!.x).toBeGreaterThanOrEqual(0)
    expect(box!.x + box!.width).toBeLessThanOrEqual(viewport!.width)
    expect(box!.height).toBeGreaterThanOrEqual(44)
  }
})

test('certifies ecosystem layout at the four required widths', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'one browser certifies explicit viewport widths')
  for (const width of [375, 768, 1280, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/')
    const bar = page.getByRole('navigation', { name: 'AgentsKit ecosystem' })
    for (const label of PRODUCT_LABELS) {
      await expect(bar.getByRole('link', { name: label, exact: true })).toBeVisible()
    }
    const bodyWidth = await page.evaluate(() => document.documentElement.scrollWidth)
    expect(bodyWidth).toBeLessThanOrEqual(width)
    await expect(page.getByRole('heading', { name: 'One workflow. Six useful next steps.' })).toBeVisible()
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
