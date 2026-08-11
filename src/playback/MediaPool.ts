/**
 * The hidden `<video>` and `<img>` elements the preview draws from.
 *
 * Preview playback uses real media elements rather than Mediabunny's decoders,
 * which is a deliberate split from the export path (see `export/`). Media
 * elements give us hardware-accelerated decode, correct audio, and smooth
 * real-time playback for free. Mediabunny gives us frame-exact, faster-than-
 * real-time decode with no dropped frames, which is what an export needs and
 * a preview does not.
 *
 * One element per asset, not per clip: three clips cut from the same wedding
 * video share one decoder rather than three.
 */

import type { Id, MediaAsset } from '@/core/types'

export class MediaPool {
  private readonly videos = new Map<Id, HTMLVideoElement>()
  private readonly images = new Map<Id, HTMLImageElement>()
  private readonly container: HTMLDivElement

  constructor() {
    this.container = document.createElement('div')
    // Off-screen rather than `display: none` — a hidden video element is
    // allowed to stop decoding in some browsers, which stalls playback.
    this.container.style.cssText =
      'position:fixed;left:-10000px;top:0;width:1px;height:1px;overflow:hidden;pointer-events:none'
    this.container.setAttribute('aria-hidden', 'true')
    document.body.appendChild(this.container)
  }

  getVideo(asset: MediaAsset): HTMLVideoElement {
    const existing = this.videos.get(asset.id)
    if (existing) return existing

    const video = document.createElement('video')
    video.src = asset.url
    video.preload = 'auto'
    video.playsInline = true
    video.crossOrigin = 'anonymous'
    this.container.appendChild(video)
    this.videos.set(asset.id, video)
    return video
  }

  getImage(asset: MediaAsset): HTMLImageElement {
    const existing = this.images.get(asset.id)
    if (existing) return existing

    const image = new Image()
    image.src = asset.url
    this.images.set(asset.id, image)
    return image
  }

  /** Stop every video except the one currently on screen. */
  pauseAllExcept(assetId: Id | null): void {
    for (const [id, video] of this.videos) {
      if (id !== assetId && !video.paused) video.pause()
    }
  }

  pauseAll(): void {
    this.pauseAllExcept(null)
  }

  /** Drop an asset's element, e.g. when the asset is removed from the project. */
  forget(assetId: Id): void {
    const video = this.videos.get(assetId)
    if (video) {
      video.pause()
      video.removeAttribute('src')
      video.load()
      video.remove()
      this.videos.delete(assetId)
    }
    this.images.delete(assetId)
  }

  dispose(): void {
    for (const id of [...this.videos.keys()]) this.forget(id)
    this.images.clear()
    this.container.remove()
  }
}
