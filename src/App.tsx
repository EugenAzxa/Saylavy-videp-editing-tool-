import { useRef } from 'react'
import { usePlayback } from '@/playback/usePlayback'
import { useEditor } from '@/state/store'
import { Announcer } from '@/ui/Announcer'
import { Header } from '@/ui/Header'
import { ImportFailures } from '@/ui/ImportFailures'
import { ImportZone } from '@/ui/ImportZone'
import { MomentActions } from '@/ui/MomentActions'
import { PiecePanel } from '@/ui/PiecePanel'
import { PieceStrip } from '@/ui/PieceStrip'
import { Preview } from '@/ui/Preview'
import { SavePanel } from '@/ui/SavePanel'
import { useKeyboardShortcuts } from '@/ui/useKeyboardShortcuts'

/**
 * One page, one column, top to bottom in the order the work happens: see the
 * film, change this moment, look at the pieces, change a piece, save it.
 *
 * No tabs, no panels to discover, nothing behind a menu. The whole tool is
 * visible by scrolling, which means nobody has to remember where anything is.
 */
export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  usePlayback(canvasRef)
  useKeyboardShortcuts()

  const hasPieces = useEditor((state) => state.project.clips.length > 0)

  return (
    <div className="app">
      <a className="skip-link" href="#main">
        Skip to the film
      </a>

      <Header />

      <main className="app__main" id="main">
        <ImportFailures />

        {hasPieces ? (
          <>
            <Preview canvasRef={canvasRef} />
            <MomentActions />
            <PieceStrip />
            <PiecePanel />
            <SavePanel />
          </>
        ) : (
          <ImportZone variant="hero" />
        )}
      </main>

      <footer className="app__footer">
        <p>
          Made by <a href="https://saylavy.com">Saylavy</a>. Your videos and photographs never leave
          this computer.
        </p>
      </footer>

      <Announcer />
    </div>
  )
}
