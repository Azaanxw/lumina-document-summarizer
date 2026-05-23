import { defineConfig, devices } from '@playwright/test'

/**
 * Smoke tests — hit the real production deployment with no mocking.
 * Run with: npx playwright test --config playwright.smoke.config.ts
 *
 * Override the target URL: SMOKE_BASE_URL=https://staging.example.com npx playwright test --config playwright.smoke.config.ts
 */
export default defineConfig({
  testDir: './tests/e2e',
  testMatch: ['**/smoke.spec.ts'],
  fullyParallel: false,
  retries: 1,
  timeout: 180_000,

  use: {
    baseURL: process.env.SMOKE_BASE_URL || 'https://luminasummarizer.com',
    trace: 'on-first-retry',
    // Give each action a generous timeout — AI calls can take 30–60 s
    actionTimeout: 10_000,
    navigationTimeout: 30_000,
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // No webServer — tests run against the live production deployment
})
