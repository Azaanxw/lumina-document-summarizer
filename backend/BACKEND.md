# Backend — Document Summarizer (Lumina)

## Overview

FastAPI backend for PDF ingestion, RAG-powered Q&A with page citations, AI study tools (summary, quiz, flashcards) via Gemini 3.1 Flash Lite, and a Free Dictionary API proxy. Uses Supabase Anonymous Auth — every visitor gets a real JWT before upload; anonymous users are limited to 1 document; upgrading (Google/email) converts the session in-place with no document transfer needed.

## Directory Structure

```
backend/
├── main.py             # FastAPI app — all endpoints, auth, DB-backed rate limiter, Sentry init
├── logging_config.py   # Centralized logging setup (StreamHandler, LOG_LEVEL env var)
├── rate_limiter.py     # DBRateLimiter — Supabase-backed rolling window rate limiter
├── pdf_utils.py        # PDF text extraction + page-anchored chunking (PyMuPDF)
├── embedding_utils.py  # Batch text embedding via OpenAI text-embedding-3-small (timeout=30s)
├── gemini_utils.py     # Gemini 3.1 Flash Lite — summary, quiz, flashcard generation (timeout=30s)
├── db_utils.py         # Supabase client — all DB queries including auth/profile/claim
├── s3_utils.py         # AWS S3 upload and presigned URL helpers
├── requirements.txt    # Python dependencies
├── pytest.ini          # pytest config (testpaths = tests, asyncio_mode = auto)
├── .env                # Environment variables (not committed)
├── uploads/            # Local temp directory (unused)
├── venv/               # Python virtual environment
└── tests/
    ├── __init__.py
    ├── conftest.py         # Shared fixtures: client, authed_client, anon_client, mock_s3, mock_supabase, mock_rate_limiter (autouse)
    ├── test_auth.py        # get_current_user + require_auth dependency logic
    ├── test_documents.py   # GET /documents, DELETE /account
    ├── test_upload.py      # POST /upload — quota, S3 failure, anon/real user paths
    ├── test_process.py     # /process-document, /generate-cards, cache-status, cache-delete
    ├── test_ask.py         # POST /ask — 200/404/500, rate limit key selection, Gemini fallback
    ├── test_rate_limit.py  # DBRateLimiter unit tests + 429 endpoint integration test
    ├── test_pdf_utils.py   # extract_text_from_pdf + extract_chunks_from_pdf (uses fitz fixture)
    ├── test_s3_utils.py    # upload/download/presign/delete S3 helpers (async)
    ├── test_db_utils.py    # All db_utils functions — Supabase chain mocking
    ├── test_gemini_utils.py    # Gemini success, OpenAI fallback, both-fail paths
    ├── test_embedding_utils.py # embed_texts batch embedding
    └── test_security_headers.py # HTTP security headers present on all responses
```

---

## Auth Model

- **Anonymous users**: Supabase `signInAnonymously()` is called on page load — every visitor has a real JWT with a `user_id` before they upload. Anonymous sessions are identified by `is_anonymous = true` on the auth user.
- **Anonymous quota**: 1 document maximum. Backend returns 403 `quota_exceeded` on the second upload attempt.
- **Upgrading**: `linkIdentity({ provider: 'google' })` or `updateUser({ email })` converts the anonymous session in-place — same `user_id`, documents are automatically preserved.
- **Authenticated quota**: 4 documents (from `profiles.document_quota`). `documents_used` is incremented on upload (not incremented for anonymous uploads).
- **JWT validation**: `get_current_user()` FastAPI dependency calls `supabase.auth.get_user(token)` and returns an `AuthUser(user_id, is_anonymous)` dataclass or `None`.
- **Rate limiting**: `/ask` is limited to 20 questions/hour per `user_id` (anonymous or real). DB-backed via `rate_limits` Supabase table — survives restarts and works across multiple ECS instances. Auth is required on `/ask`.
- **Document ownership**: All document read/query endpoints verify the requesting user owns the document (`verify_document_owner`) and return 403 if not.
- **Security headers**: HTTP middleware adds `X-Frame-Options`, `X-Content-Type-Options`, `Strict-Transport-Security`, `Referrer-Policy`, and `Content-Security-Policy` to every response.
- **IP rate limiting**: `slowapi` middleware limits `/upload` to 20 req/min and `/ask` to 60 req/min per IP, as a second layer alongside the per-user question limit.
- **Structured logging**: `logging_config.setup_logging()` called at startup — all modules use `logging.getLogger(__name__)`. Level controlled by `LOG_LEVEL` env var (default `INFO`).
- **Sentry**: Initialised via `sentry_sdk.init()` with FastAPI+Starlette integrations. Set `SENTRY_DSN` and `ENVIRONMENT` env vars to activate.

