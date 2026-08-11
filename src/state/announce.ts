/**
 * Spoken feedback for screen readers.
 *
 * Kept out of the editor store on purpose: an announcement is a transient
 * message about a change, not part of the film, and it must never end up in
 * the undo history.
 *
 * Actions in this app change something the user may not be looking at — a
 * piece disappears from the far end of the timeline, the playhead jumps. Every
 * such action says what happened, out loud, for anyone who cannot see it.
 */

import { create } from 'zustand'

interface AnnounceState {
  message: string
  /** Bumped on every call so repeating the same sentence still gets read out. */
  nonce: number
  announce: (message: string) => void
}

export const useAnnouncer = create<AnnounceState>((set, get) => ({
  message: '',
  nonce: 0,
  announce: (message) => set({ message, nonce: get().nonce + 1 }),
}))

/** Convenience for calling outside React. */
export function announce(message: string): void {
  useAnnouncer.getState().announce(message)
}
