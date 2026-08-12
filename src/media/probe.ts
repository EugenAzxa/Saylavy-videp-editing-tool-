/**
 * Measuring an imported file: how long, how big, does it have sound, and what
 * does the first moment look like.
 *
 * This uses Mediabunny rather than a hidden `<video>` element, for three
 * reasons: a `<video>` cannot tell us whether an audio track exists, its
 * `duration` is unreliable for files with no length in their metadata, and
 * failing here — at import — gives us a chance to say so in plain words rather
 * than discovering it halfway through an export.
 */

import { ALL_FORMATS, BlobSource, CanvasSink, Input } from 'mediabunny'
import { DEFAULT_IMAGE_DURATION } from '@/core/constants'
import {
  MediaImportError,
  NO_AUDIO_TRACK,
  NO_VIDEO_TRACK,
  TRY_ANOTHER_BROWSER,
  TRY_MP3,
  TRY_MP4,
  UNREADABLE,
  UNREADABLE_SOUND,
  UNSUPPORTED_CODEC,
  UNSUPPORTED_SOUND,
} from './errors'

export interface ProbeResult {
  duration: number
  width: number
  height: number
  hasAudio: boolean
  /** Object URL of a single still frame. The caller owns it and must revoke it. */
  posterUrl: string | null
}

/** Longest edge of the generated poster thumbnail, in pixels. */
const POSTER_SIZE = 480

export async function probeVideo(file: File): Promise<ProbeResult> {
  const input = new Input({ formats: ALL_FORMATS, source: new BlobSource(file) })

  try {
    const videoTrack = await input.getPrimaryVideoTrack().catch((cause) => {
      throw new MediaImportError(file.name, UNREADABLE, TRY_MP4, cause)
    })
    if (!videoTrack) {
      throw new MediaImportError(file.name, NO_VIDEO_TRACK, TRY_MP4)
    }
    if (!(await videoTrack.canDecode())) {
      throw new MediaImportError(file.name, UNSUPPORTED_CODEC, TRY_ANOTHER_BROWSER)
    }

    const [width, height, audioTrack, duration] = await Promise.all([
      videoTrack.getDisplayWidth(),
      videoTrack.getDisplayHeight(),
      input.getPrimaryAudioTrack(),
      // Scans packet timestamps, so it is exact even when the container's
      // metadata lies — which phone recordings interrupted mid-capture often do.
      input.computeDuration(),
    ])

    const posterUrl = await makePoster(videoTrack, duration).catch(() => null)

    return { duration, width, height, hasAudio: audioTrack !== null, posterUrl }
  } finally {
    input.dispose()
  }
}

/** Music, or any other sound file. No picture, so nothing to make a poster from. */
export async function probeAudio(file: File): Promise<ProbeResult> {
  const input = new Input({ formats: ALL_FORMATS, source: new BlobSource(file) })

  try {
    const track = await input.getPrimaryAudioTrack().catch((cause) => {
      throw new MediaImportError(file.name, UNREADABLE_SOUND, TRY_MP3, cause)
    })
    if (!track) throw new MediaImportError(file.name, NO_AUDIO_TRACK, TRY_MP3)
    if (!(await track.canDecode())) {
      throw new MediaImportError(file.name, UNSUPPORTED_SOUND, TRY_ANOTHER_BROWSER)
    }

    return {
      duration: await input.computeDuration(),
      width: 0,
      height: 0,
      hasAudio: true,
      posterUrl: null,
    }
  } finally {
    input.dispose()
  }
}

/** Still photos have no intrinsic duration, so we give them a default one. */
export async function probeImage(file: File): Promise<ProbeResult> {
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch (cause) {
    throw new MediaImportError(file.name, 'This picture could not be opened.', null, cause)
  }

  const result: ProbeResult = {
    duration: DEFAULT_IMAGE_DURATION,
    width: bitmap.width,
    height: bitmap.height,
    hasAudio: false,
    posterUrl: null,
  }
  bitmap.close()
  return result
}

/**
 * Grab a representative frame. One second in, rather than zero, because the
 * first frame of a phone recording is very often a blur or a lens cap.
 */
async function makePoster(
  videoTrack: Awaited<ReturnType<Input['getPrimaryVideoTrack']>>,
  duration: number,
): Promise<string | null> {
  if (!videoTrack) return null

  const sink = new CanvasSink(videoTrack)
  const wrapped = await sink.getCanvas(Math.min(1, duration / 2))
  if (!wrapped) return null

  const { canvas } = wrapped
  const scale = POSTER_SIZE / Math.max(canvas.width, canvas.height)
  const target = document.createElement('canvas')
  target.width = Math.max(1, Math.round(canvas.width * Math.min(1, scale)))
  target.height = Math.max(1, Math.round(canvas.height * Math.min(1, scale)))

  const ctx = target.getContext('2d')
  if (!ctx) return null
  ctx.drawImage(canvas, 0, 0, target.width, target.height)

  const blob = await new Promise<Blob | null>((resolve) => {
    target.toBlob(resolve, 'image/jpeg', 0.8)
  })
  return blob ? URL.createObjectURL(blob) : null
}
