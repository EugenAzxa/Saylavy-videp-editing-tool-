import { readFileSync } from 'node:fs'
import { expect, test, type Page } from '@playwright/test'
import { importVideo, makeTestVideo } from './fixtures'

/**
 * End-to-end cover for the path a user actually walks: bring footage in,
 * change it, add words and music, and get a playable MP4 back out.
 *
 * The last test in this file is the one that matters most — it opens the
 * exported file and checks it is a real MP4, because "the export finished
 * without throwing" and "the family can play the film" are not the same claim.
 */

/** WCAG 2.2 target size. The chrome sits at exactly this; nothing goes under. */
const MIN_TARGET_PX = 44

async function visibleControlHeights(page: Page): Promise<number[]> {
  return page.evaluate((): number[] => {
    const heights: number[] = []
    for (const element of document.querySelectorAll('button, input[type=text], input[type=range]')) {
      const box = element.getBoundingClientRect()
      // Timeline clips size themselves to the footage; they are not chrome.
      if (element.classList.contains('tlclip')) continue
      if (box.width > 0 && box.height > 0) heights.push(box.height)
    }
    return heights
  })
}

/** Get to an editable film without needing a fixture file. */
async function loadExample(page: Page): Promise<void> {
  await page.getByRole('button', { name: /try an example first/i }).click()
  await expect(page.getByRole('button', { name: /^add text/i })).toBeVisible({ timeout: 120_000 })
}

test.beforeEach(async ({ page }) => {
  await page.goto('/')
})

test('opens on a start screen that explains itself and promises privacy', async ({ page }) => {
  await expect(page.getByRole('heading', { name: /make a film for the service/i })).toBeVisible()
  await expect(page.getByText(/nothing is uploaded/i)).toBeVisible()
})

test.describe('accessibility guarantees', () => {
  test('body text is at least 16px', async ({ page }) => {
    const size = await page.evaluate(() => getComputedStyle(document.body).fontSize)
    expect(Number.parseFloat(size)).toBeGreaterThanOrEqual(16)
  })

  test('controls clear the 44px target on the start screen', async ({ page }) => {
    const heights = await visibleControlHeights(page)
    expect(heights.length).toBeGreaterThan(0)
    expect(Math.min(...heights)).toBeGreaterThanOrEqual(MIN_TARGET_PX)
  })

  test('controls clear the 44px target once editing', async ({ page }) => {
    await loadExample(page)
    const heights = await visibleControlHeights(page)
    expect(Math.min(...heights)).toBeGreaterThanOrEqual(MIN_TARGET_PX)
  })

  test('the position control is a real slider, so it works from the keyboard', async ({ page }) => {
    await loadExample(page)
    await expect(page.getByRole('slider', { name: /position in the film/i })).toBeVisible()
  })

  test('content is still visible with reduced motion', async ({ page }) => {
    // Panels fade in from opacity 0. If the reduced-motion rules ever drop
    // `animation-fill-mode: both`, the page renders permanently blank for
    // anyone who has asked their system for less movement.
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.reload()

    const heading = page.getByRole('heading', { name: /make a film for the service/i })
    await expect(heading).toBeVisible()
    expect(await heading.evaluate((el) => getComputedStyle(el.closest('.start')!).opacity)).toBe('1')
  })
})

test.describe('light and dark', () => {
  test('starts dark, switches to light, and remembers the choice', async ({ page }) => {
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')

    await page.getByRole('button', { name: /switch to the light screen/i }).click()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')

    // The theme script must pick the saved choice back up before first paint,
    // or the page flashes the wrong colours on every load.
    await page.reload()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  })
})