---

## Files

### `main.py`
Entry point. Defines all endpoints, auth dependencies, DB-backed rate limiter, Sentry init, and structured logging setup.

**Auth dependencies:**
- `AuthUser` — dataclass with `user_id: str` and `is_anonymous: bool`
- `get_current_user(credentials)` — optional auth; returns `AuthUser | None`
- `require_auth(auth)` — raises 401 if no valid session; returns `AuthUser`

**Rate limiter:**
- `db_rate_limiter` — `DBRateLimiter(limit=20, window_seconds=3600)` instance used by `/ask`. Backed by Supabase `rate_limits` table.

### `logging_config.py`
Configures the root logger with a `StreamHandler` to stdout. Format: `timestamp | LEVEL | module | message`. Level set by `LOG_LEVEL` env var (default `INFO`). Call `setup_logging()` once at app startup.

### `rate_limiter.py`
`DBRateLimiter` class — rolling window rate limiter backed by the Supabase `rate_limits` table. Fails open (allows request) if the DB is unreachable. Used by `/ask` at `limit=20, window_seconds=3600`. The `rate_limits` table has an index on `(user_id, endpoint, created_at)`.

---

**`GET /documents`** *(requires auth)*
- Returns `{"documents": [{id, filename, created_at}, ...], "quota": {"used": int, "total": int}}`
- Ordered by `created_at` descending.

**`POST /upload`** *(requires auth — anonymous or real; 20 req/min IP limit)*
1. 401 if no session at all.
2. Quota check: anonymous → 1 doc max; real user → `profile.document_quota` (default 4).
3. Validates file size ≤ 20 MB and magic bytes start with `%PDF-`.
4. Extract full text + page-anchored chunks from PDF.
5. Batch embed all chunks (OpenAI).
6. Upload PDF to S3 with UUID-prefixed key.
7. `save_document_metadata(user_id, ...)` — `user_id` always set (from anonymous or real session).
8. If not anonymous: `increment_documents_used()`.
9. `save_document_chunks()` — batch insert chunks + embeddings.
10. Returns `{"message", "filename", "chunks_stored", "text_preview", "database_record"}`.

**`POST /process-document`** *(requires auth — ownership verified)*
- Body: `{"document_id": "uuid"}`
- 403 if document doesn't belong to the authenticated user.
- Checks `documents.summary` + `documents.quiz` cache — returns instantly if populated.
- On cache miss: fetches `content`, calls Gemini, saves to cache.
- Returns `{"summary": str, "quiz": [{question, options, answer}, ...]}`

**`POST /generate-cards`** *(requires auth — ownership verified)*
- Body: `{"document_id": "uuid"}`
- 403 if document doesn't belong to the authenticated user.
- Checks `documents.flashcards` cache.
- Returns `{"flashcards": [{question, answer}, ...]}`

**`POST /ask`** *(requires auth — ownership verified; 60 req/min IP limit)*
- Body: `{"document_id": "uuid", "question": "..."}`
- 403 if document doesn't belong to the authenticated user.
- Enforces 20 questions/hour rolling limit per `user_id`; 429 with `{"error": "rate_limited", "retry_after": N}` on breach.
- Embeds question → `match_documents` RPC → Gemini with grounded prompt.
- 404 if no relevant chunks found.
- Returns `{"answer": str, "citations": [{page_number, snippet}, ...]}`

