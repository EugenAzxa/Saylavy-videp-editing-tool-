/**
 * Rendering the finished film to an MP4, entirely on the user's own machine.
 *
 * The shape of it:
 *
 *   for each clip, in order
 *     ask Mediabunny for the exact source frames this clip needs
 *     paint each onto the output canvas with the same code the preview uses
 *     hand the canvas to the encoder
 *
 * Frames are requested in one monotonically increasing list per clip, which
 * lets Mediabunny decode each compressed packet at most once. That is why this
 * is faster than real time, and why it does not use the hidden `<video>`
 * elements the preview uses — seeking a media element per frame would be
 * roughly an order of magnitude slower and would drop frames silently.
 *
 * Audio takes a different route: the whole soundtrack is mixed in one
 * `OfflineAudioContext` pass, which handles clip scheduling and sample-rate
 * conversion for us and stays sample-accurate against the picture.
 */

import {
  ALL_FORMATS,
  AudioBufferSource,
  BlobSource,
  BufferTarget,
  CanvasSink,
  CanvasSource,
  Input,
  Mp4OutputFormat,
  Output,
  QUALITY_HIGH,
  getFirstEncodableAudioCodec,
  getFirstEncodableVideoCodec,
} from 'mediabunny'
import { OUTPUT_CHANNELS, OUTPUT_SAMPLE_RATE } from '@/core/constants'
import { layoutTrack, projectDuration } from '@/core/timeline'
import type { Id, MediaAsset, Project, TimedClip } from '@/core/types'
import { clearFrame, drawContained, drawTitle } from '@/playback/compositor'

export type ExportPhase = 'preparing' | 'sound' | 'picture' | 'finishing'

export interface ExportProgress {
  phase: ExportPhase
  /** 0 to 1 across the whole export. */
  fraction: number
  /** Frames written so far, for a "142 of 3,600" style readout. */
  framesDone: number
  framesTotal: number
}

export interface ExportOptions {
  trackId: Id
  signal?: AbortSignal
  onProgress?: (progress: ExportProgress) => void
}

export class ExportCancelled extends Error {
  constructor() {
    super('Export cancelled')
    this.name = 'ExportCancelled'
  }
}

export class ExportFailed extends Error {
  readonly userMessage: string
  constructor(userMessage: string, cause?: unknown) {
    super(userMessage, cause === undefined ? undefined : { cause })
    this.name = 'ExportFailed'
    this.userMessage = userMessage
  }
}

/** Fraction of the progress bar given to the audio pass. */
const AUDIO_SHARE = 0.15

