import type { Page } from '@playwright/test'

/**
 * A real MP4, generated inside the browser under test.
 *
 * Committing a sample video to the repository would bloat every clone, and
 * asking a developer to supply their own footage before the tests will run is
 * a poor welcome. Instead the app exposes a generator in development builds
 * (see `src/dev/sampleVideo.ts`) which encodes a few seconds of colour and
 * tone with the same library the editor exports through — so the fixture is
 * guaranteed to be a genuinely decodable file rather than an approximation.
 */

declare global {
  interface Window {
    __saylavyMakeSampleVideo?: (seconds?: number) => Promise<Uint8Array>
  }
}

export async function makeTestVideo(page: Page, seconds = 3): Promise<Buffer> {
  // The generator is attached by a dynamic import, so it may not be there the
  // instant the page loads.
  await page.waitForFunction(() => typeof window.__saylavyMakeSampleVideo === 'function')

  const numbers = await page.evaluate(async (length: number) => {
    const bytes = await window.__saylavyMakeSampleVideo!(length)
    return Array.from(bytes)
  }, seconds)

  return Buffer.from(numbers)
}

/** Hand a generated file to the editor's file input. */
export async function importVideo(page: Page, buffer: Buffer, name = 'memory.mp4'): Promise<void> {
  await page.locator('input[type=file]').first().setInputFiles({
    name,
    mimeType: 'video/mp4',
    buffer,
  })
}