test.describe('editing', () => {
  test('an imported video becomes one piece on the timeline', async ({ page }) => {
    await importVideo(page, await makeTestVideo(page))
    await expect(page.getByText(/^1 piece/)).toBeVisible()
    await expect(page.locator('.tlclip')).toHaveCount(1)
  })

  test('the example film gives you three pieces to practise on', async ({ page }) => {
    await loadExample(page)
    await expect(page.locator('.tlclip')).toHaveCount(3)
  })

  test('cutting produces two pieces, and undo puts it back', async ({ page }) => {
    await importVideo(page, await makeTestVideo(page))
    await expect(page.locator('.tlclip')).toHaveCount(1)

    await page.getByRole('slider', { name: /position in the film/i }).fill('1.5')
    await page.getByRole('button', { name: /^cut here/i }).click()
    await expect(page.locator('.tlclip')).toHaveCount(2)

    await page.getByRole('button', { name: /^undo/i }).click()
    await expect(page.locator('.tlclip')).toHaveCount(1)
  })

  test('a piece can be selected, reordered and deleted', async ({ page }) => {
    await loadExample(page)

    await page.locator('.tlclip').nth(2).click()
    await expect(page.getByRole('heading', { name: /^piece 3$/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /move later/i })).toBeDisabled()

    await page.getByRole('button', { name: /move earlier/i }).click()
    await expect(page.getByRole('heading', { name: /^piece 2$/i })).toBeVisible()

    await page.getByRole('button', { name: /^delete/i }).click()
    await expect(page.locator('.tlclip')).toHaveCount(2)
  })

  test('trimming shortens the piece', async ({ page }) => {
    await loadExample(page)
    await page.locator('.tlclip').first().click()

    const before = await page.locator('.tlclip__len').first().innerText()
    await page.getByRole('button', { name: /^cut 1s$/i }).first().click()
    await expect(page.locator('.tlclip__len').first()).not.toHaveText(before)
  })
})

test.describe('text cards', () => {
  test('adds a card, selects it, and shows it in the preview', async ({ page }) => {
    await loadExample(page)
    await page.locator('.tlclip').first().click()
    await page.getByRole('button', { name: /^add text/i }).click()

    await expect(page.getByRole('heading', { name: /^text card$/i })).toBeVisible()
    await expect(page.locator('.tlclip')).toHaveCount(4)
    // The card goes straight after the selected piece, and becomes piece 2.
    await expect(page.locator('.ipanel__meta').first()).toContainText('Piece 2')
  })

  test('the words are editable and reach the timeline', async ({ page }) => {
    await loadExample(page)
    await page.getByRole('button', { name: /^add text/i }).click()

    await page.getByLabel('Line 1').fill('Margaret Ellen Hughes')
    await expect(page.locator('.tlclip--text .tlclip__title')).toHaveText('Margaret Ellen Hughes')
  })

  test('the font can be changed', async ({ page }) => {
    await loadExample(page)
    await page.getByRole('button', { name: /^add text/i }).click()

    const typewriter = page.getByRole('button', { name: /typewriter/i })
    await typewriter.click()
    await expect(typewriter).toHaveAttribute('aria-pressed', 'true')
  })
})

test('music can be added from the built-in pieces', async ({ page }) => {
  await loadExample(page)

  await page.getByRole('button', { name: /stillness/i }).click()
  // Generating and encoding three minutes of audio takes a moment.
  await expect(page.locator('.tlmusic')).toBeVisible({ timeout: 120_000 })
  await expect(page.getByRole('slider', { name: /volume/i })).toBeVisible()

  await page.getByRole('button', { name: /remove music/i }).click()
  await expect(page.getByText(/^no music$/i)).toBeVisible()
})

test('exports a genuine, playable MP4 and offers a QR code', async ({ page }) => {
  await importVideo(page, await makeTestVideo(page))

  await page.getByRole('button', { name: /export film/i }).click()
  await expect(page.getByRole('dialog')).toBeVisible()

  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: /export to this computer/i }).click()
  await expect(page.locator('.save__done')).toBeVisible({ timeout: 150_000 })

  const file = await download
  expect(file.suggestedFilename()).toBe('Tribute film.mp4')

  const bytes = readFileSync(await file.path())
  expect(bytes.byteLength).toBeGreaterThan(1024)
  // Bytes 4-8 of every ISO base media file are the 'ftyp' box type.
  expect(bytes.subarray(4, 8).toString('ascii')).toBe('ftyp')

  // The share step is a demonstration, and has to keep saying so.
  await expect(page.locator('.share__tag')).toHaveText(/preview/i)
  await expect(page.getByText(/not live yet/i)).toBeVisible()
  await expect(page.locator('.share__qr img')).toBeVisible()
})
