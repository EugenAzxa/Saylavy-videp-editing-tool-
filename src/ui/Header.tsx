import { announce } from '@/state/announce'
import { useEditor } from '@/state/store'
import { Button } from './Button'
import { RedoIcon, UndoIcon } from './Icon'
import { ThemeToggle } from './ThemeToggle'

/**
 * Undo lives in the header, at full size, always visible and never hidden in
 * a menu. For someone frightened of "breaking it", a permanently visible way
 * back is the single most reassuring thing on the screen.
 */
export function Header() {
  const undo = useEditor((state) => state.undo)
  const redo = useEditor((state) => state.redo)
  const canUndo = useEditor((state) => state.history.past.length > 0)
  const canRedo = useEditor((state) => state.history.future.length > 0)

  return (
    <header className="header">
      <div className="header__brand">
        <span className="header__mark" aria-hidden="true" />
        <div>
          <h1 className="header__title">Make a tribute film</h1>
          <p className="header__subtitle">
            Everything stays on this computer. Nothing is sent anywhere.
          </p>
        </div>
      </div>

      <div className="header__actions">
        <Button
          label="Undo"
          hint="Take back the last change"
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
          hint="Put it back"
          icon={<RedoIcon />}
          disabled={!canRedo}
          ariaKeyShortcuts="Control+Y"
          onClick={() => {
            redo()
            announce('Redone.')
          }}
        />
        <ThemeToggle />
      </div>
    </header>
  )
}
