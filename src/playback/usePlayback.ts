/**
 * The preview loop: one `requestAnimationFrame` that owns the canvas, the
 * hidden media elements, and the playhead while the film is running.
 *
 * The loop runs whether or not the film is playing. Paused, it keeps the
 * canvas showing whatever the playhead is pointing at, so scrubbing updates
 * the picture with no extra machinery.
 *
 * While playing, the playhead is driven BY the video element's own clock
 * rather than by wall time. That is the trick that keeps sound and picture
 * together: if decoding stalls for 80ms, the video's clock stalls with it and
 * the playhead waits, instead of running ahead and desynchronising.
 */

import { useEffect, useRef, type RefObject } from 'react'
import { clamp } from '@/core/time'
import { clipAtTime, layoutTrack, projectDuration, sourceTimeAt } from '@/core/timeline'
import type { Id, MediaAsset, Project } from '@/core/types'
import { MAIN_TRACK_ID, useEditor } from '@/state/store'
import { clearFrame, drawContained, drawTextOver, drawTitle } from './compositor'
import { MediaPool } from './MediaPool'

/** Tolerance for "the video is already where we want it", in seconds. */
const SEEK_EPSILON = 0.04
/** Below this, a difference is decode jitter; above it, the user has scrubbed. */
const RESYNC_THRESHOLD = 0.3
/** Treated as "we have reached the end of this clip". */
const EDGE = 1e-3

export function usePlayback(canvasRef: RefObject<HTMLCanvasElement | null>): void {
  const activeClipRef = useRef<Id | null>(null)
  const lastTickRef = useRef(0)

  useEffect(() => {
    const pool = new MediaPool()
    let frame = 0
    lastTickRef.current = performance.now()

    function render(deltaSeconds: number): void {
      const canvas = canvasRef.current
      const ctx = canvas?.getContext('2d')
      if (!canvas || !ctx) return

      const state = useEditor.getState()
      const { project, assets, playhead, isPlaying } = state

      if (canvas.width !== project.width || canvas.height !== project.height) {
        canvas.width = project.width
        canvas.height = project.height
      }

      const timeline = layoutTrack(project, MAIN_TRACK_ID)
      const entry = clipAtTime(timeline, playhead)
      const asset = entry && entry.clip.assetId !== null ? assets[entry.clip.assetId] : undefined
      const total = projectDuration(project)

      driveMusic(pool, project, assets, playhead, total, isPlaying)

      if (!entry || (entry.clip.assetId !== null && !asset)) {
        pool.pauseAll()
        activeClipRef.current = null
        clearFrame(ctx, project.width, project.height)
        return
      }

      /** Reached the end of the whole film: stop, and rest on the last frame. */
      function finish(): void {
        pool.pauseEverything()
        activeClipRef.current = null
        state.pause()
        state.setPlayhead(total)
      }

      /** Reached the end of this clip: hand over to the next one. */
      function advance(end: number): void {
        if (end >= total - EDGE) finish()
        else {
          activeClipRef.current = null
          state.setPlayhead(end)
        }
      }

      // A text card: nothing to decode, so wall time drives the playhead.
      if (!asset) {
        pool.pauseAll()
        activeClipRef.current = null
        if (entry.clip.title) drawTitle(ctx, entry.clip.title, project.width, project.height)
        else clearFrame(ctx, project.width, project.height)

        if (isPlaying) {
          const next = playhead + deltaSeconds
          if (next >= entry.end - EDGE) advance(entry.end)
          else state.setPlayhead(next)
        }
        return
      }

      if (asset.kind === 'video') {
        const video = pool.getVideo(asset)
        const wanted = sourceTimeAt(entry, playhead)

        if (isPlaying) {
          const isNewClip = activeClipRef.current !== entry.clip.id
          if (isNewClip) {
            pool.pauseAllExcept(asset.id)
            video.currentTime = wanted
            activeClipRef.current = entry.clip.id
            void video.play().catch(() => state.pause())
          } else if (video.paused) {
            void video.play().catch(() => state.pause())
          }

          const derived = entry.start + (video.currentTime - entry.clip.inPoint)

          if (!isNewClip && Math.abs(derived - playhead) > RESYNC_THRESHOLD) {
            // The playhead moved from outside this loop — the user scrubbed
            // mid-playback. The playhead is the source of truth; catch up to it.
            video.currentTime = wanted
          } else if (derived >= entry.end - EDGE || video.ended) {
            advance(entry.end)
          } else if (derived >= entry.start - EDGE) {
            state.setPlayhead(derived)
          }
        } else {
          if (!video.paused) video.pause()
          activeClipRef.current = null
          // Do not touch `currentTime` before the element knows its own
          // duration. Assigning it every animation frame while the file is
          // still loading restarts the seek endlessly, and the video never
          // becomes ready at all — the picture just stays blank.
          if (
            video.readyState >= HTMLMediaElement.HAVE_METADATA &&
            Math.abs(video.currentTime - wanted) > SEEK_EPSILON
          ) {
            video.currentTime = wanted
          }
          nudgeStalledSeek(video)
        }

        let painted = drawContained(ctx, video, project.width, project.height)

        // Not ready yet — a seek into a clip that has not been visited can
        // take a moment. Fall back to the still made at import: the wrong
        // instant of the right piece, rather than the right instant of the
        // previous one, which just looks like the editor ignored the click.
        if (!painted) {
          const poster = pool.getPoster(asset)
          if (poster) painted = drawContained(ctx, poster, project.width, project.height)
        }

        // The overlay is drawn only when a fresh frame went down underneath
        // it. Its scrim is translucent, so painting it onto a frame that is
        // already showing it darkens the picture a little more every tick —
        // within a second the screen is black.
        if (painted && entry.clip.title) {
          drawTextOver(ctx, entry.clip.title, project.width, project.height)
        }
        return
      }

      // Still photograph: nothing to decode either, so wall time drives it.
      pool.pauseAll()
      activeClipRef.current = null
      if (isPlaying) {
        const next = playhead + deltaSeconds
        if (next >= entry.end - EDGE) advance(entry.end)
        else state.setPlayhead(next)
      }
      if (drawContained(ctx, pool.getImage(asset), project.width, project.height) && entry.clip.title) {
        drawTextOver(ctx, entry.clip.title, project.width, project.height)
      }
    }

    function tick(now: number): void {
      frame = requestAnimationFrame(tick)
      // Clamped so that returning to a backgrounded tab does not jump the
      // playhead forward by however long the user was away.
      const delta = Math.min((now - lastTickRef.current) / 1000, 0.1)
      lastTickRef.current = now
      render(delta)
    }

    frame = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(frame)
      pool.dispose()
    }
  }, [canvasRef])
}

