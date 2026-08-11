import { readFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'

/**
 * Production smoke test: the real built bundle, served with the real
 * `vercel.json` headers, driven end to end.
 *
 * This exists because the two things most likely to break on deploy and only
 * on deploy are the Content-Security-Policy and the render-blocking theme
 * script — neither of which the dev server exercises. It uses no
 * development-only fixtures: the example film is production code, so the
 * whole path from "generate video" to "download an MP4" is genuine.
 *
 * Run with `npm run test:prod` before every deploy.
 */

test('serves the security headers the privacy promise depends on', async ({ page }) => {
  const response = await page.goto('/')
  expect(response?.status()).toBe(200)

  const headers = response!.headers()
  const csp = headers['content-security-policy'] ?? ''

  // The claim on the front page is "nothing is sent anywhere". `connect-src
  // 'self'` is what makes that enforced by the browser rather than merely
  // asserted by us — no fetch, XHR or WebSocket can reach another origin.
  expect(csp).toContain("connect-src 'self'")
  expect(csp).toContain("default-src 'self'")
  expect(csp).toContain("object-src 'none'")
  expect(csp).toContain("frame-ancestors 'none'")

  expect(headers['x-content-type-options']).toBe('nosniff')
  expect(headers['referrer-policy']).toBe('no-referrer')
})

test('nothing is blocked by the Content-Security-Policy', async ({ page }) => {
  const violations: string[] = []
  page.on('console', (message) => {
    const text = message.text()
    if (/content security policy|refused to/i.test(text)) violations.push(text)
  })
  page.on('pageerror', (error) => violations.push(`pageerror: ${error.message}`))

  await page.goto('/')
  await expect(page.getByRole('heading', { name: /start with your videos/i })).toBeVisible()

  // The theme script is render-blocking and same-origin; if the CSP or the
  // path were wrong, the page would load unthemed.
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')

  expect(violations).toEqual([])
})

test('a real film can be made and saved from the built bundle', async ({ page }) => {
  await page.goto('/')

  await page.getByRole('button', { name: /try it with an example film/i }).click()
  await expect(page.getByText(/there are 3 pieces/i)).toBeVisible({ timeout: 120_000 })

  await page.getByRole('slider', { name: /position in the film/i }).fill('2')
  await page.getByRole('button', { name: /^cut here/i }).click()
  await expect(page.getByText(/there are 4 pieces/i)).toBeVisible()

  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: /save the film to this computer/i }).click()
  await expect(page.locator('.save__done')).toBeVisible({ timeout: 150_000 })

  const bytes = readFileSync(await (await download).path())
  expect(bytes.byteLength).toBeGreaterThan(1024)
  expect(bytes.subarray(4, 8).toString('ascii')).toBe('ftyp')
})
