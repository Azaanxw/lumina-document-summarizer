from unittest.mock import patch
import main

REAL_USER_ID = "user-test-123"

CHUNKS = [{"content": "Paris is the capital.", "metadata": {"page_number": 1}}]
ANSWER = {"answer": "Paris", "citations": [{"page_number": 1, "snippet": "Paris is the capital."}]}


def test_ask_returns_answer_with_citations(authed_client):
    with patch("main.verify_document_owner", return_value=True), \
         patch("main.embed_texts", return_value=[[0.1] * 1536]), \
         patch("main.search_chunks", return_value=CHUNKS), \
         patch("main.generate_answer", return_value=ANSWER):
        response = authed_client.post("/ask", json={"document_id": "doc-1", "question": "Capital?"})

    assert response.status_code == 200
    data = response.json()
    assert data["answer"] == "Paris"
    assert data["citations"][0]["page_number"] == 1


def test_ask_returns_404_when_no_chunks_found(authed_client):
    with patch("main.verify_document_owner", return_value=True), \
         patch("main.embed_texts", return_value=[[0.1] * 1536]), \
         patch("main.search_chunks", return_value=[]):
        response = authed_client.post("/ask", json={"document_id": "doc-1", "question": "What?"})

    assert response.status_code == 404


def test_ask_returns_500_when_generate_answer_fails(authed_client):
    with patch("main.verify_document_owner", return_value=True), \
         patch("main.embed_texts", return_value=[[0.1] * 1536]), \
         patch("main.search_chunks", return_value=CHUNKS), \
         patch("main.generate_answer", return_value=None):
        response = authed_client.post("/ask", json={"document_id": "doc-1", "question": "What?"})

    assert response.status_code == 500


def test_ask_uses_user_id_as_rate_limit_key(authed_client):
    with patch("main.verify_document_owner", return_value=True), \
         patch("main.embed_texts", return_value=[[0.1] * 1536]), \
         patch("main.search_chunks", return_value=CHUNKS), \
         patch("main.generate_answer", return_value=ANSWER):
        authed_client.post("/ask", json={"document_id": "doc-1", "question": "Q?"})

    assert REAL_USER_ID in main._question_timestamps
    assert len(main._question_timestamps[REAL_USER_ID]) == 1


def test_ask_openai_fallback_used_when_gemini_raises(authed_client):
    from unittest.mock import MagicMock
    import json

    fallback_answer = {"answer": "Fallback answer", "citations": []}
    mock_gemini = MagicMock()
    mock_gemini.models.generate_content.side_effect = Exception("Gemini down")
    mock_openai = MagicMock()
    mock_openai.chat.completions.create.return_value = MagicMock(
        choices=[MagicMock(message=MagicMock(content=json.dumps(fallback_answer)))]
    )

    with patch("main.verify_document_owner", return_value=True), \
         patch("main.embed_texts", return_value=[[0.1] * 1536]), \
         patch("main.search_chunks", return_value=CHUNKS), \
         patch("gemini_utils.genai.Client", return_value=mock_gemini), \
         patch("gemini_utils.OpenAI", return_value=mock_openai):
        response = authed_client.post("/ask", json={"document_id": "doc-1", "question": "Q?"})

    assert response.status_code == 200
    assert response.json()["answer"] == "Fallback answer"


# --- Auth & ownership ---

def test_ask_requires_auth(client):
    response = client.post("/ask", json={"document_id": "doc-1", "question": "Q?"})
    assert response.status_code == 401


def test_ask_returns_403_for_wrong_owner(authed_client):
    with patch("main.verify_document_owner", return_value=False):
        response = authed_client.post("/ask", json={"document_id": "doc-1", "question": "Q?"})
    assert response.status_code == 403
    assert response.json()["detail"] == "forbidden"
