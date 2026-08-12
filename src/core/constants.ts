/** Tunable limits and defaults, gathered in one place. */

/**
 * The shortest a clip is allowed to become. Trimming and splitting both refuse
 * to produce anything below this. Half a second is long enough that a clip is
 * still visible and still clickable at a comfortable timeline zoom.
 */
export const MIN_CLIP_DURATION = 0.5

/** How long a still photo sits on screen by default, in seconds. */
export const DEFAULT_IMAGE_DURATION = 5

/** How long a new text card sits on screen. Long enough to read twice. */
export const DEFAULT_TITLE_SECONDS = 4

/** Default output settings for a new project. */
export const DEFAULT_PROJECT = {
  width: 1920,
  height: 1080,
  fps: 30,
} as const

/** Audio is always rendered at this rate, regardless of the source files. */
export const OUTPUT_SAMPLE_RATE = 48_000
export const OUTPUT_CHANNELS = 2

/** Timeline zoom, in pixels per second of footage. */
export const ZOOM_LEVELS = [10, 20, 40, 80, 160] as const
export const DEFAULT_ZOOM_INDEX = 2

/**
 * How far the playhead moves for the "Back"/"Forward" nudge buttons.
 * Deliberately coarse: these are for finding a moment, not for frame-accuracy.
 */
export const NUDGE_SECONDS = 1

/** How many undo steps to keep. Snapshots are small (clip lists only). */
export const HISTORY_LIMIT = 100

/** File types the import control will accept. */
export const ACCEPTED_VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/webm']
export const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
