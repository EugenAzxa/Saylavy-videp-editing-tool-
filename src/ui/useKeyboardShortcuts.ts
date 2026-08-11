import { useEffect } from 'react'
import { NUDGE_SECONDS } from '@/core/constants'
import { announce } from '@/state/announce'
import { useEditor } from '@/state/store'

/**
 * A very small set of shortcuts: play/pause and stepping through the film.
 *
 * Deliberately no single-key destructive shortcuts. Delete is not bound,
 * because a stray keypress removing part of someone's memorial film — even
 * with undo available — is a worse moment than the one saved keystroke is
 * worth.
 */
function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable
}

export function useKeyboardShortcuts(): void {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent): void {
      const state = useEditor.getState()
      const modifier = event.ctrlKey || event.metaKey

      if (modifier && event.key.toLowerCase() === 'z') {
        event.preventDefault()
        if (event.shiftKey) {
          state.redo()
          announce('Redone.')
        } else {
          state.undo()
          announce('Undone.')
        }
        return
      }
      if (modifier && event.key.toLowerCase() === 'y') {
        event.preventDefault()
        state.redo()
        announce('Redone.')
        return
      }

      if (isTyping(event.target)) return

      // Space activates whatever button has focus, which is the behaviour a
      // keyboard user expects. Only treat it as play/pause otherwise.
      if (event.code === 'Space' && !(event.target instanceof HTMLButtonElement)) {
        event.preventDefault()
        state.togglePlay()
        return
      }

      if (event.key === 'ArrowLeft' && !isRangeInput(event.target)) {
        event.preventDefault()
        state.pause()
        state.nudgePlayhead(-NUDGE_SECONDS)
        return
      }
      if (event.key === 'ArrowRight' && !isRangeInput(event.target)) {
        event.preventDefault()
        state.pause()
        state.nudgePlayhead(NUDGE_SECONDS)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])
}

/** The position slider handles its own arrow keys; leave it alone. */
function isRangeInput(target: EventTarget | null): boolean {
  return target instanceof HTMLInputElement && target.type === 'range'
}
