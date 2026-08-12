import { useCallback, useEffect, useRef, useState } from 'react'
import { ZOOM_LEVELS } from '@/core/constants'
import { formatDuration, formatLength } from '@/core/time'
import type { TimedClip } from '@/core/types'
import { announce } from '@/state/announce'
import { useDuration, useTimeline } from '@/state/selectors'
import { useEditor } from '@/state/store'
import { visibleLines } from '@/core/titles'

/**
 * The timeline: a ruler, the film laid out to scale, the music beneath it, and
 * a playhead you can drag.
 *
 * This replaced a row of equally sized cards. The cards were easier to hit,
 * but they hid the one thing a timeline exists to show — how long each piece
 * is relative to the others — and they made the tool read as a wizard rather
 * than an editor. Scale is the point.
 *
 * Hit targets are kept honest by the zoom control rather than by inflating
 * short clips: a two-second piece really is narrow at 40px/second, and the way
 * to work on it is to zoom in. Every timeline action also has a button in the
 * toolbar, so nothing here is the only route to anything.
 */

const RULER_HEIGHT = 26
const TRACK_HEIGHT = 76
const MUSIC_HEIGHT = 44

/**
 * How far the pointer must travel before a press becomes a drag. Below this
 * it is a click, which selects. Without a threshold, selecting a piece with an
 * unsteady hand would reorder the film instead.
 */
const DRAG_THRESHOLD = 6

interface Drag {
  clipId: string
  from: number
  /** Where the pointer went down, so movement can be measured. */
  originX: number
  /** Current horizontal offset, for dragging the block with the pointer. */
  offsetX: number
  /** Index the piece would land at if released now. */
  to: number
  /** False until the pointer has moved past the threshold. */
  active: boolean
}

/** Choose a tick spacing that keeps labels roughly 90px apart. */
function tickSeconds(pixelsPerSecond: number): number {
  const candidates = [0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300]
  return candidates.find((step) => step * pixelsPerSecond >= 90) ?? 600
}

