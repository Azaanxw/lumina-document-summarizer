from fastapi import FastAPI, UploadFile, File, HTTPException
from s3_utils import upload_to_s3
from db_utils import save_document_metadata
from dotenv import load_dotenv
import os
import uuid

load_dotenv()
app = FastAPI()

# Temporary Mock User for testing 
MOCK_USER_ID = "57de27a3-60c2-430e-8896-f8daf0e835d9" 

@app.post("/upload")
async def upload_pdf(file: UploadFile = File(...)):
    if file.content_type != "application/pdf":
        raise HTTPException(status_code=400, detail="Only PDF files are allowed")

    if not file.filename:
        raise HTTPException(status_code=400, detail="Filename is required")

    # 1. Generate a guaranteed unique filename
    unique_filename = f"{uuid.uuid4()}_{file.filename}"

    # 2. Upload to S3
    saved_filename = await upload_to_s3(file.file, unique_filename)
    
    if not saved_filename:
        raise HTTPException(status_code=500, detail="Failed to upload to S3")

    # 3. Save to Supabase using your existing 'filename' column
    db_record = save_document_metadata(MOCK_USER_ID, saved_filename)
    
    if not db_record:
        raise HTTPException(status_code=500, detail="Failed to save to database")

    return {
        "message": "Success", 
        "filename": saved_filename,
        "database_record": db_record
    }