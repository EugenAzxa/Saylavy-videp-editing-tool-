/**
 * Generates a small, real MP4 in the browser.
 *
 * Two jobs:
 *
 * 1. It lets a developer try the editor immediately, without having to find
 *    footage of their own. Run the app with `npm run dev`, open the console
 *    and call `__saylavySampleVideo()`; it downloads a few seconds of video
 *    you can then import.
 * 2. It is the fixture the Playwright tests import (see `tests/fixtures.ts`).
 *    Building it with the same encoder the app exports with guarantees the
 *    file is genuinely decodable, which a `MediaRecorder` capture in a
 *    headless browser is not.
 *
 * This module is only ever loaded when `import.meta.env.DEV` is true, so it
 * is not part of the production bundle.
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

const WIDTH = 640
const HEIGHT = 360
const FPS = 30

export async function makeSampleVideo(seconds = 3): Promise<Uint8Array<ArrayBuffer>> {
  const canvas = document.createElement('canvas')
  canvas.width = WIDTH
  canvas.height = HEIGHT
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('no 2d context')

  const [videoCodec, audioCodec] = await Promise.all([
    getFirstEncodableVideoCodec(['avc', 'vp9', 'av1'], { width: WIDTH, height: HEIGHT }),
    getFirstEncodableAudioCodec(['aac', 'opus'], {
      numberOfChannels: OUTPUT_CHANNELS,
      sampleRate: OUTPUT_SAMPLE_RATE,
    }),
  ])
  if (!videoCodec) throw new Error('this browser cannot encode video')

  const output = new Output({ format: new Mp4OutputFormat(), target: new BufferTarget() })

  const videoSource = new CanvasSource(canvas, { codec: videoCodec, quality: QUALITY_MEDIUM })
  output.addVideoTrack(videoSource)

  let audioSource: AudioBufferSource | null = null
  if (audioCodec) {
    audioSource = new AudioBufferSource({ codec: audioCodec, quality: QUALITY_MEDIUM })
    output.addAudioTrack(audioSource)
  }

  await output.start()

  if (audioSource) {
    await audioSource.add(makeTone(seconds))
    audioSource.close()
  }

  // Every frame looks different, so a wrong frame after a cut is visible.
  const frames = Math.round(seconds * FPS)
  for (let index = 0; index < frames; index += 1) {
    const time = index / FPS
    ctx.fillStyle = `hsl(${Math.round(time * 120) % 360} 70% 45%)`
    ctx.fillRect(0, 0, WIDTH, HEIGHT)
    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 64px sans-serif'
    ctx.fillText(`${time.toFixed(1)}s`, 40, 200)
    await videoSource.add(time, 1 / FPS)
  }
  videoSource.close()

  await output.finalize()
  const buffer = output.target.buffer
  if (!buffer) throw new Error('sample video came back empty')
  return new Uint8Array(buffer)
}

/** A quiet 220Hz tone, so the export's audio pass has something to mix. */
function makeTone(seconds: number): AudioBuffer {
  const length = Math.round(seconds * OUTPUT_SAMPLE_RATE)
  const buffer = new AudioBuffer({
    length,
    numberOfChannels: OUTPUT_CHANNELS,
    sampleRate: OUTPUT_SAMPLE_RATE,
  })

  for (let channel = 0; channel < OUTPUT_CHANNELS; channel += 1) {
    const data = buffer.getChannelData(channel)
    for (let i = 0; i < length; i += 1) {
      data[i] = Math.sin((2 * Math.PI * 220 * i) / OUTPUT_SAMPLE_RATE) * 0.05
    }
  }
  return buffer
}

/** Build a sample and drop it into the downloads folder. */
export async function downloadSampleVideo(seconds = 3): Promise<void> {
  const bytes = await makeSampleVideo(seconds)
  const url = URL.createObjectURL(new Blob([bytes], { type: 'video/mp4' }))
  const link = document.createElement('a')
  link.href = url
  link.download = 'sample.mp4'
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
