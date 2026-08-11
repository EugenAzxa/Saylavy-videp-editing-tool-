/**
 * An example film to practise on.
 *
 * A first-time user opening this tool is usually holding footage they cannot
 * afford to damage, and has never used an editor. Asking them to learn on
 * their own irreplaceable material is a bad first move — so the app can hand
 * them three short clips of nothing in particular, and they can cut, reorder
 * and delete without any of it mattering.
 *
 * The clips are generated here rather than shipped as files: three MP4s would
 * add megabytes to every page load and to every clone of the repository, and
 * encoding them takes about a second.
 *
 * They are deliberately made to look like scenes rather than test bars. The
 * point is to rehearse the real job, and a colour chart does not read as
 * "a moment I might want to move later".
 */

import { encodeClip } from './encodeClip'

interface Scene {
  title: string
  /** Background gradient, top to bottom. */
  from: string
  to: string
  /** Colour of the drifting highlight. */
  light: string
  toneHz: number
}

const SCENES: Scene[] = [
  { title: 'A walk by the sea', from: '#0d2b52', to: '#2f6fb5', light: '#9fd0ff', toneHz: 196 },
  { title: 'The garden in June', from: '#123524', to: '#4f8f3a', light: '#dcf5a5', toneHz: 262 },
  { title: 'Her eightieth birthday', from: '#4a1e08', to: '#c1751b', light: '#ffe2a8', toneHz: 330 },
]

const WIDTH = 960
const HEIGHT = 540
const FPS = 24
const SECONDS = 4

export interface ExampleProgress {
  done: number
  total: number
}

/**
 * Build the example clips as `File`s, ready to hand straight to `addFiles`.
 * Reports progress because on a slow machine this takes a couple of seconds.
 */
export async function createExampleFilm(
  onProgress?: (progress: ExampleProgress) => void,
): Promise<File[]> {
  const files: File[] = []

  for (const [index, scene] of SCENES.entries()) {
    onProgress?.({ done: index, total: SCENES.length })

    const bytes = await encodeClip({
      seconds: SECONDS,
      width: WIDTH,
      height: HEIGHT,
      fps: FPS,
      toneHz: scene.toneHz,
      draw: (ctx, _time, progress) => paintScene(ctx, scene, progress),
    })

    files.push(
      new File([bytes], `${index + 1}. ${scene.title}.mp4`, { type: 'video/mp4' }),
    )
  }

  onProgress?.({ done: SCENES.length, total: SCENES.length })
  return files
}

/**
 * One frame: a gradient, a highlight that drifts slowly across it, the scene
 * title, and a clock. The clock matters — it is how someone watching the
 * preview can tell that trimming actually removed the part they meant.
 */
function paintScene(ctx: CanvasRenderingContext2D, scene: Scene, progress: number): void {
  const backdrop = ctx.createLinearGradient(0, 0, 0, HEIGHT)
  backdrop.addColorStop(0, scene.from)
  backdrop.addColorStop(1, scene.to)
  ctx.fillStyle = backdrop
  ctx.fillRect(0, 0, WIDTH, HEIGHT)

  // A soft light moving left to right, so the picture is visibly in motion
  // and a trimmed clip looks different from an untrimmed one.
  const x = WIDTH * (0.15 + progress * 0.7)
  const glow = ctx.createRadialGradient(x, HEIGHT * 0.38, 0, x, HEIGHT * 0.38, HEIGHT * 0.75)
  glow.addColorStop(0, `${scene.light}66`)
  glow.addColorStop(1, `${scene.light}00`)
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, WIDTH, HEIGHT)

  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = 'rgba(0, 0, 0, 0.45)'
  ctx.font = '600 46px system-ui, sans-serif'
  ctx.fillText(scene.title, 62, HEIGHT - 84)
  ctx.fillStyle = '#ffffff'
  ctx.fillText(scene.title, 60, HEIGHT - 86)

  ctx.fillStyle = 'rgba(255, 255, 255, 0.82)'
  ctx.font = '500 30px system-ui, sans-serif'
  ctx.fillText(`${(progress * SECONDS).toFixed(1)} seconds in`, 60, HEIGHT - 44)
}
