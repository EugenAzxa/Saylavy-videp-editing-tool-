import { useCallback, useEffect, useRef, useState } from 'react'
import { ACCEPTED_IMAGE_TYPES, ACCEPTED_VIDEO_TYPES } from '@/core/constants'
import { createExampleFilm } from '@/media/exampleFilm'
import { announce } from '@/state/announce'
import { useEditor } from '@/state/store'
import { Button } from './Button'
import { PlusIcon, SparkIcon } from './Icon'

const ACCEPT = [...ACCEPTED_VIDEO_TYPES, ...ACCEPTED_IMAGE_TYPES, 'video/*', 'image/*', 'audio/*'].join(
  ',',
)

const STEPS = [
  ['Bring it in', 'Videos, photographs, and music if you have some.'],
  ['Shape it', 'Cut, trim, reorder. Add text where it needs words.'],
  ['Export', 'One MP4, on this computer, ready to play or pass on.'],
]

/**
 * The first screen. One decision — start, or try the example — and a short
 * account of what the tool does, so nobody has to guess before committing
 * footage they cannot replace.
 */
export function EmptyState() {
  const addFiles = useEditor((state) => state.addFiles)
  const isImporting = useEditor((state) => state.isImporting)
  const picker = useRef<HTMLInputElement>(null)
  const [over, setOver] = useState(false)
  const [example, setExample] = useState<'idle' | 'making' | 'failed'>('idle')
  const [made, setMade] = useState(0)

  const accept = useCallback(
    async (list: FileList | null) => {
      const files = list ? Array.from(list) : []
      if (files.length === 0) return
      announce(`Adding ${files.length} ${files.length === 1 ? 'file' : 'files'}.`)
      await addFiles(files)
    },
    [addFiles],
  )

  // Dropping works anywhere on the page, not only on the panel — hitting a
  // specific target with a shaky hand is a demand this screen should not make.
  useEffect(() => {
    const over_ = (event: DragEvent) => {
      if (!event.dataTransfer?.types.includes('Files')) return
      event.preventDefault()
      setOver(true)
    }
    const out = (event: DragEvent) => {
      if (event.relatedTarget === null) setOver(false)
    }
    const drop = (event: DragEvent) => {
      if (!event.dataTransfer?.types.includes('Files')) return
      event.preventDefault()
      setOver(false)
      void accept(event.dataTransfer.files)
    }

    window.addEventListener('dragover', over_)
    window.addEventListener('dragleave', out)
    window.addEventListener('drop', drop)
    return () => {
      window.removeEventListener('dragover', over_)
      window.removeEventListener('dragleave', out)
      window.removeEventListener('drop', drop)
    }
  }, [accept])

  async function buildExample() {
    setExample('making')
    setMade(0)
    announce('Building an example film.')
    try {
      const files = await createExampleFilm(({ done }) => setMade(done))
      await addFiles(files)
      announce('Example ready — three pieces to practise on.')
    } catch {
      setExample('failed')
    }
  }

  return (
    <div className={`start${over ? ' start--over' : ''}`}>
      <input
        ref={picker}
        type="file"
        multiple
        accept={ACCEPT}
        className="visually-hidden"
        onChange={(event) => {
          void accept(event.target.files)
          event.target.value = ''
        }}
      />

      <div className="start__main">
        <p className="start__eyebrow">Saylavy</p>
        <h1 className="start__title">Make a film for the service</h1>
        <p className="start__lead">
          Put together a tribute from the videos and photographs you already have. Everything happens
          on this computer — nothing is uploaded, and nobody else can see any of it.
        </p>

        <div className="start__actions">
          <Button
            label={isImporting ? 'Adding…' : 'Choose files'}
            tone="primary"
            size="large"
            icon={<PlusIcon />}
            disabled={isImporting}
            onClick={() => picker.current?.click()}
          />
          <Button
            label={
              example === 'making' ? `Building example… ${made} of 3` : 'Try an example first'
            }
            size="large"
            icon={<SparkIcon />}
            disabled={example === 'making' || isImporting}
            onClick={() => void buildExample()}
          />
        </div>

        <p className="start__hint">
          {example === 'failed'
            ? 'The example could not be built in this browser, but your own files will still work.'
            : 'Or drag files anywhere onto this page.'}
        </p>
      </div>

      <ol className="start__steps">
        {STEPS.map(([title, body], index) => (
          <li key={title}>
            <span className="start__num">{index + 1}</span>
            <div>
              <h2>{title}</h2>
              <p>{body}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  )
}
