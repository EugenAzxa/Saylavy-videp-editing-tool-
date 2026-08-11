import { readFileSync } from 'node:fs'
import { expect, test, type Page } from '@playwright/test'
import { importVideo, makeTestVideo } from './fixtures'

/**
 * End-to-end cover for the whole path a user actually walks: bring a file in,
 * change it, and get a playable MP4 back out.
 *
 * The last test in this file is the one that matters most — it opens the
 * exported file and checks it is a real MP4, because "the export finished
 * without throwing" and "the family can play the film" are not the same claim.
 */

const MIN_TARGET_PX = 56

async function visibleButtonHeights(page: Page): Promise<number[]> {
  return page.evaluate((): number[] => {
    const heights: number[] = []
    for (const element of document.querySelectorAll('button')) {
      const box = element.getBoundingClientRect()
      if (box.width > 0 && box.height > 0) heights.push(box.height)
    }
    return heights
  })
}

test.beforeEach(async ({ page }) => {
  await page.goto('/')
})

test('opens on an empty state that explains what to do and promises privacy', async ({ page }) => {
  await expect(page.getByRole('heading', { name: /start with your videos/i })).toBeVisible()
  await expect(page.getByText(/never uploaded/i)).toBeVisible()
})

test.describe('accessibility guarantees', () => {
  // These are the promises made at the top of styles/global.css. They are
  // easy to erode one component at a time, so they are asserted rather than
  // left to code review.

  test('body text is 20px', async ({ page }) => {
    const size = await page.evaluate(() => getComputedStyle(document.body).fontSize)
    expect(Number.parseFloat(size)).toBeGreaterThanOrEqual(20)
  })

  test('every visible button clears the 56px target on the empty state', async ({ page }) => {
    const heights = await visibleButtonHeights(page)
    expect(heights.length).toBeGreaterThan(0)
    expect(Math.min(...heights)).toBeGreaterThanOrEqual(MIN_TARGET_PX)
  })

  test('every visible button clears the 56px target once editing', async ({ page }) => {
    await importVideo(page, await makeTestVideo(page))
    await expect(page.getByRole('heading', { name: /your film, piece by piece/i })).toBeVisible()

    const heights = await visibleButtonHeights(page)
    expect(Math.min(...heights)).toBeGreaterThanOrEqual(MIN_TARGET_PX)
  })

  test('the position control is a real slider, so it works from the keyboard', async ({ page }) => {
    await importVideo(page, await makeTestVideo(page))
    await expect(page.getByRole('slider', { name: /position in the film/i })).toBeVisible()
  })
})

test.describe('editing', () => {
  test('an imported video becomes one piece', async ({ page }) => {
    await importVideo(page, await makeTestVideo(page))

    await expect(page.getByText(/there is one piece so far/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /piece 1 of 1/i })).toBeVisible()
  })

  test('cutting in the middle produces two pieces, and undo puts it back', async ({ page }) => {
    await importVideo(page, await makeTestVideo(page))
    await expect(page.getByRole('button', { name: /piece 1 of 1/i })).toBeVisible()

    // Park the playhead somewhere safely inside the clip before cutting.
    await page.getByRole('slider', { name: /position in the film/i }).fill('1.5')
    await page.getByRole('button', { name: /^cut here/i }).click()

    await expect(page.getByText(/there are 2 pieces/i)).toBeVisible()

    await page.getByRole('button', { name: /^undo/i }).click()
    await expect(page.getByText(/there is one piece so far/i)).toBeVisible()
  })

  test('a piece can be reordered and removed', async ({ page }) => {
    await importVideo(page, await makeTestVideo(page))
    await page.getByRole('slider', { name: /position in the film/i }).fill('1.5')
    await page.getByRole('button', { name: /^cut here/i }).click()
    await expect(page.getByText(/there are 2 pieces/i)).toBeVisible()

    // Select the second piece; it should then be able to move earlier but not later.
    await page.getByRole('button', { name: /piece 2 of 2/i }).click()
    await expect(page.getByRole('heading', { name: /^piece 2 of 2$/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /move later/i })).toBeDisabled()

    await page.getByRole('button', { name: /move earlier/i }).click()
    await expect(page.getByRole('heading', { name: /^piece 1 of 2$/i })).toBeVisible()

    await page.getByRole('button', { name: /remove this piece/i }).click()
    await expect(page.getByText(/there is one piece so far/i)).toBeVisible()
  })

  test('trimming shortens the film', async ({ page }) => {
    await importVideo(page, await makeTestVideo(page))
    await page.getByRole('button', { name: /piece 1 of 1/i }).click()

    const lengthBefore = await page.locator('.piece__length').first().innerText()
    await page.getByRole('button', { name: /cut off 1 second/i }).first().click()
    await expect(page.locator('.piece__length').first()).not.toHaveText(lengthBefore)
  })
})

test('exports a genuine, playable MP4', async ({ page }) => {
  await importVideo(page, await makeTestVideo(page))
  await expect(page.getByRole('heading', { name: /save the finished film/i })).toBeVisible()

  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: /save the film to this computer/i }).click()

  // Scoped to the visible confirmation: the same words also go to the
  // screen-reader live region, and an unscoped match would find both.
  await expect(page.locator('.save__done')).toBeVisible({ timeout: 120_000 })

  const file = await download
  expect(file.suggestedFilename()).toBe('Tribute film.mp4')

  const path = await file.path()
  const bytes = readFileSync(path)

  expect(bytes.byteLength).toBeGreaterThan(1024)
  // Bytes 4-8 of every ISO base media file are the 'ftyp' box type. If this
  // holds, a player will recognise the file rather than refusing to open it.
  expect(bytes.subarray(4, 8).toString('ascii')).toBe('ftyp')
})
