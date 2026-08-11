# Roadmap

What is not built, why, and how to build it. Ordered roughly by value to the person using the tool.

v1 was scoped to trimming, cutting, reordering and saving, so that those could be finished properly
rather than four things being half-done. The data model in `core/types.ts` was shaped with
everything below in mind — `Track`, `TrackKind` and the multi-track fields already exist and are
unused on purpose.

---

## 1. Background music

**The most requested feature, and mostly a licensing problem rather than a technical one.**

### The legal part — settle this first

A funeral video is played at a service and often shared with family afterwards. That is commercial-
adjacent public use, so the licence has to be unambiguous.

| Source | Licence | Verdict |
| --- | --- | --- |
| Musopen | Public domain / CC0 recordings of classical works | **Best fit.** Genuinely free, and the repertoire suits the occasion |
| Free Music Archive, CC0 tracks only | CC0 | Good, but filter carefully — most FMA tracks are *not* CC0 |
| Incompetech (Kevin MacLeod) | CC-BY 4.0 | **Avoid.** Attribution means a credit inside a funeral video |
| Pixabay Music | Pixabay Content License | Plausible, but the terms restrict redistribution. Needs legal review |
| Commissioning tracks directly | Whatever you negotiate | Most defensible, costs money |

Recommendation: **start with public-domain and CC0 only**, prefer Musopen for the classical
material, and record the licence, source URL and date for every single track in a
`public/music/LICENCES.md`. A licence you cannot evidence in two years is a licence you do not have.

Note that CC-BY is not merely inconvenient here — requiring a bereaved family to credit a composer
on screen is a real product failure, not a legal technicality.

### The technical part

Roughly a week's work, and the model is ready for it.

1. Add a second track: `{ id: 'track_music', kind: 'audio' }`. Everything in `core/timeline.ts`
   already takes a `trackId` and will work unchanged.
2. Relax the gapless invariant **for audio tracks only** — music should be able to start partway
   through. The cleanest way is a `gapless: boolean` on `Track`, honoured by `layoutTrack()`.
3. Preview: play the music through a `<audio>` element in `MediaPool`, seeking it on the same
   playhead as the video. Watch the resync path in `usePlayback.ts`.
4. Export: `mixAudio()` in `export/exportVideo.ts` already builds an `OfflineAudioContext` and
   schedules clips onto it. Music is one more `BufferSource`. Add a `GainNode` per source for fades.
5. Fade in/out and duck-under-voice are both `gain.linearRampToValueAtTime` calls in that same
   function.

UI, following `docs/ACCESSIBILITY.md`: a short list of large cards with a name, a mood word
("Gentle", "Hopeful", "Reflective"), a length and a preview button. Not a searchable library — a
choice of six is kinder here than a choice of six hundred.

## 2. Titles and text cards

A name and two dates, and a closing card. Frequently the whole reason a family makes the film.

- New `MediaKind: 'text'`, with the content on the clip rather than an asset — a text card has no
  file behind it.
- Render it in `compositor.ts` so preview and export stay identical. That is the whole trick; there
  is no other place text may be drawn.
- Keep the UI to: a line of large text, an optional second line, and nothing else. No font picker,
  no colour picker, no positioning. The design should be right by default.

## 3. Pan and zoom on photographs

Still photographs held motionless for five seconds look like a fault. A slow drift fixes it.

`compositor.ts` gains a progress argument (0–1 through the clip) and interpolates the source
rectangle. Both callers already know the clip and the time, so this is a small, contained change —
and because both go through the same function, it cannot drift between preview and export.

Offer one control: "Gentle movement" on or off, on by default.

## 4. Per-clip thumbnails

Today the poster is generated once per *asset*, so every piece cut from the same video shows the
same picture — visible in the piece strip and mildly confusing.

Generate the poster at `clip.inPoint` instead, via `CanvasSink.getCanvas()`, cached by clip id.
Cheap to do, noticeably better.

## 5. Transitions

A one-second cross-fade between pieces.

This is the one feature the current model genuinely resists: a cross-fade needs two clips visible at
once, and a gapless single track cannot express overlap. **Do not solve this by giving `Clip` an
absolute `start`** — that reintroduces every broken state described in
[ARCHITECTURE.md](ARCHITECTURE.md#2-a-track-is-a-gapless-sequence).

The right answer is a second video track, with the transition as a property of the boundary between
two clips, and the compositor drawing both and blending by the transition's progress.

## 6. Saving work in progress

Right now, closing the tab loses the arrangement. The files are still on disk, but the edit is gone.

`Project` is a plain serialisable value, so persisting it is easy; re-linking it to the original
files is not, because object URLs do not survive a reload. The File System Access API
(`showOpenFilePicker` + `FileSystemFileHandle`, persisted in IndexedDB) can hold a durable handle to
the user's files in Chrome and Edge. Safari and Firefox cannot, and would need the user to re-pick
their files.

Worth doing. Assembling a fifteen-minute film and losing it to a stray tab close is a bad evening
for someone who is already having one.

## 7. Long films

Two real limits, neither of which bites at three minutes and both of which will at thirty:

- `mixAudio()` calls `decodeAudioData` on whole source files. An hour of 4K will exhaust memory.
  Fix by streaming through Mediabunny's `AudioBufferSink` per clip instead.
- The export holds the finished MP4 in a `BufferTarget` — entirely in memory — before writing it
  out. Swap to `StreamTarget` writing into a File System Access handle for files above ~1GB.

## 8. Bundle size

~735KB raw, ~199KB gzipped, almost entirely Mediabunny. It cannot simply be lazy-loaded behind the
export button because `media/probe.ts` needs it at import time.

If this matters, the move is to probe with a hidden `<video>` element for duration and dimensions,
accept losing reliable `hasAudio` detection at import, and dynamic-import Mediabunny only when the
user saves. Measure before doing this; 199KB gzipped is not obviously a problem.

## 9. Testing gaps

- `@axe-core/playwright` over the existing Playwright suite — small job, catches real regressions.
- Screen-reader testing with NVDA and VoiceOver.
- Cross-browser runs: the config is Chromium only today. Add WebKit and Firefox projects; expect the
  export test to need per-browser codec expectations.
- **Sessions with actual users over seventy.** Nothing else on this list will teach you as much.
