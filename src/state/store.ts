/**
 * The single store. One project, one selection, one playhead.
 *
 * Everything that changes the film goes through an action here, and every
 * action that changes the film records an undo step. Components never build a
 * `Project` themselves — they call an action, which calls a pure function from
 * `core/timeline.ts`. Keeping that rule is what makes undo trustworthy.
 */

import { create } from 'zustand'
import { DEFAULT_PROJECT } from '@/core/constants'
import { newId } from '@/core/id'
import { clamp } from '@/core/time'
import {
  appendAsset,
  findClip,
  layoutTrack,
  nudgeClipOrder,
  projectDuration,
  insertTitle,
  removeClip,
  reorderWithinTrack,
  splitAt,
  trimClip,
  trimEndToTime,
  trimStartToTime,
  updateTitle,
} from '@/core/timeline'
import { DEFAULT_TITLE_SECONDS } from '@/core/constants'
import { newOverlay, newTitle } from '@/core/titles'
import type { Id, MediaAsset, MusicSpec, Project, TimedClip, TitleSpec, TrimEdge } from '@/core/types'
import type { MediaImportError } from '@/media/errors'
import { importFiles, releaseAsset } from '@/media/import'
import { emptyHistory, pushHistory, redo, undo, type History } from './history'

/**
 * v1 has exactly one track. The model supports more (see `core/types.ts`) so
 * that a music track and a titles track can be added without reshaping
 * anything, but showing a single row of pictures is far less frightening than
 * a stack of them, and one row is all this version needs.
 */
export const MAIN_TRACK_ID: Id = 'track_main'

function createProject(): Project {
  return {
    id: newId('project'),
    name: 'Untitled tribute',
    ...DEFAULT_PROJECT,
    tracks: [{ id: MAIN_TRACK_ID, kind: 'video', name: 'Your film', muted: false }],
    clips: [],
    music: null,
  }
}

/** Sensible starting point for music: quiet enough to sit under speech. */
const DEFAULT_MUSIC = { volume: 0.35, fadeIn: 2, fadeOut: 3 }

export interface EditorState {
  project: Project
  assets: Record<Id, MediaAsset>
  history: History

  selectedClipId: Id | null
  /** Seconds from the start of the finished film. */
  playhead: number
  isPlaying: boolean

  isImporting: boolean
  /** Import problems still waiting to be acknowledged by the user. */
  failures: MediaImportError[]

  // -- media ---------------------------------------------------------------
  addFiles: (files: readonly File[]) => Promise<void>
  dismissFailures: () => void

  // -- transport -----------------------------------------------------------
  setPlayhead: (seconds: number) => void
  nudgePlayhead: (delta: number) => void
  play: () => void
  pause: () => void
  togglePlay: () => void

  // -- selection -----------------------------------------------------------
  select: (clipId: Id | null) => void
  selectAtPlayhead: () => void

  // -- text cards ----------------------------------------------------------
  addTitle: () => void
  editTitle: (clipId: Id, title: TitleSpec) => void
  addTextOver: (clipId: Id) => void
  removeTextOver: (clipId: Id) => void

  // -- music ---------------------------------------------------------------
  /** Import an audio file and lay it under the film. */
  addMusic: (file: File) => Promise<void>
  removeMusic: () => void
  setMusicSettings: (settings: Partial<Omit<MusicSpec, 'assetId'>>) => void

  // -- edits ---------------------------------------------------------------
  cutAtPlayhead: () => void
  deleteSelected: () => void
  moveSelected: (direction: -1 | 1) => void
  trimSelected: (edge: TrimEdge, delta: number) => void
  trimStartToPlayhead: () => void
  trimEndToPlayhead: () => void
  reorder: (from: number, to: number) => void

  // -- history -------------------------------------------------------------
  undo: () => void
  redo: () => void

  // -- derived (call as functions; they read current state) -----------------
  timeline: () => TimedClip[]
  duration: () => number
  canUndo: () => boolean
  canRedo: () => boolean
}

