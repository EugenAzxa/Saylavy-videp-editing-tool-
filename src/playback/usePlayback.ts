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
import { clipAtTime, layoutTrack, projectDuration, sourceTimeAt } from '@/core/timeline'
import type { Id } from '@/core/types'
import { MAIN_TRACK_ID, useEditor } from '@/state/store'
import { clearFrame, drawContained } from './compositor'
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
      const asset = entry ? assets[entry.clip.assetId] : undefined

      if (!entry || !asset) {
        pool.pauseAll()
        activeClipRef.current = null
        clearFrame(ctx, project.width, project.height)
        return
      }

      const total = projectDuration(project)

      /** Reached the end of the whole film: stop, and rest on the last frame. */
      function finish(): void {
        pool.pauseAll()
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
          if (Math.abs(video.currentTime - wanted) > SEEK_EPSILON) {
            video.currentTime = wanted
          }
        }

        drawContained(ctx, video, project.width, project.height)
        return
      }

      // Still photograph: nothing to decode, so wall time drives the playhead.
      pool.pauseAll()
      activeClipRef.current = null
      if (isPlaying) {
        const next = playhead + deltaSeconds
        if (next >= entry.end - EDGE) advance(entry.end)
        else state.setPlayhead(next)
      }
      drawContained(ctx, pool.getImage(asset), project.width, project.height)
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
