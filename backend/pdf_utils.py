import fitz  # PyMuPDF

def extract_text_from_pdf(file_bytes: bytes) -> str:
    """Extracts all text from a PDF file stored in memory."""
    text = ""
    try:
        # Open the PDF directly from the byte stream
        pdf_document = fitz.open(stream=file_bytes, filetype="pdf")
        
        # Loop through every page and grab the text
        for page_num in range(len(pdf_document)):
            page = pdf_document.load_page(page_num)
            text += str(page.get_text("text")) + "\n\n"
            
        pdf_document.close()
        return text.strip()
    except Exception as e:
        print(f"PDF Extraction Error: {e}")
        return ""