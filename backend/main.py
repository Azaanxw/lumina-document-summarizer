from fastapi import FastAPI, UploadFile, File, HTTPException
from s3_utils import upload_to_s3
from dotenv import load_dotenv

load_dotenv()
app = FastAPI()

@app.post("/upload")
async def upload_pdf(file: UploadFile = File(...)):
    # 1. Validation: Only allow PDFs
    if file.content_type != "application/pdf":
        raise HTTPException(status_code=400, detail="Only PDF files are allowed")

    # 2. Upload to S3
    file_url = await upload_to_s3(file.file, file.filename)
    
    if not file_url:
        raise HTTPException(status_code=500, detail="Failed to upload to S3")

    return {"message": "Success", "url": file_url}