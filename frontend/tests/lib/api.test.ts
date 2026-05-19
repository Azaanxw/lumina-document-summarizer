import {
  uploadDocument,
  listDocuments,
  processDocument,
  generateCards,
  askQuestion,
  getPdfUrl,
  deleteAccount,
  clearSummaryCache,
  clearFlashcardsCache,
  lookupWord,
  ensureAnonymousSession,
  RateLimitError,
} from '@/lib/api'
import { supabase } from '@/lib/supabase'

const mockFetch = jest.fn()
global.fetch = mockFetch

function mockOk(body: unknown, status = 200) {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as Response)
}

function mockError(status: number, body?: unknown) {
  mockFetch.mockResolvedValueOnce({
    ok: false,
    status,
    json: async () => body ?? {},
    text: async () => JSON.stringify(body ?? ''),
  } as Response)
}

beforeEach(() => {
  jest.clearAllMocks()
  jest.mocked(supabase.auth.getSession).mockResolvedValue({
    data: { session: { access_token: 'test-token', user: {} as never } },
    error: null,
  } as never)
})

// ---------------------------------------------------------------------------
// Auth headers
// ---------------------------------------------------------------------------

it('includes Authorization header when session has access_token', async () => {
  mockOk({ documents: [], quota: { used: 0, total: 4 } })
  await listDocuments()
  const headers = mockFetch.mock.calls[0][1].headers
  expect(headers['Authorization']).toBe('Bearer test-token')
})

it('omits Authorization header when session is null', async () => {
  jest.mocked(supabase.auth.getSession).mockResolvedValueOnce({
    data: { session: null },
    error: null,
  } as never)
  mockOk({ documents: [], quota: { used: 0, total: 4 } })
  await listDocuments()
  const headers = mockFetch.mock.calls[0][1].headers
  expect(headers['Authorization']).toBeUndefined()
})

// ---------------------------------------------------------------------------
// ensureAnonymousSession
// ---------------------------------------------------------------------------

it('calls signInAnonymously when no existing session', async () => {
  jest.mocked(supabase.auth.getSession).mockResolvedValueOnce({
    data: { session: null },
    error: null,
  } as never)
  await ensureAnonymousSession()
  expect(supabase.auth.signInAnonymously).toHaveBeenCalledTimes(1)
})

it('does not call signInAnonymously when session already exists', async () => {
  await ensureAnonymousSession()
  expect(supabase.auth.signInAnonymously).not.toHaveBeenCalled()
})

// ---------------------------------------------------------------------------
// uploadDocument
// ---------------------------------------------------------------------------

it('posts FormData to /upload and returns document_id and filename', async () => {
  mockOk({ filename: 'uuid_test.pdf', database_record: [{ id: 'doc-123' }] })
  const file = new File([new Uint8Array([0])], 'test.pdf', { type: 'application/pdf' })
  const result = await uploadDocument(file)
  expect(result.document_id).toBe('doc-123')
  expect(result.filename).toBe('uuid_test.pdf')
  const [url, init] = mockFetch.mock.calls[0]
  expect(url).toContain('/upload')
  expect(init.method).toBe('POST')
})

// ---------------------------------------------------------------------------
// listDocuments
// ---------------------------------------------------------------------------

it('GET /documents returns documents and quota', async () => {
  mockOk({ documents: [{ id: 'd1', filename: 'a.pdf', created_at: '' }], quota: { used: 1, total: 4 } })
  const result = await listDocuments()
  expect(result.documents).toHaveLength(1)
  expect(result.quota.total).toBe(4)
  expect(mockFetch.mock.calls[0][0]).toContain('/documents')
})

// ---------------------------------------------------------------------------
// processDocument (cached)
// ---------------------------------------------------------------------------

it('POSTs to /process-document with correct body', async () => {
  mockOk({ summary: 'S', quiz: [] })
  await processDocument('doc-xyz')
  const [url, init] = mockFetch.mock.calls[0]
  expect(url).toContain('/process-document')
  expect(init.method).toBe('POST')
  expect(JSON.parse(init.body)).toEqual({ document_id: 'doc-xyz' })
})

// ---------------------------------------------------------------------------
// askQuestion & RateLimitError
// ---------------------------------------------------------------------------

it('POSTs to /ask and returns answer with citations', async () => {
  mockOk({ answer: 'Paris', citations: [] })
  const result = await askQuestion('doc-1', 'What is the capital?')
  expect(result.answer).toBe('Paris')
})

it('throws RateLimitError with retryAfter on 429', async () => {
  mockError(429, { detail: { error: 'rate_limited', retry_after: 1800 } })
  await expect(askQuestion('doc-1', 'Q?')).rejects.toBeInstanceOf(RateLimitError)
})

it('RateLimitError has correct name and retryAfter value', async () => {
  mockError(429, { detail: { error: 'rate_limited', retry_after: 1200 } })
  const err = await askQuestion('doc-1', 'Q?').catch((e) => e)
  expect(err.name).toBe('RateLimitError')
  expect(err.retryAfter).toBe(1200)
})

it('throws Error with response text on non-ok non-429 status', async () => {
  mockError(404, 'not found')
  await expect(listDocuments()).rejects.toThrow()
})

// ---------------------------------------------------------------------------
// getPdfUrl / deleteAccount / lookupWord
// ---------------------------------------------------------------------------

it('GET /documents/:id/pdf-url returns url string', async () => {
  mockOk({ url: 'https://s3.example.com/file.pdf' })
  const result = await getPdfUrl('doc-1')
  expect(result.url).toContain('s3.example.com')
  expect(mockFetch.mock.calls[0][0]).toContain('/documents/doc-1/pdf-url')
})

it('sends DELETE /account request', async () => {
  mockOk({})
  await deleteAccount()
  const [url, init] = mockFetch.mock.calls[0]
  expect(url).toContain('/account')
  expect(init.method).toBe('DELETE')
})

it('encodes special characters in word parameter', async () => {
  mockOk({ word: 'hello world', phonetic: '', definition: '', example: '', synonyms: [] })
  await lookupWord('hello world')
  expect(mockFetch.mock.calls[0][0]).toContain('hello%20world')
})

// ---------------------------------------------------------------------------
// clearSummaryCache / clearFlashcardsCache
// ---------------------------------------------------------------------------

it('clearSummaryCache calls DELETE endpoint', async () => {
  mockOk({})
  await clearSummaryCache('doc-1')
  const [url, init] = mockFetch.mock.calls[0]
  expect(url).toContain('/documents/doc-1/cache/summary')
  expect(init.method).toBe('DELETE')
})

it('clearFlashcardsCache calls DELETE endpoint', async () => {
  mockOk({})
  await clearFlashcardsCache('doc-1')
  const [url, init] = mockFetch.mock.calls[0]
  expect(url).toContain('/documents/doc-1/cache/flashcards')
  expect(init.method).toBe('DELETE')
})
