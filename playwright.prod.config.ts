import { defineConfig, devices } from '@playwright/test'

/**
 * Runs the production smoke test against the real built output, served with
 * the real `vercel.json` headers. Separate from `playwright.config.ts`, which
 * drives the dev server and relies on development-only test fixtures.
 *
 *   npm run test:prod
 */

const BASE_URL = 'http://localhost:4173'

export default defineConfig({
  testDir: './tests',
  testMatch: /production\.spec\.ts/,
  timeout: 180_000,
  expect: { timeout: 20_000 },
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: { args: ['--autoplay-policy=no-user-gesture-required'] },
      },
    },
  ],
  webServer: {
    command: 'npm run build && node scripts/serve-dist.mjs',
    url: BASE_URL,
    reuseExistingServer: false,
    timeout: 120_000,
  },
})
