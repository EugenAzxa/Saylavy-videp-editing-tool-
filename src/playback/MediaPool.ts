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
  private readonly audios = new Map<Id, HTMLAudioElement>()
  private readonly posters = new Map<Id, HTMLImageElement>()
  private readonly container: HTMLDivElement

  constructor() {
    this.container = document.createElement('div')
    // These elements must stay *technically visible*. `display: none`,
    // `visibility: hidden`, zero size and parking them off-screen all let
    // Chrome suspend the decoder — a seek is then accepted, `currentTime`
    // moves, and `readyState` sticks at HAVE_METADATA forever, so the canvas
    // never gets a frame and the preview shows the previous clip.
    //
    // So: inside the viewport, non-zero size, almost transparent, behind
    // everything and inert. Ugly, and load-bearing.
    this.container.style.cssText = [
      'position:fixed',
      'left:0',
      'bottom:0',
      'width:2px',
      'height:2px',
      'opacity:0.01',
      'overflow:hidden',
      'pointer-events:none',
      'z-index:-1',
    ].join(';')
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

  /** The music bed. Separate from video elements: it plays across the whole film. */
  getAudio(asset: MediaAsset): HTMLAudioElement {
    const existing = this.audios.get(asset.id)
    if (existing) return existing

    const audio = document.createElement('audio')
    audio.src = asset.url
    audio.preload = 'auto'
    this.container.appendChild(audio)
    this.audios.set(asset.id, audio)
    return audio
  }

  /** Stop every music element except the one currently in the project. */
  pauseMusicExcept(assetId: Id | null): void {
    for (const [id, audio] of this.audios) {
      if (id !== assetId && !audio.paused) audio.pause()
    }
  }

  /**
   * The still generated at import, used as a stand-in while a video element
   * is still working out how to show the frame that was asked for. Showing
   * the right clip a second early beats showing the previous clip.
   */
  getPoster(asset: MediaAsset): HTMLImageElement | null {
    if (!asset.posterUrl) return null

    const existing = this.posters.get(asset.id)
    if (existing) return existing

    const poster = new Image()
    poster.src = asset.posterUrl
    this.posters.set(asset.id, poster)
    return poster
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

  /** Everything, including the music. Used when playback stops. */
  pauseEverything(): void {
    this.pauseAllExcept(null)
    this.pauseMusicExcept(null)
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

    const audio = this.audios.get(assetId)
    if (audio) {
      audio.pause()
      audio.removeAttribute('src')
      audio.load()
      audio.remove()
      this.audios.delete(assetId)
    }

    this.images.delete(assetId)
    this.posters.delete(assetId)
  }

  dispose(): void {
    for (const id of [...this.videos.keys(), ...this.audios.keys()]) this.forget(id)
    this.images.clear()
    this.posters.clear()
    this.container.remove()
  }
}
