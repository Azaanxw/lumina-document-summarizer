import { test, expect, type Page } from '@playwright/test'
import path from 'path'

const SAMPLE_PDF = path.join(__dirname, 'fixtures/sample.pdf')

// Mock all backend API calls so tests are self-contained and do not require
// a live backend, Supabase, OpenAI, or S3.
async function mockBackend(page: Page) {
  await page.route('**/upload', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        message: 'ok',
        filename: 'sample.pdf',
        chunks_stored: 3,
        text_preview: 'Sample document text.',
        database_record: [{ id: 'mock-doc-id' }],
      }),
    })
  )
  await page.route('**/process-document', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        summary: 'This document covers machine learning fundamentals.',
        quiz: [
          {
            question: 'What is deep learning?',
            options: ['A) A type of database', 'B) A neural network technique', 'C) A sorting algorithm', 'D) A markup language'],
            answer: 'B',
          },
        ],
      }),
    })
  )
  await page.route('**/generate-cards', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        flashcards: [
          { question: 'What is a neural network?', answer: 'A system modelled on the human brain.' },
        ],
      }),
    })
  )
  await page.route('**/ask', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        answer: 'Machine learning is a subset of artificial intelligence.',
        citations: [{ page_number: 1, snippet: 'machine learning is...' }],
      }),
    })
  )
}

async function uploadAndNavigate(page: Page) {
  await mockBackend(page)
  await page.goto('/')
  // Wait for anonymous session to resolve — home page shows this text once session !== undefined
  await expect(page.getByText(/Already have an account/i)).toBeVisible({ timeout: 10_000 })
  await page.locator('input[type="file"]').setInputFiles(SAMPLE_PDF)
  await page.waitForURL(/\/document\//, { timeout: 15_000 })
}

test('home page loads with Lumina branding and upload zone', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('Lumina')).toBeVisible()
  await expect(page.locator('input[type="file"]')).toBeAttached()
})

test('uploading a valid PDF navigates to /document/:id', async ({ page }) => {
  await uploadAndNavigate(page)
})

test('document page shows Summary & Quiz tab as active by default', async ({ page }) => {
  await uploadAndNavigate(page)
  await expect(page.getByRole('tab', { name: /Summary/i })).toBeVisible()
})

test('summary section is populated after processing completes', async ({ page }) => {
  await uploadAndNavigate(page)
  await expect(
    page.getByText('This document covers machine learning fundamentals.')
  ).toBeVisible({ timeout: 15_000 })
})

test('Generate Flashcards button is visible and clicking it loads the deck', async ({ page }) => {
  await uploadAndNavigate(page)
  const generateBtn = page.getByRole('button', { name: /Generate Flashcards/i })
  await expect(generateBtn).toBeVisible({ timeout: 10_000 })
  await generateBtn.click()
  // After generation, the Flashcards tab becomes visible and the deck renders
  await expect(page.getByRole('tab', { name: /Flashcards/i })).toBeVisible({ timeout: 10_000 })
})

test('Ask panel is visible on the document page', async ({ page }) => {
  await uploadAndNavigate(page)
  await expect(page.getByPlaceholder(/Ask a question/i)).toBeVisible({ timeout: 10_000 })
})
