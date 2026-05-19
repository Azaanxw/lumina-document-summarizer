import { test, expect } from '@playwright/test'

test('navigating to /dashboard without session redirects to /', async ({ page }) => {
  // Clear all storage/cookies to ensure no session
  await page.context().clearCookies()
  await page.goto('/dashboard')
  await expect(page).toHaveURL('/', { timeout: 10_000 })
})

test('anonymous user is redirected away from /dashboard', async ({ page }) => {
  // Anonymous users should be redirected; real auth is needed for /dashboard
  await page.goto('/dashboard')
  // Should not stay on /dashboard
  await expect(page).not.toHaveURL('/dashboard', { timeout: 10_000 })
})

test('home page loads the Lumina upload zone', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('Lumina')).toBeVisible()
  await expect(page.locator('input[type="file"]')).toBeAttached()
})

test('upload zone is visible on home page for anonymous users', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('input[type="file"]')).toBeAttached()
})
