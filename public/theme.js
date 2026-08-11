/*
 * Sets the theme before the first paint, so the page never flashes the wrong
 * colours on load.
 *
 * This is a separate file rather than an inline <script> on purpose: the
 * production Content-Security-Policy sets `script-src 'self'`, which blocks
 * inline scripts outright. An inline version would need its hash pinned in
 * vercel.json and would break silently the moment anyone edited it.
 *
 * It must stay render-blocking — a classic <script src> in <head>, with no
 * `defer` and no `async`. Moving it into the bundle would put it after the
 * browser has already painted.
 *
 * Keep the storage key in sync with src/state/theme.ts.
 */
;(function () {
  try {
    var saved = localStorage.getItem('saylavy-theme')
    document.documentElement.dataset.theme = saved === 'light' ? 'light' : 'dark'
  } catch (error) {
    document.documentElement.dataset.theme = 'dark'
  }
})()
