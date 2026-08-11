import { defineConfig, devices } from '@playwright/test'

const BASE_URL = 'http://localhost:5173'

export default defineConfig({
  testDir: './tests',
  // The production smoke test needs the built bundle served with the real
  // vercel.json headers, which is a different server. It has its own config:
  // playwright.prod.config.ts, run via `npm run test:prod`.
  testIgnore: /production\.spec\.ts/,
  // Rendering a film is not a fast operation, even a three-second one.
  timeout: 180_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  reporter: process.env.CI ? 'list' : [['list']],
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          args: [
            // The tests drive playback directly rather than through a click,
            // so the gesture requirement has to be lifted.
            '--autoplay-policy=no-user-gesture-required',
            // Lets the fixture generate a test video with MediaRecorder.
            '--use-fake-ui-for-media-stream',
          ],
        },
      },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: BASE_URL,
    reuseExistingServer: true,
    timeout: 60_000,
  },
})
