/**
 * The domain model for a tribute video.
 *
 * Two ideas carry most of the weight here, and both exist to keep the editor
 * understandable for someone who has never edited video before:
 *
 * 1. A track is a GAPLESS SEQUENCE. Clips sit end to end in array order, with
 *    no overlaps and no holes. `Clip` therefore has no `start` field — a clip's
 *    position on the timeline is the sum of the durations before it. See
 *    `core/timeline.ts`. This makes a whole class of confusing states
 *    unreachable: you cannot accidentally leave a black gap in the middle of
 *    someone's memorial video, and reordering is just moving an array item.
 *
 * 2. Assets are separate from the project. A `MediaAsset` holds a live `File`
 *    handle and an object URL, neither of which can be serialised. The
 *    `Project` holds only ids, so it stays a plain snapshot-able value — which
 *    is what makes undo/redo in `state/history.ts` a two-line operation.
 */

/** All ids in this app are opaque strings from `core/id.ts`. */
export type Id = string

export type MediaKind = 'video' | 'image' | 'audio'

/**
 * A file the user brought in, plus everything we measured about it.
 * Lives outside the undo history — importing and un-importing is not undoable.
 */
export interface MediaAsset {
  id: Id
  kind: MediaKind
  /** The original filename, shown to the user. */
  name: string
  /** Kept so we can re-read the bytes at export time. Never uploaded anywhere. */
  file: File
  /** `URL.createObjectURL(file)`. Revoked when the asset is removed. */
  url: string
  /** Seconds. For images this is `DEFAULT_IMAGE_DURATION`. */
  duration: number
  /** Natural pixel dimensions of the source. */
  width: number
  height: number
  /** Whether the file carries an audio track we should mix into the export. */
  hasAudio: boolean
  /** A single still frame, used for the media bin tile. Object URL. */
  posterUrl: string | null
}

export type TrackKind = 'video' | 'audio'

export interface Track {
  id: Id
  kind: TrackKind
  /** Shown in the timeline gutter, e.g. "Your video". */
  name: string
  muted: boolean
}

/**
 * One piece of an asset, placed on a track.
 *
 * `inPoint` and `duration` describe a window into the source file. The clip's
 * position on the timeline is NOT stored — it is derived from the order of
 * `Project.clips` filtered to this track. See the file header.
 */
export interface Clip {
  id: Id
  assetId: Id
  trackId: Id
  /** Seconds into the source asset where this clip starts. `>= 0`. */
  inPoint: number
  /** Seconds of source this clip shows. `inPoint + duration <= asset.duration`. */
  duration: number
}

export interface Project {
  id: Id
  name: string
  /** Output frame size in pixels. Sources are letterboxed to fit. */
  width: number
  height: number
  /** Output frame rate. */
  fps: number
  tracks: Track[]
  /**
   * Every clip in the project, across all tracks. Order matters: within a
   * single track, array order is timeline order.
   */
  clips: Clip[]
}

/** A clip with its computed timeline position. Produced by `layoutTrack()`. */
export interface TimedClip {
  clip: Clip
  /** Seconds from the start of the timeline. */
  start: number
  /** `start + clip.duration`. Exclusive. */
  end: number
  /** Index within its track. */
  index: number
}

/** Which edge of a clip a trim operation is moving. */
export type TrimEdge = 'start' | 'end'
