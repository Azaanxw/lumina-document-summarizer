import os
from supabase import create_client, Client

def get_supabase_client() -> Client:
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        raise ValueError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set")
    return create_client(url, key)

def save_document_metadata(user_id: str, filename: str, content: str):
    """Saves document record to the documents table. Returns inserted rows or None."""
    supabase = get_supabase_client()
    try:
        response = supabase.table("documents").insert({
            "user_id": user_id,
            "filename": filename,
            "content": content
        }).execute()
        return response.data
    except Exception as e:
        print(f"Database Insert Error: {e}")
        return None

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
        print(f"Chunk Insert Error: {e}")
        return False