export function Timeline() {
  const timeline = useTimeline()
  const duration = useDuration()
  const assets = useEditor((state) => state.assets)
  const music = useEditor((state) => state.project.music)
  const selectedClipId = useEditor((state) => state.selectedClipId)
  const playhead = useEditor((state) => state.playhead)

  const select = useEditor((state) => state.select)
  const setPlayhead = useEditor((state) => state.setPlayhead)
  const pause = useEditor((state) => state.pause)

  const reorder = useEditor((state) => state.reorder)

  const [zoomIndex, setZoomIndex] = useState(2)
  const pixelsPerSecond = ZOOM_LEVELS[zoomIndex] ?? 40
  const laneRef = useRef<HTMLDivElement>(null)
  const [scrubbing, setScrubbing] = useState(false)
  const [drag, setDrag] = useState<Drag | null>(null)

  const width = Math.max(duration * pixelsPerSecond, 320)

  const timeAt = useCallback(
    (clientX: number): number => {
      const lane = laneRef.current
      if (!lane) return 0
      const box = lane.getBoundingClientRect()
      return Math.max(0, Math.min(duration, (clientX - box.left + lane.scrollLeft) / pixelsPerSecond))
    },
    [duration, pixelsPerSecond],
  )

  // Dragging is tracked on the window rather than the element, so the playhead
  // keeps following the pointer when it strays outside the timeline.
  useEffect(() => {
    if (!scrubbing) return

    const move = (event: PointerEvent) => setPlayhead(timeAt(event.clientX))
    const stop = () => setScrubbing(false)

    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', stop)
    window.addEventListener('pointercancel', stop)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', stop)
      window.removeEventListener('pointercancel', stop)
    }
  }, [scrubbing, timeAt, setPlayhead])

  // Dragging a piece to a new place in the film. Tracked on the window so the
  // drag survives the pointer leaving the timeline, and resolved on release.
  useEffect(() => {
    if (!drag) return

    const move = (event: PointerEvent) => {
      const offsetX = event.clientX - drag.originX
      const active = drag.active || Math.abs(offsetX) > DRAG_THRESHOLD
      if (!active) return

      const lane = laneRef.current
      if (!lane) return
      const box = lane.getBoundingClientRect()
      const at = (event.clientX - box.left + lane.scrollLeft) / pixelsPerSecond

      // Land where the pointer is, by comparing against each piece's midpoint.
      let to = timeline.length - 1
      for (const entry of timeline) {
        if (at < entry.start + entry.clip.duration / 2) {
          to = entry.index
          break
        }
      }

      setDrag((current) => (current ? { ...current, offsetX, to, active: true } : current))
    }

    const stop = () => {
      // The reorder happens HERE, not inside a `setDrag` updater. React may
      // invoke a state updater more than once — StrictMode does so
      // deliberately — and a side effect in one runs as many times as it is
      // called. Putting `reorder` in the updater moved the piece twice.
      //
      // Reading `drag` from the closure is correct: this effect re-subscribes
      // on every change to `drag`, so the closure always holds the latest.
      if (drag.active && drag.to !== drag.from) {
        reorder(drag.from, drag.to)
        announce(`Moved to position ${drag.to + 1} of ${timeline.length}.`)
      }
      setDrag(null)
    }

    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', stop)
    window.addEventListener('pointercancel', stop)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', stop)
      window.removeEventListener('pointercancel', stop)
    }
  }, [drag, pixelsPerSecond, timeline, reorder])

  if (timeline.length === 0) return null

  const beginScrub = (clientX: number) => {
    pause()
    setPlayhead(timeAt(clientX))
    setScrubbing(true)
  }

  const chooseClip = (entry: TimedClip) => {
    pause()
    select(entry.clip.id)
    setPlayhead(entry.start)
    announce(
      `Piece ${entry.index + 1} of ${timeline.length} selected, ${formatLength(entry.clip.duration)}.`,
    )
  }

  const step = tickSeconds(pixelsPerSecond)
  const ticks: number[] = []
  for (let at = 0; at <= duration + 0.001; at += step) ticks.push(at)

  return (
    <section className="tl" aria-label="Timeline">
      <header className="tl__bar">
        <h2 className="tl__heading">Timeline</h2>
        <span className="tl__count">
          {timeline.length} {timeline.length === 1 ? 'piece' : 'pieces'} &middot;{' '}
          {formatDuration(duration)}
        </span>
        <span className="tl__hint">Drag a piece to move it</span>

        <div className="tl__zoom">
          <button
            type="button"
            className="tl__zoom-btn"
            onClick={() => setZoomIndex((index) => Math.max(0, index - 1))}
            disabled={zoomIndex === 0}
            aria-label="Zoom out"
          >
            &minus;
          </button>
          <span className="tl__zoom-label">Zoom</span>
          <button
            type="button"
            className="tl__zoom-btn"
            onClick={() => setZoomIndex((index) => Math.min(ZOOM_LEVELS.length - 1, index + 1))}
            disabled={zoomIndex === ZOOM_LEVELS.length - 1}
            aria-label="Zoom in"
          >
            +
          </button>
        </div>
      </header>

      <div className="tl__lane" ref={laneRef}>
        <div className="tl__inner" style={{ width }}>
          <div
            className="tl__ruler"
            style={{ height: RULER_HEIGHT }}
            onPointerDown={(event) => beginScrub(event.clientX)}
          >
            {ticks.map((at) => (
              <span key={at} className="tl__tick" style={{ left: at * pixelsPerSecond }}>
                {formatDuration(at)}
              </span>
            ))}
          </div>

          <div className="tl__track" style={{ height: TRACK_HEIGHT }}>
            {timeline.map((entry) => {
              const asset = entry.clip.assetId === null ? undefined : assets[entry.clip.assetId]
              const isSelected = entry.clip.id === selectedClipId
              const lines = entry.clip.title ? visibleLines(entry.clip.title) : []

              const isCard = entry.clip.assetId === null
              const beingDragged = drag?.active && drag.clipId === entry.clip.id

              return (
                <button
                  key={entry.clip.id}
                  type="button"
                  className={`tlclip${isSelected ? ' tlclip--on' : ''}${
                    isCard ? ' tlclip--text' : ''
                  }${beingDragged ? ' tlclip--dragging' : ''}`}
                  style={{
                    left: entry.start * pixelsPerSecond,
                    width: Math.max(entry.clip.duration * pixelsPerSecond - 2, 10),
                    ...(asset?.posterUrl ? { backgroundImage: `url(${asset.posterUrl})` } : null),
                    ...(isCard && entry.clip.title
                      ? { background: entry.clip.title.background, color: entry.clip.title.color }
                      : null),
                    ...(beingDragged ? { transform: `translateX(${drag.offsetX}px)` } : null),
                  }}
                  aria-pressed={isSelected}
                  onPointerDown={(event) => {
                    if (event.button !== 0) return
                    setDrag({
                      clipId: entry.clip.id,
                      from: entry.index,
                      originX: event.clientX,
                      offsetX: 0,
                      to: entry.index,
                      active: false,
                    })
                  }}
                  // A drag ends on pointerup, which also fires a click; ignore
                  // that one so releasing a drag does not re-select and seek.
                  onClick={() => {
                    if (!drag?.active) chooseClip(entry)
                  }}
                >
                  {isCard ? <span className="tlclip__title">{lines[0] ?? 'Text'}</span> : null}
                  {!isCard && entry.clip.title ? (
                    <span className="tlclip__mark" aria-hidden="true">
                      T
                    </span>
                  ) : null}
                  <span className="tlclip__foot">
                    <span className="tlclip__name">
                      {isCard ? 'Text' : (asset?.name ?? 'Missing')}
                    </span>
                    <span className="tlclip__len">{formatLength(entry.clip.duration)}</span>
                  </span>
                  <span className="visually-hidden">
                    Piece {entry.index + 1} of {timeline.length}
                    {entry.clip.title && !isCard ? ', has words over it' : ''}
                  </span>
                </button>
              )
            })}

            {drag?.active && drag.to !== drag.from ? (
              <span
                className="tl__drop"
                style={{ left: (timeline[drag.to]?.start ?? 0) * pixelsPerSecond }}
                aria-hidden="true"
              />
            ) : null}
          </div>

          <div className="tl__track tl__track--music" style={{ height: MUSIC_HEIGHT }}>
            {music && assets[music.assetId] ? (
              <div className="tlmusic" style={{ width: duration * pixelsPerSecond - 2 }}>
                <span className="tlmusic__wave" aria-hidden="true" />
                <span className="tlmusic__name">{assets[music.assetId]?.name}</span>
              </div>
            ) : (
              <span className="tl__empty">No music</span>
            )}
          </div>

          <div
            className="tl__playhead"
            style={{ left: playhead * pixelsPerSecond }}
            onPointerDown={(event) => {
              event.stopPropagation()
              beginScrub(event.clientX)
            }}
          >
            <span className="tl__playhead-grab" />
          </div>
        </div>
      </div>
    </section>
  )
}
