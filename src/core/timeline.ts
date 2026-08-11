/**
 * Every edit the user can make, as a pure function.
 *
 * Each operation takes a `Project` and returns a NEW `Project`, never mutating
 * the input. That is what lets `state/history.ts` implement undo by keeping a
 * list of past projects — no command objects, no inverse operations to get
 * wrong. It also means every rule about what is and is not a legal edit lives
 * here, in plain testable functions, rather than being smeared across the UI.
 *
 * Remember the core invariant from `types.ts`: within a track, clips are
 * contiguous and ordered by array position. Nothing in this file may produce
 * a gap or an overlap.
 */

import { MIN_CLIP_DURATION } from './constants'
import { newId } from './id'
import { clamp, snapToFrame } from './time'
import type { Clip, Id, MediaAsset, Project, TimedClip, TrimEdge } from './types'

type AssetLookup = Readonly<Record<Id, MediaAsset>>

// ---------------------------------------------------------------------------
// Reading the timeline
// ---------------------------------------------------------------------------

export function clipsOfTrack(project: Project, trackId: Id): Clip[] {
  return project.clips.filter((clip) => clip.trackId === trackId)
}

/** Resolve a track's clips to absolute timeline positions. */
export function layoutTrack(project: Project, trackId: Id): TimedClip[] {
  let cursor = 0
  return clipsOfTrack(project, trackId).map((clip, index) => {
    const start = cursor
    cursor += clip.duration
    return { clip, start, end: cursor, index }
  })
}

export function trackDuration(project: Project, trackId: Id): number {
  return clipsOfTrack(project, trackId).reduce((total, clip) => total + clip.duration, 0)
}

/** The length of the finished video: the longest track. */
export function projectDuration(project: Project): number {
  return project.tracks.reduce((longest, track) => Math.max(longest, trackDuration(project, track.id)), 0)
}

/**
 * Which clip is on screen at time `t`.
 *
 * The range is half-open — `[start, end)` — so that at an exact boundary the
 * LATER clip wins. Both the preview and the export loop call this, and they
 * must agree, or a cut flashes one wrong frame.
 */
export function clipAtTime(timed: readonly TimedClip[], t: number): TimedClip | null {
  for (const entry of timed) {
    if (t >= entry.start && t < entry.end) return entry
  }
  // Exactly at the end of the timeline, hold the final frame rather than
  // showing black — nicer when the user drags the playhead to the very end.
  const last = timed[timed.length - 1]
  if (last && t >= last.end) return last
  return null
}

/** Convert a timeline time into a time within the clip's source file. */
export function sourceTimeAt(entry: TimedClip, t: number): number {
  const offset = clamp(t - entry.start, 0, entry.clip.duration)
  return entry.clip.inPoint + offset
}

export function findClip(project: Project, clipId: Id): Clip | null {
  return project.clips.find((clip) => clip.id === clipId) ?? null
}

// ---------------------------------------------------------------------------
// Editing the timeline
// ---------------------------------------------------------------------------

/** Add a clip covering the whole of an asset to the end of a track. */
export function appendAsset(project: Project, asset: MediaAsset, trackId: Id): Project {
  const clip: Clip = {
    id: newId('clip'),
    assetId: asset.id,
    trackId,
    inPoint: 0,
    duration: snapToFrame(asset.duration, project.fps),
  }
  return { ...project, clips: [...project.clips, clip] }
}

export function removeClip(project: Project, clipId: Id): Project {
  if (!findClip(project, clipId)) return project
  return { ...project, clips: project.clips.filter((clip) => clip.id !== clipId) }
}

/**
 * Split the clip sitting under `time` into two pieces that together occupy
 * exactly the same span. Refuses when the cut would leave either half shorter
 * than `MIN_CLIP_DURATION`, which also covers cutting at a clip boundary.
 */
export function splitAt(project: Project, trackId: Id, time: number): Project {
  const timed = layoutTrack(project, trackId)
  const entry = clipAtTime(timed, time)
  if (!entry) return project

  const offset = snapToFrame(time - entry.start, project.fps)
  const remainder = entry.clip.duration - offset
  if (offset < MIN_CLIP_DURATION || remainder < MIN_CLIP_DURATION) return project

  const left: Clip = { ...entry.clip, duration: offset }
  const right: Clip = {
    ...entry.clip,
    id: newId('clip'),
    inPoint: entry.clip.inPoint + offset,
    duration: remainder,
  }

  const index = project.clips.findIndex((clip) => clip.id === entry.clip.id)
  const clips = [...project.clips]
  clips.splice(index, 1, left, right)
  return { ...project, clips }
}

