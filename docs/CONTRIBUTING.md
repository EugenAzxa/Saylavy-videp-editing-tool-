# Contributing

## Setup

```bash
npm install
npm run test:install   # one-off: the Chromium the tests use
npm run dev
```

Node 20 or newer. No other tooling required.

No footage to test with? In development, open the console and run `__saylavySampleVideo()` to
download a generated 3-second MP4.

## Before you push

```bash
npm run typecheck
npm run test
```

Both must pass. `npm run build` runs the typecheck itself, so it is a reasonable single command.

---

## Where things go

| If you are changing… | Work in | And test in |
| --- | --- | --- |
| What an edit does | `src/core/timeline.ts` | `tests/timeline.spec.ts` |
| How a frame looks | `src/playback/compositor.ts` | `tests/editor.spec.ts` |
| What the user sees or reads | `src/ui/` | `tests/editor.spec.ts` |
| Import behaviour or error text | `src/media/` | — |
| The saved file | `src/export/exportVideo.ts` | `tests/editor.spec.ts` |

---

## Rules worth keeping

These are not style preferences. Each one is load-bearing, and the reasoning is in
[ARCHITECTURE.md](ARCHITECTURE.md) and [ACCESSIBILITY.md](ACCESSIBILITY.md).

**1. Edits are pure functions in `core/timeline.ts`.**
A component must never construct a `Project` itself. Call an action on the store, which calls a pure
function. This is what makes undo trustworthy — break it and undo silently stops covering some
edits.

**2. Never give `Clip` a `start` field.**
Position is derived from order. See ARCHITECTURE §2 for what this prevents. If you need overlap for
a transition, add a track.

**3. Frame composition happens in `compositor.ts` and nowhere else.**
The preview and the export both call it. If they diverge, the family approves one film and receives
a different one.

**4. React components use the hooks in `state/selectors.ts`.**
Not the store's `timeline()` or `duration()`. Those build a fresh value on each call and will send a
component into an infinite render loop. This has already happened once.

**5. Every button needs a written label.**
`ui/Button.tsx` enforces it. Do not add an icon-only variant.

**6. Every control stays at least 56px tall.**
There is a test for this. If it fails, fix the component, not the test.

**7. Every drag gets a button that does the same thing.**
Drag may be added as an enhancement, never as the only route.

**8. No destructive single-key shortcuts.**

**9. Error messages are sentences a grieving non-technical person can act on.**
No codes, no codec names. `MediaImportError` and `ExportFailed` both carry a `userMessage` field;
use it.

**10. Nothing is uploaded.**
Any feature that would send user media off the device is a business decision, not a pull request.

---

## Conventions

- **TypeScript strict**, including `noUncheckedIndexedAccess`. Array access returns `T | undefined`;
  handle it rather than asserting past it.
- **Imports** use the `@/` alias for anything outside the current folder. `core/` uses relative
  imports internally so its modules stay importable from tests without alias resolution.
- **Comments explain why, not what.** The codebase is commented at the file and decision level;
  match that. A comment restating the line below it is noise, a comment explaining why the range is
  half-open is not.
- **British English** in user-facing copy.
- **Plain language** in user-facing copy — see the vocabulary table in ACCESSIBILITY §4.

## Tests

`tests/timeline.spec.ts` needs no browser and runs in milliseconds. Reach for it first: most edit
behaviour can be proved there, and it is where the gapless invariant is defended.

`tests/editor.spec.ts` drives the real UI. It generates its own MP4 fixture at runtime via
`src/dev/sampleVideo.ts`, so no sample media is committed. The final test exports a film and checks
the result really is an MP4 by inspecting its `ftyp` box — "the export did not throw" and "the
family can play the file" are different claims, and only one of them matters.

Both suites run under the Playwright runner, which is why unit tests import from `@playwright/test`.
