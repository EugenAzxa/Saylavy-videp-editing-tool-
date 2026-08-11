/**
 * Undo/redo, kept deliberately dumb.
 *
 * Because every edit in `core/timeline.ts` returns a brand-new `Project`, a
 * full snapshot per step is all we need — no inverse operations, no command
 * pattern, nothing to get subtly wrong. A `Project` is a few hundred bytes of
 * clip records (the video bytes themselves live in `MediaAsset`, outside the
 * history), so a hundred of them costs nothing.
 *
 * Undo matters more here than in most tools. The people using this are tired
 * and upset, and the single most important thing the interface can say is
 * "whatever you just did, you can take it back".
 */

import { HISTORY_LIMIT } from '@/core/constants'
import type { Project } from '@/core/types'

export interface History {
  past: Project[]
  future: Project[]
}

export const emptyHistory: History = { past: [], future: [] }

/** Record `previous` as an undo step. Called with the project *before* an edit. */
export function pushHistory(history: History, previous: Project): History {
  const past = [...history.past, previous]
  if (past.length > HISTORY_LIMIT) past.shift()
  // Any new edit invalidates the redo stack, as in every editor ever made.
  return { past, future: [] }
}

export function undo(history: History, present: Project): { history: History; project: Project } | null {
  const previous = history.past[history.past.length - 1]
  if (!previous) return null
  return {
    history: { past: history.past.slice(0, -1), future: [present, ...history.future] },
    project: previous,
  }
}

export function redo(history: History, present: Project): { history: History; project: Project } | null {
  const next = history.future[0]
  if (!next) return null
  return {
    history: { past: [...history.past, present], future: history.future.slice(1) },
    project: next,
  }
}
