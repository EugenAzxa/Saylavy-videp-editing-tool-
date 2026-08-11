# Accessibility

This tool is used by people who have just been bereaved, disproportionately by people in their
seventies and eighties, often on an unfamiliar computer, frequently in a hurry, and usually while
distracted by grief. That is the design brief. It is not a general-purpose editor with an
accessibility pass bolted on.

The rules below are the ones the interface is built to. Several are enforced by tests, because
guidelines in a document erode one component at a time.

---

## The promises

### 1. Body text is 20px

`html { font-size: 125% }` in `styles/global.css`. Nothing anywhere drops below about 17px
(`0.85rem`), and that floor is reserved for supporting text that repeats information available
elsewhere.

**Tested:** `editor.spec.ts` → "body text is 20px".

### 2. Every control is at least 56px tall

WCAG 2.2 asks for 44px. This app uses 56px as its floor and goes up from there — 64px for the
common editing actions, 76px for the two primary buttons. The position slider is 56px tall with a
34px thumb.

The reason for exceeding the guideline: the target user is often on a laptop trackpad, sometimes
with a tremor, and a missed click that deletes something is far more costly here than the screen
space saved.

**Tested:** `editor.spec.ts` → "every visible button clears the 56px target", on both the empty
state and mid-edit.

### 3. No icon-only controls

Every button carries a written label. Icons sit beside words to make them faster to find, never
instead of them. `ui/Button.tsx` makes `label` a required prop and offers no icon-only variant, so
this cannot be bypassed casually.

### 4. Plain language, no jargon

The vocabulary is deliberate and should be kept:

| The interface says | Not |
| --- | --- |
| piece | clip, segment |
| your film | project, timeline, composition |
| Cut here | Split, Razor |
| Remove what comes before | Trim in-point, Ripple trim |
| Save the film to this computer | Export, Render, Encode |
| Put 1 second back | Extend, in-point −1s |

Trim controls are worded as actions rather than directions. "Start +1s" requires the user to hold a
mental model of an in-point; "Cut off 1 second" and "Put 1 second back" require none.

### 5. Every drag has a button

There is no drag-to-reorder and no drag-to-trim. Reordering is "Move earlier" / "Move later";
trimming is a pair of buttons per end, plus playhead-relative actions. Dropping files onto the page
works, but it is never the only way in — the file chooser is always there.

Dragging is a fine-motor task with a time limit. It is the first interaction to fail for this
audience, and any future drag affordance must be an *addition* to a button, never a replacement.

### 6. Nothing destructive on a single keypress

`Delete` is not bound. `useKeyboardShortcuts.ts` binds only play/pause, one-second stepping, and
undo/redo. A stray keypress removing part of someone's memorial film is a worse moment than the
keystroke saves — even with undo available.

### 7. Undo is always visible

Full size, in the header, on every screen, never behind a menu. For a user who is frightened of
"breaking it", a permanently visible way back is the single most reassuring thing on the page.
Destructive buttons say so too: "Remove this piece — *You can undo this*".

### 8. Nothing is signalled by colour alone

The selected piece has a thick border, an offset ring, *and* a filled number badge. The piece
currently on screen has a labelled "ON SCREEN NOW" banner, not a coloured outline. Disabled
buttons are dashed as well as dimmed, and are kept legible rather than faded out — a disabled
control's label is often the explanation for why it is disabled.

### 9. Actions are announced

`state/announce.ts` plus `ui/Announcer.tsx` provide a polite live region. Every action that changes
something the user may not be looking at says what happened: what was removed, where a piece moved
to, how long the selected piece now is, and — importantly — when an action was **refused**:

> "That is not possible at this exact moment. Try moving the position a little."

Silent failure is the worst outcome for a screen-reader user and nearly as bad for everyone else.

### 10. Focus is always visible

3px ring, 2px offset, on everything, via `:focus-visible`. There is a skip link to the film. The
position control is a real `<input type="range">` rather than a custom playhead, so it arrives with
keyboard support, screen-reader support and a generous hit area already correct.

### 11. System preferences are respected

`prefers-reduced-motion` disables transitions and animations. `forced-colors` mode is handled
explicitly so the borders that carry meaning — selection, progress, button edges — survive a
replaced palette.

There is a trap in this worth knowing about. Sections animate in from `opacity: 0`, and the
reduced-motion rules collapse animation duration to nothing. The only thing that then leaves the
content visible is `animation-fill-mode: both` on every entrance animation. Drop it and the page
renders permanently blank for exactly the users who asked for less movement — so there is a test
that loads the page under `prefers-reduced-motion: reduce` and asserts the content is visible.

