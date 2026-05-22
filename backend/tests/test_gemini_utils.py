import json
from unittest.mock import MagicMock, patch
from gemini_utils import generate_summary_and_quiz, generate_answer, generate_flashcards

SUMMARY_RESPONSE = {
    "summary": "Test summary.",
    "quiz": [{"question": "Q?", "options": ["A) a", "B) b", "C) c", "D) d"], "answer": "A"}],
}
FLASHCARD_RESPONSE = {"flashcards": [{"question": "What?", "answer": "This."}]}
ANSWER_RESPONSE = {"answer": "Paris", "citations": [{"page_number": 1, "snippet": "Paris is the capital."}]}


def _mock_gemini(response_dict: dict) -> MagicMock:
    mock = MagicMock()
    mock.models.generate_content.return_value = MagicMock(text=json.dumps(response_dict))
    return mock


def _mock_openai(response_dict: dict) -> MagicMock:
    mock = MagicMock()
    mock.chat.completions.create.return_value = MagicMock(
        choices=[MagicMock(message=MagicMock(content=json.dumps(response_dict)))]
    )
    return mock


def test_gemini_client_is_created_with_timeout():
    mock_constructor = MagicMock(return_value=_mock_gemini(SUMMARY_RESPONSE))
    with patch("gemini_utils.genai.Client", mock_constructor):
        generate_summary_and_quiz("document text")
    _, kwargs = mock_constructor.call_args
    assert kwargs.get("http_options") == {"timeout": 30}


def test_openai_chat_is_called_with_timeout():
    bad_gemini = MagicMock()
    bad_gemini.models.generate_content.side_effect = Exception("Gemini down")
    mock_openai = _mock_openai(SUMMARY_RESPONSE)
    with patch("gemini_utils.genai.Client", return_value=bad_gemini), \
         patch("gemini_utils.OpenAI", return_value=mock_openai):
        generate_summary_and_quiz("document text")
    call_kwargs = mock_openai.chat.completions.create.call_args.kwargs
    assert call_kwargs.get("timeout") == 30


def test_generate_summary_and_quiz_returns_dict_on_gemini_success():
    with patch("gemini_utils.genai.Client", return_value=_mock_gemini(SUMMARY_RESPONSE)):
        result = generate_summary_and_quiz("document text")
    assert result == SUMMARY_RESPONSE


def test_generate_summary_and_quiz_falls_back_to_openai_when_gemini_raises():
    bad_gemini = MagicMock()
    bad_gemini.models.generate_content.side_effect = Exception("Gemini down")

    with patch("gemini_utils.genai.Client", return_value=bad_gemini), \
         patch("gemini_utils.OpenAI", return_value=_mock_openai(SUMMARY_RESPONSE)):
        result = generate_summary_and_quiz("document text")
    assert result == SUMMARY_RESPONSE


def test_generate_summary_and_quiz_returns_none_when_both_fail():
    bad_gemini = MagicMock()
    bad_gemini.models.generate_content.side_effect = Exception("Gemini down")
    bad_openai = MagicMock()
    bad_openai.chat.completions.create.side_effect = Exception("OpenAI down")

    with patch("gemini_utils.genai.Client", return_value=bad_gemini), \
         patch("gemini_utils.OpenAI", return_value=bad_openai):
        result = generate_summary_and_quiz("document text")
    assert result is None


def test_generate_flashcards_returns_correct_structure():
    with patch("gemini_utils.genai.Client", return_value=_mock_gemini(FLASHCARD_RESPONSE)):
        result = generate_flashcards("document text")
    assert result is not None
    assert result == FLASHCARD_RESPONSE
    assert result["flashcards"][0]["question"] == "What?"


def test_generate_answer_returns_answer_and_citations():
    chunks = [{"content": "Paris is the capital.", "metadata": {"page_number": 1}}]
    with patch("gemini_utils.genai.Client", return_value=_mock_gemini(ANSWER_RESPONSE)):
        result = generate_answer("What is the capital?", chunks)
    assert result is not None
    assert result["answer"] == "Paris"
    assert result["citations"][0]["page_number"] == 1


def test_generate_answer_passes_page_context_in_prompt():
    chunks = [{"content": "Some fact.", "metadata": {"page_number": 5}}]
    mock_client = _mock_gemini(ANSWER_RESPONSE)

    with patch("gemini_utils.genai.Client", return_value=mock_client):
        generate_answer("Question?", chunks)

    call_args = mock_client.models.generate_content.call_args
    # prompt is passed as the 'contents' keyword arg
    prompt = call_args.kwargs.get("contents", "") or str(call_args)
    assert "[Page 5]" in prompt
