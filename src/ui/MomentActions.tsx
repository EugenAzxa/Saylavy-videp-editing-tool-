import { formatDuration } from '@/core/time'
import { announce } from '@/state/announce'
import { useEditor } from '@/state/store'
import { Button } from './Button'
import { CutIcon, TrimEndIcon, TrimStartIcon } from './Icon'

/**
 * The three edits that act on wherever the playhead is sitting.
 *
 * Grouped together and labelled by the moment they apply to, because "cut
 * here" only makes sense if you know where "here" is. The heading repeats the
 * current time so the answer is on screen next to the buttons.
 */
export function MomentActions() {
  const playhead = useEditor((state) => state.playhead)
  const hasPieces = useEditor((state) => state.project.clips.length > 0)

  const cutAtPlayhead = useEditor((state) => state.cutAtPlayhead)
  const trimStartToPlayhead = useEditor((state) => state.trimStartToPlayhead)
  const trimEndToPlayhead = useEditor((state) => state.trimEndToPlayhead)

  if (!hasPieces) return null

  /** Run an edit and say whether it actually did anything. */
  const perform = (action: () => void, success: string) => {
    const before = useEditor.getState().project
    action()
    const after = useEditor.getState().project
    announce(
      after === before
        ? 'That is not possible at this exact moment. Try moving the position a little.'
        : success,
    )
  }

  return (
    <section className="moment" aria-labelledby="moment-title">
      <h2 className="moment__title" id="moment-title">
        At {formatDuration(playhead)}
      </h2>

      <div className="moment__buttons">
        <Button
          label="Cut here"
          hint="Split into two pieces"
          icon={<CutIcon />}
          size="large"
          onClick={() => perform(cutAtPlayhead, 'Cut into two pieces.')}
        />
        <Button
          label="Remove what comes before"
          hint="Within this piece only"
          icon={<TrimStartIcon />}
          size="large"
          onClick={() => perform(trimStartToPlayhead, 'Removed the beginning of this piece.')}
        />
        <Button
          label="Remove what comes after"
          hint="Within this piece only"
          icon={<TrimEndIcon />}
          size="large"
          onClick={() => perform(trimEndToPlayhead, 'Removed the end of this piece.')}
        />
      </div>
    </section>
  )
}
