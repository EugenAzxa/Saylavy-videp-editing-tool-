/**
 * The built-in music.
 *
 * These pieces are SYNTHESISED HERE, note by note, rather than being licensed
 * tracks bundled with the app. That is a deliberate answer to a licensing
 * problem, not a shortcut:
 *
 *   - A funeral film is played at a service and shared with family afterwards.
 *     That is public, commercial-adjacent use, and it needs a licence nobody
 *     has to think about.
 *   - The obvious free sources mostly do not survive contact with that. CC-BY
 *     would oblige a bereaved family to credit a composer on screen, which is
 *     a product failure rather than a legal technicality.
 *   - Anything generated here is original work owned outright by Saylavy.
 *     There is no attribution, no expiry, and nothing to re-clear if the
 *     product changes.
 *
 * They are also not shipped as files: three minutes of audio each would weigh
 * on every page load, and rendering one takes about a second.
 *
 * This is not a substitute for a properly curated library — see
 * docs/ROADMAP.md. It is a substitute for having no music at all, and for
 * bundling something whose licence nobody has actually read.
 */

import {
  AudioBufferSource,
  BufferTarget,
  Mp4OutputFormat,
  Output,
  QUALITY_MEDIUM,
  getFirstEncodableAudioCodec,
} from 'mediabunny'
import { OUTPUT_CHANNELS, OUTPUT_SAMPLE_RATE } from '@/core/constants'

/** How long each generated piece runs. Longer than most tribute films. */
export const BED_SECONDS = 180

export interface MusicBed {
  id: string
  name: string
  /** What it feels like, in words a non-musician can choose between. */
  description: string
}

export const MUSIC_BEDS: MusicBed[] = [
  { id: 'stillness', name: 'Stillness', description: 'Slow piano, quiet and unhurried' },
  { id: 'light', name: 'Light', description: 'Gentler and a little brighter' },
  { id: 'remembrance', name: 'Remembrance', description: 'Held chords, no melody' },
]

// --- note material -------------------------------------------------------

/** A minor pentatonic — the reliable choice for something sad but not bleak. */
const A_MINOR = [220, 261.63, 293.66, 329.63, 392, 440, 523.25]
/** C major pentatonic, for the brighter piece. */
const C_MAJOR = [261.63, 293.66, 329.63, 392, 440, 523.25, 587.33]
/** Am – F – C – G, one bar each, for the pad piece. */
const PROGRESSION = [
  [220, 261.63, 329.63],
  [174.61, 220, 261.63],
  [261.63, 329.63, 392],
  [196, 246.94, 293.66],
]

export async function renderMusicBed(bedId: string): Promise<File> {
  const ctx = new OfflineAudioContext(
    OUTPUT_CHANNELS,
    Math.round(BED_SECONDS * OUTPUT_SAMPLE_RATE),
    OUTPUT_SAMPLE_RATE,
  )

  // A convolution reverb built from decaying noise. This one node is most of
  // the difference between "synthesiser" and "a room with a piano in it".
  const reverb = ctx.createConvolver()
  reverb.buffer = impulseResponse(ctx, 3.4, 2.6)

  const wet = ctx.createGain()
  wet.gain.value = 0.42
  reverb.connect(wet).connect(ctx.destination)

  const dry = ctx.createGain()
  dry.gain.value = 0.72
  dry.connect(ctx.destination)

  const bus = ctx.createGain()
  bus.connect(dry)
  bus.connect(reverb)

  switch (bedId) {
    case 'light':
      arpeggio(ctx, bus, C_MAJOR, 1.25, 0.16)
      drone(ctx, bus, 130.81, 0.05)
      break
    case 'remembrance':
      pads(ctx, bus)
      break
    default:
      arpeggio(ctx, bus, A_MINOR, 1.7, 0.18)
      drone(ctx, bus, 110, 0.06)
  }

  const rendered = await ctx.startRendering()
  const bytes = await encodeAudio(rendered)
  const bed = MUSIC_BEDS.find((candidate) => candidate.id === bedId) ?? MUSIC_BEDS[0]!
  return new File([bytes], `${bed.name}.m4a`, { type: 'audio/mp4' })
}

// --- voices --------------------------------------------------------------

/**
 * One struck note. Built from a handful of harmonics with an exponential
 * decay, which is roughly what a struck string does and reads to the ear as a
 * piano rather than as a beep.
 */
function note(ctx: OfflineAudioContext, out: AudioNode, freq: number, at: number, gain: number): void {
  const harmonics = [1, 2, 3, 4.2, 5.4]
  const weights = [1, 0.42, 0.2, 0.09, 0.045]
  const decay = 4.2

  harmonics.forEach((multiple, index) => {
    const osc = ctx.createOscillator()
    osc.type = 'sine'
    // Slight detune upward on the partials, as a real string is inharmonic.
    osc.frequency.value = freq * multiple * (1 + index * 0.0008)

    const envelope = ctx.createGain()
    const peak = gain * weights[index]!
    envelope.gain.setValueAtTime(0, at)
    envelope.gain.linearRampToValueAtTime(peak, at + 0.012)
    // Higher partials die away first, as they do on a real instrument.
    envelope.gain.exponentialRampToValueAtTime(0.0001, at + decay / (1 + index * 0.5))

    osc.connect(envelope).connect(out)
    osc.start(at)
    osc.stop(Math.min(at + decay + 0.2, BED_SECONDS))
  })
}

