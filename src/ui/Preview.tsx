import type { RefObject } from 'react'
import { NUDGE_SECONDS } from '@/core/constants'
import { describeDuration, formatDuration } from '@/core/time'
import { useDuration } from '@/state/selectors'
import { useEditor } from '@/state/store'
import { Button } from './Button'
import { ArrowLeftIcon, ArrowRightIcon, PauseIcon, PlayIcon, RewindIcon } from './Icon'

interface PreviewProps {
  canvasRef: RefObject<HTMLCanvasElement | null>
}

/**
 * The film as it currently stands, plus the controls for moving through it.
 *
 * The position control is a plain `<input type="range">`. A hand-built
 * draggable playhead would look more like a video editor, but a range input
 * arrives with keyboard support, screen-reader support and a generous hit
 * area already correct, and it is a control every user has met before on a
 * volume slider. That trade is worth making here.
 */
export function Preview({ canvasRef }: PreviewProps) {
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

  const scrub = (value: number) => {
    pause()
    setPlayhead(value)
  }

  return (
    <section className="preview" aria-label="The film so far">
      <div className="preview__screen" style={{ aspectRatio: `${width} / ${height}` }}>
        <canvas ref={canvasRef} className="preview__canvas" width={width} height={height} />
      </div>

      <div className="preview__position">
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
          onChange={(event) => scrub(Number(event.target.value))}
          aria-valuetext={`${describeDuration(playhead)} of ${describeDuration(duration)}`}
        />
        <p className="preview__time">
          <strong>{formatDuration(playhead)}</strong>
          <span> of {formatDuration(duration)}</span>
        </p>
      </div>

      <div className="preview__transport">
        <Button
          label="Back"
          hint="One second"
          icon={<ArrowLeftIcon />}
          onClick={() => {
            pause()
            nudgePlayhead(-NUDGE_SECONDS)
          }}
        />
        <Button
          label={isPlaying ? 'Pause' : 'Play'}
          tone="primary"
          size="huge"
          icon={isPlaying ? <PauseIcon size={1.25} /> : <PlayIcon size={1.25} />}
          disabled={duration === 0}
          ariaKeyShortcuts="Space"
          onClick={togglePlay}
        />
        <Button
          label="Forward"
          hint="One second"
          icon={<ArrowRightIcon />}
          onClick={() => {
            pause()
            nudgePlayhead(NUDGE_SECONDS)
          }}
        />
        <Button
          label="Back to start"
          icon={<RewindIcon />}
          onClick={() => {
            pause()
            setPlayhead(0)
          }}
        />
      </div>
    </section>
  )
}