/**
 * Move a clip one place earlier (`-1`) or later (`+1`) within its own track.
 *
 * Expressed in track-relative steps rather than absolute indices because
 * `project.clips` interleaves tracks; the UI only ever thinks in "swap with
 * the neighbour", which is also what the on-screen buttons do.
 */
export function nudgeClipOrder(project: Project, clipId: Id, direction: -1 | 1): Project {
  const clip = findClip(project, clipId)
  if (!clip) return project

  const siblings = clipsOfTrack(project, clip.trackId)
  const from = siblings.findIndex((candidate) => candidate.id === clipId)
  const to = from + direction
  if (from < 0 || to < 0 || to >= siblings.length) return project

  return reorderWithinTrack(project, clip.trackId, from, to)
}

/** Move a clip to an arbitrary position in its track. Used by drag and drop. */
export function reorderWithinTrack(project: Project, trackId: Id, from: number, to: number): Project {
  const siblings = clipsOfTrack(project, trackId)
  if (from === to || from < 0 || from >= siblings.length || to < 0 || to >= siblings.length) {
    return project
  }

  const reordered = [...siblings]
  const [moved] = reordered.splice(from, 1)
  if (!moved) return project
  reordered.splice(to, 0, moved)

  // Rebuild the flat list, substituting the track's clips in their new order
  // and leaving every other track's clips exactly where they were.
  let cursor = 0
  const clips = project.clips.map((clip) => {
    if (clip.trackId !== trackId) return clip
    const next = reordered[cursor]
    cursor += 1
    return next ?? clip
  })

  return { ...project, clips }
}

/**
 * Move one edge of a clip by `delta` seconds. Positive `delta` always moves
 * the edge to the right (later in the source).
 *
 * - Moving the START edge changes where in the source file the clip begins,
 *   keeping its end fixed. The clip gets shorter as `delta` grows.
 * - Moving the END edge changes only the length.
 *
 * Both are clamped so a clip can never be shorter than `MIN_CLIP_DURATION`
 * nor reach past the end of its source file. Because positions are derived
 * from durations, later clips ripple automatically — no gap can appear.
 */
export function trimClip(
  project: Project,
  clipId: Id,
  edge: TrimEdge,
  delta: number,
  assets: AssetLookup,
): Project {
  const clip = findClip(project, clipId)
  if (!clip) return project

  const asset = assets[clip.assetId]
  if (!asset) return project

  // A still photo has no end: it can be held on screen for as long as the user
  // likes. Video runs out when the file does.
  const sourceDuration =
    asset.kind === 'image' ? Number.POSITIVE_INFINITY : snapToFrame(asset.duration, project.fps)
  let { inPoint, duration } = clip

  if (edge === 'start') {
    const maxShift = duration - MIN_CLIP_DURATION // shrink limit
    const minShift = -inPoint // cannot start before the file does
    const shift = snapToFrame(clamp(delta, minShift, maxShift), project.fps)
    inPoint += shift
    duration -= shift
  } else {
    const maxDuration = Math.max(MIN_CLIP_DURATION, sourceDuration - inPoint)
    duration = snapToFrame(clamp(duration + delta, MIN_CLIP_DURATION, maxDuration), project.fps)
  }

  if (inPoint === clip.inPoint && duration === clip.duration) return project

  return {
    ...project,
    clips: project.clips.map((candidate) =>
      candidate.id === clipId ? { ...candidate, inPoint, duration } : candidate,
    ),
  }
}

/**
 * "Everything before this point in this piece is not part of the tribute."
 *
 * Trims the start edge of the clip under `time` up to the playhead. This is
 * the operation people actually reach for — cut off the shaky beginning —
 * and it is one button rather than a split followed by a delete.
 */
export function trimStartToTime(project: Project, trackId: Id, time: number, assets: AssetLookup): Project {
  const entry = clipAtTime(layoutTrack(project, trackId), time)
  if (!entry) return project
  return trimClip(project, entry.clip.id, 'start', time - entry.start, assets)
}

/** The mirror image: drop everything in this piece after the playhead. */
export function trimEndToTime(project: Project, trackId: Id, time: number, assets: AssetLookup): Project {
  const entry = clipAtTime(layoutTrack(project, trackId), time)
  if (!entry) return project
  return trimClip(project, entry.clip.id, 'end', time - entry.end, assets)
}
