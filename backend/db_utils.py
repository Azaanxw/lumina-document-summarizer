import os
from supabase import create_client, Client

def get_supabase_client() -> Client:
    """Initializes and returns the Supabase client."""
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        raise ValueError("SUPABASE_URL and SUPABASE_ANON_KEY must be set")
    return create_client(url, key)

# db_utils.py (Update this function)

def save_document_metadata(user_id: str, filename: str, content: str):
    """Saves the unique S3 filename AND extracted text to the database."""
    supabase = get_supabase_client()
    
    try:
        response = supabase.table("documents").insert({
            "user_id": user_id,
            "filename": filename,
            "content": content  # <--- Now saving the actual words!
        }).execute()
        
        return response.data
    except Exception as e:
        print(f"Database Insert Error: {e}")
        return None