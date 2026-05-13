# Backend — Document Summarizer (Lumina)

## Overview

FastAPI backend for PDF ingestion, RAG-powered Q&A with page citations, AI study tools (summary, quiz, flashcards) via Gemini 3.1 Flash Lite, and a Free Dictionary API proxy.

## Directory Structure

```
backend/
├── main.py             # FastAPI app — /upload, /process-document, /generate-cards, /ask, /dictionary/{word}
├── pdf_utils.py        # PDF text extraction + page-anchored chunking (PyMuPDF)
├── embedding_utils.py  # Batch text embedding via OpenAI text-embedding-3-small
├── gemini_utils.py     # Gemini 3.1 Flash Lite — summary, quiz, flashcard generation
├── db_utils.py         # Supabase client — documents + document_chunks queries
├── s3_utils.py         # AWS S3 upload and presigned URL helpers
├── requirements.txt    # Python dependencies
├── .env                # Environment variables (not committed)
├── uploads/            # Local temp directory (unused)
└── venv/               # Python virtual environment
```

---

## Files

### `main.py`
Entry point. Defines the FastAPI app and all endpoints.

**`GET /documents`** — list all documents for the mock user.
- Returns `{"documents": [{"id", "filename", "created_at"}, ...]}`
- Results ordered by `created_at` descending.

**`POST /upload`** — ingest a PDF into the system.
1. Validate file is a PDF with a filename.
2. Read entire file into memory once.
3. `extract_text_from_pdf()` — full text string for `documents.content`.
4. `extract_chunks_from_pdf()` — page-anchored chunks for RAG.
5. `embed_texts()` — batch embed all chunk texts in one OpenAI API call.
6. Attach each embedding to its chunk.
7. Generate UUID-prefixed unique filename, seek(0), upload to S3.
8. `save_document_metadata()` — insert into `documents`, extract returned `id`.
9. `save_document_chunks()` — batch insert chunks + embeddings into `document_chunks`.
10. Return JSON with filename, `chunks_stored` count, text preview, and DB record.

**`POST /process-document`** — generate summary + quiz for an existing document.
- Body: `{"document_id": "uuid"}`
- Checks `documents.summary` + `documents.quiz` cache first — returns instantly if populated.
- On cache miss: fetches `content`, calls Gemini, saves result to cache, returns result.
- Returns `{"summary": str, "quiz": [{"question", "options", "answer"}, ...]}`

**`POST /generate-cards`** — generate 10 flashcards for an existing document.
- Body: `{"document_id": "uuid"}`
- Checks `documents.flashcards` cache first — returns instantly if populated.
- On cache miss: fetches `content`, calls Gemini, saves result to cache, returns result.
- Returns `{"flashcards": [{"question": str, "answer": str}, ...]}`

**`POST /ask`** — RAG-powered Q&A with page citations.
- Body: `{"document_id": "uuid", "question": "..."}`
- Embeds the question, calls `match_documents` RPC to retrieve top 5 relevant chunks (threshold 0.5).
- 404 if no relevant chunks found.
- Passes chunks + question to Gemini with a grounded-only prompt.
- Returns `{"answer": str, "citations": [{"page_number": int, "snippet": str}]}`

**`GET /documents/{document_id}/pdf`** — PDF proxy (avoids S3 CORS).
- Downloads the PDF from S3 server-side and streams bytes back to the client.
- Returns the raw PDF with `Content-Type: application/pdf`.
- Frontend react-pdf points at this endpoint instead of the S3 presigned URL.

**`GET /dictionary/{word}`** — Free Dictionary API proxy.
- Calls `api.dictionaryapi.dev` server-side to avoid frontend CORS issues.
- Returns `{"word": str, "phonetic": str, "definition": str, "example": str, "synonyms": list[str]}`
- Synonyms capped at 5. Example and synonyms are empty string/list if not available.
- 404 if word not found.

> `MOCK_USER_ID` is hardcoded — replaced by JWT auth once the React frontend is ready.

---

### `pdf_utils.py`
PDF processing using **PyMuPDF** (`fitz`) and **LangChain text splitters**.

| Function | Description |
|---|---|
| `extract_text_from_pdf(file_bytes)` | Opens PDF from raw bytes, concatenates all page text with double newlines. Returns full string or `""` on error. Used for `documents.content`. |
| `extract_chunks_from_pdf(file_bytes)` | Page-anchored chunking: runs `RecursiveCharacterTextSplitter(chunk_size=800, chunk_overlap=100)` on each page independently so no chunk ever spans two pages. Returns `[{"content": str, "metadata": {"page_number": int}}, ...]`. Skips blank pages. |

---

### `embedding_utils.py`
OpenAI embedding wrapper.

| Function | Description |
|---|---|
| `embed_texts(texts)` | Batch-sends a list of strings to `text-embedding-3-small` in one API call. Returns `list[list[float]]` — 1536-dim vectors matching the pgvector column. Picks up `OPENAI_API_KEY` from env automatically. |

---

