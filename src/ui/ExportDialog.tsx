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
import { CloseIcon, SaveIcon, WarningIcon } from './Icon'
import { ShareStep } from './ShareStep'

const PHASE_TEXT: Record<ExportProgress['phase'], string> = {
  preparing: 'Getting ready',
  sound: 'Mixing the sound',
  picture: 'Rendering the picture',
  finishing: 'Finishing the file',
}

type SaveState =
  | { status: 'idle' }
  | { status: 'working'; progress: ExportProgress }
  | { status: 'done'; filename: string }
  | { status: 'error'; message: string }

function toFilename(name: string): string {
  const cleaned = name.trim().replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim()
  return `${cleaned || 'Tribute film'}.mp4`
}

/**
 * Exporting, as a modal.
 *
 * A dialog rather than a panel because rendering takes minutes and must not
 * compete for attention with the editor behind it — and because closing the
 * tab midway loses the render, which is worth one clear surface saying so.
 */
export function ExportDialog({ onClose }: { onClose: () => void }) {
  const project = useEditor((state) => state.project)
  const assets = useEditor((state) => state.assets)
  const pause = useEditor((state) => state.pause)
  const duration = useDuration()

  const [support, setSupport] = useState<ExportSupport | null>(null)
  const [name, setName] = useState('Tribute film')
  const [state, setState] = useState<SaveState>({ status: 'idle' })
  const abortRef = useRef<AbortController | null>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    headingRef.current?.focus()
  }, [])

  useEffect(() => {
    let cancelled = false
    void checkExportSupport(project.width, project.height).then((result) => {
      if (!cancelled) setSupport(result)
    })
    return () => {
      cancelled = true
    }
  }, [project.width, project.height])

  // Escape closes, but never mid-render: cancelling an export by leaning on a
  // key is not a mistake anyone should be able to make.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && state.status !== 'working') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, state.status])

  useEffect(() => {
    if (state.status !== 'working') return
    const warn = (event: BeforeUnloadEvent) => event.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [state.status])

  async function save() {
    pause()
    const controller = new AbortController()
    abortRef.current = controller
    const filename = toFilename(name)

    setState({
      status: 'working',
      progress: { phase: 'preparing', fraction: 0, framesDone: 0, framesTotal: 0 },
    })
    announce('Exporting. This can take a few minutes.')

    try {
      const blob = await exportVideo(project, assets, {
        trackId: MAIN_TRACK_ID,
        signal: controller.signal,
        onProgress: (progress) => setState({ status: 'working', progress }),
      })
      downloadBlob(blob, filename)
      setState({ status: 'done', filename })
      announce(`Saved as ${filename}.`)
    } catch (error) {
      if (error instanceof ExportCancelled) {
        setState({ status: 'idle' })
        announce('Export stopped. The film has not been changed.')
        return
      }
      const message =
        error instanceof ExportFailed ? error.userMessage : 'Something went wrong while exporting.'
      setState({ status: 'error', message })
      announce(message)
    } finally {
      abortRef.current = null
    }
  }

  const working = state.status === 'working'

  return (
    <div className="scrim" onPointerDown={() => !working && onClose()}>
      <div
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="export-title"
        onPointerDown={(event) => event.stopPropagation()}
      >
        <header className="dialog__head">
          <h2 className="dialog__title" id="export-title" tabIndex={-1} ref={headingRef}>
            Export the film
          </h2>
          <button
            type="button"
            className="dialog__close"
            onClick={onClose}
            disabled={working}
            aria-label="Close"
          >
            <CloseIcon />
          </button>
        </header>

        <div className="dialog__body">
          {support && !support.supported ? (
            <div className="notice notice--bad">
              <WarningIcon />
              <div>
                <p>{support.reason}</p>
                {support.suggestion ? <p className="notice__hint">{support.suggestion}</p> : null}
              </div>
            </div>
          ) : (
            <>
              <p className="dialog__lead">
                {describeDuration(duration)} long. The film is put together on this computer, so it
                can take a few minutes. Leave this page open until it finishes.
              </p>

              <label className="ifield-row" htmlFor="film-name">
                <span>File name</span>
                <input
                  id="film-name"
                  className="ifield"
                  type="text"
                  value={name}
                  disabled={working}
                  autoComplete="off"
                  onChange={(event) => setName(event.target.value)}
                />
              </label>

              {working ? (
                <div className="dialog__progress">
                  <div
                    className="progress"
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.round(state.progress.fraction * 100)}
                    aria-label="Export progress"
                  >
                    <div
                      className="progress__fill"
                      style={{ width: `${state.progress.fraction * 100}%` }}
                    />
                  </div>
                  <p className="dialog__status" aria-live="polite">
                    {PHASE_TEXT[state.progress.phase]}
                    {state.progress.framesTotal > 0 && state.progress.phase === 'picture'
                      ? ` — frame ${state.progress.framesDone} of ${state.progress.framesTotal}`
                      : ''}{' '}
                    <strong>{Math.round(state.progress.fraction * 100)}%</strong>
                  </p>
                  <Button label="Stop" size="compact" onClick={() => abortRef.current?.abort()} />
                </div>
              ) : (
                <Button
                  label="Export to this computer"
                  tone="primary"
                  size="large"
                  icon={<SaveIcon />}
                  onClick={() => void save()}
                />
              )}

              {state.status === 'done' ? (
                <>
                  <p className="notice notice--good save__done" role="status">
                    Saved as <strong>{state.filename}</strong> — look in your Downloads folder.
                  </p>
                  <ShareStep filename={state.filename} />
                </>
              ) : null}

              {state.status === 'error' ? (
                <p className="notice notice--bad" role="alert">
                  <WarningIcon /> {state.message}
                </p>
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
