from fastapi import FastAPI, UploadFile, File, HTTPException
from s3_utils import upload_to_s3
from db_utils import save_document_metadata, save_document_chunks
from dotenv import load_dotenv
from pdf_utils import extract_text_from_pdf, extract_chunks_from_pdf
from embedding_utils import embed_texts
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

    file_bytes = await file.read()

    # Full text for documents.content column
    extracted_text = extract_text_from_pdf(file_bytes)
    if not extracted_text:
        print("Warning: No text could be extracted from this PDF.")

    # Page-anchored chunks for RAG
    chunks = extract_chunks_from_pdf(file_bytes)

    # Batch embed all chunks in one API call
    if chunks:
        embeddings = embed_texts([c["content"] for c in chunks])
        for i, chunk in enumerate(chunks):
            chunk["embedding"] = embeddings[i]

    unique_filename = f"{uuid.uuid4()}_{file.filename}"

    await file.seek(0)
    saved_filename = await upload_to_s3(file.file, unique_filename)
    if not saved_filename:
        raise HTTPException(status_code=500, detail="Failed to upload to S3")

    db_record = save_document_metadata(MOCK_USER_ID, saved_filename, extracted_text)
    if not db_record:
        raise HTTPException(status_code=500, detail="Failed to save to database")

    document_id: str = str(db_record[0]["id"])  # type: ignore

    if chunks:
        save_document_chunks(document_id, chunks)

    return {
        "message": "Success",
        "filename": saved_filename,
        "chunks_stored": len(chunks),
        "text_preview": extracted_text[:100] + "...",
        "database_record": db_record
    }