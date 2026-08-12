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

test.describe('what happens afterwards', () => {
  // Two of these three do not exist. The badges are the only thing stopping
  // the start screen from claiming they do, and this section will be shown to
  // investors — so the labels are asserted, not trusted.

  test('shows the three outcomes with honest status labels', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /when the film is finished/i })).toBeVisible()

    await expect(page.locator('.aw__item--now')).toContainText('Keep the film')
    await expect(page.locator('.aw__item--now .aw__badge')).toHaveText(/works today/i)

    await expect(page.locator('.aw__item--preview')).toContainText('A code on the stone')
    await expect(page.locator('.aw__item--preview .aw__badge')).toHaveText(/preview/i)

    await expect(page.locator('.aw__item--planned')).toContainText('Let others add to it')
    await expect(page.locator('.aw__item--planned .aw__badge')).toHaveText(/planned/i)
  })

  test('says plainly that only one of them is built', async ({ page }) => {
    await expect(page.locator('.aw__footnote')).toContainText(/only the first of these is built/i)
  })
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

  test('a piece can be dragged along the timeline, exactly once', async ({ page }) => {
    await loadExample(page)
    const names = () => page.locator('.tlclip__name').allInnerTexts()
    const before = await names()

    const first = page.locator('.tlclip').first()
    const box = await first.boundingBox()
    expect(box).not.toBeNull()

    await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2)
    await page.mouse.down()
    await page.mouse.move(box!.x + 400, box!.y + box!.height / 2, { steps: 10 })
    await page.mouse.up()

    // Exactly one piece moved. A side effect inside a state updater once made
    // this run twice, which shuffled the film instead of moving one piece.
    const after = await names()
    expect(after).toEqual([before[1], before[2], before[0]])
  })

  test('a short press selects rather than drags', async ({ page }) => {
    await loadExample(page)
    const before = await page.locator('.tlclip__name').allInnerTexts()

    await page.locator('.tlclip').first().click()
    await expect(page.getByRole('heading', { name: /^piece 1$/i })).toBeVisible()
    expect(await page.locator('.tlclip__name').allInnerTexts()).toEqual(before)
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

  test('the card lands at the playhead, not at the end', async ({ page }) => {
    await loadExample(page)
    // Nothing selected, playhead inside the first of three 4-second pieces.
    await page.getByRole('slider', { name: /position in the film/i }).fill('2')
    await page.getByRole('button', { name: /^add text/i }).click()

    const index = await page
      .locator('.tlclip')
      .evaluateAll((els) => els.findIndex((el) => el.classList.contains('tlclip--text')))
    expect(index).toBe(1)
  })

  test('words can be put over footage, and taken off again', async ({ page }) => {
    await loadExample(page)
    await page.locator('.tlclip').first().click()

    await page.getByRole('button', { name: /add words over this/i }).click()
    await page.getByLabel('Overlay line 1').fill('Margaret Hughes')

    // The piece keeps its footage — this is an overlay, not a card.
    await expect(page.locator('.tlclip').first()).not.toHaveClass(/tlclip--text/)
    await expect(page.locator('.tlclip').first().locator('.tlclip__mark')).toBeVisible()

    // Words can sit at any of the three heights over the picture.
    for (const where of ['Top', 'Middle', 'Bottom']) {
      const button = page.getByRole('button', { name: new RegExp(`^${where}$`) })
      await button.click()
      await expect(button).toBeDisabled() // disabled means "this is the one in use"
    }

    await page.getByRole('button', { name: /remove the words/i }).click()
    await expect(page.locator('.tlclip').first().locator('.tlclip__mark')).toHaveCount(0)
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