export async function exportVideo(
  project: Project,
  assets: Readonly<Record<Id, MediaAsset>>,
  options: ExportOptions,
): Promise<Blob> {
  const { trackId, signal, onProgress } = options
  const timeline = layoutTrack(project, trackId)
  if (timeline.length === 0) {
    throw new ExportFailed('There is nothing in the film to save yet.')
  }

  const { fps, width, height } = project
  const framesTotal = Math.max(1, Math.round(projectDuration(project) * fps))

  const report = (phase: ExportPhase, fraction: number, framesDone: number): void => {
    onProgress?.({ phase, fraction: Math.min(1, Math.max(0, fraction)), framesDone, framesTotal })
  }
  const throwIfCancelled = (): void => {
    if (signal?.aborted) throw new ExportCancelled()
  }

  report('preparing', 0, 0)

  const [videoCodec, audioCodec] = await Promise.all([
    getFirstEncodableVideoCodec(['avc', 'vp9', 'av1'], { width, height, quality: QUALITY_HIGH }),
    getFirstEncodableAudioCodec(['aac', 'opus'], {
      numberOfChannels: OUTPUT_CHANNELS,
      sampleRate: OUTPUT_SAMPLE_RATE,
      quality: QUALITY_HIGH,
    }),
  ])
  if (!videoCodec) {
    throw new ExportFailed('This device cannot compress video at the chosen size.')
  }

  // Mix the sound first. It is the cheaper pass, and if a file's audio cannot
  // be decoded it is far kinder to fail now than after the picture render.
  report('sound', 0.01, 0)
  const soundtrack = await mixAudio(project, assets, timeline, signal)
  throwIfCancelled()

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d', { alpha: false })
  if (!ctx) throw new ExportFailed('This browser could not create a drawing surface.')
  clearFrame(ctx, width, height)

  const output = new Output({
    format: new Mp4OutputFormat(),
    target: new BufferTarget(),
  })

  const videoSource = new CanvasSource(canvas, { codec: videoCodec, quality: QUALITY_HIGH })
  output.addVideoTrack(videoSource)

  let audioSource: AudioBufferSource | null = null
  if (soundtrack && audioCodec) {
    audioSource = new AudioBufferSource({ codec: audioCodec, quality: QUALITY_HIGH })
    output.addAudioTrack(audioSource)
  }

  /** One `Input` per asset, reused across every clip cut from that asset. */
  const inputs = new Map<Id, Input>()
  const bitmaps = new Map<Id, ImageBitmap>()

  try {
    await output.start()

    if (audioSource && soundtrack) {
      await audioSource.add(soundtrack)
      audioSource.close()
    }

    let framesDone = 0
    const pictureShare = soundtrack ? 1 - AUDIO_SHARE : 1
    const pictureBase = soundtrack ? AUDIO_SHARE : 0

    for (const entry of timeline) {
      throwIfCancelled()
      const asset = entry.clip.assetId === null ? undefined : assets[entry.clip.assetId]
      if (entry.clip.assetId !== null && !asset) continue

      const startFrame = Math.round(entry.start * fps)
      const endFrame = Math.round(entry.end * fps)
      const count = Math.max(0, endFrame - startFrame)
      if (count === 0) continue

      // A text card. Painted once — every frame of it is identical.
      if (!asset) {
        if (entry.clip.title) drawTitle(ctx, entry.clip.title, width, height)
        else clearFrame(ctx, width, height)

        for (let i = 0; i < count; i += 1) {
          throwIfCancelled()
          await videoSource.add((startFrame + i) / fps, 1 / fps)
          framesDone += 1
          report('picture', pictureBase + (framesDone / framesTotal) * pictureShare, framesDone)
        }
        continue
      }

      if (asset.kind === 'image') {
        let bitmap = bitmaps.get(asset.id)
        if (!bitmap) {
          bitmap = await createImageBitmap(asset.file)
          bitmaps.set(asset.id, bitmap)
        }
        drawContained(ctx, bitmap, width, height)

        for (let i = 0; i < count; i += 1) {
          throwIfCancelled()
          await videoSource.add((startFrame + i) / fps, 1 / fps)
          framesDone += 1
          report('picture', pictureBase + (framesDone / framesTotal) * pictureShare, framesDone)
        }
        continue
      }

      // Video. Ask for exactly the source instants this clip occupies, in
      // ascending order, so the decoder runs straight through the packets.
      const timestamps: number[] = []
      for (let i = 0; i < count; i += 1) {
        timestamps.push(entry.clip.inPoint + i / fps)
      }

      const sink = await sinkFor(inputs, asset)
      let first = true
      let index = 0

      for await (const wrapped of sink.canvasesAtTimestamps(timestamps)) {
        throwIfCancelled()

        if (wrapped) {
          drawContained(ctx, wrapped.canvas, width, height)
        } else if (first) {
          // No frame at this instant and nothing sensible to hold over from
          // the previous clip — start black rather than with a stale picture.
          clearFrame(ctx, width, height)
        }
        // A null mid-clip means the source has no new frame yet; holding the
        // last one is exactly what a player would show.

        first = false
        await videoSource.add((startFrame + index) / fps, 1 / fps)
        index += 1
        framesDone += 1
        report('picture', pictureBase + (framesDone / framesTotal) * pictureShare, framesDone)
      }
    }

    videoSource.close()

    report('finishing', 0.99, framesDone)
    await output.finalize()

    const buffer = output.target.buffer
    if (!buffer) throw new ExportFailed('The finished file came back empty.')

    report('finishing', 1, framesDone)
    return new Blob([buffer], { type: 'video/mp4' })
  } catch (error) {
    if (output.state === 'started' || output.state === 'pending') {
      await output.cancel().catch(() => undefined)
    }
    if (error instanceof ExportCancelled || error instanceof ExportFailed) throw error
    throw new ExportFailed('Something went wrong while saving the film.', error)
  } finally {
    for (const input of inputs.values()) input.dispose()
    for (const bitmap of bitmaps.values()) bitmap.close()
  }
}

