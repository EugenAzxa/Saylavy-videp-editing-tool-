/** Time formatting and frame/second conversion. */

/**
 * Snap a time to the nearest frame boundary. Every edit runs through this so
 * that clip durations are always whole numbers of frames — otherwise the
 * export loop and the preview disagree about which frame is on screen at a
 * boundary, and you get a one-frame flash of the wrong clip.
 */
export function snapToFrame(seconds: number, fps: number): number {
  return Math.round(seconds * fps) / fps
}

export function secondsToFrames(seconds: number, fps: number): number {
  return Math.round(seconds * fps)
}

export function framesToSeconds(frames: number, fps: number): number {
  return frames / fps
}

/**
 * "1:23" or "1:02:03" — the format people already know from every video player
 * they have ever used. Deliberately not timecode with frames; "00:01:23:14"
 * means nothing to someone assembling photographs of their late husband.
 */
export function formatDuration(seconds: number): string {
  const safe = Number.isFinite(seconds) && seconds > 0 ? seconds : 0
  const total = Math.floor(safe)
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const secs = total % 60

  const mm = hours > 0 ? String(minutes).padStart(2, '0') : String(minutes)
  const ss = String(secs).padStart(2, '0')

  return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`
}

/**
 * The length of a piece, as opposed to a position in the film.
 *
 * `formatDuration` floors, because a clock that reads 0:02 before two seconds
 * have passed is wrong. A LENGTH must round instead, or a 1.8-second piece and
 * a 1.2-second piece both read "0:01" while the panel beneath them says "2
 * seconds long" — the interface contradicting itself over something the user
 * is trying to judge by eye.
 *
 * Short pieces are given in seconds rather than 0:0n, which is both shorter to
 * read and harder to misread as minutes.
 */
export function formatLength(seconds: number): string {
  const safe = Number.isFinite(seconds) && seconds > 0 ? seconds : 0
  if (safe < 60) return `${Math.round(safe)}s`

  const total = Math.round(safe)
  const minutes = Math.floor(total / 60)
  const secs = total % 60
  return `${minutes}:${String(secs).padStart(2, '0')}`
}

/**
 * A spoken-language duration for screen readers and helper text:
 * "2 minutes 5 seconds". `formatDuration` is for the eye; this is for the ear
 * and for anyone who finds "2:05" ambiguous.
 */
export function describeDuration(seconds: number): string {
  const safe = Number.isFinite(seconds) && seconds > 0 ? seconds : 0
  const total = Math.round(safe)
  const minutes = Math.floor(total / 60)
  const secs = total % 60

  const parts: string[] = []
  if (minutes > 0) parts.push(`${minutes} minute${minutes === 1 ? '' : 's'}`)
  if (secs > 0 || minutes === 0) parts.push(`${secs} second${secs === 1 ? '' : 's'}`)

  return parts.join(' ')
}

export function clamp(value: number, min: number, max: number): number {
  if (max < min) return min
  return Math.min(Math.max(value, min), max)
}
