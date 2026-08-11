import { useCallback, useEffect, useRef, useState } from 'react'
import { ACCEPTED_IMAGE_TYPES, ACCEPTED_VIDEO_TYPES } from '@/core/constants'
import { announce } from '@/state/announce'
import { useEditor } from '@/state/store'
import { Button } from './Button'
import { PlusIcon } from './Icon'

const ACCEPT = [...ACCEPTED_VIDEO_TYPES, ...ACCEPTED_IMAGE_TYPES, 'video/*', 'image/*'].join(',')

interface ImportZoneProps {
  /** `hero` is the empty-state panel; `inline` is the small button in the toolbar. */
  variant: 'hero' | 'inline'
}

/**
 * Bringing files in.
 *
 * Two ways, always both available: a large button that opens the normal file
 * chooser, and dropping files anywhere on the page. Drag and drop alone would
 * exclude anyone who finds dragging difficult, and a file chooser alone would
 * frustrate everyone else.
 */
export function ImportZone({ variant }: ImportZoneProps) {
  const addFiles = useEditor((state) => state.addFiles)
  const isImporting = useEditor((state) => state.isImporting)
  const inputRef = useRef<HTMLInputElement>(null)
  const [isDraggingOver, setDraggingOver] = useState(false)

  const accept = useCallback(
    async (list: FileList | null) => {
      const files = list ? Array.from(list) : []
      if (files.length === 0) return
      announce(`Adding ${files.length} ${files.length === 1 ? 'file' : 'files'}. Please wait.`)
      await addFiles(files)
      announce(`Added. Your film now has ${useEditor.getState().project.clips.length} pieces.`)
    },
    [addFiles],
  )

  // Dropping is accepted anywhere on the page, not just on the panel. Hitting
  // a specific target with a shaky hand is exactly the sort of demand this
  // interface should not be making.
  useEffect(() => {
    const onDragOver = (event: DragEvent) => {
      if (!event.dataTransfer?.types.includes('Files')) return
      event.preventDefault()
      setDraggingOver(true)
    }
    const onDragLeave = (event: DragEvent) => {
      if (event.relatedTarget === null) setDraggingOver(false)
    }
    const onDrop = (event: DragEvent) => {
      if (!event.dataTransfer?.types.includes('Files')) return
      event.preventDefault()
      setDraggingOver(false)
      void accept(event.dataTransfer.files)
    }

    window.addEventListener('dragover', onDragOver)
    window.addEventListener('dragleave', onDragLeave)
    window.addEventListener('drop', onDrop)
    return () => {
      window.removeEventListener('dragover', onDragOver)
      window.removeEventListener('dragleave', onDragLeave)
      window.removeEventListener('drop', onDrop)
    }
  }, [accept])

  const picker = (
    <input
      ref={inputRef}
      type="file"
      multiple
      accept={ACCEPT}
      className="visually-hidden"
      // Cleared so that choosing the same file twice in a row still fires.
      onChange={(event) => {
        void accept(event.target.files)
        event.target.value = ''
      }}
    />
  )

  if (variant === 'inline') {
    return (
      <>
        {picker}
        <Button
          label={isImporting ? 'Adding…' : 'Add more'}
          hint="Videos or photographs"
          icon={<PlusIcon />}
          disabled={isImporting}
          onClick={() => inputRef.current?.click()}
        />
      </>
    )
  }

  return (
    <section className={`dropzone${isDraggingOver ? ' dropzone--active' : ''}`} aria-labelledby="dropzone-title">
      {picker}
      <h2 className="dropzone__title" id="dropzone-title">
        Start with your videos and photographs
      </h2>
      <p className="dropzone__body">
        Choose the clips and pictures you would like in the film. You can add more at any time, and
        change your mind about any of it later.
      </p>
      <Button
        label={isImporting ? 'Adding your files…' : 'Choose files from this computer'}
        tone="primary"
        size="huge"
        icon={<PlusIcon size={1.25} />}
        disabled={isImporting}
        onClick={() => inputRef.current?.click()}
      />
      <p className="dropzone__hint">Or drag them onto this page.</p>
      <p className="dropzone__privacy">
        Your files stay on this computer. They are never uploaded, and nobody else can see them.
      </p>
    </section>
  )
}