/** Open (or reuse) a decoder for an asset and wrap it in a canvas sink. */
async function sinkFor(inputs: Map<Id, Input>, asset: MediaAsset): Promise<CanvasSink> {
  let input = inputs.get(asset.id)
  if (!input) {
    input = new Input({ formats: ALL_FORMATS, source: new BlobSource(asset.file) })
    inputs.set(asset.id, input)
  }

  const track = await input.getPrimaryVideoTrack()
  if (!track) throw new ExportFailed(`“${asset.name}” no longer contains any video.`)
  return new CanvasSink(track)
}

/**
 * Lay every clip's sound onto one timeline and render it in a single pass.
 *
 * Returns null when the film is silent, in which case no audio track is added
 * to the file at all — an empty audio track makes some players show a
 * misleading "no sound" warning.
 *
 * A clip whose audio cannot be decoded is skipped rather than fatal: losing
 * the sound from one of thirty clips should not cost the user the whole film.
 */
async function mixAudio(
  project: Project,
  assets: Readonly<Record<Id, MediaAsset>>,
  timeline: readonly TimedClip[],
  signal: AbortSignal | undefined,
): Promise<AudioBuffer | null> {
  const audible = timeline.filter(
    (entry) => entry.clip.assetId !== null && assets[entry.clip.assetId]?.hasAudio,
  )
  const music = project.music ? assets[project.music.assetId] : undefined
  if (audible.length === 0 && !music) return null

  const total = projectDuration(project)
  const frames = Math.ceil(total * OUTPUT_SAMPLE_RATE)
  if (frames <= 0) return null

  const ctx = new OfflineAudioContext(OUTPUT_CHANNELS, frames, OUTPUT_SAMPLE_RATE)
  const decoded = new Map<Id, AudioBuffer>()
  let scheduled = 0

  /** Read a file once and keep it — several clips often share one source. */
  async function bufferFor(asset: MediaAsset): Promise<AudioBuffer | null> {
    const cached = decoded.get(asset.id)
    if (cached) return cached
    try {
      // `decodeAudioData` detaches the array it is given, so each asset is
      // read exactly once and the result cached.
      const buffer = await ctx.decodeAudioData(await asset.file.arrayBuffer())
      decoded.set(asset.id, buffer)
      return buffer
    } catch {
      return null
    }
  }

  for (const entry of audible) {
    if (signal?.aborted) throw new ExportCancelled()
    if (entry.clip.assetId === null) continue

    const asset = assets[entry.clip.assetId]
    if (!asset) continue

    const buffer = await bufferFor(asset)
    if (!buffer) continue // silent clip; the picture still renders

    const node = ctx.createBufferSource()
    node.buffer = buffer
    node.connect(ctx.destination)
    node.start(entry.start, entry.clip.inPoint, entry.clip.duration)
    scheduled += 1
  }

  // Music, laid under everything, with its fades drawn as gain ramps. The
  // fades are clamped so that on a film shorter than the two fades combined
  // they meet in the middle instead of overlapping into silence.
  if (project.music && music) {
    const buffer = await bufferFor(music)
    if (buffer) {
      const { volume, fadeIn, fadeOut } = project.music
      const rise = Math.min(fadeIn, total / 2)
      const fall = Math.min(fadeOut, total / 2)

      const gain = ctx.createGain()
      gain.gain.setValueAtTime(0, 0)
      gain.gain.linearRampToValueAtTime(volume, rise)
      gain.gain.setValueAtTime(volume, Math.max(rise, total - fall))
      gain.gain.linearRampToValueAtTime(0, total)
      gain.connect(ctx.destination)

      const node = ctx.createBufferSource()
      node.buffer = buffer
      node.connect(gain)
      // Trimmed to the film. A piece longer than the film simply stops.
      node.start(0, 0, Math.min(total, buffer.duration))
      scheduled += 1
    }
  }

  if (scheduled === 0) return null
  return ctx.startRendering()
}

/** Hand the finished file to the browser's downloads folder. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  // Give the browser a moment to start the download before dropping the URL.
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}
