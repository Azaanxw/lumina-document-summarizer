import logging
import os
from supabase import create_client, Client

logger = logging.getLogger(__name__)


def get_supabase_client() -> Client:
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        raise ValueError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set")
    return create_client(url, key)

def save_document_metadata(user_id: str, filename: str, content: str):
    """Saves document record. user_id is always required (anonymous or real auth user)."""
    supabase = get_supabase_client()
    try:
        response = supabase.table("documents").insert({
            "user_id": user_id,
            "filename": filename,
            "content": content,
        }).execute()
        return response.data
    except Exception as e:
        logger.error(f"Database Insert Error: {e}")
        return None

def get_profile(user_id: str) -> dict | None:
    """Returns the user's quota profile (documents_used, document_quota)."""
    supabase = get_supabase_client()
    try:
        response = supabase.table("profiles").select("documents_used, document_quota").eq("id", user_id).single().execute()
        return response.data  # type: ignore
    except Exception as e:
        logger.error(f"Profile Fetch Error: {e}")
        return None

def increment_documents_used(user_id: str) -> bool:
    """Increments the user's documents_used counter via a SECURITY DEFINER RPC."""
    supabase = get_supabase_client()
    try:
        supabase.rpc("increment_documents_used", {"uid": user_id}).execute()
        return True
    except Exception as e:
        logger.error(f"Increment Error: {e}")
        return False

def get_document_content(document_id: str) -> str | None:
    """Fetches the full extracted text for a document by its ID."""
    supabase = get_supabase_client()
    try:
        response = supabase.table("documents").select("content").eq("id", document_id).single().execute()
        return response.data["content"]  # type: ignore
    except Exception as e:
        logger.error(f"Document Fetch Error: {e}")
        return None

def search_chunks(document_id: str, query_embedding: list[float], match_count: int = 6, match_threshold: float = 0.3) -> list[dict]:
    """Calls match_documents RPC to retrieve semantically similar chunks for a query."""
    supabase = get_supabase_client()
    try:
        response = supabase.rpc("match_documents", {
            "query_embedding": query_embedding,
            "match_threshold": match_threshold,
            "match_count": match_count,
            "filter_document_id": document_id
        }).execute()
        return response.data or []  # type: ignore
    except Exception as e:
        logger.error(f"Chunk Search Error: {e}")
        return []

def get_document_filename(document_id: str) -> str | None:
    """Fetches the S3 filename for a document by its ID."""
    supabase = get_supabase_client()
    try:
        response = supabase.table("documents").select("filename").eq("id", document_id).single().execute()
        return response.data["filename"]  # type: ignore
    except Exception as e:
        logger.error(f"Document Filename Fetch Error: {e}")
        return None

def get_user_documents(user_id: str) -> list[dict]:
    """Returns all documents for a user, ordered by creation date descending."""
    supabase = get_supabase_client()
    try:
        response = supabase.table("documents").select("id, filename, created_at").eq("user_id", user_id).order("created_at", desc=True).execute()
        return response.data or []  # type: ignore
    except Exception as e:
        logger.error(f"Document List Error: {e}")
        return []

def get_user_document_filenames(user_id: str) -> list[str]:
    """Returns all S3 filenames for documents owned by the user (used before account deletion)."""
    supabase = get_supabase_client()
    try:
        response = supabase.table("documents").select("filename").eq("user_id", user_id).execute()
        return [str(row["filename"]) for row in (response.data or [])]  # type: ignore
    except Exception as e:
        logger.error(f"Get Filenames Error: {e}")
        return []

def get_document_cache(document_id: str) -> dict | None:
    """Returns cached AI columns (summary, quiz, flashcards) for a document."""
    supabase = get_supabase_client()
    try:
        response = supabase.table("documents").select("summary, quiz, flashcards").eq("id", document_id).single().execute()
        return response.data  # type: ignore
    except Exception as e:
        logger.error(f"Get Cache Error: {e}")
        return None

def save_document_cache(document_id: str, data: dict) -> bool:
    """Updates AI cache columns on an existing document row."""
    supabase = get_supabase_client()
    try:
        supabase.table("documents").update(data).eq("id", document_id).execute()
        return True
    except Exception as e:
        logger.error(f"Save Cache Error: {e}")
        return False

def clear_summary_cache(document_id: str) -> bool:
    """Nulls out summary and quiz cache columns so they are regenerated on next request."""
    supabase = get_supabase_client()
    try:
        supabase.table("documents").update({"summary": None, "quiz": None}).eq("id", document_id).execute()
        return True
    except Exception as e:
        logger.error(f"Clear Summary Cache Error: {e}")
        return False

def clear_flashcards_cache(document_id: str) -> bool:
    """Nulls out flashcards cache column so it is regenerated on next request."""
    supabase = get_supabase_client()
    try:
        supabase.table("documents").update({"flashcards": None}).eq("id", document_id).execute()
        return True
    except Exception as e:
        logger.error(f"Clear Flashcards Cache Error: {e}")
        return False

def save_document_chunks(document_id: str, chunks: list[dict]) -> bool:
    """Batch-inserts page-anchored chunks with embeddings into document_chunks."""
    supabase = get_supabase_client()
    rows = [
        {
            "document_id": document_id,
            "content": chunk["content"],
            "metadata": chunk["metadata"],
            "embedding": chunk["embedding"],
        }
        for chunk in chunks
    ]
    try:
        supabase.table("document_chunks").insert(rows).execute()
        return True
    except Exception as e:
        logger.error(f"Chunk Insert Error: {e}")
        return False

def verify_document_owner(document_id: str, user_id: str) -> bool:
    """Returns True if the document exists and belongs to the given user."""
    supabase = get_supabase_client()
    try:
        response = (
            supabase.table("documents")
            .select("id")
            .eq("id", document_id)
            .eq("user_id", user_id)
            .maybe_single()
            .execute()
        )
        return response is not None and response.data is not None  # type: ignore
    except Exception as e:
        logger.error(f"Ownership Check Error: {e}")
        return False
