/**
 * Painting one frame.
 *
 * Shared by the preview and the export so that what the user approves on
 * screen is precisely what lands in the file. If a change ever needs to be
 * made to how a frame is composed, it must be made here and nowhere else.
 */

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
