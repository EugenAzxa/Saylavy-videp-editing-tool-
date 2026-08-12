import { useEffect, useRef, useState } from 'react'
import { usePlayback } from '@/playback/usePlayback'
import { useEditor } from '@/state/store'
import { Announcer } from '@/ui/Announcer'
import { EmptyState } from '@/ui/EmptyState'
import { ExportDialog } from '@/ui/ExportDialog'
import { ImportFailures } from '@/ui/ImportFailures'
import { Inspector } from '@/ui/Inspector'
import { Stage } from '@/ui/Stage'
import { Timeline } from '@/ui/Timeline'
import { Toolbar } from '@/ui/Toolbar'
import { TopBar } from '@/ui/TopBar'
import { useKeyboardShortcuts } from '@/ui/useKeyboardShortcuts'

/**
 * The editor: a thin application bar, the picture beside its properties, the
 * edit actions, and the timeline along the bottom.
 *
 * That arrangement is the one every editing tool has converged on, and the
 * reason to follow it here is not fashion — it is that a fair number of people
 * opening this will have seen one before, and nothing about a funeral is a
 * good moment to be taught a novel layout.
 */
export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  usePlayback(canvasRef)
  useKeyboardShortcuts()

  const hasFilm = useEditor((state) => state.project.clips.length > 0)
  const [exporting, setExporting] = useState(false)

  // Nothing to export once the last piece is gone.
  useEffect(() => {
    if (!hasFilm) setExporting(false)
  }, [hasFilm])

  return (
    <div className="app">
      <a className="skip-link" href="#work">
        Skip to the film
      </a>

      <TopBar onExport={() => setExporting(true)} />

      <ImportFailures />

      <main className="work" id="work">
        {hasFilm ? (
          <>
            <div className="work__upper">
              <Stage canvasRef={canvasRef} />
              <Inspector />
            </div>
            <Toolbar />
            <Timeline />
          </>
        ) : (
          <EmptyState />
        )}
      </main>

      {exporting ? <ExportDialog onClose={() => setExporting(false)} /> : null}

      <Announcer />
    </div>
  )
}
