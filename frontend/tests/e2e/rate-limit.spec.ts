import { test, expect, type Page } from '@playwright/test'
import path from 'path'

const SAMPLE_PDF = path.join(__dirname, 'fixtures/sample.pdf')

// Mock /upload and /process-document so these tests work without real auth or a live backend.
// Only /ask behaviour is under test here.
async function navigateToDocPage(page: Page) {
  await page.route('**/upload', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ message: 'ok', filename: 'sample.pdf', chunks_stored: 3, text_preview: '', database_record: [{ id: 'mock-doc-id' }] }),
    })
  )
  await page.route('**/process-document', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ summary: 'A test summary.', quiz: [] }),
    })
  )
  await page.goto('/')
  await expect(page.getByText(/Already have an account/i)).toBeVisible({ timeout: 10_000 })
  await page.locator('input[type="file"]').setInputFiles(SAMPLE_PDF)
  await page.waitForURL(/\/document\//, { timeout: 30_000 })
}

test('429 response from /ask shows rate limit error in QA chat', async ({ page }) => {
  await page.route('**/ask', (route) =>
    route.fulfill({
      status: 429,
      contentType: 'application/json',
      body: JSON.stringify({ detail: { error: 'rate_limited', retry_after: 1800 } }),
    })
  )

  await navigateToDocPage(page)

  const askInput = page.getByPlaceholder(/Ask a question/i)
  await expect(askInput).toBeVisible({ timeout: 15_000 })
  await askInput.fill('What is the main topic?')
  await page.keyboard.press('Enter')

  await expect(
    page.getByText(/20 questions this hour|rate limit|too many/i).first()
  ).toBeVisible({ timeout: 10_000 })
})

test('successful /ask response renders answer text', async ({ page }) => {
  await page.route('**/ask', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        answer: 'This is the mocked answer.',
        citations: [{ page_number: 1, snippet: 'relevant snippet text' }],
      }),
    })
  )

  await navigateToDocPage(page)

  const askInput = page.getByPlaceholder(/Ask a question/i)
  await expect(askInput).toBeVisible({ timeout: 15_000 })
  await askInput.fill('What is the main topic?')
  await page.keyboard.press('Enter')

  await expect(page.getByText('This is the mocked answer.')).toBeVisible({ timeout: 10_000 })
})

test('non-rate-limit errors from /ask show a generic error message', async ({ page }) => {
  await page.route('**/ask', (route) =>
    route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({ detail: 'Internal server error' }),
    })
  )

  await navigateToDocPage(page)

  const askInput = page.getByPlaceholder(/Ask a question/i)
  await expect(askInput).toBeVisible({ timeout: 15_000 })
  await askInput.fill('What is the main topic?')
  await page.keyboard.press('Enter')

  await expect(
    page.getByText(/error|failed|unable/i).first()
  ).toBeVisible({ timeout: 10_000 })
})
