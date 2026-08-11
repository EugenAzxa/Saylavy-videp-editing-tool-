/**
 * Encoding a short clip from things drawn on a canvas.
 *
 * Used twice: to build the example film a first-time user can practise on
 * (`media/exampleFilm.ts`), and to build the fixture the tests import
 * (`dev/sampleVideo.ts`). Both need a genuine, decodable video file rather
 * than an approximation, and they get it from the same encoder the app
 * exports through — so if this works, export works.
 */

import {
  AudioBufferSource,
  BufferTarget,
  CanvasSource,
  Mp4OutputFormat,
  Output,
  QUALITY_MEDIUM,
  getFirstEncodableAudioCodec,
  getFirstEncodableVideoCodec,
} from 'mediabunny'
import { OUTPUT_CHANNELS, OUTPUT_SAMPLE_RATE } from '@/core/constants'

export interface ClipSpec {
  seconds: number
  width: number
  height: number
  fps: number
  /**
   * Paints one frame.
   * @param time - seconds from the start of the clip
   * @param progress - the same thing as 0..1, for eased movement
   */
  draw: (ctx: CanvasRenderingContext2D, time: number, progress: number) => void
  /** Frequency of a quiet sine tone, or null for a silent clip. */
  toneHz?: number | null
}

export class EncodingUnavailable extends Error {
  constructor() {
    super('This browser cannot create video files')
    this.name = 'EncodingUnavailable'
  }
}

export async function encodeClip(spec: ClipSpec): Promise<Uint8Array<ArrayBuffer>> {
  const { seconds, width, height, fps, draw, toneHz = null } = spec

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new EncodingUnavailable()

  const [videoCodec, audioCodec] = await Promise.all([
    getFirstEncodableVideoCodec(['avc', 'vp9', 'av1'], { width, height }),
    toneHz === null
      ? Promise.resolve(null)
      : getFirstEncodableAudioCodec(['aac', 'opus'], {
          numberOfChannels: OUTPUT_CHANNELS,
          sampleRate: OUTPUT_SAMPLE_RATE,
        }),
  ])
  if (!videoCodec) throw new EncodingUnavailable()

  const output = new Output({ format: new Mp4OutputFormat(), target: new BufferTarget() })

  const videoSource = new CanvasSource(canvas, { codec: videoCodec, quality: QUALITY_MEDIUM })
  output.addVideoTrack(videoSource)

  let audioSource: AudioBufferSource | null = null
  if (audioCodec && toneHz !== null) {
    audioSource = new AudioBufferSource({ codec: audioCodec, quality: QUALITY_MEDIUM })
    output.addAudioTrack(audioSource)
  }

  await output.start()

  if (audioSource && toneHz !== null) {
    await audioSource.add(makeTone(seconds, toneHz))
    audioSource.close()
  }

  const frames = Math.max(1, Math.round(seconds * fps))
  for (let index = 0; index < frames; index += 1) {
    const time = index / fps
    draw(ctx, time, index / (frames - 1 || 1))
    await videoSource.add(time, 1 / fps)
  }
  videoSource.close()

  await output.finalize()
  const buffer = output.target.buffer
  if (!buffer) throw new EncodingUnavailable()
  return new Uint8Array(buffer)
}

/** A quiet sine tone, faded at both ends so it does not click. */
function makeTone(seconds: number, hz: number): AudioBuffer {
  const length = Math.round(seconds * OUTPUT_SAMPLE_RATE)
  const buffer = new AudioBuffer({
    length,
    numberOfChannels: OUTPUT_CHANNELS,
    sampleRate: OUTPUT_SAMPLE_RATE,
  })
  const fade = Math.min(Math.round(0.05 * OUTPUT_SAMPLE_RATE), Math.floor(length / 2))

  for (let channel = 0; channel < OUTPUT_CHANNELS; channel += 1) {
    const data = buffer.getChannelData(channel)
    for (let i = 0; i < length; i += 1) {
      const envelope = Math.min(1, i / fade, (length - i) / fade)
      data[i] = Math.sin((2 * Math.PI * hz * i) / OUTPUT_SAMPLE_RATE) * 0.04 * envelope
    }
  }
  return buffer
}
