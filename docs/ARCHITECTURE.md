# Architecture

Why the code is shaped the way it is. Read `src/core/types.ts` and `src/core/timeline.ts` first;
this document explains the decisions behind them.

---

## 1. Everything happens in the browser

There is no backend. Files are read with `URL.createObjectURL`, which hands the browser a pointer
to bytes already on the user's disk; decoding, compositing and encoding all run locally through
WebCodecs.

This started as a privacy decision and turned out to be a product decision too:

- **Nothing to breach.** A server holding families' final videos of dying relatives is a liability
  that no amount of encryption makes comfortable. There is no such server.
- **Nothing to say no to.** The interface can state "your files stay on this computer" without
  qualification, which matters to the specific person using it.
- **Nothing to pay for.** Rendering video server-side for an unbounded number of grieving families
  is the single largest cost in a product like this. Here it is zero.

The cost is real and worth naming: export speed is bounded by the user's machine, very long or 4K
films will strain memory, and browsers without WebCodecs cannot save at all. That last one is
detected up front — see `src/export/capabilities.ts`.

## 2. A track is a gapless sequence

The central modelling decision. Within a track, clips sit end to end in array order, with no
overlaps and no gaps. `Clip` has **no `start` field** — a clip's position is the sum of the
durations before it, computed by `layoutTrack()`.

```ts
// A clip knows what part of a source file it shows, and nothing about where it sits.
interface Clip { id, assetId, trackId, inPoint, duration }
```

The alternative — storing an absolute `start` per clip — makes a whole family of broken states
representable: overlapping clips, clips at negative times, and gaps that render as unexplained
black. On a memorial video, an accidental two-second hole in the middle is not a cosmetic bug.

Deriving position instead means:

- Reordering is moving one array element.
- Deleting ripples automatically; the gap closes because there was never a gap to begin with.
- Trimming the start of a clip shifts everything after it, for free.
- There is no "repair the timeline" code anywhere, because an invalid timeline cannot be built.

