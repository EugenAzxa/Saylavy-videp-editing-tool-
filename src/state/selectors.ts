/**
 * Derived views of the project, for components.
 *
 * These exist because of a sharp edge in every selector-based store: a
 * selector that computes a fresh array or object on each call returns a new
 * reference every time, the store concludes the state changed, and the
 * component re-renders forever. `layoutTrack()` builds a new array, so
 * `useEditor(state => state.timeline())` is exactly that trap.
 *
 * The fix is to subscribe to `project` — which is replaced only when an edit
 * actually happens, and is otherwise reference-stable — and derive from it
 * with `useMemo`. Components should always reach for the hooks in this file
 * rather than calling the store's `timeline()` or `duration()` helpers, which
 * are there for non-React callers such as the playback loop.
 */

import { useMemo } from 'react'
import { layoutTrack, projectDuration } from '@/core/timeline'
import type { TimedClip } from '@/core/types'
import { MAIN_TRACK_ID, useEditor } from './store'

export function useTimeline(): TimedClip[] {
  const project = useEditor((state) => state.project)
  return useMemo(() => layoutTrack(project, MAIN_TRACK_ID), [project])
}

export function useDuration(): number {
  const project = useEditor((state) => state.project)
  return useMemo(() => projectDuration(project), [project])
}

export function useSelectedPiece(): TimedClip | null {
  const timeline = useTimeline()
  const selectedClipId = useEditor((state) => state.selectedClipId)

  return useMemo(
    () => timeline.find((entry) => entry.clip.id === selectedClipId) ?? null,
    [timeline, selectedClipId],
  )
}
