import { announce } from '@/state/announce'
import { useDuration } from '@/state/selectors'
import { useEditor } from '@/state/store'
import { Button } from './Button'
import { RedoIcon, SaveIcon, UndoIcon } from './Icon'
import { ThemeToggle } from './ThemeToggle'

interface TopBarProps {
  onExport: () => void
}

/**
 * The application bar. Deliberately thin: it holds only the things that are
 * true everywhere — what this is, how to take a step back, and how to get the
 * film out. Everything about the film itself lives lower down, next to it.
 */
export function TopBar({ onExport }: TopBarProps) {
  const undo = useEditor((state) => state.undo)
  const redo = useEditor((state) => state.redo)
  const canUndo = useEditor((state) => state.history.past.length > 0)
  const canRedo = useEditor((state) => state.history.future.length > 0)
  const duration = useDuration()

  return (
    <header className="topbar">
      <div className="topbar__brand">
        <span className="topbar__mark" aria-hidden="true" />
        <span className="topbar__name">
          Saylavy<span className="topbar__sub">Tribute films</span>
        </span>
      </div>

      <div className="topbar__tools">
        <Button
          label="Undo"
          size="compact"
          icon={<UndoIcon />}
          disabled={!canUndo}
          ariaKeyShortcuts="Control+Z"
          onClick={() => {
            undo()
            announce('Undone.')
          }}
        />
        <Button
          label="Redo"
          size="compact"
          icon={<RedoIcon />}
          disabled={!canRedo}
          ariaKeyShortcuts="Control+Y"
          onClick={() => {
            redo()
            announce('Redone.')
          }}
        />
        <span className="topbar__divider" aria-hidden="true" />
        <ThemeToggle />
        <Button
          label="Export film"
          tone="primary"
          size="compact"
          icon={<SaveIcon />}
          disabled={duration === 0}
          onClick={onExport}
        />
      </div>
    </header>
  )
}
