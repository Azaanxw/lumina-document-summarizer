import logging
import fitz  # PyMuPDF
from langchain_text_splitters import RecursiveCharacterTextSplitter  # pyright: ignore[reportMissingImports]

logger = logging.getLogger(__name__)


def get_page_count(file_bytes: bytes) -> int:
    try:
        pdf_document = fitz.open(stream=file_bytes, filetype="pdf")
        count = len(pdf_document)
        pdf_document.close()
        return count
    except Exception:
        return 0


def extract_text_from_pdf(file_bytes: bytes) -> str:
    """Extracts all text from a PDF file stored in memory."""
    text = ""
    try:
        pdf_document = fitz.open(stream=file_bytes, filetype="pdf")
        for page_num in range(len(pdf_document)):
            page = pdf_document.load_page(page_num)
            text += str(page.get_text("text")) + "\n\n"
        pdf_document.close()
        return text.strip()
    except Exception as e:
        logger.error(f"PDF Extraction Error: {e}")
        return ""

def extract_chunks_from_pdf(file_bytes: bytes) -> list[dict]:
    """Extracts page-anchored chunks from a PDF. No chunk spans more than one page."""
    splitter = RecursiveCharacterTextSplitter(chunk_size=600, chunk_overlap=100)
    chunks = []
    try:
        pdf_document = fitz.open(stream=file_bytes, filetype="pdf")
        for page_num in range(len(pdf_document)):
            page_text = str(pdf_document.load_page(page_num).get_text("text")).strip()
            if not page_text:
                continue
            for chunk_text in splitter.split_text(page_text):
                chunks.append({
                    "content": chunk_text,
                    "metadata": {"page_number": page_num + 1}
                })
        pdf_document.close()
    except Exception as e:
        logger.error(f"PDF Chunking Error: {e}")
    return chunks