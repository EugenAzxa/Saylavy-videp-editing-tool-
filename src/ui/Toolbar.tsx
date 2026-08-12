import { useRef } from 'react'
import { ACCEPTED_IMAGE_TYPES, ACCEPTED_VIDEO_TYPES } from '@/core/constants'
import { announce } from '@/state/announce'
import { useSelectedPiece, useTimeline } from '@/state/selectors'
import { useEditor } from '@/state/store'
import { Button } from './Button'
import { ArrowLeftIcon, ArrowRightIcon, CutIcon, PlusIcon, TextIcon, TrashIcon } from './Icon'

const ACCEPT = [...ACCEPTED_VIDEO_TYPES, ...ACCEPTED_IMAGE_TYPES, 'video/*', 'image/*'].join(',')

/**
 * The edit actions, in one row above the timeline.
 *
 * Everything here is also reachable from the timeline or the inspector; this
 * row exists so that no operation depends on hitting a small target or on
 * knowing where to right-click. Buttons disable themselves when they would do
 * nothing, so the row also answers "why can't I?" without being asked.
 */
export function Toolbar() {
  const timeline = useTimeline()
  const selected = useSelectedPiece()
  const isImporting = useEditor((state) => state.isImporting)

  const cutAtPlayhead = useEditor((state) => state.cutAtPlayhead)
  const deleteSelected = useEditor((state) => state.deleteSelected)
  const moveSelected = useEditor((state) => state.moveSelected)
  const addTitle = useEditor((state) => state.addTitle)
  const addFiles = useEditor((state) => state.addFiles)

  const picker = useRef<HTMLInputElement>(null)
  const position = selected ? selected.index + 1 : 0

  const perform = (action: () => void, success: string) => {
    const before = useEditor.getState().project
    action()
    const after = useEditor.getState().project
    announce(after === before ? 'That is not possible here. Try moving the playhead a little.' : success)
  }

  return (
    <div className="toolbar" role="toolbar" aria-label="Edit the film">
      <input
        ref={picker}
        type="file"
        multiple
        accept={ACCEPT}
        className="visually-hidden"
        onChange={(event) => {
          void addFiles(Array.from(event.target.files ?? []))
          event.target.value = ''
        }}
      />

      <Button
        label={isImporting ? 'Adding…' : 'Add media'}
        size="compact"
        icon={<PlusIcon />}
        disabled={isImporting}
        onClick={() => picker.current?.click()}
      />

      <Button
        label="Add text"
        size="compact"
        icon={<TextIcon />}
        onClick={() => {
          addTitle()
          announce('Text card added. Type the words in the panel on the right.')
        }}
      />

      <span className="toolbar__divider" aria-hidden="true" />

      <Button
        label="Cut here"
        size="compact"
        icon={<CutIcon />}
        disabled={timeline.length === 0}
        onClick={() => perform(cutAtPlayhead, 'Cut into two pieces.')}
      />

      <Button
        label="Move earlier"
        size="compact"
        icon={<ArrowLeftIcon />}
        disabled={!selected || position === 1}
        onClick={() => perform(() => moveSelected(-1), `Moved to position ${position - 1}.`)}
      />

      <Button
        label="Move later"
        size="compact"
        icon={<ArrowRightIcon />}
        disabled={!selected || position === timeline.length}
        onClick={() => perform(() => moveSelected(1), `Moved to position ${position + 1}.`)}
      />

      <Button
        label="Delete"
        tone="danger"
        size="compact"
        icon={<TrashIcon />}
        disabled={!selected}
        onClick={() =>
          perform(deleteSelected, `Piece ${position} removed. Undo will bring it back.`)
        }
      />
    </div>
  )
}
