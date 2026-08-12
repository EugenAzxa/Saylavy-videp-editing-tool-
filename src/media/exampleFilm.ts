/**
 * An example film to practise on.
 *
 * A first-time user opening this tool is usually holding footage they cannot
 * afford to damage, and has never used an editor. Asking them to learn on
 * their own irreplaceable material is a bad first move — so the app can hand
 * them three short clips of nothing in particular, and they can cut, reorder
 * and delete without any of it mattering.
 *
 * WHY THESE ARE PAINTED RATHER THAN PHOTOGRAPHED
 *
 * Two reasons, and the second is the important one.
 *
 * 1. Licensing. Stock photographs come with terms that would have to be
 *    checked, recorded and re-checked, for footage whose only job is to be
 *    cut up and thrown away.
 * 2. Decency. Using a real stranger's face as the stand-in for somebody's
 *    dead mother is not a thing to do, whatever the licence says. Someone
 *    will eventually see their own grandmother's photograph used as filler in
 *    a funeral product, and no amount of correctness makes that all right.
 *
 * So these are places rather than people: light on water, a garden going over,
 * candles burning down. Painted with gradients, soft focus and film grain so
 * they read as photographs rather than as test cards — which matters, because
 * the point is to rehearse the real job, and a colour chart does not feel like
 * "a moment I might want to move later".
 *
 * If Saylavy would rather ship licensed photography, this is the one file to
 * replace and nothing else changes.
 */

import { encodeClip } from './encodeClip'

const WIDTH = 960
const HEIGHT = 540
const FPS = 24
const SECONDS = 4

interface Scene {
  id: 'sea' | 'garden' | 'candles'
  /** Becomes the filename, which is how the timeline labels the piece. */
  title: string
  toneHz: number
}

const SCENES: Scene[] = [
  { id: 'sea', title: 'A walk by the sea', toneHz: 196 },
  { id: 'garden', title: 'The garden in June', toneHz: 262 },
  { id: 'candles', title: 'Her eightieth birthday', toneHz: 330 },
]

export interface ExampleProgress {
  done: number
  total: number
}

export async function createExampleFilm(
  onProgress?: (progress: ExampleProgress) => void,
): Promise<File[]> {
  const files: File[] = []

  for (const [index, scene] of SCENES.entries()) {
    onProgress?.({ done: index, total: SCENES.length })

    const paint = makePainter(scene)
    const bytes = await encodeClip({
      seconds: SECONDS,
      width: WIDTH,
      height: HEIGHT,
      fps: FPS,
      toneHz: scene.toneHz,
      draw: (ctx, _time, progress) => paint(ctx, progress),
    })

    files.push(new File([bytes], `${index + 1}. ${scene.title}.mp4`, { type: 'video/mp4' }))
  }

  onProgress?.({ done: SCENES.length, total: SCENES.length })
  return files
}

// ---------------------------------------------------------------------------
// Painting
// ---------------------------------------------------------------------------

