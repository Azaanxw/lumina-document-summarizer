import os
from supabase import create_client, Client

def get_supabase_client() -> Client:
    """Initializes and returns the Supabase client."""
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        raise ValueError("SUPABASE_URL and SUPABASE_ANON_KEY must be set")
    return create_client(url, key)

def save_document_metadata(user_id: str, filename: str):
    """Saves the unique S3 filename to the database."""
    supabase = get_supabase_client()
    
    try:
        response = supabase.table("documents").insert({
            "user_id": user_id,
            "filename": filename  # <--- Pointing back to your actual column
        }).execute()
        
        return response.data
    except Exception as e:
        print(f"Database Insert Error: {e}")
        return None