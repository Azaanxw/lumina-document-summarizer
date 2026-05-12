from fastapi import FastAPI, UploadFile, File, HTTPException
from s3_utils import upload_to_s3
from db_utils import save_document_metadata
from dotenv import load_dotenv
from pdf_utils import extract_text_from_pdf
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

    # 2. Read the entire file into memory ONCE
    file_bytes = await file.read()

    # 3. Extract the text using our new utility
    extracted_text = extract_text_from_pdf(file_bytes)
    
    if not extracted_text:
        print("Warning: No text could be extracted from this PDF.")

    # 4. Generate the unique filename
    unique_filename = f"{uuid.uuid4()}_{file.filename}"

    # 5. Reset the file cursor back to the top before handing it to AWS!
    await file.seek(0) 
    saved_filename = await upload_to_s3(file.file, unique_filename)
    
    if not saved_filename:
        raise HTTPException(status_code=500, detail="Failed to upload to S3")

    # 6. Save BOTH the filename and the extracted text to Supabase
    db_record = save_document_metadata(MOCK_USER_ID, saved_filename, extracted_text)
    
    if not db_record:
        raise HTTPException(status_code=500, detail="Failed to save to database")

    return {
        "message": "Success", 
        "filename": saved_filename,
        "text_preview": extracted_text[:100] + "...", # Just returning a snippet so it doesn't crash your Swagger UI!
        "database_record": db_record
    }