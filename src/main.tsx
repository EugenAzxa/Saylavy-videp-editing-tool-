import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { releaseAllAssets } from './state/store'
import './styles/global.css'

const container = document.getElementById('root')
if (!container) throw new Error('Missing #root element')

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Object URLs pin the imported files in memory for as long as the page lives.
// Release them on the way out so a long session does not leave gigabytes held.
window.addEventListener('pagehide', releaseAllAssets)

// Development only, and tree-shaken out of the production build. Exposes a
// sample-footage generator so a developer can try the editor without hunting
// for a video first, and so the Playwright tests have a real file to import.
// See src/dev/sampleVideo.ts.
if (import.meta.env.DEV) {
  void import('./dev/sampleVideo').then(({ downloadSampleVideo, makeSampleVideo }) => {
    Object.assign(window, {
      __saylavySampleVideo: downloadSampleVideo,
      __saylavyMakeSampleVideo: makeSampleVideo,
    })
  })
}
