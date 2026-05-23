import logging
import os
import sentry_sdk  # pyright: ignore[reportMissingImports]
from sentry_sdk.integrations.fastapi import FastApiIntegration  # pyright: ignore[reportMissingImports]
from sentry_sdk.integrations.starlette import StarletteIntegration  # pyright: ignore[reportMissingImports]
from fastapi import FastAPI, Request, UploadFile, File, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from dataclasses import dataclass
from s3_utils import upload_to_s3, create_presigned_url, create_signed_cloudfront_url, download_from_s3, delete_from_s3
from db_utils import (
    get_supabase_client,
    save_document_metadata, save_document_chunks, get_document_content,
    search_chunks, get_user_documents, get_document_filename, get_document_cache,
    save_document_cache, clear_summary_cache, clear_flashcards_cache,
    get_profile, increment_documents_used, get_user_document_filenames,
    verify_document_owner,
)
from dotenv import load_dotenv
from pdf_utils import extract_text_from_pdf, extract_chunks_from_pdf
from embedding_utils import embed_texts
from gemini_utils import generate_summary_and_quiz, generate_flashcards, generate_answer
from slowapi import Limiter, _rate_limit_exceeded_handler  # pyright: ignore[reportMissingImports]
from slowapi.util import get_remote_address  # pyright: ignore[reportMissingImports]
from slowapi.errors import RateLimitExceeded  # pyright: ignore[reportMissingImports]
from logging_config import setup_logging
from rate_limiter import DBRateLimiter
import uuid
import httpx
import asyncio

load_dotenv()
setup_logging()

sentry_sdk.init(
    dsn=os.getenv("SENTRY_DSN"),
    integrations=[StarletteIntegration(), FastApiIntegration()],
    traces_sample_rate=0.1,
    environment=os.getenv("ENVIRONMENT", "development"),
)

logger = logging.getLogger(__name__)
app = FastAPI()

limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)  # type: ignore

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://luminasummarizer.com",
        "https://www.luminasummarizer.com",
        "http://localhost:3000",
    ],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.middleware("http")
async def add_security_headers(request, call_next):
    response = await call_next(request)
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Content-Security-Policy"] = "default-src 'none'"
    return response

# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------

security = HTTPBearer(auto_error=False)

@dataclass
class AuthUser:
    user_id: str
    is_anonymous: bool

def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
) -> AuthUser | None:
    """Returns AuthUser if the Bearer JWT is valid, otherwise None."""
    if credentials is None:
        return None
    try:
        supabase = get_supabase_client()
        result = supabase.auth.get_user(credentials.credentials)
        if result is None or result.user is None:
            return None
        return AuthUser(
            user_id=str(result.user.id),
            is_anonymous=getattr(result.user, "is_anonymous", False) or False,
        )
    except Exception:
        return None

def require_auth(auth: AuthUser | None = Depends(get_current_user)) -> AuthUser:
    """Raises 401 if there is no valid session."""
    if auth is None:
        raise HTTPException(status_code=401, detail="Authentication required")
    return auth

# ---------------------------------------------------------------------------
# Rate limiting (/ask — 20 questions per hour, rolling window, DB-backed)
# ---------------------------------------------------------------------------

MAX_FILE_SIZE = 20 * 1024 * 1024  # 20 MB
db_rate_limiter = DBRateLimiter(limit=10, window_seconds=3600)

# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------

class DocumentRequest(BaseModel):
    document_id: str

class AskRequest(BaseModel):
    document_id: str
    question: str

# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@app.get("/health")
def health():
    return {"status": "ok"}

@app.delete("/account")
def delete_account(auth: AuthUser = Depends(require_auth)):
    """Deletes the user's S3 files, then removes the auth user (cascades to DB rows)."""
    filenames = get_user_document_filenames(auth.user_id)
    for filename in filenames:
        delete_from_s3(filename)
    supabase = get_supabase_client()
    supabase.auth.admin.delete_user(auth.user_id)
    return {"ok": True}

@app.get("/documents")
def list_documents(auth: AuthUser = Depends(require_auth)):
    docs = get_user_documents(auth.user_id)
    profile = get_profile(auth.user_id)
    return {
        "documents": docs,
        "quota": {
            "used": len(docs),
            "total": 1 if auth.is_anonymous else (profile["document_quota"] if profile else 4),
        },
    }

