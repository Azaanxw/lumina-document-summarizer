# Backend — Document Summarizer (Lumina)

## Overview

FastAPI backend that accepts PDF uploads, extracts text, stores the raw file in AWS S3, chunks and embeds the text for RAG, and saves everything to Supabase (PostgreSQL + pgvector).

## Directory Structure

```
backend/
├── main.py             # FastAPI app + /upload endpoint
├── pdf_utils.py        # PDF text extraction + page-anchored chunking (PyMuPDF)
├── embedding_utils.py  # Batch text embedding via OpenAI text-embedding-3-small
├── db_utils.py         # Supabase client — documents + document_chunks inserts
├── s3_utils.py         # AWS S3 upload and presigned URL helpers
├── requirements.txt    # Python dependencies
├── .env                # Environment variables (not committed)
├── uploads/            # Local temp directory (unused)
└── venv/               # Python virtual environment
```

---

## Files

### `main.py`
Entry point. Defines the FastAPI app and the `POST /upload` endpoint.

**Upload flow:**
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

### `db_utils.py`
Supabase (PostgreSQL + pgvector) interactions.

| Function | Description |
|---|---|
| `get_supabase_client()` | Initializes client using `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. |
| `save_document_metadata(user_id, filename, content)` | Inserts into `documents`. Returns inserted row list or `None` on error. |
| `save_document_chunks(document_id, chunks)` | Batch-inserts into `document_chunks`. Each chunk must have `content`, `metadata`, and `embedding` keys. Returns `True`/`False`. |

**Supabase tables:**

`documents`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK, auto-generated |
| `user_id` | uuid | FK → auth.users |
| `filename` | text | UUID-prefixed S3 key |
| `content` | text | Full extracted text |
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
| `create_presigned_url(filename, expiration)` | Generates a temporary signed URL (default 1-hour). Not yet wired to an endpoint. |

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
| `langchain`, `langchain-openai`, `langchain-pinecone` | Reserved for Phase 3 Path A (study tools) |
| `google-generativeai` | Gemini 1.5 Flash — reserved for Phase 3 Path A |

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
