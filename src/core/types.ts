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

/** Where a clip's text sits. */
export type TextPlacement =
  /** Fills the frame on its own. The only option when there is no footage. */
  | 'card'
  /** Over the footage, near the top. */
  | 'top'
  /** Over the footage, centred. */
  | 'centre'
  /** Over the footage, low down — the usual place for a name and dates. */
  | 'bottom'

/**
 * Words on a clip. Lives on the clip itself — there is no file behind it.
 *
 * The same shape covers both jobs. A clip with no `assetId` renders its text
 * as a full-screen card; a clip with footage renders it OVER that footage, at
 * `placement`. One structure rather than two, because they differ only in
 * where the words are drawn.
 */
export interface TitleSpec {
  /** One to three lines. Blank lines are dropped at render time. */
  lines: string[]
  fontId: string
  /** Text colour. */
  color: string
  /** Card background. Ignored when the text sits over footage. */
  background: string
  placement: TextPlacement
}

/**
 * Music laid under the whole film.
 *
 * Deliberately a single field on the project rather than a track of clips.
 * Every memorial video wants one piece of music running underneath from start
 * to finish, and modelling that as a track would mean relaxing the gapless
 * invariant (see the file header) for a case nobody actually needs. When
 * multiple cues are wanted, this becomes a track — see docs/ROADMAP.md.
 */
export interface MusicSpec {
  assetId: Id
  /** 0 to 1. The film's own sound is not touched; this sits under it. */
  volume: number
  /** Seconds of silence rising to `volume`, measured from `startAt`. */
  fadeIn: number
  /** Seconds falling to silence, measured back from where the music stops. */
  fadeOut: number
  /**
   * Seconds into the music FILE where playback begins — for skipping an
   * introduction, or starting at the part the family wants.
   */
  inPoint: number
  /** Seconds along the TIMELINE where the music comes in. */
  startAt: number
  /** Seconds along the timeline where it stops. Null means "run to the end". */
  endAt: number | null
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
  /** The file this clip shows, or null when it is a text card. */
  assetId: Id | null
  trackId: Id
  /** Seconds into the source asset where this clip starts. `>= 0`. */
  inPoint: number
  /** Seconds of source this clip shows. `inPoint + duration <= asset.duration`. */
  duration: number
  /**
   * Words on this clip. Always present when `assetId` is null — that is what
   * makes it a text card. Optional otherwise, where it becomes an overlay.
   */
  title?: TitleSpec
  /**
   * The clip's OWN sound is off. For wind, traffic, or whoever was holding
   * the camera talking over the moment.
   */
  silent?: boolean
  /**
   * The music bed is silenced while this clip is on screen — so a piece where
   * somebody speaks can be heard without a piano underneath it.
   */
  musicOff?: boolean
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
  /** Music under the whole film, or null for none. */
  music: MusicSpec | null
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
