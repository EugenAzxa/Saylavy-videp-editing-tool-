import { useRef, useState } from 'react'
import { MIN_CLIP_DURATION } from '@/core/constants'
import { describeDuration, formatDuration, formatLength } from '@/core/time'
import { FONTS, MAX_TITLE_LINES, TITLE_STYLES } from '@/core/titles'
import type { TimedClip, TitleSpec } from '@/core/types'
import { MUSIC_BEDS, renderMusicBed } from '@/media/music'
import { announce } from '@/state/announce'
import { useDuration, useSelectedPiece } from '@/state/selectors'
import { useEditor } from '@/state/store'
import { Button } from './Button'
import { MusicIcon, TextIcon, TrashIcon } from './Icon'

/**
 * The right-hand panel: everything about whatever is currently selected, plus
 * the music, which belongs to the film as a whole.
 *
 * Contextual rather than a wall of every control at once — an editor that
 * shows you eleven things you cannot use is how a tool starts feeling
 * difficult.
 */
export function Inspector() {
  const selected = useSelectedPiece()
  const isCard = selected?.clip.assetId === null

  return (
    <aside className="inspector" aria-label="Properties">
      {selected && isCard && selected.clip.title ? (
        <TitleSection entry={selected} title={selected.clip.title} />
      ) : selected ? (
        <>
          <ClipSection entry={selected} />
          <TextOverSection entry={selected} />
        </>
      ) : (
        <section className="ipanel ipanel--hint">
          <h2 className="ipanel__title">Nothing selected</h2>
          <p className="ipanel__body">
            Choose a piece on the timeline below and its settings appear here.
          </p>
        </section>
      )}

      <MusicSection />
    </aside>
  )
}

// ---------------------------------------------------------------------------

const TRIM_STEP = 1

function ClipSection({ entry }: { entry: TimedClip }) {
  const assets = useEditor((state) => state.assets)
  const trimSelected = useEditor((state) => state.trimSelected)
  const toggleClipSound = useEditor((state) => state.toggleClipSound)
  const hasMusic = useEditor((state) => state.project.music !== null)
  const { clip, index } = entry
  const asset = clip.assetId === null ? undefined : assets[clip.assetId]

  const sourceLength =
    asset && asset.kind === 'image' ? Number.POSITIVE_INFINITY : (asset?.duration ?? 0)
  const canGrowStart = clip.inPoint > 0
  const canGrowEnd = clip.inPoint + clip.duration < sourceLength
  const canShrink = clip.duration - TRIM_STEP >= MIN_CLIP_DURATION

  const trim = (edge: 'start' | 'end', delta: number, message: string) => {
    trimSelected(edge, delta)
    announce(message)
  }

  return (
    <section className="ipanel">
      <h2 className="ipanel__title">Piece {index + 1}</h2>
      <p className="ipanel__meta">
        {asset?.name ?? 'Missing file'} &middot; {formatLength(clip.duration)}
      </p>

      <h3 className="ipanel__label">Trim the beginning</h3>
      <div className="ipanel__pair">
        <Button
          label="Cut 1s"
          size="compact"
          disabled={!canShrink}
          onClick={() => trim('start', TRIM_STEP, 'One second off the beginning.')}
        />
        <Button
          label="Add 1s"
          size="compact"
          disabled={!canGrowStart}
          onClick={() => trim('start', -TRIM_STEP, 'One second back at the beginning.')}
        />
      </div>

      <h3 className="ipanel__label">Trim the end</h3>
      <div className="ipanel__pair">
        <Button
          label="Cut 1s"
          size="compact"
          disabled={!canShrink}
          onClick={() => trim('end', -TRIM_STEP, 'One second off the end.')}
        />
        <Button
          label="Add 1s"
          size="compact"
          disabled={!canGrowEnd}
          onClick={() => trim('end', TRIM_STEP, 'One second back at the end.')}
        />
      </div>

      <p className="ipanel__note">This piece runs for {describeDuration(clip.duration)}.</p>

      <h3 className="ipanel__label">Sound</h3>
      <div className="itoggles">
        <Toggle
          label="This piece's own sound"
          on={!clip.silent}
          disabled={!asset?.hasAudio}
          hint={asset?.hasAudio ? undefined : 'This piece has no sound of its own'}
          onChange={() => {
            toggleClipSound(clip.id, 'own')
            announce(clip.silent ? "This piece's sound is on." : "This piece's sound is off.")
          }}
        />
        <Toggle
          label="Music under this piece"
          on={!clip.musicOff}
          disabled={!hasMusic}
          hint={hasMusic ? undefined : 'No music has been added yet'}
          onChange={() => {
            toggleClipSound(clip.id, 'music')
            announce(clip.musicOff ? 'Music plays here.' : 'Music stops here.')
          }}
        />
      </div>
    </section>
  )
}

