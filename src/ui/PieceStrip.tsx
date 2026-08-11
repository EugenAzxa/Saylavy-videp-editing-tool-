import { describeDuration, formatLength } from '@/core/time'
import type { TimedClip } from '@/core/types'
import { announce } from '@/state/announce'
import { useDuration, useTimeline } from '@/state/selectors'
import { useEditor } from '@/state/store'
import { ImportZone } from './ImportZone'

/**
 * The film, shown as a row of numbered cards — one per piece.
 *
 * A conventional editor draws clips at a width proportional to their length,
 * which makes a half-second clip a sliver a few pixels wide. That is a fine
 * trade for a professional and a bad one here: the pieces a user most needs to
 * click are often the short ones they are trying to remove.
 *
 * So each piece gets a card of the same generous size, with its length written
 * on it in figures and drawn underneath as a proportional bar. You keep the
 * sense of relative length, and every piece stays easy to hit.
 */
export function PieceStrip() {
  const timeline = useTimeline()
  const total = useDuration()
  const assets = useEditor((state) => state.assets)
  const selectedClipId = useEditor((state) => state.selectedClipId)
  const playhead = useEditor((state) => state.playhead)

  const select = useEditor((state) => state.select)
  const setPlayhead = useEditor((state) => state.setPlayhead)
  const pause = useEditor((state) => state.pause)

  if (timeline.length === 0) return null

  const choose = (entry: TimedClip) => {
    pause()
    select(entry.clip.id)
    setPlayhead(entry.start)
    announce(
      `Piece ${entry.index + 1} of ${timeline.length} selected. ${describeDuration(entry.clip.duration)} long.`,
    )
  }

  return (
    <section className="strip" aria-labelledby="strip-title">
      <div className="strip__head">
        <div>
          <h2 className="strip__title" id="strip-title">
            Your film, piece by piece
          </h2>
          <p className="strip__lead">
            {timeline.length === 1
              ? 'There is one piece so far.'
              : `There are ${timeline.length} pieces, played in this order.`}{' '}
            Choose one to change it.
          </p>
        </div>
        {/* Adding footage belongs with the film as a whole, not with the
            playhead-relative actions above it. */}
        <ImportZone variant="inline" />
      </div>

      <ol className="strip__list">
        {timeline.map((entry) => {
          const asset = assets[entry.clip.assetId]
          const isSelected = entry.clip.id === selectedClipId
          const isShowing = playhead >= entry.start && playhead < entry.end
          const share = total > 0 ? (entry.clip.duration / total) * 100 : 100

          return (
            <li key={entry.clip.id} className="strip__item">
              <button
                type="button"
                className={`piece${isSelected ? ' piece--selected' : ''}${isShowing ? ' piece--showing' : ''}`}
                aria-pressed={isSelected}
                onClick={() => choose(entry)}
              >
                <span className="piece__number" aria-hidden="true">
                  {entry.index + 1}
                </span>

                <span className="piece__thumb">
                  {asset?.posterUrl ? (
                    <img src={asset.posterUrl} alt="" />
                  ) : (
                    <span className="piece__thumb-empty" aria-hidden="true" />
                  )}
                  {isShowing ? <span className="piece__showing">On screen now</span> : null}
                </span>

                <span className="piece__meta">
                  <span className="piece__name">{asset?.name ?? 'Missing file'}</span>
                  <span className="piece__length">{formatLength(entry.clip.duration)}</span>
                </span>

                <span className="piece__bar" aria-hidden="true">
                  <span className="piece__bar-fill" style={{ width: `${share}%` }} />
                </span>

                <span className="visually-hidden">
                  Piece {entry.index + 1} of {timeline.length}. {describeDuration(entry.clip.duration)} long.
                  {isShowing ? ' Currently on screen.' : ''}
                </span>
              </button>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