/** Seeded, so the same scene is identical on every render and every machine. */
function seeded(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

interface Blob {
  x: number
  y: number
  radius: number
  alpha: number
  drift: number
  phase: number
}

/** Out-of-focus highlights — the single strongest cue that a frame is a photo. */
function makeBokeh(count: number, seed: number, spread: number): Blob[] {
  const random = seeded(seed)
  return Array.from({ length: count }, () => ({
    x: random() * WIDTH,
    y: HEIGHT * (1 - spread) + random() * HEIGHT * spread,
    radius: 12 + random() * 58,
    alpha: 0.05 + random() * 0.22,
    drift: 6 + random() * 26,
    phase: random() * Math.PI * 2,
  }))
}

function drawBlob(ctx: CanvasRenderingContext2D, blob: Blob, x: number, y: number, colour: string) {
  const glow = ctx.createRadialGradient(x, y, 0, x, y, blob.radius)
  glow.addColorStop(0, `${colour}${toHexAlpha(blob.alpha)}`)
  glow.addColorStop(0.65, `${colour}${toHexAlpha(blob.alpha * 0.45)}`)
  glow.addColorStop(1, `${colour}00`)
  ctx.fillStyle = glow
  ctx.beginPath()
  ctx.arc(x, y, blob.radius, 0, Math.PI * 2)
  ctx.fill()
}

function toHexAlpha(alpha: number): string {
  return Math.round(Math.max(0, Math.min(1, alpha)) * 255)
    .toString(16)
    .padStart(2, '0')
}

/** Darkened corners. Every lens does it; its absence reads as computer-drawn. */
function vignette(ctx: CanvasRenderingContext2D, strength: number) {
  const shade = ctx.createRadialGradient(
    WIDTH / 2,
    HEIGHT / 2,
    HEIGHT * 0.28,
    WIDTH / 2,
    HEIGHT / 2,
    HEIGHT * 0.95,
  )
  shade.addColorStop(0, '#00000000')
  shade.addColorStop(1, `#000000${toHexAlpha(strength)}`)
  ctx.fillStyle = shade
  ctx.fillRect(0, 0, WIDTH, HEIGHT)
}

/**
 * Film grain, from a tile built once and reused.
 * Generating noise per pixel per frame would be far too slow for 96 frames.
 */
let grainTile: HTMLCanvasElement | null = null

function grain(ctx: CanvasRenderingContext2D, offset: number) {
  if (!grainTile) {
    const tile = document.createElement('canvas')
    tile.width = 128
    tile.height = 128
    const tileCtx = tile.getContext('2d')
    if (tileCtx) {
      const image = tileCtx.createImageData(128, 128)
      const random = seeded(9161)
      for (let i = 0; i < image.data.length; i += 4) {
        const value = 120 + random() * 135
        image.data[i] = value
        image.data[i + 1] = value
        image.data[i + 2] = value
        image.data[i + 3] = 255
      }
      tileCtx.putImageData(image, 0, 0)
    }
    grainTile = tile
  }

  ctx.save()
  ctx.globalAlpha = 0.05
  ctx.globalCompositeOperation = 'overlay'
  // Shifted each frame so the grain moves, as it does on real film.
  const shift = (offset * 37) % 128
  for (let x = -shift; x < WIDTH; x += 128) {
    for (let y = -shift; y < HEIGHT; y += 128) {
      ctx.drawImage(grainTile, x, y)
    }
  }
  ctx.restore()
}

type Painter = (ctx: CanvasRenderingContext2D, progress: number) => void

function makePainter(scene: Scene): Painter {
  switch (scene.id) {
    case 'garden':
      return makeGarden()
    case 'candles':
      return makeCandles()
    default:
      return makeSea()
  }
}

/** Low sun over water, the light track running toward the camera. */
function makeSea(): Painter {
  const sparkle = seeded(4021)
  const glints = Array.from({ length: 90 }, () => ({
    x: 0.5 + (sparkle() - 0.5) * 0.5,
    y: sparkle(),
    width: 8 + sparkle() * 44,
    phase: sparkle() * Math.PI * 2,
  }))

  return (ctx, progress) => {
    const horizon = HEIGHT * 0.52
    // The sun sinks a little across the clip, so the frame visibly changes.
    const sunY = horizon - HEIGHT * 0.1 + progress * HEIGHT * 0.06

    const sky = ctx.createLinearGradient(0, 0, 0, horizon)
    sky.addColorStop(0, '#16243f')
    sky.addColorStop(0.55, '#3d5170')
    sky.addColorStop(0.86, '#c08a63')
    sky.addColorStop(1, '#f0b27f')
    ctx.fillStyle = sky
    ctx.fillRect(0, 0, WIDTH, horizon)

    const halo = ctx.createRadialGradient(WIDTH / 2, sunY, 0, WIDTH / 2, sunY, HEIGHT * 0.5)
    halo.addColorStop(0, '#fff0d0cc')
    halo.addColorStop(0.25, '#ffcf9455')
    halo.addColorStop(1, '#ffcf9400')
    ctx.fillStyle = halo
    ctx.fillRect(0, 0, WIDTH, horizon)

    ctx.fillStyle = '#fff3dc'
    ctx.beginPath()
    ctx.arc(WIDTH / 2, sunY, HEIGHT * 0.052, 0, Math.PI * 2)
    ctx.fill()

    const sea = ctx.createLinearGradient(0, horizon, 0, HEIGHT)
    sea.addColorStop(0, '#c68f68')
    sea.addColorStop(0.18, '#4a5b78')
    sea.addColorStop(1, '#101c31')
    ctx.fillStyle = sea
    ctx.fillRect(0, horizon, WIDTH, HEIGHT - horizon)

    // The reflected light path: brightest at the horizon, spreading nearer.
    for (const glint of glints) {
      const depth = glint.y
      const y = horizon + depth * (HEIGHT - horizon)
      const spread = 0.06 + depth * 0.34
      const x = WIDTH * (glint.x + (sparkleAt(glint.phase, progress) - 0.5) * spread)
      const alpha = (1 - depth) * 0.5 * (0.55 + 0.45 * Math.sin(glint.phase + progress * 7))
      ctx.fillStyle = `#ffe4bd${toHexAlpha(alpha)}`
      ctx.fillRect(x, y, glint.width * (0.4 + depth), 1.6 + depth * 2.2)
    }

    vignette(ctx, 0.42)
    grain(ctx, progress * 96)
  }
}

function sparkleAt(phase: number, progress: number): number {
  return 0.5 + 0.5 * Math.sin(phase + progress * 3.1)
}

/** Sun through leaves, everything but one plane thrown out of focus. */
function makeGarden(): Painter {
  const far = makeBokeh(34, 7717, 1)
  const near = makeBokeh(14, 3391, 0.7)

  return (ctx, progress) => {
    const base = ctx.createLinearGradient(0, 0, WIDTH * 0.4, HEIGHT)
    base.addColorStop(0, '#1d3a1c')
    base.addColorStop(0.5, '#2f5a26')
    base.addColorStop(1, '#12280f')
    ctx.fillStyle = base
    ctx.fillRect(0, 0, WIDTH, HEIGHT)

    const sun = ctx.createRadialGradient(
      WIDTH * 0.76,
      HEIGHT * 0.2,
      0,
      WIDTH * 0.76,
      HEIGHT * 0.2,
      HEIGHT * 0.85,
    )
    sun.addColorStop(0, '#fff4c088')
    sun.addColorStop(0.4, '#d7e88a33')
    sun.addColorStop(1, '#d7e88a00')
    ctx.fillStyle = sun
    ctx.fillRect(0, 0, WIDTH, HEIGHT)

    for (const blob of far) {
      drawBlob(
        ctx,
        blob,
        blob.x + Math.sin(blob.phase + progress * 1.4) * blob.drift,
        blob.y + Math.cos(blob.phase + progress * 1.1) * blob.drift * 0.5,
        '#e9f7a8',
      )
    }

    // A dark, heavily blurred foreground band — depth, cheaply.
    const front = ctx.createLinearGradient(0, HEIGHT * 0.72, 0, HEIGHT)
    front.addColorStop(0, '#0b1a0900')
    front.addColorStop(1, '#0b1a09cc')
    ctx.fillStyle = front
    ctx.fillRect(0, HEIGHT * 0.72, WIDTH, HEIGHT * 0.28)

    for (const blob of near) {
      drawBlob(
        ctx,
        blob,
        blob.x + Math.sin(blob.phase + progress * 0.9) * blob.drift * 1.6,
        blob.y,
        '#fbffd4',
      )
    }

    vignette(ctx, 0.5)
    grain(ctx, progress * 96 + 33)
  }
}

/** Candles on a table, warm and close, everything else falling away. */
function makeCandles(): Painter {
  const flames = [0.3, 0.42, 0.54, 0.66, 0.78].map((x, index) => ({
    x: x * WIDTH,
    y: HEIGHT * (0.55 + (index % 2) * 0.05),
    scale: 0.85 + (index % 3) * 0.14,
    phase: index * 1.7,
  }))
  const warm = makeBokeh(18, 5519, 0.9)

  return (ctx, progress) => {
    ctx.fillStyle = '#140b06'
    ctx.fillRect(0, 0, WIDTH, HEIGHT)

    const room = ctx.createRadialGradient(
      WIDTH * 0.5,
      HEIGHT * 0.6,
      0,
      WIDTH * 0.5,
      HEIGHT * 0.6,
      WIDTH * 0.6,
    )
    room.addColorStop(0, '#6b3a17')
    room.addColorStop(0.5, '#341b0c')
    room.addColorStop(1, '#0e0703')
    ctx.fillStyle = room
    ctx.fillRect(0, 0, WIDTH, HEIGHT)

    for (const blob of warm) {
      drawBlob(ctx, blob, blob.x, blob.y + Math.sin(blob.phase + progress * 0.8) * 6, '#ffbe6b')
    }

    for (const flame of flames) {
      // Flicker: two out-of-step sines, so it never looks like a loop.
      const flicker =
        0.86 + 0.09 * Math.sin(flame.phase + progress * 26) + 0.05 * Math.sin(flame.phase * 2.3 + progress * 41)
      const height = HEIGHT * 0.05 * flame.scale * flicker
      const width = height * 0.42

      const halo = ctx.createRadialGradient(flame.x, flame.y, 0, flame.x, flame.y, height * 5.5)
      halo.addColorStop(0, '#ffd79a70')
      halo.addColorStop(0.35, '#ff9d3a2e')
      halo.addColorStop(1, '#ff9d3a00')
      ctx.fillStyle = halo
      ctx.beginPath()
      ctx.arc(flame.x, flame.y, height * 5.5, 0, Math.PI * 2)
      ctx.fill()

      const body = ctx.createLinearGradient(flame.x, flame.y - height, flame.x, flame.y + height * 0.4)
      body.addColorStop(0, '#fff6dd')
      body.addColorStop(0.45, '#ffd07a')
      body.addColorStop(1, '#e8791f00')
      ctx.fillStyle = body
      ctx.beginPath()
      ctx.ellipse(flame.x, flame.y - height * 0.25, width, height, 0, 0, Math.PI * 2)
      ctx.fill()
    }

    vignette(ctx, 0.62)
    grain(ctx, progress * 96 + 61)
  }
}
