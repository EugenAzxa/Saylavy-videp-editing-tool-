/**
 * Turning dropped files into `MediaAsset`s.
 *
 * Nothing here uploads anything. `URL.createObjectURL` hands the browser a
 * pointer to bytes already on the user's disk; the file never crosses the
 * network. That is the whole privacy promise of this tool, and it lives in
 * this one function.
 */

import { newId } from '@/core/id'
import type { MediaAsset, MediaKind } from '@/core/types'
import { MediaImportError } from './errors'
import { probeImage, probeVideo } from './probe'

export interface ImportOutcome {
  assets: MediaAsset[]
  /** One entry per file that could not be brought in, with a readable reason. */
  failures: MediaImportError[]
}

function kindOf(file: File): MediaKind | null {
  if (file.type.startsWith('video/')) return 'video'
  if (file.type.startsWith('image/')) return 'image'
  if (file.type.startsWith('audio/')) return 'audio'
  return null
}

/**
 * Import a batch of files. One bad file never sinks the batch — a user
 * selecting forty photographs from a memorial folder should get the
 * thirty-nine that work, plus a note about the one that did not.
 */
export async function importFiles(files: readonly File[]): Promise<ImportOutcome> {
  const results = await Promise.all(files.map((file) => importOne(file)))

  const assets: MediaAsset[] = []
  const failures: MediaImportError[] = []
  for (const result of results) {
    if (result instanceof MediaImportError) failures.push(result)
    else assets.push(result)
  }
  return { assets, failures }
}

async function importOne(file: File): Promise<MediaAsset | MediaImportError> {
  const kind = kindOf(file)

  if (kind === null) {
    return new MediaImportError(
      file.name,
      'This is not a video or a picture, so it cannot go into the film.',
      'Videos and photographs from a phone or camera both work.',
    )
  }
  if (kind === 'audio') {
    return new MediaImportError(
      file.name,
      'Music and sound files cannot be added yet.',
      'This is coming in a later version. For now you can only add videos and photographs.',
    )
  }

  let url: string | null = null
  try {
    const probe = kind === 'video' ? await probeVideo(file) : await probeImage(file)
    url = URL.createObjectURL(file)

    return {
      id: newId(kind === 'video' ? 'video' : 'photo'),
      kind,
      name: file.name,
      file,
      url,
      duration: probe.duration,
      width: probe.width,
      height: probe.height,
      hasAudio: probe.hasAudio,
      // A photograph is its own thumbnail; a video needs one generated.
      posterUrl: kind === 'image' ? url : probe.posterUrl,
    }
  } catch (error) {
    if (url) URL.revokeObjectURL(url)
    if (error instanceof MediaImportError) return error
    return new MediaImportError(file.name, 'Something went wrong opening this file.', null, error)
  }
}

/**
 * Hand the browser back the memory an asset was holding. Call this whenever an
 * asset leaves the project, and for everything on unload.
 */
export function releaseAsset(asset: MediaAsset): void {
  URL.revokeObjectURL(asset.url)
  // For photos the poster IS the asset URL; revoking twice is harmless but
  // checking keeps the intent obvious.
  if (asset.posterUrl && asset.posterUrl !== asset.url) {
    URL.revokeObjectURL(asset.posterUrl)
  }
}
