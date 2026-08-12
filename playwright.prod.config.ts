import { defineConfig, devices } from '@playwright/test'

/**
 * Runs the production smoke test against the real built output, served with
 * the real `vercel.json` headers. Separate from `playwright.config.ts`, which
 * drives the dev server and relies on development-only test fixtures.
 *
 *   npm run test:prod
 */

/**
 * Point this at a real deployment to smoke-test the live site instead of a
 * local build — the same three checks, against whatever is actually serving:
 *
 *   LIVE_URL=https://saylavy.pro npm run test:prod
 */
const LIVE_URL = process.env.LIVE_URL
const BASE_URL = LIVE_URL ?? 'http://localhost:4173'

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
  // Nothing to start when testing a deployment that is already running.
  ...(LIVE_URL
    ? {}
    : {
        webServer: {
          command: 'npm run build && node scripts/serve-dist.mjs',
          url: BASE_URL,
          reuseExistingServer: false,
          timeout: 120_000,
        },
      }),
})
