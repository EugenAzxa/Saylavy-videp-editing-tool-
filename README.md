# Saylavy Tribute Video Editor

A video editor for people arranging a funeral.

Someone has died, and a family has been asked for "a short film for the service" — usually within a
few days, usually by someone who has never edited video and is in no state to learn. This tool does
the small number of things that job actually needs, and it does them without ever asking anyone to
upload their family's private footage to a stranger's server.

Part of [Saylavy](https://saylavy.com).

---

## What it does today

- **Bring in videos and photographs** from the computer, by button or by dropping them on the page.
- **Try it with an example film** — three throwaway clips, generated on the spot, so nobody has to
  learn what "Cut here" does by pressing it on irreplaceable footage.
- **Play the film** and move through it with a large, keyboard-operable position slider.
- **Cut** a piece in two at the current moment.
- **Trim** the beginning or end of any piece, either a second at a time or straight to the playhead.
- **Reorder** pieces, and **remove** the ones that do not belong.
- **Undo and redo** anything, always, from a button that is never hidden.
- **Switch between the dark brand look and a lighter, easier-to-read one**, remembered between
  visits.
- **Save a finished MP4** to the computer.

Everything runs in the browser. Nothing is uploaded. There is no server, no account, and no
database — which is a deliberate product decision, not a missing feature. See
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## What it does not do yet

Background music, titles and captions, photo pan-and-zoom, and transitions are all **not built**.
They were scoped out of v1 on purpose so the core could be finished properly, and the data model was
shaped to accept them without a rewrite. [docs/ROADMAP.md](docs/ROADMAP.md) explains what each one
involves and where the code would go — read it before planning the next sprint, particularly the
music section, which is mostly a licensing problem rather than a technical one.

---

## Running it

```bash
npm install
npm run dev          # http://localhost:5173
```

No footage to hand? In development the app exposes a sample-video generator. Open the browser
console and run:

```js
__saylavySampleVideo()      // downloads a 3-second MP4 you can then import
```

### Other commands

| Command | What it does |
| --- | --- |
| `npm run build` | Typechecks, then builds to `dist/` |
| `npm run typecheck` | TypeScript only, no build |
| `npm run test` | Full Playwright suite (unit + end-to-end) |
| `npm run test:unit` | Just the timeline logic — fast, no browser work |
| `npm run test:e2e` | Just the browser tests, including a real MP4 export |
| `npm run test:install` | One-off: download the Chromium the tests need |

The end-to-end tests generate their own video fixture at runtime, so there is no sample footage
committed to this repository and no setup step beyond installing Chromium.

---

## Browser support

Saving a film needs [WebCodecs](https://developer.mozilla.org/en-US/docs/Web/API/WebCodecs_API) and
a secure context (`https://`, or `localhost` in development).

| Browser | Editing | Saving |
| --- | --- | --- |
| Chrome / Edge 111+ | Yes | Yes |
| Safari 16.4+ | Yes | Yes |
| Firefox 130+ | Yes | Yes |
| Anything older | Yes | No — the app checks on load and says so plainly |

The check lives in [`src/export/capabilities.ts`](src/export/capabilities.ts) and runs when the save
panel appears, so an unsupported browser is reported before the user has spent an evening
assembling a film they cannot export.

---

## Layout of the code

```
src/
  core/          The domain. Pure, no React, no browser APIs beyond types.
    types.ts       Assets, clips, tracks, project — read this first
    timeline.ts    Every edit, as a pure function. The heart of the app.
    time.ts        Frame snapping and the two duration formats
    constants.ts   Limits and defaults, all in one place
  media/         Turning files into assets: probing, thumbnails, error messages
    exampleFilm.ts Generates the three practice clips
    encodeClip.ts  Shared canvas-to-MP4 encoder, used by the example and the tests
  state/         Zustand store, undo history, theme, and the memoised selectors
  playback/      The preview: a rAF loop, hidden media elements, the compositor
  export/        Rendering the finished MP4, and the capability check
  ui/            React components. Plain language, large targets, no icon-only buttons.
  dev/           Development-only helpers, excluded from the production build
tests/
  timeline.spec.ts   Unit tests for the edit operations
  editor.spec.ts     End-to-end, including an export that is verified as a real MP4
docs/
  ARCHITECTURE.md    Why it is built this way
  ACCESSIBILITY.md   The promises the interface makes, and how they are enforced
  CONTRIBUTING.md    Conventions and how to work on it
  ROADMAP.md         What is not built, and how to build it
```

Start with `src/core/types.ts`, then `src/core/timeline.ts`. Those two files contain the ideas;
everything else is plumbing around them.

---

## A note on who this is for

Two constraints shaped nearly every decision in this codebase, and both are easy to erode
accidentally:

**It has to work for someone in their eighties.** Body text is 20px, every control is at least 56px
tall, nothing is icon-only, no destructive action is bound to a single keypress, and every drag has
a button that does the same job. These are asserted by tests, not left to good intentions — see
[docs/ACCESSIBILITY.md](docs/ACCESSIBILITY.md).

**The footage is nobody else's business.** The last video of someone's mother is not something to
put on a server "temporarily". Keeping the whole pipeline in the browser is what lets the interface
say "nothing is sent anywhere" and mean it. Any future feature that would break that promise needs
a decision from the business, not a pull request.

---

## Licence

Not yet chosen. Decide before any public release or open-sourcing — the dependencies permit either
route (Mediabunny is MPL-2.0, React and Zustand are MIT).
