# Backend — Document Summarizer

## Overview

FastAPI backend that accepts PDF uploads, extracts their text, stores the raw file in AWS S3, and saves the extracted text + metadata to a Supabase (PostgreSQL) database.

## Directory Structure

```
backend/
├── main.py            # FastAPI app + upload endpoint
├── s3_utils.py        # AWS S3 upload and presigned URL helpers
├── db_utils.py        # Supabase client + document metadata insert
├── pdf_utils.py       # PDF text extraction via PyMuPDF
├── requirements.txt   # Python dependencies
├── .env               # Environment variables (not committed)
├── uploads/           # Local temp directory (not used in current flow)
└── venv/              # Python virtual environment
```

---

## Files

### `main.py`
The entry point. Defines the FastAPI app and the single `POST /upload` endpoint.

**Flow when a PDF is uploaded:**
1. Validates the file is a PDF and has a filename.
2. Reads the entire file into memory once.
3. Calls `extract_text_from_pdf()` to pull text from the PDF bytes.
4. Generates a UUID-prefixed unique filename to avoid S3 key collisions.
5. Resets the file cursor and streams the file to S3 via `upload_to_s3()`.
6. Saves the S3 filename and extracted text to Supabase via `save_document_metadata()`.
7. Returns a success response with the filename, a 100-character text preview, and the database record.

> `MOCK_USER_ID` is hardcoded for local testing — will be replaced by real auth in a later phase.

---

### `s3_utils.py`
AWS S3 interactions.

| Function | Description |
|---|---|
| `get_s3_client()` | Creates a `boto3` S3 client using `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, and `AWS_REGION` from env. |
| `upload_to_s3(file_obj, filename)` | Streams a file object to the configured S3 bucket. Sets `ContentType: application/pdf` so the file renders correctly in browsers. Returns the S3 key (filename) on success, `None` on failure. |
| `create_presigned_url(filename, expiration)` | Generates a temporary signed URL for a private S3 object. Defaults to 1-hour expiry. Not yet wired into an endpoint. |

---

### `db_utils.py`
Supabase (PostgreSQL) interactions.

| Function | Description |
|---|---|
| `get_supabase_client()` | Initializes the Supabase client using `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` from env. |
| `save_document_metadata(user_id, filename, content)` | Inserts a row into the `documents` table with `user_id`, `filename` (S3 key), and `content` (full extracted text). Returns the inserted row data or `None` on error. |

**Database table: `documents`**

| Column | Type | Description |
|---|---|---|
| `user_id` | UUID | Foreign key to the user |
| `filename` | text | S3 object key (UUID-prefixed original filename) |
| `content` | text | Full extracted text from the PDF |

---

### `pdf_utils.py`
PDF text extraction using **PyMuPDF** (`fitz`).

| Function | Description |
|---|---|
| `extract_text_from_pdf(file_bytes)` | Opens a PDF from raw bytes (no temp file needed), iterates every page, concatenates page text with double newlines, and returns the stripped result. Returns an empty string on failure. |

---

### `requirements.txt`
Key dependencies:

| Package | Purpose |
|---|---|
| `fastapi` + `uvicorn` | Web framework and ASGI server |
| `boto3` | AWS SDK — S3 uploads |
| `supabase` | Supabase Python client |
| `pymupdf` | PDF parsing and text extraction |
| `python-dotenv` | Loads `.env` into environment variables |
| `python-multipart` | Required by FastAPI to handle `multipart/form-data` file uploads |
| `langchain`, `langchain-openai`, `langchain-pinecone`, `langchain-text-splitters` | LangChain stack — not yet wired in, reserved for the summarization/RAG phase |
| `openai`, `google-generativeai` | LLM provider SDKs — reserved for summarization phase |

---

### `.env`
Holds all secrets and configuration. Never committed to git.

Expected keys:
```
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=
AWS_S3_BUCKET=
```

---

## Running Locally

```bash
# Activate virtual environment
.\venv\Scripts\Activate.ps1

# Start the dev server
uvicorn main:app --reload
```

API docs available at `http://localhost:8000/docs`.
