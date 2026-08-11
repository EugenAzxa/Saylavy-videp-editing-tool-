import { expect, test } from '@playwright/test'
import { MIN_CLIP_DURATION } from '../src/core/constants'
import {
  clipAtTime,
  layoutTrack,
  nudgeClipOrder,
  projectDuration,
  removeClip,
  splitAt,
  trimClip,
} from '../src/core/timeline'
import type { Clip, MediaAsset, Project } from '../src/core/types'

/**
 * Unit tests for the edit operations. These need no browser, and they are the
 * tests to reach for first when changing anything about how clips behave —
 * the invariant they all defend is that a track stays gapless and in order.
 */

const TRACK = 'track_main'
const FPS = 30

function asset(id: string, duration: number, kind: MediaAsset['kind'] = 'video'): MediaAsset {
  return {
    id,
    kind,
    name: `${id}.mp4`,
    file: new File([], `${id}.mp4`),
    url: `blob:${id}`,
    duration,
    width: 1920,
    height: 1080,
    hasAudio: true,
    posterUrl: null,
  }
}

function clip(id: string, assetId: string, inPoint: number, duration: number): Clip {
  return { id, assetId, trackId: TRACK, inPoint, duration }
}

/** Three clips of 10, 6 and 4 seconds, cut from two source files. */
function makeProject(): { project: Project; assets: Record<string, MediaAsset> } {
  return {
    project: {
      id: 'p1',
      name: 'Test',
      width: 1920,
      height: 1080,
      fps: FPS,
      tracks: [{ id: TRACK, kind: 'video', name: 'Your film', muted: false }],
      clips: [clip('c1', 'a1', 0, 10), clip('c2', 'a2', 2, 6), clip('c3', 'a1', 20, 4)],
    },
    assets: { a1: asset('a1', 30), a2: asset('a2', 12) },
  }
}

test.describe('layout', () => {
  test('positions are the running total of the durations before each clip', () => {
    const { project } = makeProject()
    const timed = layoutTrack(project, TRACK)

    expect(timed.map((entry) => [entry.start, entry.end])).toEqual([
      [0, 10],
      [10, 16],
      [16, 20],
    ])
    expect(projectDuration(project)).toBe(20)
  })

  test('a clip boundary belongs to the later clip', () => {
    const { project } = makeProject()
    const timed = layoutTrack(project, TRACK)

    expect(clipAtTime(timed, 9.999)?.clip.id).toBe('c1')
    expect(clipAtTime(timed, 10)?.clip.id).toBe('c2')
    // Past the end, the last frame is held rather than going black.
    expect(clipAtTime(timed, 25)?.clip.id).toBe('c3')
  })
})

test.describe('splitting', () => {
  test('splits into two pieces covering exactly the same span', () => {
    const { project } = makeProject()
    const next = splitAt(project, TRACK, 4)

    expect(next.clips).toHaveLength(4)
    expect(projectDuration(next)).toBe(projectDuration(project))

    const [first, second] = layoutTrack(next, TRACK)
    expect(first?.clip.duration).toBe(4)
    expect(second?.clip.duration).toBe(6)
    // The second half must continue reading the source where the first stopped.
    expect(second?.clip.inPoint).toBe(4)
  })

  test('refuses a cut that would leave a sliver', () => {
    const { project } = makeProject()
    expect(splitAt(project, TRACK, MIN_CLIP_DURATION / 2)).toBe(project)
    // Exactly on a boundary would produce a zero-length piece.
    expect(splitAt(project, TRACK, 10)).toBe(project)
  })
})

test.describe('removing and reordering', () => {
  test('removing a clip closes the gap behind it', () => {
    const { project } = makeProject()
    const next = removeClip(project, 'c2')
    const timed = layoutTrack(next, TRACK)

    expect(timed.map((entry) => entry.start)).toEqual([0, 10])
    expect(projectDuration(next)).toBe(14)
  })

  test('moving a clip swaps it with its neighbour and keeps the total length', () => {
    const { project } = makeProject()
    const next = nudgeClipOrder(project, 'c3', -1)

    expect(layoutTrack(next, TRACK).map((entry) => entry.clip.id)).toEqual(['c1', 'c3', 'c2'])
    expect(projectDuration(next)).toBe(projectDuration(project))
  })

  test('moving past either end does nothing', () => {
    const { project } = makeProject()
    expect(nudgeClipOrder(project, 'c1', -1)).toBe(project)
    expect(nudgeClipOrder(project, 'c3', 1)).toBe(project)
  })
})

test.describe('trimming', () => {
  test('trimming the start moves into the source and shortens the clip', () => {
    const { project, assets } = makeProject()
    const next = trimClip(project, 'c1', 'start', 3, assets)
    const trimmed = next.clips.find((candidate) => candidate.id === 'c1')

    expect(trimmed?.inPoint).toBe(3)
    expect(trimmed?.duration).toBe(7)
    // Everything downstream ripples earlier; no gap is left behind.
    expect(projectDuration(next)).toBe(17)
  })

  test('a clip cannot be trimmed below the minimum', () => {
    const { project, assets } = makeProject()
    const next = trimClip(project, 'c3', 'end', -100, assets)
    expect(next.clips.find((candidate) => candidate.id === 'c3')?.duration).toBe(MIN_CLIP_DURATION)
  })

  test('a clip cannot be extended past the end of its source file', () => {
    const { project, assets } = makeProject()
    // c2 reads a2 (12s long) from 2s, so at most 10s are available.
    const next = trimClip(project, 'c2', 'end', 100, assets)
    expect(next.clips.find((candidate) => candidate.id === 'c2')?.duration).toBe(10)
  })

  test('a clip cannot start before its source file does', () => {
    const { project, assets } = makeProject()
    const next = trimClip(project, 'c2', 'start', -100, assets)
    const trimmed = next.clips.find((candidate) => candidate.id === 'c2')

    expect(trimmed?.inPoint).toBe(0)
    expect(trimmed?.duration).toBe(8) // gained the 2 seconds it had skipped
  })

  test('a photograph can be held on screen for longer than its nominal length', () => {
    const photo = asset('a3', 5, 'image')
    const project: Project = {
      id: 'p2',
      name: 'Photos',
      width: 1920,
      height: 1080,
      fps: FPS,
      tracks: [{ id: TRACK, kind: 'video', name: 'Your film', muted: false }],
      clips: [clip('c1', 'a3', 0, 5)],
    }

    const next = trimClip(project, 'c1', 'end', 20, { a3: photo })
    expect(next.clips[0]?.duration).toBe(25)
  })
})
