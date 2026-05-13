const BASE = process.env.NEXT_PUBLIC_API_URL

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, init)
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    throw new Error(text || `Request failed: ${res.status}`)
  }
  return res.json() as Promise<T>
}

// Module-level promise cache — both Strict Mode calls share the same in-flight
// promise so only one HTTP request is made. Subsequent mounts return instantly.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const _cache = new Map<string, Promise<any>>()

export type DocumentMeta = { id: string; filename: string; created_at: string }
export type QuizQuestion = { question: string; options: string[]; answer: string }
export type Flashcard = { question: string; answer: string }
export type Citation = { page_number: number; snippet: string }

export async function uploadDocument(file: File): Promise<{ document_id: string; filename: string }> {
  const form = new FormData()
  form.append("file", file)
  const data = await request<{ filename: string; database_record: Array<{ id: string }> }>("/upload", {
    method: "POST",
    body: form,
  })
  return { document_id: data.database_record[0].id, filename: data.filename }
}

export async function listDocuments(): Promise<DocumentMeta[]> {
  const data = await request<{ documents: DocumentMeta[] }>("/documents")
  return data.documents
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

export async function lookupWord(word: string): Promise<{
  word: string
  phonetic: string
  definition: string
  example: string
  synonyms: string[]
}> {
  return request(`/dictionary/${encodeURIComponent(word)}`)
}
