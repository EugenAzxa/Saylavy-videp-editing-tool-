/**
 * A generated MP4 for developers and for the test suite.
 *
 * Two jobs:
 *
 * 1. It lets a developer try the editor immediately, without having to find
 *    footage of their own. Run `npm run dev`, open the console and call
 *    `__saylavySampleVideo()`; it downloads a few seconds of video.
 * 2. It is the fixture the Playwright tests import (see `tests/fixtures.ts`).
 *    Building it with the same encoder the app exports through guarantees the
 *    file is genuinely decodable, which a `MediaRecorder` capture in a
 *    headless browser is not — that was tried first, and produced a 110-byte
 *    file containing no frames at all.
 *
 * This is a plain, obvious test pattern on purpose. The polished version a
 * real user is offered lives in `media/exampleFilm.ts`.
 *
 * Only loaded when `import.meta.env.DEV` is true, so it is not in the
 * production bundle.
 */

import { encodeClip } from '@/media/encodeClip'

const WIDTH = 640
const HEIGHT = 360
const FPS = 30

export async function makeSampleVideo(seconds = 3): Promise<Uint8Array<ArrayBuffer>> {
  return encodeClip({
    seconds,
    width: WIDTH,
    height: HEIGHT,
    fps: FPS,
    toneHz: 220,
    // Every frame looks different, so a wrong frame after a cut is visible.
    draw: (ctx, time) => {
      ctx.fillStyle = `hsl(${Math.round(time * 120) % 360} 70% 45%)`
      ctx.fillRect(0, 0, WIDTH, HEIGHT)
      ctx.fillStyle = '#ffffff'
      ctx.font = 'bold 64px sans-serif'
      ctx.fillText(`${time.toFixed(1)}s`, 40, 200)
    },
  })
}

/** Build a sample and drop it into the downloads folder. */
export async function downloadSampleVideo(seconds = 3): Promise<void> {
  const bytes = await makeSampleVideo(seconds)
  const url = URL.createObjectURL(new Blob([bytes], { type: 'video/mp4' }))
  const link = document.createElement('a')
  link.href = url
  link.download = 'sample.mp4'
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
