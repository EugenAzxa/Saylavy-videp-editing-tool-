import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    // WebCodecs needs a secure context. localhost counts as one, so plain
    // `npm run dev` is fine; any non-localhost host must be served over HTTPS.
    headers: {
      // Reserved for a future ffmpeg.wasm fallback, which needs cross-origin
      // isolation for SharedArrayBuffer. Harmless today. See docs/ARCHITECTURE.md.
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'credentialless',
    },
  },
  build: {
    target: 'es2022',
    sourcemap: true,
  },
})