The trade is that overlapping transitions (a cross-fade) cannot be expressed in this model. See
[ROADMAP.md](ROADMAP.md#transitions) — the answer is a second video track, not absolute positions.

## 3. Every edit is a pure function

`src/core/timeline.ts` holds every operation the user can perform. Each takes a `Project` and
returns a new one, and never mutates.

```ts
splitAt(project, trackId, time) -> Project
trimClip(project, clipId, edge, delta, assets) -> Project
```

Two things fall out of this:

- **Undo is trivial.** `state/history.ts` keeps a list of previous `Project` values. No command
  objects, no inverse operations, nothing to get subtly wrong. A `Project` is a few hundred bytes
  of clip records — the video data lives in `MediaAsset`, outside the history — so snapshots are
  free.
- **The rules are testable without a browser.** `tests/timeline.spec.ts` covers the invariants
  directly. That is the first place to add a test when changing edit behaviour.

An operation that would be illegal returns the *same object it was given*. The store uses that
identity check to know an edit was refused, and the UI uses it to tell the user why
(`MomentActions.perform`).

## 4. Assets live outside the project

`MediaAsset` holds a live `File` handle and an object URL. Neither can be serialised or snapshotted,
so they are kept in a separate map on the store, keyed by id, and `Project` references them by id
only.

This is what keeps `Project` a plain value, which is what makes point 3 work.

## 5. The preview and the export are different engines, on purpose

This looks like duplication and is not.

| | Preview | Export |
| --- | --- | --- |
| Decoder | Hidden `<video>` elements (`playback/MediaPool.ts`) | Mediabunny `CanvasSink` |
| Driven by | `requestAnimationFrame` | A frame loop, as fast as it decodes |
| Needs | Smooth real-time playback, audio, instant scrubbing | Frame-exact output, no dropped frames |

A media element gives hardware-accelerated decode and correct audio for free, which is exactly what
a preview needs and exactly what browsers are good at. But seeking one per frame to render an export
is roughly an order of magnitude slower, and — worse — it drops frames silently, so the file quietly
differs from what was approved on screen.

Mediabunny's `canvasesAtTimestamps()` takes one monotonically ascending list of timestamps per clip
and decodes each compressed packet at most once. That is why export runs faster than real time.

**The one thing they share is `playback/compositor.ts`.** Both call `drawContained()` to paint a
frame. If they ever diverge, the film the family approves is not the film they get, so any change to
how a frame is composed must be made in that file and nowhere else.

### Playback detail worth knowing

While playing, the playhead is driven by the video element's own `currentTime`, not by wall clock.
If decoding stalls for 80ms, the media clock stalls with it and the playhead waits — instead of
running ahead and desynchronising the sound. `usePlayback.ts` also watches for the playhead moving
by more than `RESYNC_THRESHOLD` between frames, which means the user scrubbed during playback, and
re-seeks the source to catch up.

## 6. Audio is mixed in one offline pass

`mixAudio()` in `export/exportVideo.ts` builds an `OfflineAudioContext` the length of the film,
schedules every clip's audio onto it with `start(when, offset, duration)`, and renders once. Clip
scheduling and sample-rate conversion come free and stay sample-accurate against the picture.

A clip whose audio will not decode is skipped rather than fatal — losing the sound from one of
thirty clips should not cost someone the whole film.

Known limitation: `decodeAudioData` decodes an entire source file into memory. Fine for phone
clips, heavy for an hour of 4K. See [ROADMAP.md](ROADMAP.md#long-films).

## 7. Derived state is memoised off `project`

There is a sharp edge in every selector-based store, and this codebase hit it during development:

```ts
// WRONG. layoutTrack() builds a new array each call, so the store sees a new
// reference every render, concludes the state changed, and re-renders forever.
const timeline = useEditor((state) => state.timeline())
```

The fix is `src/state/selectors.ts`: subscribe to `project` — which is replaced only when an edit
actually happens and is otherwise reference-stable — and derive with `useMemo`.

```ts
const timeline = useTimeline()   // correct
```

The store's own `timeline()` and `duration()` helpers remain, for non-React callers like the
playback loop that read through `getState()`. They are commented accordingly. **Components must use
the hooks.**

## 8. Error messages are part of the domain

`media/errors.ts` defines `MediaImportError` with a `userMessage` and a `suggestion`, both written
in plain English. "Decode error: unsupported codec profile" is not something to put in front of
someone organising a funeral.

The same principle applies to `ExportFailed`. Any new failure path should carry a sentence a
non-technical person can act on.

---

## Data flow, end to end

```
File
  │  media/import.ts — probe with Mediabunny, generate poster, make object URL
  ▼
MediaAsset ────────────────► state/store.ts (assets map, outside history)
  │
  │  core/timeline.ts appendAsset()
  ▼
Project ───────────────────► state/store.ts (in history, snapshot per edit)
  │
  ├──► state/selectors.ts ──► useTimeline() ──► ui/ components
  │
  ├──► playback/usePlayback.ts ──► MediaPool ──► compositor ──► <canvas>
  │
  └──► export/exportVideo.ts ──► CanvasSink ──► compositor ──► CanvasSource ──► MP4 Blob
                                     │
                                     └──► mixAudio() ──► AudioBufferSource
```

---

## Dependencies, and why each is there

| Package | Why | Could it go? |
| --- | --- | --- |
| `mediabunny` | Demux, decode, encode, mux. Does the entire media job. | No — it is the product |
| `react` | The UI is stateful enough to want it | Yes, at a cost |
| `zustand` | ~1KB store, no provider ceremony | Yes — `useSyncExternalStore` would do |

Mediabunny is MPL-2.0. It replaced `mp4-muxer`, which the same author has deprecated in its favour,
and it brought the input/decode half that made the fast export path possible.

The production bundle is ~735KB raw / ~199KB gzipped, nearly all of it Mediabunny. It cannot be
lazily loaded behind the export button, because `media/probe.ts` needs it at import time. See
[ROADMAP.md](ROADMAP.md#bundle-size) if this becomes a concern.