/**
 * Unstick a seek that will never finish on its own.
 *
 * Chrome will leave `seeking` true indefinitely on a paused media element that
 * has never been played — even with the entire file buffered and no error.
 * `currentTime` reports the target, `readyState` stays at HAVE_METADATA, and
 * no frame is ever produced, so the preview silently keeps showing the
 * previous clip. Observed reliably when scrubbing straight into a piece that
 * had not been visited yet.
 *
 * Starting playback forces the decoder to run; one frame later there is
 * something to draw and we stop again. Muted throughout, so nothing is heard.
 *
 * The WeakSet stops this firing on every animation frame while the play()
 * promise is still pending.
 */
const beingNudged = new WeakSet<HTMLVideoElement>()

function nudgeStalledSeek(video: HTMLVideoElement): void {
  if (!video.seeking || video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) return
  if (beingNudged.has(video)) return

  beingNudged.add(video)
  const wasMuted = video.muted
  video.muted = true

  const settle = () => {
    video.pause()
    video.muted = wasMuted
    beingNudged.delete(video)
  }

  void video
    .play()
    .then(() => {
      // One frame is enough; anything longer and the playhead drifts.
      window.setTimeout(settle, 60)
    })
    .catch(() => {
      video.muted = wasMuted
      beingNudged.delete(video)
    })
}

/**
 * Keep the music bed in step with the playhead.
 *
 * The music runs from zero across the whole film, so unlike the video clips it
 * is not driven by any one piece. Its gain is recomputed every frame from the
 * fade settings, which means the fades are audible while scrubbing rather than
 * only appearing in the exported file — it is the same envelope `mixAudio()`
 * renders at export time, so what is heard here is what gets written out.
 */
function driveMusic(
  pool: MediaPool,
  project: Project,
  assets: Readonly<Record<Id, MediaAsset>>,
  playhead: number,
  total: number,
  isPlaying: boolean,
): void {
  const music = project.music
  const asset = music ? assets[music.assetId] : undefined

  if (!music || !asset) {
    pool.pauseMusicExcept(null)
    return
  }

  const audio = pool.getAudio(asset)
  pool.pauseMusicExcept(asset.id)

  const rise = Math.min(music.fadeIn, total / 2)
  const fall = Math.min(music.fadeOut, total / 2)
  const up = rise > 0 ? Math.min(1, playhead / rise) : 1
  const down = fall > 0 ? Math.min(1, (total - playhead) / fall) : 1
  audio.volume = clamp(music.volume * Math.min(up, down), 0, 1)

  if (!isPlaying) {
    if (!audio.paused) audio.pause()
    if (Math.abs(audio.currentTime - playhead) > SEEK_EPSILON) {
      audio.currentTime = Math.min(playhead, audio.duration || playhead)
    }
    return
  }

  // Music shorter than the film simply stops, matching the export.
  if (audio.duration && playhead >= audio.duration) {
    if (!audio.paused) audio.pause()
    return
  }

  if (Math.abs(audio.currentTime - playhead) > RESYNC_THRESHOLD) {
    audio.currentTime = playhead
  }
  if (audio.paused) void audio.play().catch(() => undefined)
}
