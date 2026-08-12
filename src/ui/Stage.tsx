import type { RefObject } from 'react'
import { NUDGE_SECONDS } from '@/core/constants'
import { describeDuration, formatDuration } from '@/core/time'
import { useDuration } from '@/state/selectors'
import { useEditor } from '@/state/store'
import { ArrowLeftIcon, ArrowRightIcon, PauseIcon, PlayIcon, RewindIcon } from './Icon'

interface StageProps {
  canvasRef: RefObject<HTMLCanvasElement | null>
}

/**
 * The picture, and the controls for moving through it.
 *
 * The scrub bar duplicates the timeline's playhead on purpose. It is a real
 * `<input type="range">`, which arrives with keyboard support and a screen
 * reader value already correct — the timeline playhead is a pointer affordance
 * and cannot offer either. Neither is the only way to move.
 */
export function Stage({ canvasRef }: StageProps) {
  const isPlaying = useEditor((state) => state.isPlaying)
  const playhead = useEditor((state) => state.playhead)
  const fps = useEditor((state) => state.project.fps)
  const width = useEditor((state) => state.project.width)
  const height = useEditor((state) => state.project.height)
  const duration = useDuration()

  const togglePlay = useEditor((state) => state.togglePlay)
  const pause = useEditor((state) => state.pause)
  const setPlayhead = useEditor((state) => state.setPlayhead)
  const nudgePlayhead = useEditor((state) => state.nudgePlayhead)

  const jump = (delta: number) => {
    pause()
    nudgePlayhead(delta)
  }

  return (
    <section className="stage" aria-label="Preview">
      <div className="stage__screen" style={{ aspectRatio: `${width} / ${height}` }}>
        <canvas ref={canvasRef} className="stage__canvas" width={width} height={height} />
      </div>

      <div className="stage__scrub">
        <label className="visually-hidden" htmlFor="scrubber">
          Position in the film
        </label>
        <input
          id="scrubber"
          className="scrubber"
          type="range"
          min={0}
          max={Math.max(duration, 0.001)}
          step={1 / fps}
          value={Math.min(playhead, duration)}
          onChange={(event) => {
            pause()
            setPlayhead(Number(event.target.value))
          }}
          aria-valuetext={`${describeDuration(playhead)} of ${describeDuration(duration)}`}
        />
      </div>

      <div className="stage__transport">
        <button
          type="button"
          className="tbtn"
          onClick={() => {
            pause()
            setPlayhead(0)
          }}
          aria-label="Back to the start"
        >
          <RewindIcon />
        </button>
        <button type="button" className="tbtn" onClick={() => jump(-NUDGE_SECONDS)} aria-label="Back one second">
          <ArrowLeftIcon />
        </button>

        <button
          type="button"
          className="tbtn tbtn--play"
          onClick={togglePlay}
          disabled={duration === 0}
          aria-label={isPlaying ? 'Pause' : 'Play'}
          aria-keyshortcuts="Space"
        >
          {isPlaying ? <PauseIcon size={1.15} /> : <PlayIcon size={1.15} />}
          <span className="tbtn__word">{isPlaying ? 'Pause' : 'Play'}</span>
        </button>

        <button
          type="button"
          className="tbtn"
          onClick={() => jump(NUDGE_SECONDS)}
          aria-label="Forward one second"
        >
          <ArrowRightIcon />
        </button>

        <p className="stage__time">
          <strong>{formatDuration(playhead)}</strong>
          <span>/ {formatDuration(duration)}</span>
        </p>
      </div>
    </section>
  )
}