/**
 * A labelled on/off switch.
 *
 * `aria-pressed` rather than a checkbox because these turn something on and
 * off immediately rather than recording a choice to be submitted. The state
 * is written out in words next to the label, so it never rests on the colour
 * of a track alone.
 */
function Toggle({
  label,
  on,
  disabled,
  hint,
  onChange,
}: {
  label: string
  on: boolean
  disabled?: boolean
  hint?: string
  onChange: () => void
}) {
  return (
    <button
      type="button"
      className={`itoggle${on && !disabled ? ' itoggle--on' : ''}`}
      aria-pressed={on && !disabled}
      disabled={disabled}
      onClick={onChange}
    >
      <span className="itoggle__track" aria-hidden="true">
        <span className="itoggle__knob" />
      </span>
      <span className="itoggle__text">
        <span>{label}</span>
        <span className="itoggle__state">{hint ?? (on && !disabled ? 'On' : 'Off')}</span>
      </span>
    </button>
  )
}

// ---------------------------------------------------------------------------

/**
 * Words laid over a piece of footage, rather than on a card of their own.
 *
 * This is what most people mean by "add text": a name and dates across a
 * photograph, not a black screen between two clips. Both exist; this is the
 * one that belongs next to the footage it sits on.
 */
function TextOverSection({ entry }: { entry: TimedClip }) {
  const addTextOver = useEditor((state) => state.addTextOver)
  const removeTextOver = useEditor((state) => state.removeTextOver)
  const editTitle = useEditor((state) => state.editTitle)

  const title = entry.clip.title
  if (!title) {
    return (
      <section className="ipanel">
        <h2 className="ipanel__title">Words over this piece</h2>
        <p className="ipanel__body">Put a name, dates or a line of text across the picture.</p>
        <Button
          label="Add words over this"
          size="compact"
          icon={<TextIcon />}
          onClick={() => {
            addTextOver(entry.clip.id)
            announce('Words added over this piece. Type them in the panel.')
          }}
        />
      </section>
    )
  }

  const change = (patch: Partial<TitleSpec>) => editTitle(entry.clip.id, { ...title, ...patch })

  const lines = [...title.lines]
  while (lines.length < MAX_TITLE_LINES) lines.push('')

  return (
    <section className="ipanel">
      <h2 className="ipanel__title">Words over this piece</h2>

      {lines.map((line, index) => (
        <input
          key={index}
          className="ifield"
          type="text"
          value={line}
          placeholder={index === 0 ? 'Margaret Hughes' : index === 1 ? '1943 – 2026' : 'Optional'}
          aria-label={`Overlay line ${index + 1}`}
          onChange={(event) => {
            const next = [...lines]
            next[index] = event.target.value
            change({ lines: next })
          }}
        />
      ))}

      <h3 className="ipanel__label">Where it sits</h3>
      <div className="ipanel__trio">
        {(
          [
            ['top', 'Top'],
            ['centre', 'Middle'],
            ['bottom', 'Bottom'],
          ] as const
        ).map(([placement, label]) => (
          <Button
            key={placement}
            label={label}
            size="compact"
            disabled={title.placement === placement}
            onClick={() => change({ placement })}
          />
        ))}
      </div>

      <h3 className="ipanel__label">Lettering</h3>
      <FontPicker fontId={title.fontId} onPick={(fontId) => change({ fontId })} />

      <Button
        label="Remove the words"
        tone="danger"
        size="compact"
        icon={<TrashIcon />}
        onClick={() => {
          removeTextOver(entry.clip.id)
          announce('Words removed from this piece.')
        }}
      />
    </section>
  )
}

