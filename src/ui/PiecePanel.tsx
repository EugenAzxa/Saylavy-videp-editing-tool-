import { MIN_CLIP_DURATION } from '@/core/constants'
import { describeDuration, formatLength } from '@/core/time'
import { announce } from '@/state/announce'
import { useSelectedPiece, useTimeline } from '@/state/selectors'
import { useEditor } from '@/state/store'
import { Button } from './Button'
import { ArrowLeftIcon, ArrowRightIcon, TrashIcon, TrimEndIcon, TrimStartIcon } from './Icon'

/** How much one press of a trim button changes the piece, in seconds. */
const STEP = 1

/**
 * Everything you can do to the piece you have chosen.
 *
 * The trimming controls are worded as actions rather than directions —
 * "Cut off 1 second", "Put 1 second back" — because "start +1s" requires the
 * user to hold a mental model of an in-point. Two plainly worded buttons per
 * end need no model at all, and each is disabled the moment it would do
 * nothing, so the interface never lets someone press hopefully at a limit.
 */
export function PiecePanel() {
  const selected = useSelectedPiece()
  const pieceCount = useTimeline().length
  const assets = useEditor((state) => state.assets)

  const moveSelected = useEditor((state) => state.moveSelected)
  const deleteSelected = useEditor((state) => state.deleteSelected)
  const trimSelected = useEditor((state) => state.trimSelected)
  const select = useEditor((state) => state.select)

  if (!selected) {
    return (
      <section className="panel panel--empty" aria-labelledby="panel-title">
        <h2 className="panel__title" id="panel-title">
          Change a piece
        </h2>
        <p className="panel__body">
          Choose one of the pieces above, and the ways to change it will appear here.
        </p>
      </section>
    )
  }

  const { clip, index } = selected
  const asset = assets[clip.assetId]
  const position = index + 1

  // A photograph can be held on screen indefinitely; a video runs out.
  const sourceLength = asset && asset.kind === 'image' ? Number.POSITIVE_INFINITY : (asset?.duration ?? 0)
  const canGrowStart = clip.inPoint > 0
  const canGrowEnd = clip.inPoint + clip.duration < sourceLength
  const canShrink = clip.duration - STEP >= MIN_CLIP_DURATION

  const change = (action: () => void, message: string) => {
    action()
    announce(message)
  }

  return (
    <section className="panel" aria-labelledby="panel-title">
      <div className="panel__head">
        <h2 className="panel__title" id="panel-title">
          Piece {position} of {pieceCount}
        </h2>
        <p className="panel__meta">
          {asset?.name ?? 'Missing file'} &middot; {formatLength(clip.duration)}
        </p>
      </div>

      <div className="panel__group">
        <h3 className="panel__group-title">Where it comes in the film</h3>
        <div className="panel__row">
          <Button
            label="Move earlier"
            icon={<ArrowLeftIcon />}
            size="large"
            disabled={position === 1}
            onClick={() =>
              change(() => moveSelected(-1), `Moved to position ${position - 1} of ${pieceCount}.`)
            }
          />
          <Button
            label="Move later"
            icon={<ArrowRightIcon />}
            size="large"
            disabled={position === pieceCount}
            onClick={() =>
              change(() => moveSelected(1), `Moved to position ${position + 1} of ${pieceCount}.`)
            }
          />
        </div>
      </div>

      <div className="panel__group">
        <h3 className="panel__group-title">
          <TrimStartIcon />
          The beginning of this piece
        </h3>
        <div className="panel__row">
          <Button
            label="Cut off 1 second"
            size="large"
            disabled={!canShrink}
            onClick={() => change(() => trimSelected('start', STEP), 'One second removed from the beginning.')}
          />
          <Button
            label="Put 1 second back"
            size="large"
            disabled={!canGrowStart}
            onClick={() => change(() => trimSelected('start', -STEP), 'One second restored at the beginning.')}
          />
        </div>
      </div>

      <div className="panel__group">
        <h3 className="panel__group-title">
          <TrimEndIcon />
          The end of this piece
        </h3>
        <div className="panel__row">
          <Button
            label="Cut off 1 second"
            size="large"
            disabled={!canShrink}
            onClick={() => change(() => trimSelected('end', -STEP), 'One second removed from the end.')}
          />
          <Button
            label="Put 1 second back"
            size="large"
            disabled={!canGrowEnd}
            onClick={() => change(() => trimSelected('end', STEP), 'One second restored at the end.')}
          />
        </div>
        <p className="panel__note">
          This piece is {describeDuration(clip.duration)} long.
        </p>
      </div>

      <div className="panel__group panel__group--danger">
        <h3 className="panel__group-title">Take it out</h3>
        <Button
          label="Remove this piece"
          hint="You can undo this"
          tone="danger"
          size="large"
          icon={<TrashIcon />}
          onClick={() =>
            change(() => {
              deleteSelected()
              select(null)
            }, `Piece ${position} removed. Press Undo to bring it back.`)
          }
        />
      </div>
    </section>
  )
}