@app.post("/upload")
@limiter.limit("20/minute")
async def upload_pdf(
    request: Request,
    file: UploadFile = File(...),
    auth: AuthUser | None = Depends(get_current_user),
):
    if auth is None:
        raise HTTPException(status_code=401, detail="Authentication required")

    if file.content_type != "application/pdf":
        raise HTTPException(status_code=400, detail="Only PDF files are allowed")

    if not file.filename:
        raise HTTPException(status_code=400, detail="Filename is required")

    doc_count = len(get_user_documents(auth.user_id))
    if auth.is_anonymous:
        if doc_count >= 1:
            raise HTTPException(status_code=403, detail="quota_exceeded")
    else:
        profile = get_profile(auth.user_id)
        if profile and doc_count >= profile["document_quota"]:
            raise HTTPException(status_code=403, detail="quota_exceeded")

    file_bytes = await file.read()

    if len(file_bytes) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File too large. Maximum size is 20MB.")

    if file_bytes[:5] != b"%PDF-":
        raise HTTPException(status_code=400, detail="Invalid PDF file.")

    extracted_text = extract_text_from_pdf(file_bytes)
    if not extracted_text:
        logger.warning("No text could be extracted from this PDF.")

    chunks = extract_chunks_from_pdf(file_bytes)

    if chunks:
        embeddings = embed_texts([c["content"] for c in chunks])
        for i, chunk in enumerate(chunks):
            chunk["embedding"] = embeddings[i]

    unique_filename = f"{uuid.uuid4()}_{file.filename}"

    await file.seek(0)
    saved_filename = await upload_to_s3(file.file, unique_filename)
    if not saved_filename:
        raise HTTPException(status_code=500, detail="Failed to upload to S3")

    db_record = save_document_metadata(auth.user_id, saved_filename, extracted_text)
    if not db_record:
        raise HTTPException(status_code=500, detail="Failed to save to database")

    if not auth.is_anonymous:
        increment_documents_used(auth.user_id)

    document_id: str = str(db_record[0]["id"])  # type: ignore

    if chunks:
        save_document_chunks(document_id, chunks)

    return {
        "message": "Success",
        "filename": saved_filename,
        "chunks_stored": len(chunks),
        "text_preview": extracted_text[:100] + "...",
        "database_record": db_record,
    }

@app.post("/process-document")
def process_document(req: DocumentRequest, auth: AuthUser = Depends(require_auth)):
    if not verify_document_owner(req.document_id, auth.user_id):
        raise HTTPException(status_code=403, detail="forbidden")
    cache = get_document_cache(req.document_id)
    if cache and cache.get("summary") and cache.get("quiz"):
        return {"summary": cache["summary"], "quiz": cache["quiz"]}

    content = get_document_content(req.document_id)
    if not content:
        raise HTTPException(status_code=404, detail="Document not found")

    result = generate_summary_and_quiz(content)
    if not result:
        raise HTTPException(status_code=500, detail="Failed to generate summary and quiz")

    save_document_cache(req.document_id, {"summary": result["summary"], "quiz": result["quiz"]})
    return result

@app.get("/documents/{document_id}/cache-status")
def get_cache_status(document_id: str, auth: AuthUser = Depends(require_auth)):
    if not verify_document_owner(document_id, auth.user_id):
        raise HTTPException(status_code=403, detail="forbidden")
    cache = get_document_cache(document_id)
    return {
        "has_summary": bool(cache and cache.get("summary")),
        "has_flashcards": bool(cache and cache.get("flashcards")),
    }

@app.delete("/documents/{document_id}/cache/summary")
def delete_summary_cache(document_id: str, auth: AuthUser = Depends(require_auth)):
    if not verify_document_owner(document_id, auth.user_id):
        raise HTTPException(status_code=403, detail="forbidden")
    ok = clear_summary_cache(document_id)
    if not ok:
        raise HTTPException(status_code=500, detail="Failed to clear summary cache")
    return {"ok": True}