/** Notes wandering up and down the scale, never quite repeating. */
function arpeggio(
  ctx: OfflineAudioContext,
  out: AudioNode,
  scale: number[],
  spacing: number,
  gain: number,
): void {
  let index = 0
  let direction = 1
  let step = 0

  for (let at = 0.5; at < BED_SECONDS - 4; at += spacing) {
    note(ctx, out, scale[index]!, at, gain)

    // Turn around at the ends, and drop an octave occasionally so the line
    // does not sound like a scale exercise.
    index += direction
    if (index >= scale.length) {
      index = scale.length - 2
      direction = -1
    } else if (index < 0) {
      index = 1
      direction = 1
    }

    step += 1
    if (step % 9 === 0) note(ctx, out, scale[0]! / 2, at + spacing * 0.5, gain * 0.5)
  }
}

/** A low sustained tone underneath everything, breathing very slowly. */
function drone(ctx: OfflineAudioContext, out: AudioNode, freq: number, gain: number): void {
  for (const multiple of [1, 2]) {
    const osc = ctx.createOscillator()
    osc.type = 'triangle'
    osc.frequency.value = freq * multiple

    const envelope = ctx.createGain()
    envelope.gain.setValueAtTime(0, 0)
    envelope.gain.linearRampToValueAtTime(gain / multiple, 6)

    // Slow swell, roughly one breath every twenty seconds.
    const lfo = ctx.createOscillator()
    lfo.frequency.value = 0.05
    const depth = ctx.createGain()
    depth.gain.value = (gain / multiple) * 0.35
    lfo.connect(depth).connect(envelope.gain)
    lfo.start(0)
    lfo.stop(BED_SECONDS)

    osc.connect(envelope).connect(out)
    osc.start(0)
    osc.stop(BED_SECONDS)
  }
}

/** Held chords, changing every eight seconds. No melody at all. */
function pads(ctx: OfflineAudioContext, out: AudioNode): void {
  const bar = 8
  for (let at = 0, index = 0; at < BED_SECONDS - bar; at += bar, index += 1) {
    const chord = PROGRESSION[index % PROGRESSION.length]!

    for (const freq of chord) {
      for (const type of ['sine', 'triangle'] as OscillatorType[]) {
        const osc = ctx.createOscillator()
        osc.type = type
        osc.frequency.value = type === 'triangle' ? freq : freq * 2

        const envelope = ctx.createGain()
        const peak = type === 'triangle' ? 0.075 : 0.028
        envelope.gain.setValueAtTime(0, at)
        envelope.gain.linearRampToValueAtTime(peak, at + 2.4)
        envelope.gain.setValueAtTime(peak, at + bar - 2.6)
        envelope.gain.linearRampToValueAtTime(0.0001, at + bar + 1.2)

        osc.connect(envelope).connect(out)
        osc.start(at)
        osc.stop(at + bar + 1.4)
      }
    }
  }
}

/** Decaying noise, which is all a convolution reverb needs to sound like a room. */
function impulseResponse(ctx: OfflineAudioContext, seconds: number, decay: number): AudioBuffer {
  const length = Math.round(seconds * ctx.sampleRate)
  const buffer = ctx.createBuffer(2, length, ctx.sampleRate)

  for (let channel = 0; channel < 2; channel += 1) {
    const data = buffer.getChannelData(channel)
    for (let i = 0; i < length; i += 1) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / length) ** decay
    }
  }
  return buffer
}

// --- encoding ------------------------------------------------------------

/**
 * Wrap a rendered buffer as an audio-only MP4, so generated music arrives as a
 * `File` and travels the same import path as a track the user brought in
 * themselves. One path, not two.
 */
async function encodeAudio(buffer: AudioBuffer): Promise<Uint8Array<ArrayBuffer>> {
  const codec = await getFirstEncodableAudioCodec(['aac', 'opus'], {
    numberOfChannels: OUTPUT_CHANNELS,
    sampleRate: OUTPUT_SAMPLE_RATE,
  })
  if (!codec) throw new Error('This browser cannot create audio files')

  const output = new Output({ format: new Mp4OutputFormat(), target: new BufferTarget() })
  const source = new AudioBufferSource({ codec, quality: QUALITY_MEDIUM })
  output.addAudioTrack(source)

  await output.start()
  await source.add(buffer)
  source.close()
  await output.finalize()

  const bytes = output.target.buffer
  if (!bytes) throw new Error('The generated music came back empty')
  return new Uint8Array(bytes)
}
