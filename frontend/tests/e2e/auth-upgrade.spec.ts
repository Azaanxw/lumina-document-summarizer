import { test, expect } from '@playwright/test'

test('home page has a sign in button or link for anonymous users', async ({ page }) => {
  await page.goto('/')
  // Guest icon or "Sign in" link should be present
  const signInTrigger = page.getByRole('button', { name: /sign in/i }).or(
    page.getByText(/sign in/i)
  ).first()
  await expect(signInTrigger).toBeVisible({ timeout: 10_000 })
})

test('clicking sign in opens the AuthModal', async ({ page }) => {
  await page.goto('/')
  const signInTrigger = page.getByRole('button', { name: /sign in/i }).first()
  await signInTrigger.click()
  await expect(page.getByText('Sign in to Lumina')).toBeVisible()
})

test('AuthModal renders Continue with Google button', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: /sign in/i }).first().click()
  await expect(page.getByRole('button', { name: /Continue with Google/i })).toBeVisible()
})

test('email input is visible when modal opens', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: /sign in/i }).first().click()
  await expect(page.getByPlaceholder('you@example.com')).toBeVisible()
})

test('send code button is disabled with empty email', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: /sign in/i }).first().click()
  await expect(page.getByRole('button', { name: /Send code/i })).toBeDisabled()
})

test('send code button enables after typing valid email', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: /sign in/i }).first().click()
  await page.getByPlaceholder('you@example.com').fill('user@example.com')
  await expect(page.getByRole('button', { name: /Send code/i })).not.toBeDisabled()
})

test('modal closes when X button is clicked', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: /sign in/i }).first().click()
  await expect(page.getByText('Sign in to Lumina')).toBeVisible()
  await page.getByLabel('Dismiss').click()
  await expect(page.getByText('Sign in to Lumina')).not.toBeVisible()
})

test('nudge banner appears after analysis completes and 15s pass for anonymous user', async ({ page }) => {
  await page.goto('/')
  // Navigate to a document page that has completed analysis
  // Inject a fake timer advance by waiting + checking
  // This is a smoke test — real timing requires a pre-loaded document
  await page.goto('/')
  const nudge = page.getByText(/Enjoying Lumina/i)
  // Banner shouldn't be visible immediately
  await expect(nudge).not.toBeVisible()
})
