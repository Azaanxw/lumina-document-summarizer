from unittest.mock import patch

SUMMARY_RESULT = {
    "summary": "A great document.",
    "quiz": [{"question": "Q?", "options": ["A) a", "B) b", "C) c", "D) d"], "answer": "A"}],
}
FLASHCARD_RESULT = {"flashcards": [{"question": "What?", "answer": "This."}]}


def test_process_document_returns_cached_result_when_cache_hit(client):
    cache = {"summary": "cached summary", "quiz": [{"question": "Q?", "options": ["A) a", "B) b", "C) c", "D) d"], "answer": "A"}]}

    with patch("main.get_document_cache", return_value=cache):
        response = client.post("/process-document", json={"document_id": "doc-1"})

    assert response.status_code == 200
    assert response.json()["summary"] == "cached summary"


def test_process_document_calls_gemini_when_no_cache(client):
    with patch("main.get_document_cache", return_value={}), \
         patch("main.get_document_content", return_value="document text"), \
         patch("main.generate_summary_and_quiz", return_value=SUMMARY_RESULT) as mock_gen, \
         patch("main.save_document_cache", return_value=True):
        response = client.post("/process-document", json={"document_id": "doc-1"})

    assert response.status_code == 200
    mock_gen.assert_called_once()


def test_process_document_returns_404_when_document_not_found(client):
    with patch("main.get_document_cache", return_value={}), \
         patch("main.get_document_content", return_value=None):
        response = client.post("/process-document", json={"document_id": "missing"})

    assert response.status_code == 404


def test_process_document_returns_500_when_generate_fails(client):
    with patch("main.get_document_cache", return_value={}), \
         patch("main.get_document_content", return_value="text"), \
         patch("main.generate_summary_and_quiz", return_value=None):
        response = client.post("/process-document", json={"document_id": "doc-1"})

    assert response.status_code == 500


def test_generate_cards_returns_cached_flashcards(client):
    cache = {"flashcards": [{"question": "Q?", "answer": "A."}]}

    with patch("main.get_document_cache", return_value=cache):
        response = client.post("/generate-cards", json={"document_id": "doc-1"})

    assert response.status_code == 200
    assert len(response.json()["flashcards"]) == 1


def test_generate_cards_calls_gemini_and_saves_cache(client):
    with patch("main.get_document_cache", return_value={}), \
         patch("main.get_document_content", return_value="content"), \
         patch("main.generate_flashcards", return_value=FLASHCARD_RESULT) as mock_gen, \
         patch("main.save_document_cache", return_value=True):
        response = client.post("/generate-cards", json={"document_id": "doc-1"})

    assert response.status_code == 200
    mock_gen.assert_called_once()


def test_generate_cards_returns_404_when_document_not_found(client):
    with patch("main.get_document_cache", return_value={}), \
         patch("main.get_document_content", return_value=None):
        response = client.post("/generate-cards", json={"document_id": "missing"})

    assert response.status_code == 404


def test_get_cache_status_returns_correct_flags(client):
    cache = {"summary": "text", "quiz": [], "flashcards": None}

    with patch("main.get_document_cache", return_value=cache):
        response = client.get("/documents/doc-1/cache-status")

    assert response.status_code == 200
    data = response.json()
    assert data["has_summary"] is True
    assert data["has_flashcards"] is False


def test_delete_summary_cache_returns_ok(client):
    with patch("main.clear_summary_cache", return_value=True):
        response = client.delete("/documents/doc-1/cache/summary")

    assert response.status_code == 200
    assert response.json() == {"ok": True}


def test_delete_flashcards_cache_returns_ok(client):
    with patch("main.clear_flashcards_cache", return_value=True):
        response = client.delete("/documents/doc-1/cache/flashcards")

    assert response.status_code == 200
    assert response.json() == {"ok": True}
