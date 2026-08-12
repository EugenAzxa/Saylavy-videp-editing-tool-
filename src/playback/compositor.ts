/**
 * Painting one frame.
 *
 * Shared by the preview and the export so that what the user approves on
 * screen is precisely what lands in the file. If a change ever needs to be
 * made to how a frame is composed, it must be made here and nowhere else.
 */

import { fontStack, visibleLines } from '@/core/titles'
import type { TitleSpec } from '@/core/types'

/** The colour behind letterboxed footage and on empty stretches of timeline. */
export const BACKDROP = '#000000'

export type Drawable = HTMLVideoElement | HTMLImageElement | HTMLCanvasElement | OffscreenCanvas | ImageBitmap

/** Natural pixel size of a drawable, or null if it is not ready to paint yet. */
export function sourceSize(source: Drawable): { width: number; height: number } | null {
  if (source instanceof HTMLVideoElement) {
    if (source.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return null
    return { width: source.videoWidth, height: source.videoHeight }
  }
  if (source instanceof HTMLImageElement) {
    if (!source.complete || source.naturalWidth === 0) return null
    return { width: source.naturalWidth, height: source.naturalHeight }
  }
  return { width: source.width, height: source.height }
}

export function clearFrame(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  ctx.fillStyle = BACKDROP
  ctx.fillRect(0, 0, width, height)
}

/**
 * Draw `source` centred inside the output frame, scaled to fit without
 * cropping, with black bars filling whatever is left over.
 *
 * "Contain" rather than "cover" because cropping is not ours to do. A
 * portrait phone video of someone's last birthday gets pillarboxed; it does
 * not get their face cut off to fill a widescreen frame.
 *
 * Returns false if the source had nothing to paint yet, so the caller can
 * decide whether to hold the previous frame or show black.
 */
export function drawContained(
  ctx: CanvasRenderingContext2D,
  source: Drawable,
  frameWidth: number,
  frameHeight: number,
): boolean {
  const size = sourceSize(source)
  clearFrame(ctx, frameWidth, frameHeight)
  if (!size || size.width === 0 || size.height === 0) return false

  const scale = Math.min(frameWidth / size.width, frameHeight / size.height)
  const width = size.width * scale
  const height = size.height * scale

  ctx.drawImage(source, (frameWidth - width) / 2, (frameHeight - height) / 2, width, height)
  return true
}

/**
 * Draw a text card.
 *
 * Sizes are fractions of the frame height, never fixed pixels, so a card looks
 * identical in the 480px-wide preview and the 1080p export. Getting this wrong
 * is the classic way a title looks right on screen and wrong in the file.
 *
 * The font stack is a system one (see `core/titles.ts`) precisely so that
 * `fillText` can draw it synchronously — a webfont that has not finished
 * loading falls back silently, and nobody notices until the family plays it.
 */
export function drawTitle(
  ctx: CanvasRenderingContext2D,
  title: TitleSpec,
  frameWidth: number,
  frameHeight: number,
): void {
  ctx.fillStyle = title.background
  ctx.fillRect(0, 0, frameWidth, frameHeight)

  const lines = visibleLines(title)
  if (lines.length === 0) return

  // The first line is the name or the sentiment and carries the weight; the
  // rest are dates or a short quotation, and sit quieter beneath it.
  const leadSize = frameHeight * 0.11
  const restSize = frameHeight * 0.062
  const gap = frameHeight * 0.035
  const stack = fontStack(title.fontId)

  const heights = lines.map((_, index) => (index === 0 ? leadSize : restSize))
  const total = heights.reduce((sum, height) => sum + height, 0) + gap * (lines.length - 1)

  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = title.color

  let y = frameHeight / 2 - total / 2
  lines.forEach((line, index) => {
    const size = heights[index]!
    y += size / 2
    ctx.font = `${index === 0 ? '600' : '400'} ${Math.round(size)}px ${stack}`
    ctx.fillText(line, frameWidth / 2, y, frameWidth * 0.86)
    y += size / 2 + gap
  })

  // A hairline rule under the lead line, which reads as considered rather than
  // as a default. Only when there is something beneath it to separate.
  if (lines.length > 1) {
    const ruleWidth = frameWidth * 0.14
    const ruleY = frameHeight / 2 - total / 2 + leadSize + gap * 0.15
    ctx.fillRect(frameWidth / 2 - ruleWidth / 2, ruleY, ruleWidth, Math.max(1, frameHeight * 0.0025))
  }
}