export const useEditor = create<EditorState>((set, get) => {
  /**
   * Apply an edit, record it for undo, and repair anything the edit
   * invalidated: a selection pointing at a deleted clip, or a playhead now
   * past the end of a shortened film.
   */
  function commit(next: Project): void {
    const state = get()
    if (next === state.project) return // the operation was refused; nothing to record

    const stillExists = state.selectedClipId !== null && findClip(next, state.selectedClipId) !== null

    set({
      project: next,
      history: pushHistory(state.history, state.project),
      selectedClipId: stillExists ? state.selectedClipId : null,
      playhead: clamp(state.playhead, 0, projectDuration(next)),
    })
  }

  return {
    project: createProject(),
    assets: {},
    history: emptyHistory,
    selectedClipId: null,
    playhead: 0,
    isPlaying: false,
    isImporting: false,
    failures: [],

    // -- media -------------------------------------------------------------

    async addFiles(files) {
      if (files.length === 0) return
      set({ isImporting: true })

      try {
        const { assets, failures } = await importFiles(files)
        const state = get()

        // A dropped sound file is music, not a piece of the film. Routing it
        // here means "drag an MP3 onto the page" does the obvious thing.
        const sound = assets.filter((asset) => asset.kind === 'audio')
        const pictures = assets.filter((asset) => asset.kind !== 'audio')

        // Everything imported in one drop becomes one undo step, so "undo"
        // after adding forty photos removes forty photos, not one.
        let next = state.project
        for (const asset of pictures) {
          next = appendAsset(next, asset, MAIN_TRACK_ID)
        }

        const lastSound = sound[sound.length - 1]
        if (lastSound) {
          next = { ...next, music: { assetId: lastSound.id, ...DEFAULT_MUSIC } }
        }

        const byId = { ...state.assets }
        for (const asset of assets) byId[asset.id] = asset

        set({
          assets: byId,
          project: next,
          history: assets.length > 0 ? pushHistory(state.history, state.project) : state.history,
          failures: [...state.failures, ...failures],
        })
      } finally {
        set({ isImporting: false })
      }
    },

    // -- text cards --------------------------------------------------------

    addTitle() {
      const state = get()
      // Insert after the piece under the PLAYHEAD, not after the selection.
      // Keying off the selection meant that with nothing selected — the usual
      // case — every card landed at the end of the film, which is almost never
      // where it was wanted. The playhead is where the user is looking.
      const timeline = state.timeline()
      const here = timeline.find(
        (entry) => state.playhead >= entry.start && state.playhead < entry.end,
      )
      const anchor = here ?? (state.playhead > 0 ? timeline[timeline.length - 1] : undefined)

      const before = state.project
      const next = insertTitle(
        before,
        MAIN_TRACK_ID,
        newTitle(),
        DEFAULT_TITLE_SECONDS,
        anchor ? anchor.index : null,
      )
      if (next === before) return

      const added = next.clips.find((clip) => !before.clips.some((old) => old.id === clip.id))
      // Move the playhead onto the new card, so the preview shows the thing
      // the inspector has just started editing. Without this you type into a
      // panel while looking at a different piece entirely.
      const placed = added
        ? layoutTrack(next, MAIN_TRACK_ID).find((candidate) => candidate.clip.id === added.id)
        : undefined

      set({
        project: next,
        history: pushHistory(state.history, before),
        selectedClipId: added?.id ?? null,
        playhead: placed ? placed.start : clamp(state.playhead, 0, projectDuration(next)),
        isPlaying: false,
      })
    },

    editTitle(clipId, title) {
      commit(updateTitle(get().project, clipId, title))
    },

    /** Put words over a piece of footage, rather than on a card of their own. */
    addTextOver(clipId) {
      const project = get().project
      const clip = project.clips.find((candidate) => candidate.id === clipId)
      if (!clip || clip.assetId === null || clip.title) return

      commit({
        ...project,
        clips: project.clips.map((candidate) =>
          candidate.id === clipId ? { ...candidate, title: newOverlay() } : candidate,
        ),
      })
    },

    /** Take the words off a piece of footage. Text cards are deleted, not cleared. */
    removeTextOver(clipId) {
      const project = get().project
      const clip = project.clips.find((candidate) => candidate.id === clipId)
      if (!clip || clip.assetId === null || !clip.title) return

      commit({
        ...project,
        clips: project.clips.map((candidate) => {
          if (candidate.id !== clipId) return candidate
          const { title: _removed, ...rest } = candidate
          return rest
        }),
      })
    },

    // -- music -------------------------------------------------------------

    async addMusic(file) {
      set({ isImporting: true })
      try {
        const { assets, failures } = await importFiles([file])
        const state = get()
        const track = assets[0]

        if (!track) {
          set({ failures: [...state.failures, ...failures] })
          return
        }

        set({
          assets: { ...state.assets, [track.id]: track },
          project: { ...state.project, music: { assetId: track.id, ...DEFAULT_MUSIC } },
          history: pushHistory(state.history, state.project),
          failures: [...state.failures, ...failures],
        })
      } finally {
        set({ isImporting: false })
      }
    },

    removeMusic() {
      const state = get()
      if (!state.project.music) return
      commit({ ...state.project, music: null })
    },

    setMusicSettings(settings) {
      const state = get()
      const music = state.project.music
      if (!music) return
      // Volume and fade changes are continuous — a slider drag would otherwise
      // push a hundred entries onto the undo stack — so they bypass history.
      set({ project: { ...state.project, music: { ...music, ...settings } } })
    },

    dismissFailures() {
      set({ failures: [] })
    },

    // -- transport ---------------------------------------------------------

    setPlayhead(seconds) {
      set({ playhead: clamp(seconds, 0, get().duration()) })
    },

    nudgePlayhead(delta) {
      get().setPlayhead(get().playhead + delta)
    },

    play() {
      if (get().duration() === 0) return
      // Starting from the very end would play nothing; rewind first.
      if (get().playhead >= get().duration() - 1e-3) set({ playhead: 0 })
      set({ isPlaying: true })
    },

    pause() {
      set({ isPlaying: false })
    },

    togglePlay() {
      if (get().isPlaying) get().pause()
      else get().play()
    },

    // -- selection ---------------------------------------------------------

    select(clipId) {
      set({ selectedClipId: clipId })
    },

    /** Select whatever is on screen right now. Used by the keyboard shortcuts. */
    selectAtPlayhead() {
      const { playhead } = get()
      const entry = get()
        .timeline()
        .find((candidate) => playhead >= candidate.start && playhead < candidate.end)
      set({ selectedClipId: entry?.clip.id ?? null })
    },

    // -- edits -------------------------------------------------------------

    cutAtPlayhead() {
      commit(splitAt(get().project, MAIN_TRACK_ID, get().playhead))
    },

    deleteSelected() {
      const { selectedClipId } = get()
      if (!selectedClipId) return
      commit(removeClip(get().project, selectedClipId))
    },

    moveSelected(direction) {
      const { selectedClipId } = get()
      if (!selectedClipId) return
      commit(nudgeClipOrder(get().project, selectedClipId, direction))
    },

    trimSelected(edge, delta) {
      const { selectedClipId, project, assets } = get()
      if (!selectedClipId) return
      commit(trimClip(project, selectedClipId, edge, delta, assets))
    },

    trimStartToPlayhead() {
      const { project, assets, playhead } = get()
      commit(trimStartToTime(project, MAIN_TRACK_ID, playhead, assets))
    },

    trimEndToPlayhead() {
      const { project, assets, playhead } = get()
      commit(trimEndToTime(project, MAIN_TRACK_ID, playhead, assets))
    },

    reorder(from, to) {
      commit(reorderWithinTrack(get().project, MAIN_TRACK_ID, from, to))
    },

    // -- history -----------------------------------------------------------

    undo() {
      const state = get()
      const result = undo(state.history, state.project)
      if (!result) return
      set({
        project: result.project,
        history: result.history,
        selectedClipId: null,
        playhead: clamp(state.playhead, 0, projectDuration(result.project)),
        isPlaying: false,
      })
    },

    redo() {
      const state = get()
      const result = redo(state.history, state.project)
      if (!result) return
      set({
        project: result.project,
        history: result.history,
        selectedClipId: null,
        playhead: clamp(state.playhead, 0, projectDuration(result.project)),
        isPlaying: false,
      })
    },

    // -- derived -------------------------------------------------------------
    // These build a fresh array or number on every call, so a React component
    // must NOT use them as a selector — it would re-render without end. Use
    // the hooks in `state/selectors.ts` instead. These are for the playback
    // loop and the store's own actions, which read via `getState()`.

    timeline: () => layoutTrack(get().project, MAIN_TRACK_ID),
    duration: () => projectDuration(get().project),
    canUndo: () => get().history.past.length > 0,
    canRedo: () => get().history.future.length > 0,
  }
})

/** Release every object URL. Wired to `pagehide` in `main.tsx`. */
export function releaseAllAssets(): void {
  for (const asset of Object.values(useEditor.getState().assets)) {
    releaseAsset(asset)
  }
}
