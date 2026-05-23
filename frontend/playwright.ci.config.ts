import { defineConfig, devices } from '@playwright/test'

/**
 * CI config — runs the mocked E2E specs on every PR.
 * Only starts the Next.js frontend (backend calls are mocked via page.route()).
 * Smoke tests (smoke.spec.ts) are excluded — those run post-deploy in deploy.yml.
 *
 * Required GitHub secrets:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY
 */
export default defineConfig({
  testDir: './tests/e2e',
  testIgnore: ['**/smoke.spec.ts'],
  fullyParallel: false,
  forbidOnly: true,
  retries: 1,
  timeout: 30_000,

  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },

  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: false,
    timeout: 60_000,
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
})
