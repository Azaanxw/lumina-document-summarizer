import { supabase } from './supabase'

const BASE = process.env.NEXT_PUBLIC_API_URL

// ---------------------------------------------------------------------------
// Custom errors
// ---------------------------------------------------------------------------

export class RateLimitError extends Error {
  constructor(public readonly retryAfter: number) {
    super("rate_limited")
    this.name = "RateLimitError"
  }
}

// ---------------------------------------------------------------------------
// Anonymous session — ensure every visitor has a Supabase session before upload
// ---------------------------------------------------------------------------

export async function ensureAnonymousSession(): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    await supabase.auth.signInAnonymously()
  }
}

async function getAuthHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {}
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.access_token) {
      headers['Authorization'] = `Bearer ${session.access_token}`
    }
  } catch {}
  return headers
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const authHeaders = await getAuthHeaders()
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      ...authHeaders,
      ...(init?.headers as Record<string, string> | undefined),
    },
  })
  if (res.status === 429) {
    let retryAfter = 3600
    try {
      const json = await res.json()
      if (typeof json?.detail?.retry_after === 'number') {
        retryAfter = json.detail.retry_after
      }
    } catch {}
    throw new RateLimitError(retryAfter)
  }
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    throw new Error(text || `Request failed: ${res.status}`)
  }
  return res.json() as Promise<T>
}

// Module-level promise cache — both Strict Mode calls share the same in-flight
// promise so only one HTTP request is made.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const _cache = new Map<string, Promise<any>>()

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DocumentMeta = { id: string; filename: string; created_at: string }
export type QuizQuestion = { question: string; options: string[]; answer: string }
export type Flashcard = { question: string; answer: string }
export type Citation = { page_number: number; snippet: string }
export type Quota = { used: number; total: number }

// ---------------------------------------------------------------------------
// Document endpoints
// ---------------------------------------------------------------------------

export async function uploadDocument(file: File): Promise<{ document_id: string; filename: string }> {
  const form = new FormData()
  form.append("file", file)
  const data = await request<{ filename: string; database_record: Array<{ id: string }> }>("/upload", {
    method: "POST",
    body: form,
  })
  const document_id = data.database_record[0].id
  return { document_id, filename: data.filename }
}

export async function listDocuments(): Promise<{ documents: DocumentMeta[]; quota: Quota }> {
  return request<{ documents: DocumentMeta[]; quota: Quota }>("/documents")
}

function cached<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  if (!_cache.has(key)) {
    const p = fetcher().catch((err) => { _cache.delete(key); throw err })
    _cache.set(key, p)
  }
  return _cache.get(key)
}

export async function processDocument(documentId: string): Promise<{ summary: string; quiz: QuizQuestion[] }> {
  return cached(`process-document:${documentId}`, () =>
    request("/process-document", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ document_id: documentId }),
    })
  )
}

export async function getCacheStatus(documentId: string): Promise<{ has_summary: boolean; has_flashcards: boolean }> {
  return request(`/documents/${documentId}/cache-status`)
}

export async function clearSummaryCache(documentId: string): Promise<void> {
  _cache.delete(`process-document:${documentId}`)
  await request(`/documents/${documentId}/cache/summary`, { method: "DELETE" })
}

export async function clearFlashcardsCache(documentId: string): Promise<void> {
  _cache.delete(`generate-cards:${documentId}`)
  await request(`/documents/${documentId}/cache/flashcards`, { method: "DELETE" })
}

export async function generateCards(documentId: string): Promise<{ flashcards: Flashcard[] }> {
  return cached(`generate-cards:${documentId}`, () =>
    request("/generate-cards", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ document_id: documentId }),
    })
  )
}

export async function askQuestion(
  documentId: string,
  question: string
): Promise<{ answer: string; citations: Citation[] }> {
  return request("/ask", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ document_id: documentId, question }),
  })
}

export async function getPdfUrl(documentId: string): Promise<{ url: string }> {
  return request(`/documents/${documentId}/pdf-url`)
}

export async function deleteAccount(): Promise<void> {
  await request("/account", { method: "DELETE" })
}

export async function lookupWord(word: string): Promise<{
  word: string
  phonetic: string
  definition: string
  example: string
  synonyms: string[]
}> {
  return request(`/dictionary/${encodeURIComponent(word)}`)
}