### `gemini_utils.py`
Gemini 3.1 Flash Lite study tool generation. Both functions call `_get_client()` internally and enforce JSON output via `response_mime_type="application/json"`.

| Function | Description |
|---|---|
| `generate_summary_and_quiz(text)` | Sends full document text with a mega-prompt to `gemini-3.1-flash-lite`. Returns `{"summary": str, "quiz": [...]}` — 10 multiple choice questions spread across the document. Returns `None` on error. |
| `generate_flashcards(text)` | Sends full document text with a manual prompt to `gemini-3.1-flash-lite`. Returns `{"flashcards": [{"question": str, "answer": str}]}` — 10 Q&A pairs. Returns `None` on error. |
| `generate_answer(question, chunks)` | Builds context from retrieved chunks formatted as `[Page N]\ntext`, sends to Gemini with a grounded-only prompt. Returns `{"answer": str, "citations": [{"page_number": int, "snippet": str}]}`. Returns `None` on error. |

---

### `db_utils.py`
Supabase (PostgreSQL + pgvector) interactions.

| Function | Description |
|---|---|
| `get_supabase_client()` | Initializes client using `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. |
| `save_document_metadata(user_id, filename, content)` | Inserts into `documents`. Returns inserted row list or `None` on error. |
| `get_user_documents(user_id)` | Returns `[{id, filename, created_at}]` for a user, newest first. Returns `[]` on error. |
| `get_document_content(document_id)` | Fetches the `content` field of a document by its UUID. Returns `str` or `None`. |
| `get_document_cache(document_id)` | Returns `{"summary", "quiz", "flashcards"}` from the documents row. Returns `None` on error. Used by AI endpoints to skip re-generation. |
| `save_document_cache(document_id, data)` | Updates AI cache columns (`summary`, `quiz`, `flashcards`) on an existing document row. `data` is a partial dict with only the keys to update. Returns `True`/`False`. |
| `search_chunks(document_id, query_embedding, match_count, match_threshold)` | Calls `match_documents` RPC with a query embedding. Defaults: top 5 chunks, 0.3 similarity threshold. Returns list of matching chunks with `content`, `metadata`, `similarity`. |
| `save_document_chunks(document_id, chunks)` | Batch-inserts into `document_chunks`. Each chunk must have `content`, `metadata`, and `embedding` keys. Returns `True`/`False`. |

**Supabase tables:**

`documents`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK, auto-generated |
| `user_id` | uuid | FK → auth.users |
| `filename` | text | UUID-prefixed S3 key |
| `content` | text | Full extracted text |
| `summary` | text | AI-generated summary (cached) |
| `quiz` | jsonb | AI-generated quiz questions (cached) |
| `flashcards` | jsonb | AI-generated flashcards (cached) |
| `embedding` | vector | Unused (reserved) |
| `created_at` | timestamptz | Auto |

`document_chunks`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK, auto-generated |
| `document_id` | uuid | FK → documents.id |
| `content` | text | Chunk text (≤800 chars) |
| `metadata` | jsonb | `{"page_number": N}` |
| `embedding` | vector(1536) | OpenAI embedding |

**RPC: `match_documents(query_embedding, match_threshold, match_count, filter_document_id)`**
Cosine similarity search on `document_chunks` filtered by `document_id`. Returns `(id, document_id, content, metadata, similarity)`.

---

### `s3_utils.py`
AWS S3 interactions.

| Function | Description |
|---|---|
| `get_s3_client()` | Creates boto3 S3 client from `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`. |
| `upload_to_s3(file_obj, filename)` | Streams file to S3 bucket. Sets `ContentType: application/pdf`. Returns S3 key or `None`. |
| `download_from_s3(filename)` | Downloads a file from S3 and returns raw bytes. Used by the PDF proxy endpoint. Returns `None` on error. |
| `create_presigned_url(filename, expiration)` | Generates a temporary signed URL (default 1-hour). |

---

### `requirements.txt`
Key dependencies:

| Package | Purpose |
|---|---|
| `fastapi` + `uvicorn` | Web framework and ASGI server |
| `boto3` | AWS SDK — S3 uploads |
| `supabase` | Supabase Python client |
| `pymupdf` | PDF parsing and text extraction |
| `openai` | OpenAI SDK — embeddings (`text-embedding-3-small`) |
| `langchain-text-splitters` | `RecursiveCharacterTextSplitter` for page-anchored chunking |
| `python-dotenv` | Loads `.env` into environment |
| `python-multipart` | FastAPI multipart/form-data file upload support |
| `langchain`, `langchain-openai`, `langchain-pinecone` | Reserved for future RAG chain work |
| `google-genai` | Gemini 3.1 Flash Lite — summary, quiz, and flashcard generation |

---

### `.env`
Never committed to git.

```
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=
AWS_S3_BUCKET=
OPENAI_API_KEY=
GEMINI_API_KEY=
```

---

## Running Locally

```powershell
# Activate virtual environment
.\venv\Scripts\Activate.ps1

# Start the dev server
uvicorn main:app --reload
```

API docs available at `http://localhost:8000/docs`.
