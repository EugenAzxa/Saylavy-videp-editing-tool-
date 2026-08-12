/**
 * Import failures a user can actually act on.
 *
 * The audience for this tool is grieving and often not technical. "Decode
 * error: unsupported codec profile" helps nobody. Every failure carries a
 * plain sentence and, where one exists, a suggested next step.
 */
export class MediaImportError extends Error {
  /** A sentence to show the user. No jargon, no error codes. */
  readonly userMessage: string
  /** What they could try instead, if anything. */
  readonly suggestion: string | null
  /** The filename this happened to. */
  readonly fileName: string

  constructor(fileName: string, userMessage: string, suggestion: string | null = null, cause?: unknown) {
    super(`${fileName}: ${userMessage}`, cause === undefined ? undefined : { cause })
    this.name = 'MediaImportError'
    this.fileName = fileName
    this.userMessage = userMessage
    this.suggestion = suggestion
  }
}

export const UNREADABLE = 'This file could not be opened as a video.'
export const NO_VIDEO_TRACK = 'This file does not seem to contain any video.'
export const UNSUPPORTED_CODEC = 'Your browser cannot play the video inside this file.'
export const TRY_MP4 = 'Most phone and camera recordings work. If this one will not, try saving it as an MP4 first.'
export const TRY_ANOTHER_BROWSER = 'Chrome, Edge and Safari can open the widest range of video files.'

export const UNREADABLE_SOUND = 'This file could not be opened as music.'
export const NO_AUDIO_TRACK = 'This file does not seem to contain any sound.'
export const UNSUPPORTED_SOUND = 'Your browser cannot play the sound inside this file.'
export const TRY_MP3 = 'MP3 and M4A files work best.'