**`DELETE /account`** *(requires auth)*
- Fetches all S3 filenames for the user's documents, deletes each S3 object, then calls `supabase.auth.admin.delete_user(user_id)` which cascades to `profiles` and `documents` tables.
- Returns `{"ok": True}`.

**`GET /documents/{document_id}/cache-status`** *(requires auth — ownership verified)* — returns `{has_summary, has_flashcards}`

**`DELETE /documents/{document_id}/cache/summary`** *(requires auth — ownership verified)* — nulls `summary` + `quiz` columns

**`DELETE /documents/{document_id}/cache/flashcards`** *(requires auth — ownership verified)* — nulls `flashcards` column

**`GET /documents/{document_id}/pdf`** *(requires auth — ownership verified)* — PDF proxy (downloads from S3 server-side, avoids CORS)

**`GET /documents/{document_id}/pdf-url`** *(requires auth — ownership verified)* — returns a 1-hour presigned S3 URL

**`GET /dictionary/{word}`** — Free Dictionary API proxy; returns `{word, phonetic, definition, example, synonyms}`

---

### `db_utils.py`
Supabase (PostgreSQL + pgvector) interactions. Uses `SUPABASE_SERVICE_ROLE_KEY` — bypasses RLS.

| Function | Description |
|---|---|
| `get_supabase_client()` | Initializes client using `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. |
| `save_document_metadata(user_id, filename, content)` | Inserts into `documents`. `user_id` is always required (anonymous or real). Returns inserted row list or `None`. |
| `get_profile(user_id)` | Returns `{documents_used, document_quota}` from `profiles` table. Returns `None` on error. |
| `increment_documents_used(user_id)` | Calls `increment_documents_used(uid)` RPC — atomic increment of `profiles.documents_used`. |
| `get_user_documents(user_id)` | Returns `[{id, filename, created_at}]` for a user, newest first. |
| `get_user_document_filenames(user_id)` | Returns `list[str]` of S3 filenames for all documents owned by the user — used by `DELETE /account` before DB deletion. |
| `get_document_content(document_id)` | Fetches the `content` field by UUID. Returns `str` or `None`. |
| `get_document_cache(document_id)` | Returns `{summary, quiz, flashcards}`. Returns `None` on error. |
| `save_document_cache(document_id, data)` | Updates AI cache columns. `data` is a partial dict. Returns `True`/`False`. |
| `clear_summary_cache(document_id)` | Nulls `summary` and `quiz`. Returns `True`/`False`. |
| `clear_flashcards_cache(document_id)` | Nulls `flashcards`. Returns `True`/`False`. |
| `search_chunks(document_id, query_embedding, match_count, match_threshold)` | Calls `match_documents` RPC. Defaults: top 10 chunks, 0.3 threshold. |
| `save_document_chunks(document_id, chunks)` | Batch-inserts into `document_chunks`. Each chunk needs `content`, `metadata`, `embedding`. |
| `verify_document_owner(document_id, user_id)` | Returns `True` if the document exists and belongs to `user_id`. Used by all document-scoped endpoints to enforce ownership. |

**Supabase tables:**

`documents`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK, auto-generated |
| `user_id` | uuid | FK → auth.users; always set (anonymous or real auth user) |
| `guest_token` | uuid | Legacy column — unused, left for existing rows |
| `filename` | text | UUID-prefixed S3 key |
| `content` | text | Full extracted text |
| `summary` | text | AI-generated summary (cached) |
| `quiz` | jsonb | AI-generated quiz questions (cached) |
| `flashcards` | jsonb | AI-generated flashcards (cached) |
| `embedding` | vector | Unused (reserved) |
| `created_at` | timestamptz | Auto |
| `updated_at` | timestamptz | Auto-updated on any row change (used by cleanup cron) |

`document_chunks`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK, auto-generated |
| `document_id` | uuid | FK → documents.id |
| `content` | text | Chunk text (≤800 chars) |
| `metadata` | jsonb | `{"page_number": N}` |
| `embedding` | vector(1536) | OpenAI embedding |

`profiles`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK, FK → auth.users |
| `documents_used` | int | Incremented on each upload or claim |
| `document_quota` | int | Default 4 (free tier) |
| `full_name` | text | From Supabase auth profile |
| `upload_credits` | int | Legacy column (unused by backend) |
| `tier` | text | Legacy column (unused by backend) |
| `created_at` | timestamptz | Auto |

**RPC functions:**
- `match_documents(query_embedding, match_threshold, match_count, filter_document_id)` — cosine similarity search on `document_chunks` filtered by document.
- `increment_documents_used(uid)` — atomically increments `profiles.documents_used` for a user.

**pg_cron job:**
- `cleanup-anonymous-documents` — runs daily at 3 AM; deletes `documents` whose `user_id` belongs to an anonymous Supabase auth user created more than 30 days ago.

---

### `pdf_utils.py`
PDF processing using **PyMuPDF** (`fitz`) and **LangChain text splitters**.

| Function | Description |
|---|---|
| `extract_text_from_pdf(file_bytes)` | Concatenates all page text with double newlines. Returns `""` on error. |
| `extract_chunks_from_pdf(file_bytes)` | Page-anchored chunking (800 chars, 100-char overlap per page). No cross-page chunks. Returns `[{content, metadata: {page_number}}]`. |

---

### `embedding_utils.py`

| Function | Description |
|---|---|
| `embed_texts(texts)` | Batch-embeds via `text-embedding-3-small`. Returns `list[list[float]]` (1536-dim). |

---

### `gemini_utils.py`
Gemini 3.1 Flash Lite. All functions enforce JSON output via `response_mime_type="application/json"`.

| Function | Description |
|---|---|
| `generate_summary_and_quiz(text)` | Returns `{summary, quiz}` — 10 multiple choice questions. `None` on error. |
| `generate_flashcards(text)` | Returns `{flashcards}` — 10 Q&A pairs. `None` on error. |
| `generate_answer(question, chunks)` | Grounded-only prompt with chunk context. Returns `{answer, citations}`. `None` on error. |

---

### `s3_utils.py`

| Function | Description |
|---|---|
| `get_s3_client()` | Creates boto3 client from env vars. |
| `upload_to_s3(file_obj, filename)` | Streams to S3. Returns S3 key or `None`. |
| `download_from_s3(filename)` | Returns raw bytes or `None`. |
| `create_presigned_url(filename, expiration)` | 1-hour signed URL. |
| `delete_from_s3(filename)` | Deletes a single object from S3 by key. Returns `bool`. |

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
SENTRY_DSN=          # optional — Sentry error tracking (no-op if unset)
ENVIRONMENT=         # optional — "development" | "production" (default: development)
LOG_LEVEL=           # optional — DEBUG | INFO | WARNING | ERROR (default: INFO)
```

---

## Running Locally

```powershell
.\venv\Scripts\Activate.ps1
uvicorn main:app --reload
```

API docs: `http://localhost:8000/docs`

---

## Testing

```powershell
# From backend/ with venv activated
pytest                                    # run all tests
pytest --cov=. --cov-report=term-missing  # with coverage
pytest tests/test_upload.py -v            # single file
```

**Key patterns:**
- External clients (`OpenAI`, `genai.Client`, `boto3.client`, `create_client`) are created inside functions — patch at the call site module (e.g. `patch("main.upload_to_s3")`, not `patch("s3_utils.upload_to_s3")`).
- `upload_to_s3` is `async def` — use `AsyncMock` when patching it in endpoint tests.
- Auth is bypassed via `app.dependency_overrides` (see `authed_client` / `anon_client` fixtures in `conftest.py`).
- Rate limit state (`main._question_timestamps`) is cleared by an `autouse` fixture in `conftest.py`.
- `asyncio_mode = auto` in `pytest.ini` — `async def` tests run without any decorator.
