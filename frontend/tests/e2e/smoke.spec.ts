/**
 * Smoke tests — no mocking, no local servers.
 * Every request hits the real production backend (Supabase, S3, OpenAI, Gemini).
 *
 * Run: npx playwright test --config playwright.smoke.config.ts
 */
import { test, expect } from '@playwright/test'
import path from 'path'

const SAMPLE_PDF = path.join(__dirname, 'fixtures/sample.pdf')

// Reset the runner IP's quota before each test so accumulated uploads from prior
// tests (or prior CI runs) don't block subsequent uploads. SMOKE_SUPABASE_URL and
// SMOKE_SUPABASE_SERVICE_KEY are injected by the deploy workflow; in local dev
// these are unset and this hook is a no-op.
test.beforeEach(async () => {
  const supabaseUrl = process.env.SMOKE_SUPABASE_URL
  const serviceKey = process.env.SMOKE_SUPABASE_SERVICE_KEY
  if (!supabaseUrl || !serviceKey) return
  try {
    const runnerIp = await fetch('https://api.ipify.org').then(r => r.text())
    await fetch(`${supabaseUrl}/rest/v1/ip_quotas?ip_address=eq.${runnerIp}`, {
      method: 'DELETE',
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
      },
    })
  } catch {
    // fail open — quota cleanup is best-effort; test may still pass
  }
})

// Shared helper — lands on home, waits for anonymous session, uploads PDF,
// then waits for the redirect to /document/:id.
async function uploadAndGetDocumentPage(page: import('@playwright/test').Page) {
  await page.goto('/')

  // Auth state resolves (undefined → session or null) — both null and anonymous
  // render "Already have an account?", so this only confirms the effect ran.
  await expect(page.getByText(/Already have an account/i)).toBeVisible({ timeout: 15_000 })

  // Wait for the Supabase session cookie to confirm signInAnonymously() actually
  // succeeded. Without this, the upload fires with no Bearer token → 401.
  await expect.poll(
    async () => {
      const cookies = await page.context().cookies()
      return cookies.some(c => c.name.startsWith('sb-') && c.value.length > 20)
    },
    {
      message: 'Supabase session cookie never set — signInAnonymously() likely failed or anonymous auth is disabled',
      timeout: 15_000,
      intervals: [500, 500, 1000, 1000, 2000],
    }
  ).toBe(true)

  // Upload — triggers real POST /upload → S3 → Supabase insert
  await page.locator('input[type="file"]').setInputFiles(SAMPLE_PDF)
  // 90 s — ECS Fargate cold start can push the upload pipeline past 30 s
  await page.waitForURL(/\/document\//, { timeout: 90_000 })
}

// ─── Upload pipeline ──────────────────────────────────────────────────────────

test('upload: POST /upload stores file and redirects to /document/:id', async ({ page }) => {
  await uploadAndGetDocumentPage(page)
  expect(page.url()).toMatch(/\/document\/[a-f0-9-]{36}/)
})

// ─── AI processing ───────────────────────────────────────────────────────────

test('process-document: summary and quiz render after Gemini call', async ({ page }) => {
  await uploadAndGetDocumentPage(page)

  // Loading spinner appears first
  await expect(page.getByText('Analysing your document…')).toBeVisible({ timeout: 10_000 })

  // Summary heading appears once /process-document returns (Gemini call)
  await expect(page.getByRole('heading', { name: 'Summary' })).toBeVisible({ timeout: 90_000 })

  // Summary section has at least one paragraph of content
  const summarySection = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Summary' }) })
  await expect(summarySection.locator('p, h3, li').first()).toBeVisible()

  // Quiz heading and at least one question card appear below
  await expect(page.getByRole('heading', { name: 'Quiz' })).toBeVisible()
  const quizSection = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Quiz' }) })
  await expect(quizSection.getByText(/\d+ \/ \d+/)).toBeVisible()

  // PDF viewer must render without errors — catches broken signed URLs (403),
  // CORS misconfigurations, and S3 permission issues that the AI pipeline hides.
  await expect(page.getByText(/Failed to load PDF|Error loading/i)).not.toBeVisible()
  await expect(page.locator('.react-pdf__Page canvas').first()).toBeVisible({ timeout: 15_000 })
})

// ─── Q&A pipeline ────────────────────────────────────────────────────────────

test('ask: /ask returns a grounded answer with a page citation', async ({ page }) => {
  await uploadAndGetDocumentPage(page)

  // Wait for processing to finish before asking (summary heading visible)
  await expect(page.getByRole('heading', { name: 'Summary' })).toBeVisible({ timeout: 90_000 })

  // Type and submit a question
  const askInput = page.getByPlaceholder(/Ask a question/i)
  await expect(askInput).toBeVisible()
  await askInput.fill('What is this document about?')
  await page.keyboard.press('Enter')

  // Input is disabled while /ask is in flight
  await expect(askInput).toBeDisabled({ timeout: 5_000 })

  // Input re-enables once the answer arrives (or an error occurs)
  await expect(askInput).toBeEnabled({ timeout: 60_000 })

  // A citation badge (page number) should be visible — proves RAG returned chunks
  await expect(page.getByText(/Page \d+|p\.\d+/i).first().or(
    page.locator('[data-testid="citation"]').first()
  )).toBeVisible({ timeout: 5_000 })
})

// ─── Anonymous quota enforcement ─────────────────────────────────────────────

test('quota: anonymous user cannot upload a second document', async ({ page }) => {
  // Upload once — consumes the anonymous quota (limit = 1)
  await uploadAndGetDocumentPage(page)

  // Navigate back to home and attempt a second upload
  await page.goto('/')
  await expect(page.getByText(/Already have an account/i)).toBeVisible({ timeout: 15_000 })
  await page.locator('input[type="file"]').setInputFiles(SAMPLE_PDF)

  // Expect a quota error toast or message — backend returns 403 quota_exceeded
  await expect(
    page.getByText(/quota|limit|upgrade|sign in/i).first()
  ).toBeVisible({ timeout: 15_000 })
})