### 12. Motion is calm, and never carries meaning alone

Every animation is a short fade or a small downward settle. No bounce, no spring, no overshoot,
nothing that draws the eye for its own sake. People use this on one of the worst weeks of their
lives, and motion that reads as playful reads as disrespectful.

Nothing is communicated by movement alone. The pulsing "ON SCREEN NOW" badge is a written label
first; the shimmer on the progress bar sits under a numeric percentage. Switch every animation off
and the interface says exactly the same things.

### 13. There is something safe to practise on

"Try it with an example film" generates three throwaway clips. A first-time user is otherwise
obliged to learn what "Cut here" does by pressing it on irreplaceable footage of someone who has
died, which is a cruel way to introduce an editor. The example removes the risk from the first five
minutes entirely.

---

## Colour and contrast

The palette is Saylavy's own, lifted from the PrimeVue tokens published on saylavy.com: the
`#204BCC` primary ramp over slate neutrals, set in Open Sans. The brand blue is reserved for the
action the user is most likely to want next.

### Two themes, one bar

Dark is the default, matching the marketing site. A toggle in the header switches to light and the
choice persists.

Both themes are held to the same standard. Dark is not a decorative mode that gets a pass — if
anything it needs more care, because that is where contrast quietly slips.

**Dark** (ratios against `--surface` #131C31, the card):

| Pair | Ratio | Standard |
| --- | --- | --- |
| `--ink` #E8EDF7 on `--paper` #0B1120 | ~16.1:1 | AAA |
| `--ink-soft` #9FB0CC on card | ~7.7:1 | AAA |
| `--accent-ink` #FFFFFF on `--accent` #204BCC | ~7.2:1 | AAA |
| `--danger` #F87171 on card | ~6.1:1 | AA |
| `--focus` #93B4FF on card | ~8.3:1 | AAA |
| `--accent-edge` #5F85E1 on card | ~4.8:1 | AA (UI, needs 3:1) |
| `--line-strong` #6B7C9E on card | ~4.0:1 | AA (UI, needs 3:1) |

**Light** (ratios against `--surface` #FFFFFF):

| Pair | Ratio | Standard |
| --- | --- | --- |
| `--ink` #0F172A on `--paper` #EEF2FA | ~17.6:1 | AAA |
| `--ink-soft` #475569 on white | ~7.6:1 | AAA |
| `--accent` #204BCC on white | ~7.2:1 | AAA |
| `--danger` #991B1B on white | ~8.4:1 | AAA |
| `--line-strong` #64748B on white | ~4.8:1 | AA (UI, needs 3:1) |

Four choices in there are deliberate departures from the obvious pick:

- **Dark text is `#E8EDF7`, not white.** Pure white on near-black haloes badly for readers with
  astigmatism or cataracts — a large share of this audience. Off-white keeps the contrast and drops
  the glare.
- **`--line-strong` is slate-500, not slate-400.** A border that carries meaning — the edge of a
  button — needs 3:1. Slate-400 manages only 2.6:1 on white.
- **`--danger` is red-800 in light mode, not red-600.** The lighter reds reach about 6.5:1, and the
  warning attached to deleting part of someone's memorial film should clear AAA.
- **The primary button gets a lighter border in dark mode** (`--accent-edge`). The brand blue fill
  is only 2.4:1 against the dark card, so without an edge the button's *shape* disappears even
  though its label is perfectly legible.

### Why there is a toggle rather than a decision

Dark backgrounds genuinely reduce legibility for readers with cataracts or reduced contrast
sensitivity. That is a real cost, and it is not a reason to withhold the brand look from everyone
else. So: dark by default, light one tap away, labelled "Light screen — easier to read" rather than
with an icon nobody has to decode.

The theme is applied by an inline script in `index.html` before first paint. If that ever moves
into the bundle, the page will flash the wrong colours on every load.

---

## Known gaps

Honest list, for whoever picks this up:

- **No automated contrast or axe-core audit in CI.** The ratios above were computed by hand. Adding
  `@axe-core/playwright` to the existing suite is a small job and worth doing.
- **Not tested with real screen readers.** The live regions and labelling are written correctly, but
  NVDA, JAWS and VoiceOver have not been driven through a full session.
- **Not tested with real users.** Nothing in this document substitutes for watching one
  seventy-five-year-old try to trim a clip. That test will find things this list does not.
- **No zoom testing beyond 200%.** The layout is fluid and should hold, but it is unverified.
- **Copy is English only**, and written in British English at that.
