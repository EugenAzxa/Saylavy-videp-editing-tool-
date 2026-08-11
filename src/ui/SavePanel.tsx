import { useEffect, useRef, useState } from 'react'
import { describeDuration } from '@/core/time'
import { checkExportSupport, type ExportSupport } from '@/export/capabilities'
import {
  downloadBlob,
  ExportCancelled,
  ExportFailed,
  exportVideo,
  type ExportProgress,
} from '@/export/exportVideo'
import { announce } from '@/state/announce'
import { useDuration } from '@/state/selectors'
import { MAIN_TRACK_ID, useEditor } from '@/state/store'
import { Button } from './Button'
import { SaveIcon, WarningIcon } from './Icon'

const PHASE_TEXT: Record<ExportProgress['phase'], string> = {
  preparing: 'Getting ready…',
  sound: 'Putting the sound together…',
  picture: 'Putting the pictures together…',
  finishing: 'Almost finished…',
}

type SaveState =
  | { status: 'idle' }
  | { status: 'working'; progress: ExportProgress }
  | { status: 'done'; filename: string }
  | { status: 'error'; message: string }

/** Turn whatever the user typed into something a file system will accept. */
function toFilename(name: string): string {
  const cleaned = name.trim().replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim()
  return `${cleaned || 'Tribute film'}.mp4`
}

export function SavePanel() {
  const project = useEditor((state) => state.project)
  const assets = useEditor((state) => state.assets)
  const duration = useDuration()
  const pause = useEditor((state) => state.pause)

  const [support, setSupport] = useState<ExportSupport | null>(null)
  const [name, setName] = useState('Tribute film')
  const [state, setState] = useState<SaveState>({ status: 'idle' })
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    let cancelled = false
    void checkExportSupport(project.width, project.height).then((result) => {
      if (!cancelled) setSupport(result)
    })
    return () => {
      cancelled = true
    }
  }, [project.width, project.height])

  // Saving can run for minutes. Closing the tab midway loses the render, and
  // — because nothing is stored on a server — the assembled film with it.
  useEffect(() => {
    if (state.status !== 'working') return
    const warn = (event: BeforeUnloadEvent) => event.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [state.status])

  if (duration === 0) return null

  async function save() {
    pause()
    const controller = new AbortController()
    abortRef.current = controller
    const filename = toFilename(name)

    setState({
      status: 'working',
      progress: { phase: 'preparing', fraction: 0, framesDone: 0, framesTotal: 0 },
    })
    announce('Saving the film. This can take a few minutes.')

    try {
      const blob = await exportVideo(project, assets, {
        trackId: MAIN_TRACK_ID,
        signal: controller.signal,
        onProgress: (progress) => setState({ status: 'working', progress }),
      })
      downloadBlob(blob, filename)
      setState({ status: 'done', filename })
      announce(`The film has been saved as ${filename}.`)
    } catch (error) {
      if (error instanceof ExportCancelled) {
        setState({ status: 'idle' })
        announce('Saving stopped. Your film has not been changed.')
        return
      }
      const message =
        error instanceof ExportFailed ? error.userMessage : 'Something went wrong while saving the film.'
      setState({ status: 'error', message })
      announce(message)
    } finally {
      abortRef.current = null
    }
  }

  if (support && !support.supported) {
    return (
      <section className="save save--blocked" aria-labelledby="save-title">
        <h2 className="save__title" id="save-title">
          <WarningIcon /> Saving is not available here
        </h2>
        <p className="save__body">{support.reason}</p>
        {support.suggestion ? <p className="save__body">{support.suggestion}</p> : null}
      </section>
    )
  }

  return (
    <section className="save" aria-labelledby="save-title">
      <h2 className="save__title" id="save-title">
        Save the finished film
      </h2>
      <p className="save__body">
        The film is {describeDuration(duration)} long. Saving it happens on this computer, so it can
        take a few minutes. Please leave this page open until it is done.
      </p>

      <div className="save__name">
        <label htmlFor="film-name">What should the file be called?</label>
        <input
          id="film-name"
          type="text"
          value={name}
          disabled={state.status === 'working'}
          onChange={(event) => setName(event.target.value)}
          autoComplete="off"
        />
      </div>

      {state.status === 'working' ? (
        <div className="save__progress">
          <div
            className="progress"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(state.progress.fraction * 100)}
            aria-label="Saving the film"
          >
            <div className="progress__fill" style={{ width: `${state.progress.fraction * 100}%` }} />
          </div>
          <p className="save__status" aria-live="polite">
            {PHASE_TEXT[state.progress.phase]}{' '}
            <strong>{Math.round(state.progress.fraction * 100)}%</strong>
          </p>
          <Button
            label="Stop saving"
            hint="Your film will not be changed"
            onClick={() => abortRef.current?.abort()}
          />
        </div>
      ) : (
        <Button
          label="Save the film to this computer"
          tone="primary"
          size="huge"
          icon={<SaveIcon size={1.25} />}
          onClick={() => void save()}
        />
      )}

      {state.status === 'done' ? (
        <p className="save__done" role="status">
          Saved as <strong>{state.filename}</strong>. Look in your Downloads folder.
        </p>
      ) : null}

      {state.status === 'error' ? (
        <p className="save__error" role="alert">
          <WarningIcon /> {state.message}
        </p>
      ) : null}
    </section>
  )
}