@app.post("/generate-cards")
def generate_cards(req: DocumentRequest, auth: AuthUser = Depends(require_auth)):
    if not verify_document_owner(req.document_id, auth.user_id):
        raise HTTPException(status_code=403, detail="forbidden")
    cache = get_document_cache(req.document_id)
    if cache and cache.get("flashcards"):
        return {"flashcards": cache["flashcards"]}

    content = get_document_content(req.document_id)
    if not content:
        raise HTTPException(status_code=404, detail="Document not found")

    result = generate_flashcards(content)
    if not result:
        raise HTTPException(status_code=500, detail="Failed to generate flashcards")

    save_document_cache(req.document_id, {"flashcards": result["flashcards"]})
    return result

@app.post("/ask")
@limiter.limit("60/minute")
def ask(
    request: Request,
    req: AskRequest,
    auth: AuthUser = Depends(require_auth),
):
    if not verify_document_owner(req.document_id, auth.user_id):
        raise HTTPException(status_code=403, detail="forbidden")
    allowed, retry_after = db_rate_limiter.check(auth.user_id, "ask")
    if not allowed:
        raise HTTPException(
            status_code=429,
            detail={"error": "rate_limited", "retry_after": retry_after},
        )

    query_embedding = embed_texts([req.question])[0]
    chunks = search_chunks(req.document_id, query_embedding)

    if not chunks:
        raise HTTPException(status_code=404, detail="No relevant content found for this question")

    result = generate_answer(req.question, chunks)
    if not result:
        raise HTTPException(status_code=500, detail="Failed to generate answer")

    return result

@app.delete("/documents/{document_id}/cache/flashcards")
def delete_flashcards_cache(document_id: str, auth: AuthUser = Depends(require_auth)):
    if not verify_document_owner(document_id, auth.user_id):
        raise HTTPException(status_code=403, detail="forbidden")
    ok = clear_flashcards_cache(document_id)
    if not ok:
        raise HTTPException(status_code=500, detail="Failed to clear flashcards cache")
    return {"ok": True}

@app.get("/documents/{document_id}/pdf-url")
def get_pdf_url(document_id: str, auth: AuthUser = Depends(require_auth)):
    if not verify_document_owner(document_id, auth.user_id):
        raise HTTPException(status_code=403, detail="forbidden")
    filename = get_document_filename(document_id)
    if not filename:
        raise HTTPException(status_code=404, detail="Document not found")
    url = create_signed_cloudfront_url(filename) or create_presigned_url(filename)
    if not url:
        raise HTTPException(status_code=500, detail="Failed to generate PDF URL")
    return {"url": url}

@app.get("/documents/{document_id}/pdf")
def get_pdf_proxy(document_id: str, auth: AuthUser = Depends(require_auth)):
    if not verify_document_owner(document_id, auth.user_id):
        raise HTTPException(status_code=403, detail="forbidden")
    filename = get_document_filename(document_id)
    if not filename:
        raise HTTPException(status_code=404, detail="Document not found")
    file_bytes = download_from_s3(filename)
    if not file_bytes:
        raise HTTPException(status_code=500, detail="Failed to download PDF")
    return Response(content=file_bytes, media_type="application/pdf")

@app.get("/dictionary/{word}")
async def dictionary(word: str):
    async with httpx.AsyncClient(timeout=5.0) as client:
        dict_resp, syn_resp = await asyncio.gather(
            client.get(f"https://api.dictionaryapi.dev/api/v2/entries/en/{word}"),
            client.get(f"https://api.datamuse.com/words?rel_syn={word}&max=5")
        )

    if dict_resp.status_code == 404:
        raise HTTPException(status_code=404, detail="Word not found")

    entry = dict_resp.json()[0]
    meaning = entry["meanings"][0]
    first_def = meaning["definitions"][0]

    example = ""
    for m in entry["meanings"]:
        for d in m["definitions"]:
            if d.get("example"):
                example = d["example"]
                break
        if example:
            break

    synonyms = [s["word"] for s in syn_resp.json()] if syn_resp.status_code == 200 else []

    return {
        "word": entry.get("word", word),
        "phonetic": entry.get("phonetic", ""),
        "definition": first_def["definition"],
        "example": example,
        "synonyms": synonyms
    }
