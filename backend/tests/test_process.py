from unittest.mock import patch

SUMMARY_RESULT = {
    "summary": "A great document.",
    "quiz": [{"question": "Q?", "options": ["A) a", "B) b", "C) c", "D) d"], "answer": "A"}],
}
FLASHCARD_RESULT = {"flashcards": [{"question": "What?", "answer": "This."}]}


def test_process_document_returns_cached_result_when_cache_hit(authed_client):
    cache = {"summary": "cached summary", "quiz": [{"question": "Q?", "options": ["A) a", "B) b", "C) c", "D) d"], "answer": "A"}]}

    with patch("main.verify_document_owner", return_value=True), \
         patch("main.get_document_cache", return_value=cache):
        response = authed_client.post("/process-document", json={"document_id": "doc-1"})

    assert response.status_code == 200
    assert response.json()["summary"] == "cached summary"


def test_process_document_calls_gemini_when_no_cache(authed_client):
    with patch("main.verify_document_owner", return_value=True), \
         patch("main.get_document_cache", return_value={}), \
         patch("main.get_document_content", return_value="document text"), \
         patch("main.generate_summary_and_quiz", return_value=SUMMARY_RESULT) as mock_gen, \
         patch("main.save_document_cache", return_value=True):
        response = authed_client.post("/process-document", json={"document_id": "doc-1"})

    assert response.status_code == 200
    mock_gen.assert_called_once()


def test_process_document_returns_404_when_document_not_found(authed_client):
    with patch("main.verify_document_owner", return_value=True), \
         patch("main.get_document_cache", return_value={}), \
         patch("main.get_document_content", return_value=None):
        response = authed_client.post("/process-document", json={"document_id": "missing"})

    assert response.status_code == 404


def test_process_document_returns_500_when_generate_fails(authed_client):
    with patch("main.verify_document_owner", return_value=True), \
         patch("main.get_document_cache", return_value={}), \
         patch("main.get_document_content", return_value="text"), \
         patch("main.generate_summary_and_quiz", return_value=None):
        response = authed_client.post("/process-document", json={"document_id": "doc-1"})

    assert response.status_code == 500


def test_generate_cards_returns_cached_flashcards(authed_client):
    cache = {"flashcards": [{"question": "Q?", "answer": "A."}]}

    with patch("main.verify_document_owner", return_value=True), \
         patch("main.get_document_cache", return_value=cache):
        response = authed_client.post("/generate-cards", json={"document_id": "doc-1"})

    assert response.status_code == 200
    assert len(response.json()["flashcards"]) == 1


def test_generate_cards_calls_gemini_and_saves_cache(authed_client):
    with patch("main.verify_document_owner", return_value=True), \
         patch("main.get_document_cache", return_value={}), \
         patch("main.get_document_content", return_value="content"), \
         patch("main.generate_flashcards", return_value=FLASHCARD_RESULT) as mock_gen, \
         patch("main.save_document_cache", return_value=True):
        response = authed_client.post("/generate-cards", json={"document_id": "doc-1"})

    assert response.status_code == 200
    mock_gen.assert_called_once()


def test_generate_cards_returns_404_when_document_not_found(authed_client):
    with patch("main.verify_document_owner", return_value=True), \
         patch("main.get_document_cache", return_value={}), \
         patch("main.get_document_content", return_value=None):
        response = authed_client.post("/generate-cards", json={"document_id": "missing"})

    assert response.status_code == 404


def test_get_cache_status_returns_correct_flags(authed_client):
    cache = {"summary": "text", "quiz": [], "flashcards": None}

    with patch("main.verify_document_owner", return_value=True), \
         patch("main.get_document_cache", return_value=cache):
        response = authed_client.get("/documents/doc-1/cache-status")

    assert response.status_code == 200
    data = response.json()
    assert data["has_summary"] is True
    assert data["has_flashcards"] is False


def test_delete_summary_cache_returns_ok(authed_client):
    with patch("main.verify_document_owner", return_value=True), \
         patch("main.clear_summary_cache", return_value=True):
        response = authed_client.delete("/documents/doc-1/cache/summary")

    assert response.status_code == 200
    assert response.json() == {"ok": True}


def test_delete_flashcards_cache_returns_ok(authed_client):
    with patch("main.verify_document_owner", return_value=True), \
         patch("main.clear_flashcards_cache", return_value=True):
        response = authed_client.delete("/documents/doc-1/cache/flashcards")

    assert response.status_code == 200
    assert response.json() == {"ok": True}


# --- Auth & ownership ---

def test_process_document_requires_auth(client):
    response = client.post("/process-document", json={"document_id": "doc-1"})
    assert response.status_code == 401


def test_process_document_returns_403_for_wrong_owner(authed_client):
    with patch("main.verify_document_owner", return_value=False):
        response = authed_client.post("/process-document", json={"document_id": "doc-1"})
    assert response.status_code == 403
    assert response.json()["detail"] == "forbidden"


def test_generate_cards_requires_auth(client):
    response = client.post("/generate-cards", json={"document_id": "doc-1"})
    assert response.status_code == 401


def test_generate_cards_returns_403_for_wrong_owner(authed_client):
    with patch("main.verify_document_owner", return_value=False):
        response = authed_client.post("/generate-cards", json={"document_id": "doc-1"})
    assert response.status_code == 403
    assert response.json()["detail"] == "forbidden"


def test_get_cache_status_requires_auth(client):
    response = client.get("/documents/doc-1/cache-status")
    assert response.status_code == 401


def test_delete_summary_cache_requires_auth(client):
    response = client.delete("/documents/doc-1/cache/summary")
    assert response.status_code == 401


def test_delete_flashcards_cache_requires_auth(client):
    response = client.delete("/documents/doc-1/cache/flashcards")
    assert response.status_code == 401
