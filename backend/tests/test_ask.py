from unittest.mock import patch
import main

REAL_USER_ID = "user-test-123"

CHUNKS = [{"content": "Paris is the capital.", "metadata": {"page_number": 1}}]
ANSWER = {"answer": "Paris", "citations": [{"page_number": 1, "snippet": "Paris is the capital."}]}


def test_ask_returns_answer_with_citations(client):
    with patch("main.embed_texts", return_value=[[0.1] * 1536]), \
         patch("main.search_chunks", return_value=CHUNKS), \
         patch("main.generate_answer", return_value=ANSWER):
        response = client.post("/ask", json={"document_id": "doc-1", "question": "Capital?"})

    assert response.status_code == 200
    data = response.json()
    assert data["answer"] == "Paris"
    assert data["citations"][0]["page_number"] == 1


def test_ask_returns_404_when_no_chunks_found(client):
    with patch("main.embed_texts", return_value=[[0.1] * 1536]), \
         patch("main.search_chunks", return_value=[]):
        response = client.post("/ask", json={"document_id": "doc-1", "question": "What?"})

    assert response.status_code == 404


def test_ask_returns_500_when_generate_answer_fails(client):
    with patch("main.embed_texts", return_value=[[0.1] * 1536]), \
         patch("main.search_chunks", return_value=CHUNKS), \
         patch("main.generate_answer", return_value=None):
        response = client.post("/ask", json={"document_id": "doc-1", "question": "What?"})

    assert response.status_code == 500


def test_ask_uses_document_id_as_rate_limit_key_for_unauthenticated(client):
    with patch("main.embed_texts", return_value=[[0.1] * 1536]), \
         patch("main.search_chunks", return_value=CHUNKS), \
         patch("main.generate_answer", return_value=ANSWER):
        client.post("/ask", json={"document_id": "key-doc", "question": "Q?"})

    assert "key-doc" in main._question_timestamps
    assert len(main._question_timestamps["key-doc"]) == 1


def test_ask_uses_user_id_as_rate_limit_key_for_authenticated(authed_client):
    with patch("main.embed_texts", return_value=[[0.1] * 1536]), \
         patch("main.search_chunks", return_value=CHUNKS), \
         patch("main.generate_answer", return_value=ANSWER):
        authed_client.post("/ask", json={"document_id": "doc-1", "question": "Q?"})

    assert REAL_USER_ID in main._question_timestamps
    assert len(main._question_timestamps[REAL_USER_ID]) == 1


def test_ask_openai_fallback_used_when_gemini_raises(client):
    from unittest.mock import MagicMock
    import json

    fallback_answer = {"answer": "Fallback answer", "citations": []}
    mock_gemini = MagicMock()
    mock_gemini.models.generate_content.side_effect = Exception("Gemini down")
    mock_openai = MagicMock()
    mock_openai.chat.completions.create.return_value = MagicMock(
        choices=[MagicMock(message=MagicMock(content=json.dumps(fallback_answer)))]
    )

    with patch("main.embed_texts", return_value=[[0.1] * 1536]), \
         patch("main.search_chunks", return_value=CHUNKS), \
         patch("gemini_utils.genai.Client", return_value=mock_gemini), \
         patch("gemini_utils.OpenAI", return_value=mock_openai):
        response = client.post("/ask", json={"document_id": "doc-1", "question": "Q?"})

    assert response.status_code == 200
    assert response.json()["answer"] == "Fallback answer"
