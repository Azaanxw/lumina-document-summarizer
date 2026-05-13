from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel
from s3_utils import upload_to_s3, create_presigned_url, download_from_s3
from db_utils import save_document_metadata, save_document_chunks, get_document_content, search_chunks, get_user_documents, get_document_filename
from dotenv import load_dotenv
from pdf_utils import extract_text_from_pdf, extract_chunks_from_pdf
from embedding_utils import embed_texts
from gemini_utils import generate_summary_and_quiz, generate_flashcards, generate_answer
import uuid
import httpx
import asyncio

load_dotenv()
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

MOCK_USER_ID = "57de27a3-60c2-430e-8896-f8daf0e835d9"

class DocumentRequest(BaseModel):
    document_id: str

class AskRequest(BaseModel):
    document_id: str
    question: str

@app.get("/documents")
def list_documents():
    docs = get_user_documents(MOCK_USER_ID)
    return {"documents": docs}

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

@app.post("/process-document")
def process_document(req: DocumentRequest):
    content = get_document_content(req.document_id)
    if not content:
        raise HTTPException(status_code=404, detail="Document not found")

    result = generate_summary_and_quiz(content)
    if not result:
        raise HTTPException(status_code=500, detail="Failed to generate summary and quiz")

    return result

@app.post("/generate-cards")
def generate_cards(req: DocumentRequest):
    content = get_document_content(req.document_id)
    if not content:
        raise HTTPException(status_code=404, detail="Document not found")

    result = generate_flashcards(content)
    if not result:
        raise HTTPException(status_code=500, detail="Failed to generate flashcards")

    return result

@app.post("/ask")
def ask(req: AskRequest):
    query_embedding = embed_texts([req.question])[0]
    chunks = search_chunks(req.document_id, query_embedding)

    if not chunks:
        raise HTTPException(status_code=404, detail="No relevant content found for this question")

    result = generate_answer(req.question, chunks)
    if not result:
        raise HTTPException(status_code=500, detail="Failed to generate answer")

    return result

@app.get("/documents/{document_id}/pdf-url")
def get_pdf_url(document_id: str):
    filename = get_document_filename(document_id)
    if not filename:
        raise HTTPException(status_code=404, detail="Document not found")
    url = create_presigned_url(filename)
    if not url:
        raise HTTPException(status_code=500, detail="Failed to generate PDF URL")
    return {"url": url}

@app.get("/documents/{document_id}/pdf")
def get_pdf_proxy(document_id: str):
    filename = get_document_filename(document_id)
    if not filename:
        raise HTTPException(status_code=404, detail="Document not found")
    file_bytes = download_from_s3(filename)
    if not file_bytes:
        raise HTTPException(status_code=500, detail="Failed to download PDF")
    return Response(content=file_bytes, media_type="application/pdf")

@app.get("/dictionary/{word}")
async def dictionary(word: str):
    async with httpx.AsyncClient() as client:
        dict_resp, syn_resp = await asyncio.gather(
            client.get(f"https://api.dictionaryapi.dev/api/v2/entries/en/{word}"),
            client.get(f"https://api.datamuse.com/words?rel_syn={word}&max=5")
        )

    if dict_resp.status_code == 404:
        raise HTTPException(status_code=404, detail="Word not found")

    entry = dict_resp.json()[0]
    meaning = entry["meanings"][0]
    first_def = meaning["definitions"][0]

    synonyms = [s["word"] for s in syn_resp.json()] if syn_resp.status_code == 200 else []

    return {
        "word": entry.get("word", word),
        "phonetic": entry.get("phonetic", ""),
        "definition": first_def["definition"],
        "example": first_def.get("example", ""),
        "synonyms": synonyms
    }