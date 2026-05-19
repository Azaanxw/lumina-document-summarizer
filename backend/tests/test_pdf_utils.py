import pytest
import fitz  # PyMuPDF
from pdf_utils import extract_text_from_pdf, extract_chunks_from_pdf


@pytest.fixture
def simple_pdf_bytes():
    doc = fitz.open()
    page = doc.new_page()
    page.insert_text((72, 72), "Hello world. This is test content for PDF extraction.")
    return doc.tobytes()


@pytest.fixture
def two_page_pdf_bytes():
    doc = fitz.open()
    for i in range(2):
        page = doc.new_page()
        page.insert_text((72, 72), f"Page {i + 1} content. " * 20)
    return doc.tobytes()


def test_extract_text_returns_string_for_valid_pdf(simple_pdf_bytes):
    result = extract_text_from_pdf(simple_pdf_bytes)
    assert isinstance(result, str)
    assert "Hello" in result


def test_extract_chunks_returns_list_of_dicts_for_valid_pdf(simple_pdf_bytes):
    result = extract_chunks_from_pdf(simple_pdf_bytes)
    assert isinstance(result, list)
    assert len(result) > 0


def test_chunks_have_content_and_metadata_with_page_number(simple_pdf_bytes):
    result = extract_chunks_from_pdf(simple_pdf_bytes)
    for chunk in result:
        assert "content" in chunk
        assert "metadata" in chunk
        assert "page_number" in chunk["metadata"]
        assert chunk["metadata"]["page_number"] >= 1


def test_no_chunk_spans_multiple_pages(two_page_pdf_bytes):
    result = extract_chunks_from_pdf(two_page_pdf_bytes)
    assert len(result) > 0
    page_numbers = {chunk["metadata"]["page_number"] for chunk in result}
    assert page_numbers.issubset({1, 2})


def test_extract_text_returns_empty_for_invalid_bytes():
    result = extract_text_from_pdf(b"not a pdf")
    assert result == ""


def test_extract_chunks_returns_empty_for_invalid_bytes():
    result = extract_chunks_from_pdf(b"not a pdf")
    assert result == []
