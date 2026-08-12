/**
 * "When the film is finished" — the three things a family might do with it.
 *
 * Each one carries an honest status, and those labels are load-bearing:
 *
 *   - Download is BUILT and works today.
 *   - The QR code is a DEMONSTRATION. The image is real and downloads; the
 *     link it encodes opens nothing.
 *   - Collaboration is NOT BUILT. There is no invitation, no server, no
 *     shared project.
 *
 * This section will be shown to investors, and two of the three things on it
 * do not exist yet. Presenting them as though they do would be a lie told on
 * Saylavy's behalf, and it would be found out in the first demo. Saying
 * plainly which is which costs nothing — a clear roadmap reads as confidence,
 * and the one that IS built is the hard one.
 *
 * Do not remove the badges to tidy a screenshot.
 */

import type { ReactElement } from 'react'

type Status = 'now' | 'preview' | 'planned'

const STATUS_TEXT: Record<Status, string> = {
  now: 'Works today',
  preview: 'Preview',
  planned: 'Planned',
}

interface Outcome {
  status: Status
  title: string
  body: string
  art: ReactElement
}

/** A code on the memorial, so the film outlives the service. */
function StoneArt() {
  return (
    <svg viewBox="0 0 160 120" className="aw__art" aria-hidden="true" focusable="false">
      <defs>
        <clipPath id="aw-stone-clip">
          <rect x="58" y="46" width="30" height="30" rx="3" />
        </clipPath>
      </defs>

      <path d="M4 100h152" className="aw__ground" />
      <path
        d="M46 100V52a28 28 0 0 1 56 0v48Z"
        className="aw__stone"
      />

      <rect x="58" y="46" width="30" height="30" rx="3" className="aw__plaque" />
      <g className="aw__code">
        <rect x="62" y="50" width="7" height="7" />
        <rect x="77" y="50" width="7" height="7" />
        <rect x="62" y="65" width="7" height="7" />
        <rect x="72" y="60" width="4" height="4" />
        <rect x="79" y="65" width="4" height="4" />
        <rect x="72" y="70" width="4" height="4" />
      </g>

      {/* A scan sweeping the plaque, then the film beginning to play. */}
      <g clipPath="url(#aw-stone-clip)">
        <rect x="58" y="44" width="30" height="3" className="aw__scan" />
      </g>
      <g className="aw__play">
        <circle cx="118" cy="40" r="13" />
        <path d="M114 34l10 6-10 6Z" className="aw__play-tri" />
      </g>
    </svg>
  )
}

/** The file itself, on the family's own machine. */
function DownloadArt() {
  return (
    <svg viewBox="0 0 160 120" className="aw__art" aria-hidden="true" focusable="false">
      <rect x="52" y="18" width="56" height="42" rx="5" className="aw__film" />
      <path d="M52 30h56M52 48h56" className="aw__perf" />
      <path d="M74 34l14 5-14 5Z" className="aw__film-tri" />

      <g className="aw__falling">
        <path d="M80 62v20" className="aw__arrow" />
        <path d="M72 76l8 8 8-8" className="aw__arrow" />
      </g>

      <path d="M46 92h68a4 4 0 0 1 4 4v8H42v-8a4 4 0 0 1 4-4Z" className="aw__tray" />
    </svg>
  )
}

/** Other people adding what they have. */
function CollaborateArt() {
  return (
    <svg viewBox="0 0 160 120" className="aw__art" aria-hidden="true" focusable="false">
      <g className="aw__letter">
        <rect x="16" y="34" width="40" height="28" rx="4" className="aw__envelope" />
        <path d="M16 38l20 14 20-14" className="aw__envelope-flap" />
      </g>

      <path d="M62 48h28" className="aw__path" />

      <g className="aw__strip">
        <rect x="96" y="30" width="22" height="18" rx="3" className="aw__cell aw__cell--own" />
        <rect x="96" y="54" width="22" height="18" rx="3" className="aw__cell aw__cell--own" />
        <rect x="124" y="30" width="22" height="18" rx="3" className="aw__cell aw__cell--joins" />
        <rect x="124" y="54" width="22" height="18" rx="3" className="aw__cell aw__cell--joins aw__cell--late" />
      </g>
    </svg>
  )
}

const OUTCOMES: Outcome[] = [
  {
    status: 'now',
    title: 'Keep the film',
    body: 'One MP4 on your own computer. Play it at the service, put it on a memory stick, send it to whoever asks. It is yours and it needs nothing from us.',
    art: <DownloadArt />,
  },
  {
    status: 'preview',
    title: 'A code on the stone',
    body: 'A small code on the memorial or the order of service. Anyone who visits can watch the film, years later, standing where it matters.',
    art: <StoneArt />,
  },
  {
    status: 'planned',
    title: 'Let others add to it',
    body: 'Send it round the family. A brother with the wedding footage, a granddaughter with the last birthday — everyone puts in what they have, and the film grows.',
    art: <CollaborateArt />,
  },
]

export function Afterwards() {
  return (
    <section className="aw" aria-labelledby="aw-title">
      <h2 className="aw__title" id="aw-title">
        When the film is finished
      </h2>

      <ul className="aw__list">
        {OUTCOMES.map((outcome) => (
          <li key={outcome.title} className={`aw__item aw__item--${outcome.status}`}>
            <div className="aw__frame">{outcome.art}</div>
            <div className="aw__head">
              <h3>{outcome.title}</h3>
              <span className={`aw__badge aw__badge--${outcome.status}`}>
                {STATUS_TEXT[outcome.status]}
              </span>
            </div>
            <p>{outcome.body}</p>
          </li>
        ))}
      </ul>

      <p className="aw__footnote">
        Only the first of these is built. The code is a working demonstration — the image is real,
        the address it points at is not. Sharing a film with the family would mean keeping it on a
        server, which is the one thing this tool currently promises not to do.
      </p>
    </section>
  )
}