// ---------------------------------------------------------------------------

function FontPicker({ fontId, onPick }: { fontId: string; onPick: (id: string) => void }) {
  return (
    <div className="ifonts">
      {FONTS.map((font) => (
        <button
          key={font.id}
          type="button"
          className={`ifont${font.id === fontId ? ' ifont--on' : ''}`}
          style={{ fontFamily: font.stack }}
          aria-pressed={font.id === fontId}
          onClick={() => onPick(font.id)}
        >
          <span className="ifont__sample">Aa</span>
          <span className="ifont__name">{font.name}</span>
        </button>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------

function TitleSection({ entry, title }: { entry: TimedClip; title: TitleSpec }) {
  const editTitle = useEditor((state) => state.editTitle)
  const trimSelected = useEditor((state) => state.trimSelected)

  const change = (patch: Partial<TitleSpec>) => editTitle(entry.clip.id, { ...title, ...patch })

  const setLine = (index: number, value: string) => {
    const lines = [...title.lines]
    while (lines.length < MAX_TITLE_LINES) lines.push('')
    lines[index] = value
    change({ lines })
  }

  const lines = [...title.lines]
  while (lines.length < MAX_TITLE_LINES) lines.push('')

  return (
    <section className="ipanel">
      <h2 className="ipanel__title">Text card</h2>
      <p className="ipanel__meta">Piece {entry.index + 1} &middot; {formatLength(entry.clip.duration)}</p>

      <h3 className="ipanel__label">Words</h3>
      {lines.map((line, index) => (
        <input
          key={index}
          className="ifield"
          type="text"
          value={line}
          placeholder={index === 0 ? 'In loving memory' : index === 1 ? '1943 – 2026' : 'Optional'}
          aria-label={`Line ${index + 1}`}
          onChange={(event) => setLine(index, event.target.value)}
        />
      ))}

      <h3 className="ipanel__label">Lettering</h3>
      <FontPicker fontId={title.fontId} onPick={(fontId) => change({ fontId })} />

      <h3 className="ipanel__label">Colours</h3>
      <div className="istyles">
        {TITLE_STYLES.map((style) => {
          const on = style.color === title.color && style.background === title.background
          return (
            <button
              key={style.id}
              type="button"
              className={`istyle${on ? ' istyle--on' : ''}`}
              style={{ background: style.background, color: style.color }}
              aria-pressed={on}
              aria-label={style.name}
              onClick={() => change({ color: style.color, background: style.background })}
            >
              Aa
            </button>
          )
        })}
      </div>

      <h3 className="ipanel__label">How long it stays up</h3>
      <div className="ipanel__pair">
        <Button
          label="Shorter"
          size="compact"
          disabled={entry.clip.duration - 1 < MIN_CLIP_DURATION}
          onClick={() => trimSelected('end', -1)}
        />
        <Button label="Longer" size="compact" onClick={() => trimSelected('end', 1)} />
      </div>
      <p className="ipanel__note">On screen for {describeDuration(entry.clip.duration)}.</p>
    </section>
  )
}

// ---------------------------------------------------------------------------

function MusicSection() {
  const music = useEditor((state) => state.project.music)
  const assets = useEditor((state) => state.assets)
  const addMusic = useEditor((state) => state.addMusic)
  const removeMusic = useEditor((state) => state.removeMusic)
  const setMusicSettings = useEditor((state) => state.setMusicSettings)

  const playhead = useEditor((state) => state.playhead)
  const duration = useDuration()

  const picker = useRef<HTMLInputElement>(null)
  const [making, setMaking] = useState<string | null>(null)

  const chooseBed = async (bedId: string, name: string) => {
    setMaking(bedId)
    announce(`Preparing ${name}. This takes a moment.`)
    try {
      await addMusic(await renderMusicBed(bedId))
      announce(`${name} added under the film.`)
    } catch {
      announce('That music could not be prepared in this browser.')
    } finally {
      setMaking(null)
    }
  }

  const track = music ? assets[music.assetId] : undefined

  return (
    <section className="ipanel">
      <h2 className="ipanel__title">
        <MusicIcon /> Music
      </h2>

      <input
        ref={picker}
        type="file"
        accept="audio/*,.mp3,.m4a,.wav"
        className="visually-hidden"
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) void addMusic(file)
          event.target.value = ''
        }}
      />

      {track && music ? (
        <>
          <p className="ipanel__meta">{track.name}</p>

          <label className="islider" htmlFor="music-volume">
            <span>
              Volume <b>{Math.round(music.volume * 100)}%</b>
            </span>
            <input
              id="music-volume"
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={music.volume}
              onChange={(event) => setMusicSettings({ volume: Number(event.target.value) })}
            />
          </label>

          <label className="islider" htmlFor="music-fade-in">
            <span>
              Fade in <b>{music.fadeIn.toFixed(0)}s</b>
            </span>
            <input
              id="music-fade-in"
              type="range"
              min={0}
              max={10}
              step={0.5}
              value={music.fadeIn}
              onChange={(event) => setMusicSettings({ fadeIn: Number(event.target.value) })}
            />
          </label>

          <label className="islider" htmlFor="music-fade-out">
            <span>
              Fade out <b>{music.fadeOut.toFixed(0)}s</b>
            </span>
            <input
              id="music-fade-out"
              type="range"
              min={0}
              max={10}
              step={0.5}
              value={music.fadeOut}
              onChange={(event) => setMusicSettings({ fadeOut: Number(event.target.value) })}
            />
          </label>

          <h3 className="ipanel__label">Cut the music</h3>
          <p className="ipanel__note">
            Plays from {formatDuration(music.startAt)} to{' '}
            {formatDuration(music.endAt ?? duration)}, starting{' '}
            {formatDuration(music.inPoint)} into the track.
          </p>
          <div className="ipanel__pair">
            <Button
              label="Start here"
              size="compact"
              onClick={() => {
                setMusicSettings({ startAt: Math.min(playhead, (music.endAt ?? duration) - 0.5) })
                announce(`Music now starts at ${formatDuration(playhead)}.`)
              }}
            />
            <Button
              label="Stop here"
              size="compact"
              onClick={() => {
                setMusicSettings({ endAt: Math.max(playhead, music.startAt + 0.5) })
                announce(`Music now stops at ${formatDuration(playhead)}.`)
              }}
            />
          </div>

          <label className="islider" htmlFor="music-in">
            <span>
              Skip the first <b>{music.inPoint.toFixed(0)}s</b> of the track
            </span>
            <input
              id="music-in"
              type="range"
              min={0}
              max={Math.max(0, Math.floor((track.duration || 0) - 1))}
              step={1}
              value={music.inPoint}
              onChange={(event) => setMusicSettings({ inPoint: Number(event.target.value) })}
            />
          </label>

          <Button
            label="Play under the whole film"
            size="compact"
            disabled={music.startAt === 0 && music.endAt === null}
            onClick={() => {
              setMusicSettings({ startAt: 0, endAt: null })
              announce('Music runs under the whole film again.')
            }}
          />

          <Button
            label="Remove music"
            tone="danger"
            size="compact"
            icon={<TrashIcon />}
            onClick={() => {
              removeMusic()
              announce('Music removed.')
            }}
          />
        </>
      ) : (
        <>
          <p className="ipanel__body">
            Choose a piece written for this app — free to use, with nothing to credit — or add one
            of your own.
          </p>

          <div className="ibeds">
            {MUSIC_BEDS.map((bed) => (
              <button
                key={bed.id}
                type="button"
                className="ibed"
                disabled={making !== null}
                onClick={() => void chooseBed(bed.id, bed.name)}
              >
                <span className="ibed__name">
                  {making === bed.id ? `Preparing ${bed.name}…` : bed.name}
                </span>
                <span className="ibed__desc">{bed.description}</span>
              </button>
            ))}
          </div>

          <Button
            label="Use my own music"
            size="compact"
            disabled={making !== null}
            onClick={() => picker.current?.click()}
          />
        </>
      )}
    </section>
  )
}
